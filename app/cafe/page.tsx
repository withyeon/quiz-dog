'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCafeStore } from '@/store/cafeStore'
import CafeView from '@/components/CafeView'
import AttackAlert from '@/components/cafe/AttackAlert'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Clock, Coins, Users } from 'lucide-react'
import { formatCafeMoney, formatTime, MENU_ITEMS } from '@/lib/game/cafe'
import { useGameBase } from '@/hooks/useGameBase'
import { CAFE_ITEMS, type ItemId } from '@/lib/game/cafeItems'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'

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
    attackerNickname: string
    itemName: string
    itemEmoji: string
  } | null>(null)
  const isPaused = room?.status === 'paused'
  const scoreSyncTimerRef = useRef<NodeJS.Timeout | null>(null)

  const {
    status,
    totalCashEarned,
    customersServed,
    stats,
    startGame,
    resetGame,
    applyBuff,
    removeHalfCustomers,
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

  useEffect(() => {
    return () => {
      if (scoreSyncTimerRef.current) clearTimeout(scoreSyncTimerRef.current)
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

      const item = CAFE_ITEMS[payload.itemId]
      setIncomingAttack({
        attackerNickname: payload.attackerNickname || '상대',
        itemName: item.name,
        itemEmoji: item.emoji,
      })
      setTimeout(() => setIncomingAttack(null), 3000)

      switch (payload.itemId) {
        case 'BAD_REVIEW':
        case 'PRICE_CRASH':
          applyBuff(payload.itemId, payload.duration ?? item.duration)
          break
        case 'ROACH_ALERT':
          removeHalfCustomers()
          break
      }
    })
  }, [applyBuff, playerId, removeHalfCustomers])

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

  const syncScore = useCallback((totalCash: number) => {
    if (!playerId) return

    if (scoreSyncTimerRef.current) {
      clearTimeout(scoreSyncTimerRef.current)
    }

    scoreSyncTimerRef.current = setTimeout(() => {
      void commitPlayerPatch(playerId, {
        score: totalCash,
        cafe_cash: totalCash,
      }, 'cafe_score_update')
    }, 500)
  }, [commitPlayerPatch, playerId])

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
            <Card className="w-full max-w-2xl border-4 border-amber-300 shadow-2xl bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <div className="text-6xl mb-4">☕</div>
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
                  <Clock className="h-6 w-6 text-amber-600" />
                  <span className="text-lg font-semibold text-gray-700">게임 시간</span>
                  <span className="text-2xl font-bold text-amber-700">{formatTime(gameDuration)}</span>
                </div>

                {/* 게임 설명 */}
                <div className="bg-amber-50 rounded-xl p-4 border-2 border-amber-200">
                  <h3 className="font-bold text-lg mb-2 text-gray-900">게임 방법</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• 손님이 주문한 메뉴를 클릭해서 서빙하세요</li>
                    <li>• 돈을 모아 새로운 메뉴 잠금을 해제하고 업그레이드를 구매하세요</li>
                    <li>• 시간 내에 가장 많은 돈을 벌어보세요!</li>
                  </ul>
                </div>

                {/* 시작은 선생님이 한다. 학생은 대기만. */}
                <div className="flex flex-col items-center gap-3 rounded-xl border-4 border-dashed border-amber-300 bg-white/60 py-6">
                  <div className="text-4xl animate-pulse">⏳</div>
                  <p className="text-lg font-bold text-gray-700">선생님이 시작하면 자동으로 시작돼요</p>
                  <p className="text-sm text-gray-500">잠시만 기다려 주세요…</p>
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
              roomCode={roomCode}
              currentQuestion={currentQuestion}
              onAnswer={handleAnswer}
              onNextQuestion={handleNextQuestion}
              players={players}
              currentPlayerId={playerId}
              consecutiveCorrect={consecutiveCorrect}
              onSendEvent={handleSendCafeEvent}
              onScoreChange={syncScore}
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
            <Card className="w-full max-w-3xl border-4 border-amber-300 shadow-2xl bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-4xl font-bold text-gray-900 mb-2">
                  게임 종료!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-xl p-4 border-4 border-green-300 text-center">
                    <Coins className="h-8 w-8 mx-auto mb-2 text-green-700" />
                    <div className="text-2xl font-bold text-green-900">
                      {formatCafeMoney(totalCashEarned)}
                    </div>
                    <div className="text-sm text-green-700 mt-1">총 수익</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl p-4 border-4 border-blue-300 text-center">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-700" />
                    <div className="text-2xl font-bold text-blue-900">{customersServed}</div>
                    <div className="text-sm text-blue-700 mt-1">서빙한 손님</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl p-4 border-4 border-purple-300 text-center">
                    <Trophy className="h-8 w-8 mx-auto mb-2 text-purple-700" />
                    <div className="text-2xl font-bold text-purple-900">{topMenuName}</div>
                    <div className="text-sm text-purple-700 mt-1">인기 메뉴</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl p-4 border-4 border-orange-300 text-center">
                    <div className="text-2xl font-bold text-orange-900">{topMenuCount}회</div>
                    <div className="text-sm text-orange-700 mt-1">판매 횟수</div>
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
