'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useMafiaStore } from '@/store/mafiaStore'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import MafiaView from '@/components/MafiaView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Trophy, Clock, DollarSign, Users } from 'lucide-react'
import { formatTime, calculateLaunderedCash } from '@/lib/game/mafia'
import { useGameBase } from '@/hooks/useGameBase'

type MafiaViewType = 'lobby' | 'playing' | 'result'

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
    playBGM,
    playSFX,
  } = useGameBase({ expectedGameMode: 'mafia' })

  const [selectedDuration, setSelectedDuration] = useState(420) // 7분 기본값

  const {
    status,
    players,
    gameLog,
    actions,
  } = useMafiaStore()

  // room 상태가 'playing'이 되면 자동으로 게임 시작
  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && status !== 'playing') {
      actions.startGame(selectedDuration)
      setCurrentView('playing')
    } else if (room?.status === 'waiting' && currentView !== 'lobby') {
      actions.resetGame()
      setCurrentView('lobby')
    }
  }, [room?.status, currentView, status, actions, selectedDuration, setCurrentView])

  // 게임 상태 동기화
  useEffect(() => {
    if (status === 'playing' && currentView !== 'playing') {
      setCurrentView('playing')
    } else if (status === 'ended' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [status, currentView, setCurrentView])

  const handleStartGame = () => {
    actions.startGame(selectedDuration)
    setCurrentView('playing')
  }

  const handleRestart = () => {
    actions.resetGame()
    setCurrentView('lobby')
  }

  // 최종 순위 계산
  const sortedPlayers = [...players].sort(
    (a, b) => calculateLaunderedCash(b) - calculateLaunderedCash(a)
  )
  const winner = sortedPlayers[0]
  const player = players.find((p) => !p.isAi)
  const playerRank = sortedPlayers.findIndex((p) => p.id === player?.id) + 1

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-gray-900 via-black to-gray-900" style={{ fontFamily: 'BMKkubulim, sans-serif' }}>
      <AnimatedBackground />

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-2xl border-4 border-yellow-600 shadow-2xl bg-black/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <div className="text-7xl mb-4">🕴️</div>
                <CardTitle className="text-5xl font-bold text-yellow-400 mb-2">
                  쉿! 마피아
                </CardTitle>
                <p className="text-xl text-gray-300">
                  금고를 털고, 배신하고, 색출하라!
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 게임 시간 선택 */}
                <div>
                  <label className="block text-xl font-semibold text-yellow-400 mb-3">
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
                            ? 'border-yellow-500 bg-yellow-900/50 scale-105'
                            : 'border-gray-600 bg-gray-800/50 hover:border-yellow-600'
                          }`}
                      >
                        <div className="text-3xl font-bold text-yellow-400">{option.label}</div>
                        <div className="text-base text-gray-400 mt-1">
                          {formatTime(option.seconds)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 게임 설명 */}
                <div className="bg-gray-800/50 rounded-xl p-4 border-2 border-yellow-600">
                  <h3 className="font-bold text-xl mb-2 text-yellow-400">게임 방법</h3>
                  <ul className="space-y-2 text-base text-gray-300">
                    <li className="flex items-start gap-2">
                      <span>📝</span>
                      <span>퀴즈를 풀고 정답을 맞추세요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>🔐</span>
                      <span>정답 시 금고 열기 또는 조사를 선택할 수 있습니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>⚡</span>
                      <span>금고에서 배수 아이템을 획득하면 보상이 증가합니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>⚠️</span>
                      <span>CHEAT 버튼으로 모든 금고를 볼 수 있지만, 걸리면 큰 손실이 있습니다</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>👁️</span>
                      <span>다른 플레이어를 조사하여 치팅을 색출하세요</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>💰</span>
                      <span>시간 내에 가장 많은 세탁된 자금을 모으세요!</span>
                    </li>
                  </ul>
                </div>

                {/* 시작 버튼 */}
                <Button
                  onClick={handleStartGame}
                  size="lg"
                  className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-black font-bold text-2xl py-6 shadow-xl border-4 border-yellow-400"
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
            className="w-full h-screen"
          >
            <MafiaView
              onGameEnd={() => setCurrentView('result')}
              roomCode={roomCode}
              playerId={playerId || undefined}
            />
          </motion.div>
        )}

        {currentView === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-3xl border-4 border-yellow-600 shadow-2xl bg-black/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="mb-4 flex justify-center"
                >
                  {playerRank === 1 ? <Image src="/trophy.svg" alt="트로피" width={112} height={112} className="w-28 h-28" /> : <span className="text-7xl">🎯</span>}
                </motion.div>
                <CardTitle className="text-5xl font-bold text-yellow-400 mb-2">
                  게임 종료!
                </CardTitle>
                <p className="text-xl text-gray-300">
                  승자: {winner.name} (${calculateLaunderedCash(winner).toLocaleString()})
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 순위표 */}
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold text-yellow-400 mb-4">최종 순위</h3>
                  {sortedPlayers.map((p, index) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 ${index === 0
                          ? 'border-yellow-500 bg-yellow-900/30'
                          : p.id === player?.id
                            ? 'border-blue-500 bg-blue-900/30'
                            : 'border-gray-600 bg-gray-800/50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-yellow-400 w-8">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-white text-lg">{p.name}</div>
                          {p.isAi && <div className="text-sm text-gray-400">AI</div>}
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-yellow-400">
                        ${calculateLaunderedCash(p).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 플레이어 통계 */}
                {player && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-xl p-4 border-2 border-gray-600 text-center">
                      <DollarSign className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                      <div className="text-3xl font-bold text-yellow-400">
                        ${calculateLaunderedCash(player).toLocaleString()}
                      </div>
                      <div className="text-base text-gray-400 mt-1">세탁된 자금</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 border-2 border-gray-600 text-center">
                      <Trophy className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
                      <div className="text-3xl font-bold text-yellow-400">{playerRank}위</div>
                      <div className="text-base text-gray-400 mt-1">최종 순위</div>
                    </div>
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleRestart}
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-black font-bold text-xl py-6 shadow-xl"
                  >
                    🔄 다시 하기
                  </Button>
                  <Button
                    onClick={() => router.push('/teacher/dashboard')}
                    size="lg"
                    variant="outline"
                    className="flex-1 border-4 border-gray-600 text-gray-300 font-bold text-xl py-6"
                  >
                    🏠 대시보드로
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
