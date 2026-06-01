'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCafeStore } from '@/store/cafeStore'
import CafeView from '@/components/CafeView'
import AttackAlert from '@/components/cafe/AttackAlert'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { Button } from '@/components/ui/button'
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
  } = useGameBase({ expectedGameMode: 'cafe' })

  const [selectedDuration, setSelectedDuration] = useState(420) // 7분 기본값
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

  // room 상태가 'playing'이 되면 자동으로 게임 시작
  useEffect(() => {
    if (room?.status === 'playing') {
      if (!isPreStartQuizComplete) return
      if (status !== 'playing' && status !== 'ended') {
        startGame(selectedDuration)
      }
      if (currentView !== 'playing' && currentView !== 'result') {
        setCurrentView('playing')
      }
    } else if (room?.status === 'finished' && currentView !== 'result') {
      setCurrentView('result')
    } else if (room?.status === 'waiting' && currentView !== 'lobby') {
      resetGame()
      setCurrentView('lobby')
    }
  }, [isPreStartQuizComplete, room?.status, currentView, status, startGame, resetGame, selectedDuration, setCurrentView])

  // 게임 상태 동기화
  useEffect(() => {
    if (status === 'playing' && currentView !== 'playing' && isPreStartQuizComplete) {
      setCurrentView('playing')
    } else if (status === 'ended' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [isPreStartQuizComplete, status, currentView, setCurrentView])

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

  const handleStartGame = () => {
    startGame(selectedDuration)
    setCurrentView('playing')
  }

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
                {/* 게임 시간 선택 */}
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-3">
                    <Clock className="inline mr-2 h-5 w-5" />
                    게임 시간 선택
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { minutes: 3, seconds: 180, label: '3분' },
                      { minutes: 7, seconds: 420, label: '7분' },
                      { minutes: 10, seconds: 600, label: '10분' },
                    ].map((option) => (
                      <button
                        key={option.seconds}
                        onClick={() => setSelectedDuration(option.seconds)}
                        className={`p-4 rounded-xl border-4 transition-all ${selectedDuration === option.seconds
                            ? 'border-amber-500 bg-amber-100 scale-105'
                            : 'border-gray-300 bg-gray-50 hover:border-amber-300'
                          }`}
                      >
                        <div className="text-2xl font-bold text-gray-900">{option.label}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {formatTime(option.seconds)}
                        </div>
                      </button>
                    ))}
                  </div>
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

                {/* 시작 버튼 */}
                <Button
                  onClick={handleStartGame}
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xl py-6 shadow-xl border-4 border-white"
                >
                  🎮 게임 시작하기
                </Button>
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
              onNextQuestion={goToNextQuestion}
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
