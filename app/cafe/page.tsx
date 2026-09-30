'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCafeStore } from '@/store/cafeStore'
import CafeView from '@/components/CafeView'
import AttackAlert from '@/components/cafe/AttackAlert'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Coins, Users } from 'lucide-react'
import { formatCafeMoney, formatTime, MENU_ITEMS, type CafePlayerMeta } from '@/lib/game/cafe'
import { useGameBase } from '@/hooks/useGameBase'
import { CAFE_ITEMS, type ItemId } from '@/lib/game/cafeItems'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import PixelIcon from '@/components/ui/PixelIcon'
import CafeImage from '@/components/cafe/CafeImage'

type CafeViewType = 'lobby' | 'playing' | 'result'

export default function CafePage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    room,
    roomLoading,
    playersLoading,
    players,
    currentPlayer,
    currentQuestion,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    isPreStartQuizComplete,
    checkAnswer,
    handlePreStartQuizAnswer,
    goToNextQuestion,
    consecutiveCorrect,
    sendRoomEvent,
    commitPlayerPatch,
    playBGM,
    playSFX,
  } = useGameBase({ expectedGameMode: 'cafe', preStartQuizTotal: 0 })

  // 게임 시간은 선생님이 정한다(room.duration_seconds). 학생은 선택하지 않는다.
  const gameDuration = room?.duration_seconds ?? 420
  const [incomingAttack, setIncomingAttack] = useState<{
    id: number
    attackerNickname: string
    itemName: string
    itemEmoji: string
    itemImage: string
    detail?: string
  } | null>(null)
  // 배너를 지우는 타이머. 3초 안에 또 공격받으면 앞 타이머가 새 배너를 일찍 지우지 않게 바꿔 단다.
  const attackBannerTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isPaused = room?.status === 'paused'
  const scoreSyncTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 0.5초 모으는 동안 아직 안 보낸 점수. 화면을 떠날 때 버리지 않고 바로 보낸다.
  const pendingScoreRef = useRef<{ playerId: string; cash: number } | null>(null)
  const commitPlayerPatchRef = useRef(commitPlayerPatch)
  useEffect(() => {
    commitPlayerPatchRef.current = commitPlayerPatch
  }, [commitPlayerPatch])
  // 선생님이 게임을 끝낸 뒤 늦게 도착한 공격(특히 세금)이 최종 금액을 바꾸지 않게 한다
  const roomStatusRef = useRef(room?.status)
  useEffect(() => {
    roomStatusRef.current = room?.status
  }, [room?.status])

  const {
    status,
    cash,
    totalCashEarned,
    customersServed,
    stats,
    unlockedMenus,
    taxFreeUntil,
    startGame,
    resetGame,
    applyBuff,
    removeHalfCustomers,
    clearCustomers,
    discardHalfStock,
    receiveTax,
  } = useCafeStore()

  // 선생님이 시작(room.status='playing')하면 카페 게임을 시작한다.
  // 게임 시간은 선생님이 정한 room.duration_seconds(gameDuration)를 사용한다.
  // 여기서는 스토어만 시작(startGame)하고, 화면 전환은 아래 별도 effect가 스토어
  // status를 보고 처리한다(시작 로직과 뷰 전환의 책임 분리).
  useEffect(() => {
    if (room?.status === 'playing') {
      if (!isPreStartQuizComplete) return
      if (status !== 'playing' && status !== 'ended') {
        startGame(gameDuration)
      }
    } else if (room?.status === 'finished' && currentView !== 'result') {
      setCurrentView('result')
    } else if (room?.status === 'waiting' && currentView !== 'lobby') {
      resetGame()
      setCurrentView('lobby')
    }
  }, [isPreStartQuizComplete, room?.status, currentView, status, startGame, resetGame, gameDuration, setCurrentView])

  // 스토어 상태에 따라 화면 전환
  useEffect(() => {
    if (status === 'playing' && currentView !== 'playing' && currentView !== 'result') {
      setCurrentView('playing')
    } else if (status === 'ended' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [status, currentView, setCurrentView])

  // 시간이 끝나면 useGameBase가 곧바로 결과 페이지로 보내 이 화면이 사라진다.
  // 그때 모으던 점수를 버리면 마지막 0.5초 동안의 서빙·구매·세금이 순위에 안 들어가므로 바로 보낸다.
  useEffect(() => {
    return () => {
      if (attackBannerTimerRef.current) clearTimeout(attackBannerTimerRef.current)
      if (scoreSyncTimerRef.current) clearTimeout(scoreSyncTimerRef.current)
      const pending = pendingScoreRef.current
      pendingScoreRef.current = null
      if (pending) {
        void commitPlayerPatchRef.current(pending.playerId, {
          score: pending.cash,
          cafe_cash: pending.cash,
        }, 'cafe_score_update')
      }
    }
  }, [])

  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'cafe:item_attack') return

      const payload = event.payload as {
        attackerNickname?: string
        targetId?: string
        itemId?: ItemId
        duration?: number
      } | undefined

      if (!payload?.itemId || payload.targetId !== playerId) return
      if (roomStatusRef.current === 'finished') return

      const item = CAFE_ITEMS[payload.itemId]
      if (!item) return
      let detail: string | undefined = item.victimText

      switch (payload.itemId) {
        case 'BAD_REVIEW':
          // 줄 선 손님이 모두 떠나고, 지속 시간 동안 새 손님이 안 온다.
          // (예전에는 새 손님만 막았는데, 손님 줄이 15초 인내심으로 이미 차 있어 티가 안 났다)
          applyBuff(payload.itemId, payload.duration ?? item.duration)
          clearCustomers()
          break
        case 'PRICE_CRASH':
          applyBuff(payload.itemId, payload.duration ?? item.duration)
          break
        case 'ROACH_ALERT':
          // 손님 절반이 도망가고 재고도 절반 버려진다.
          // (손님만 줄이면 2초 만에 줄이 다시 차서 아무 효과가 없었다)
          removeHalfCustomers()
          discardHalfStock()
          break
        case 'TAX': {
          // 가진 돈의 일부가 사라진다. 방금 세금을 냈으면(면제 중) 이번 세금은 걷히지 않는다.
          const result = receiveTax()
          detail = !result
            ? '세금 면제 중이라 안 냈어요'
            : result.paid > 0
              ? `세금 ${formatCafeMoney(result.paid)}을 냈어요`
              : '낼 돈이 없어서 세금을 안 냈어요'
          break
        }
      }

      setIncomingAttack({
        id: Date.now(),
        attackerNickname: payload.attackerNickname || '상대',
        itemName: item.name,
        itemEmoji: item.emoji,
        itemImage: item.image,
        detail,
      })
      if (attackBannerTimerRef.current) clearTimeout(attackBannerTimerRef.current)
      attackBannerTimerRef.current = setTimeout(() => setIncomingAttack(null), 3000)
    })
  }, [applyBuff, clearCustomers, discardHalfStock, playerId, receiveTax, removeHalfCustomers])

  // 내가 연 메뉴와 세금 면제 시각을 플레이어 행(active_item)에 실어 둔다.
  // 카피캣은 1등의 메뉴를, 세금은 면제 중인 친구를 알아야 한다.
  useEffect(() => {
    if (!playerId || status !== 'playing') return
    const meta: CafePlayerMeta = { unlockedMenus, taxFreeUntil }
    void commitPlayerPatch(playerId, { active_item: meta }, 'cafe_menus_update').catch(() => {
      // 동기화 실패는 게임 진행에 영향 없음(카피캣·세금 대상 표시만 최신 정보를 못 볼 뿐)
    })
  }, [commitPlayerPatch, playerId, status, taxFreeUntil, unlockedMenus])

  const handleAnswer = useCallback(async (answer: string) => {
    return checkAnswer(answer)
  }, [checkAnswer])

  // 카페는 퀴즈/아이템 UI를 CafeView 내부 상태로 직접 관리한다.
  // useGameBase의 goToNextQuestion은 공용 뷰를 'quiz'로 바꾸는데, 카페 페이지는
  // 'lobby' | 'playing' | 'result'만 렌더하므로 'quiz'가 되면 손님·접시가 모두 사라지고
  // 빈 카페 배경만 남는다. 다음 문제로 넘어간 직후 다시 'playing' 뷰로 되돌린다.
  const handleNextQuestion = useCallback(() => {
    goToNextQuestion()
    setCurrentView('playing')
  }, [goToNextQuestion, setCurrentView])

  const handleSendCafeEvent = useCallback(async (type: 'cafe:item_attack', payload: unknown) => {
    const eventPayload = payload as Record<string, unknown>
    await sendRoomEvent(type, {
      ...eventPayload,
      attackerNickname: currentPlayer?.nickname,
    })
  }, [currentPlayer?.nickname, sendRoomEvent])

  // 순위는 "끝났을 때 가진 돈"이다. 벌 때뿐 아니라 메뉴·업그레이드를 사거나 세금을 낼 때도
  // 가진 돈이 바뀌므로, 서빙 시점이 아니라 cash가 바뀔 때마다 보낸다(0.5초 모아서).
  useEffect(() => {
    if (!playerId) return
    if (status !== 'playing' && status !== 'ended') return
    // 막 시작해 아직 번 돈이 없는 상태는 보내지 않는다 (새로고침 직후 점수를 0으로 덮지 않게)
    if (cash === 0 && totalCashEarned === 0) return

    if (scoreSyncTimerRef.current) {
      clearTimeout(scoreSyncTimerRef.current)
    }

    // commitPlayerPatch는 채널이 다시 붙을 때마다 새 함수가 되므로 ref로 부른다 (의존성에 넣으면 타이머가 계속 밀린다)
    pendingScoreRef.current = { playerId, cash }
    scoreSyncTimerRef.current = setTimeout(() => {
      pendingScoreRef.current = null
      void commitPlayerPatchRef.current(playerId, {
        score: cash,
        cafe_cash: cash,
      }, 'cafe_score_update')
    }, 500)
  }, [cash, playerId, status, totalCashEarned])

  // 가장 많이 판 메뉴 찾기
  const topMenuEntry = Object.entries(stats.menuSales).sort((a, b) => b[1] - a[1])[0]
  const topMenuName = topMenuEntry
    ? MENU_ITEMS.find((m) => m.id === topMenuEntry[0])?.name || '없음'
    : '없음'
  const topMenuCount = topMenuEntry ? topMenuEntry[1] : 0

  return (
    <div className="cafe-ambient min-h-dvh relative overflow-hidden font-bitbit">
      <AttackAlert attack={incomingAttack} />
      {shouldShowPreStartQuiz && (
        <PreStartQuizGate
          question={preStartQuizQuestion}
          submittedCount={preStartSubmittedCount}
          total={preStartQuizTotal}
          onAnswer={handlePreStartQuizAnswer}
          questionsLoading={questionsLoading}
          questionsError={questionsError}
        />
      )}

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-dvh flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-2xl border-4 border-amber-300 shadow-2xl bg-white/95">
              <CardHeader className="text-center pb-4">
                <div className="mb-4 flex justify-center">
                  <CafeImage
                    src="/cafe-items/cafe-logo.webp"
                    alt=""
                    width={80}
                    height={80}
                    className="h-20 w-20 object-contain"
                    fallbackEmoji="☕"
                    fallbackClassName="h-20 w-20 text-6xl"
                  />
                </div>
                <CardTitle className="text-4xl font-bold text-gray-900 mb-2">
                  달콤 바삭 카페
                </CardTitle>
                <p className="text-lg text-gray-600">
                  손님에게 음식을 서빙하고 카페를 성장시키세요!
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 선생님이 정한 게임 시간 안내 (학생은 선택 불가) */}
                <div className="flex items-center justify-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-4">
                  <PixelIcon name="time" size={28} alt="" />
                  <span className="text-lg font-semibold text-gray-700">게임 시간</span>
                  <span className="text-2xl font-bold text-amber-700">{formatTime(gameDuration)}</span>
                </div>

                {/* 게임 설명 */}
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200">
                  <h3 className="font-bold text-lg mb-2 text-gray-900">게임 방법</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• 손님이 주문한 메뉴를 클릭해서 서빙하세요</li>
                    <li>• 돈을 모아 새로운 메뉴 잠금을 해제하고 업그레이드를 구매하세요</li>
                    <li>• 끝났을 때 돈을 가장 많이 가진 사람이 1등이에요!</li>
                  </ul>
                </div>

                {/* 시작은 선생님이 한다. 학생은 대기만. */}
                <div className="flex flex-col items-center gap-3 rounded-xl border-4 border-dashed border-amber-300 bg-white/60 py-6">
                  <PixelIcon name="waiting" size={48} alt="" className="animate-pulse" />
                  <p className="text-lg font-bold text-gray-700">선생님이 시작하면 자동으로 시작돼요</p>
                  <p className="text-sm text-gray-500">잠시만 기다려 주세요</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentView === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-dvh"
          >
            <CafeView
              onGameEnd={() => setCurrentView('result')}
              questionSetTitle={questionSetTitle}
              roomCode={roomCode}
              currentQuestion={currentQuestion}
              onAnswer={handleAnswer}
              onNextQuestion={handleNextQuestion}
              players={players}
              currentPlayerId={playerId}
              consecutiveCorrect={consecutiveCorrect}
              onSendEvent={handleSendCafeEvent}
              paused={isPaused}
            />
          </motion.div>
        )}

        {currentView === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="min-h-dvh flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-3xl border-4 border-amber-300 shadow-2xl bg-white/95">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-4xl font-bold text-gray-900 mb-2">
                  게임 종료!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 통계 — 첫 칸(가진 돈)이 순위 기준, 총 번 돈은 참고용 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-xl p-4 border-4 border-green-300 text-center">
                    <Coins className="h-8 w-8 mx-auto mb-2 text-green-700" />
                    <div className="text-2xl font-bold text-green-900">
                      {formatCafeMoney(cash)}
                    </div>
                    <div className="text-sm text-green-700 mt-1">가진 돈 (순위 기준)</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl p-4 border-4 border-amber-300 text-center">
                    <PixelIcon name="gold" size={32} alt="" className="mx-auto mb-2" />
                    <div className="text-2xl font-bold text-amber-900">
                      {formatCafeMoney(totalCashEarned)}
                    </div>
                    <div className="text-sm text-amber-700 mt-1">총 번 돈</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-4 border-4 border-blue-300 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-700" />
                    <div className="text-2xl font-bold text-blue-900">{customersServed}</div>
                    <div className="text-sm text-blue-700 mt-1">서빙한 손님</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-4 border-4 border-orange-300 text-center">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-700" />
                    <div className="text-2xl font-bold text-orange-900">{topMenuName}</div>
                    <div className="text-sm text-orange-700 mt-1">
                      인기 메뉴{topMenuCount > 0 ? ` · ${topMenuCount}회` : ''}
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </div>
  )
}
