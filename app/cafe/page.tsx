'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCafeStore } from '@/store/cafeStore'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import CafeView from '@/components/CafeView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Trophy, Clock, DollarSign, Users } from 'lucide-react'
import { formatTime, MENU_ITEMS } from '@/lib/game/cafe'
import { useGameBase } from '@/hooks/useGameBase'

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
    playBGM,
    playSFX,
  } = useGameBase({ expectedGameMode: 'cafe' })

  const [selectedDuration, setSelectedDuration] = useState(420) // 7분 기본값

  const {
    status,
    totalCashEarned,
    customersServed,
    stats,
    startGame,
    resetGame,
  } = useCafeStore()

  // room 상태가 'playing'이 되면 자동으로 게임 시작
  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && status !== 'playing') {
      startGame(selectedDuration)
      setCurrentView('playing')
    } else if (room?.status === 'waiting' && currentView !== 'lobby') {
      resetGame()
      setCurrentView('lobby')
    }
  }, [room?.status, currentView, status, startGame, resetGame, selectedDuration, setCurrentView])

  // 게임 상태 동기화
  useEffect(() => {
    if (status === 'playing' && currentView !== 'playing') {
      setCurrentView('playing')
    } else if (status === 'ended' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [status, currentView, setCurrentView])

  const handleStartGame = () => {
    startGame(selectedDuration)
    setCurrentView('playing')
  }

  const handleRestart = () => {
    resetGame()
    setCurrentView('lobby')
  }

  // 가장 많이 판 메뉴 찾기
  const topMenuEntry = Object.entries(stats.menuSales).sort((a, b) => b[1] - a[1])[0]
  const topMenuName = topMenuEntry
    ? MENU_ITEMS.find((m) => m.id === topMenuEntry[0])?.name || '없음'
    : '없음'
  const topMenuCount = topMenuEntry ? topMenuEntry[1] : 0

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-amber-50 to-orange-100">
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
                    <li>• 돈을 모아 새로운 메뉴를 해금하고 업그레이드를 구매하세요</li>
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
            className="w-full h-screen"
          >
            <CafeView onGameEnd={() => setCurrentView('result')} roomCode={roomCode} />
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
            <Card className="w-full max-w-3xl border-4 border-amber-300 shadow-2xl bg-white/95 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                  className="text-6xl mb-4"
                >
                  🎉
                </motion.div>
                <CardTitle className="text-4xl font-bold text-gray-900 mb-2">
                  게임 종료!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 통계 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-xl p-4 border-4 border-green-300 text-center">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-green-700" />
                    <div className="text-2xl font-bold text-green-900">
                      ${totalCashEarned.toLocaleString()}
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

                {/* 액션 버튼 */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleRestart}
                    size="lg"
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-lg py-6 shadow-xl"
                  >
                    🔄 다시 하기
                  </Button>
                  <Button
                    onClick={() => (window.location.href = '/teacher/dashboard')}
                    size="lg"
                    variant="outline"
                    className="flex-1 border-4 border-gray-300 font-bold text-lg py-6"
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
