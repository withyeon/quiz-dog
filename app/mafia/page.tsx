'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import MafiaView from '@/components/MafiaView'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import Countdown from '@/components/Countdown'
import GameResult from '@/components/GameResult'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Clock, Users } from 'lucide-react'
import { formatTime } from '@/lib/game/mafia'
import { useGameBase } from '@/hooks/useGameBase'

export default function MafiaPage() {
  const router = useRouter()
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    room,
    roomLoading,
    playersLoading,
    players,
    currentQuestion,
    questionsLoading,
    questionsError,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    playBGM,
    playSFX,
    handlePreStartQuizAnswer,
    handleCountdownComplete,
    showCountdown,
    checkAnswer,
    goToNextQuestion,
    commitPlayerPatch,
    sendRoomEvent,
    finishGame,
    isRoomHost,
  } = useGameBase({ expectedGameMode: 'mafia', preStartQuizTotal: 0 })

  const [remainingTime, setRemainingTime] = useState(room?.duration_seconds ?? 420)
  const hasFinishedRef = useRef(false)
  const duration = room?.duration_seconds ?? 420

  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && !shouldShowPreStartQuiz) {
      setCurrentView('quiz')
      playBGM('game')
    }
  }, [currentView, playBGM, room?.status, setCurrentView, shouldShowPreStartQuiz])

  useEffect(() => {
    if (room?.status !== 'playing' || !room.started_at) {
      hasFinishedRef.current = false
      return
    }

    const startedAt = new Date(room.started_at).getTime()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const nextRemaining = Math.max(0, duration - elapsed)
      setRemainingTime(nextRemaining)
      if (nextRemaining <= 0 && isRoomHost && !hasFinishedRef.current) {
        hasFinishedRef.current = true
        void finishGame()
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [duration, finishGame, isRoomHost, room?.started_at, room?.status])

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [players],
  )
  const currentPlayerRank = sortedPlayers.findIndex((player) => player.id === playerId) + 1

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-xl font-bold text-yellow-300">
        방 코드와 플레이어 ID가 필요합니다.
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-xl font-bold text-yellow-300">
        마피아 조직원 불러오는 중...
      </div>
    )
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-gray-900 via-black to-gray-900" style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}>
      <AnimatedBackground />

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

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 flex min-h-dvh items-center justify-center p-4"
          >
            <Card className="w-full max-w-2xl border-4 border-yellow-600 bg-black/90 shadow-2xl backdrop-blur-sm">
              <CardHeader className="pb-4 text-center">
                <div className="mb-4 flex justify-center">
                  <Image src="/title/mafia.svg" alt="쉿! 마피아" width={520} height={180} className="h-28 w-auto max-w-full object-contain" priority />
                </div>
                <CardTitle className="mb-2 text-4xl font-bold text-yellow-400">
                  친구를 속이고, 조사하고, 금고를 터세요
                </CardTitle>
                <p className="text-xl text-gray-300">
                  선생님이 시작하면 각자 입장해서 바로 플레이합니다.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border-2 border-yellow-600 bg-gray-800/50 p-4 text-center">
                    <Clock className="mx-auto mb-2 h-8 w-8 text-yellow-400" />
                    <div className="text-3xl font-bold text-yellow-400">{formatTime(duration)}</div>
                    <div className="mt-1 text-base text-gray-400">제한 시간</div>
                  </div>
                  <div className="rounded-xl border-2 border-yellow-600 bg-gray-800/50 p-4 text-center">
                    <Users className="mx-auto mb-2 h-8 w-8 text-yellow-400" />
                    <div className="text-3xl font-bold text-yellow-400">{players.length}명</div>
                    <div className="mt-1 text-base text-gray-400">참가자</div>
                  </div>
                </div>

                <div className="rounded-xl border-2 border-yellow-600 bg-gray-800/50 p-4 text-base text-gray-300">
                  정답을 맞히면 금고를 열거나 친구를 조사할 수 있습니다. 금고를 몰래보면 보상 선택은 쉬워지지만, 그 순간 친구에게 잡힐 수 있어요.
                </div>

                <Button
                  onClick={() => {
                    if (room?.status === 'playing') {
                      setCurrentView('quiz')
                      playBGM('game')
                    }
                  }}
                  size="lg"
                  disabled={room?.status !== 'playing'}
                  className="w-full border-4 border-yellow-400 bg-gradient-to-r from-yellow-600 to-yellow-500 py-6 text-2xl font-bold text-black shadow-xl hover:from-yellow-700 hover:to-yellow-600 disabled:opacity-60"
                >
                  {room?.status === 'playing' ? '게임 입장하기' : '선생님 시작 대기'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentView !== 'lobby' && currentView !== 'result' && !showCountdown && room?.status === 'playing' && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 h-dvh w-full"
          >
            <MafiaView
              roomCode={roomCode}
              playerId={playerId}
              players={players}
              currentQuestion={currentQuestion}
              timeRemaining={remainingTime}
              checkAnswer={checkAnswer}
              goToNextQuestion={goToNextQuestion}
              commitPlayerPatch={commitPlayerPatch}
              sendRoomEvent={sendRoomEvent}
              playSFX={playSFX}
            />
          </motion.div>
        )}

        {currentView === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative z-10 min-h-dvh p-4"
          >
            <GameResult
              players={players}
              currentPlayerId={playerId}
              gameMode="mafia"
              onExit={() => router.push('/')}
            />
            {currentPlayerRank > 0 && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/85 px-5 py-3 text-lg font-black text-yellow-300">
                내 순위 {currentPlayerRank}위
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
