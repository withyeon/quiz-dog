'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useZombieStore } from '@/store/zombieStore'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import ZombieView from '@/components/ZombieView'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Trophy, Clock, Users, Heart, Skull, Shield, Search } from 'lucide-react'
import { formatTime, GAME_CONSTANTS, ZombiePlayer } from '@/lib/game/zombie'
import { useGameBase } from '@/hooks/useGameBase'

export default function ZombiePage() {
  const router = useRouter()
  const {
    roomCode, playerId, currentView, setCurrentView,
    room, roomLoading, playersLoading, playBGM, playSFX,
  } = useGameBase({ expectedGameMode: 'zombie' })

  const { status, players, winner, winReason, actions, playerCount } = useZombieStore()

  // Room state sync
  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && status !== 'playing' && status !== 'role_reveal') {
      actions.startGame()
      setCurrentView('playing')
    } else if (room?.status === 'waiting' && currentView !== 'lobby') {
      actions.resetGame()
      setCurrentView('lobby')
    }
  }, [room?.status, currentView, status, actions, setCurrentView])

  useEffect(() => {
    if (status === 'playing' && currentView !== 'playing') setCurrentView('playing')
    else if (status === 'ended' && currentView !== 'result') setCurrentView('result')
  }, [status, currentView, setCurrentView])

  const handleStartGame = () => {
    actions.startGame()
    // role_reveal -> playing handled by store
    setCurrentView('playing')
  }

  const handleRestart = () => {
    actions.resetGame()
    setCurrentView('lobby')
  }

  const myPlayer = players.find(p => !p.isAi)
  const sortedPlayers = [...players].sort((a, b) => {
    // Survivors first, then by health, then by correct answers
    if (a.role === 'human' && b.role !== 'human') return -1
    if (a.role !== 'human' && b.role === 'human') return 1
    if (a.role === 'human' && b.role === 'human') return b.health - a.health
    return b.infectCount - a.infectCount
  })

  const humanSurvivors = players.filter(p => p.role === 'human')
  const zombies = players.filter(p => p.role === 'zombie')
  const myWon = winner === null ? false : (myPlayer?.role === winner)

  return (
    <div 
      className="min-h-screen relative overflow-hidden" 
      style={{ 
        fontFamily: 'DNFBitBitv2, sans-serif',
        backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.65)), url('/zombie/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <AnimatedBackground />

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {currentView === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl border-4 border-green-600 shadow-2xl bg-black/90 backdrop-blur-sm">
              <CardHeader className="text-center pb-4">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-7xl mb-4">🧟</motion.div>
                <CardTitle className="text-5xl font-bold text-green-400 mb-2">좀비를 피해라!</CardTitle>
                <p className="text-xl text-gray-300">감염을 막고 생존하라!</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Player count */}
                <div>
                  <label className="block text-xl font-semibold text-green-400 mb-3">
                    <Users className="inline mr-2 h-5 w-5" />
                    플레이어 수: {playerCount}명
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={GAME_CONSTANTS.MIN_PLAYERS}
                      max={GAME_CONSTANTS.MAX_PLAYERS}
                      value={playerCount}
                      onChange={e => actions.setPlayerCount(parseInt(e.target.value))}
                      className="flex-1 h-3 rounded-lg appearance-none bg-gray-700 accent-green-500"
                    />
                    <span className="text-2xl font-bold text-green-400 w-12 text-center">{playerCount}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{GAME_CONSTANTS.MIN_PLAYERS}명</span>
                    <span>{GAME_CONSTANTS.MAX_PLAYERS}명</span>
                  </div>
                </div>

                {/* Game info */}
                <div className="bg-gray-800/50 rounded-xl p-4 border-2 border-green-600">
                  <h3 className="font-bold text-xl mb-2 text-green-400">게임 방법</h3>
                  <ul className="space-y-2 text-base text-gray-300">
                    <li className="flex items-start gap-2"><span>🧟</span><span>15~20%가 랜덤으로 좀비! 본인 역할은 비밀</span></li>
                    <li className="flex items-start gap-2"><span>📝</span><span>퀴즈를 풀면 행동 기회를 얻어요</span></li>
                    <li className="flex items-start gap-2"><span>💚</span><span>인간: 치료 / 방어막 / 스캔으로 생존!</span></li>
                    <li className="flex items-start gap-2"><span>⚔️</span><span>좀비: 인간을 공격해서 감염시켜요</span></li>
                    <li className="flex items-start gap-2"><span>🏆</span><span>인간팀: 10분 생존 / 좀비팀: 전원 감염</span></li>
                    <li className="flex items-start gap-2"><span>❌</span><span>오답 시 인간은 체력이 깎여요!</span></li>
                  </ul>
                </div>

                {/* Zombie count preview */}
                <div className="text-center p-3 bg-green-950/30 rounded-lg border border-green-700">
                  <p className="text-gray-400">예상 좀비 수: <span className="text-green-400 font-bold text-xl">{Math.max(1, Math.floor(playerCount * 0.15))}~{Math.max(1, Math.ceil(playerCount * 0.20))}명</span></p>
                </div>

                <Button onClick={handleStartGame} size="lg" className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold text-2xl py-6 shadow-xl border-4 border-green-400">
                  🎮 게임 시작하기
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── ROLE REVEAL (handled inside playing) ── */}
        {currentView === 'playing' && status === 'role_reveal' && (
          <motion.div key="role_reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.8 }} className="text-center">
              <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 1, repeat: Infinity }} className="text-[120px]">
                {myPlayer?.role === 'zombie' ? '🧟' : '🧑'}
              </motion.div>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className={`text-6xl font-bold mt-6 ${myPlayer?.role === 'zombie' ? 'text-green-400' : 'text-blue-400'}`}>
                당신은 {myPlayer?.role === 'zombie' ? '좀비' : '인간'}입니다!
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-2xl text-gray-400 mt-4">
                {myPlayer?.role === 'zombie' ? '모든 인간을 감염시키세요!' : '10분간 생존하세요!'}
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ delay: 2, duration: 1.5, repeat: Infinity }} className="text-lg text-gray-500 mt-6">
                잠시 후 게임이 시작됩니다...
              </motion.p>
            </motion.div>
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {currentView === 'playing' && status === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-screen">
            <ZombieView onGameEnd={() => setCurrentView('result')} roomCode={roomCode} playerId={playerId || undefined} />
          </motion.div>
        )}

        {/* ── RESULT ── */}
        {currentView === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="min-h-screen flex items-center justify-center p-4">
            <Card className={`w-full max-w-3xl border-4 ${winner === 'human' ? 'border-blue-500' : 'border-green-500'} shadow-2xl bg-black/90 backdrop-blur-sm`}>
              <CardHeader className="text-center pb-4">
                <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ type: 'spring' }} className="mb-4">
                  <span className="text-8xl">{winner === 'human' ? '🏆' : '🧟'}</span>
                </motion.div>
                <CardTitle className={`text-5xl font-bold mb-2 ${winner === 'human' ? 'text-blue-400' : 'text-green-400'}`}>
                  {winner === 'human' ? '인간 팀 승리!' : '좀비 팀 승리!'}
                </CardTitle>
                <p className="text-xl text-gray-300">{winReason}</p>
                <p className={`text-2xl font-bold mt-2 ${myWon ? 'text-yellow-400' : 'text-red-400'}`}>
                  {myWon ? '🎉 당신이 이겼습니다!' : '💀 당신은 졌습니다...'}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Survivors */}
                <div>
                  <h3 className="text-2xl font-bold text-blue-400 mb-3">🧑 생존자 ({humanSurvivors.length}명)</h3>
                  <div className="space-y-2">
                    {humanSurvivors.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border-2 border-blue-500/50 bg-blue-950/30">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🧑</span>
                          <span className="font-bold text-white">{p.name} {!p.isAi && '(나)'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span className="text-red-400">{p.health}</span>
                        </div>
                      </div>
                    ))}
                    {humanSurvivors.length === 0 && <p className="text-gray-500 text-center">생존자 없음</p>}
                  </div>
                </div>

                {/* Zombies */}
                <div>
                  <h3 className="text-2xl font-bold text-green-400 mb-3">🧟 좀비 ({zombies.length}명)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {zombies.map(p => (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border-2 ${p.originalRole === 'zombie' ? 'border-red-500/50 bg-red-950/30' : 'border-green-500/30 bg-green-950/20'}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-xl">🧟</span>
                          <span className="font-bold text-white">{p.name} {!p.isAi && '(나)'}</span>
                          {p.originalRole === 'zombie' && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">원조 좀비</span>}
                        </div>
                        <div className="text-sm text-gray-400">감염: {p.infectCount}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-4">
                  <Button onClick={handleRestart} size="lg" className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white font-bold text-xl py-6 shadow-xl">
                    🔄 다시 하기
                  </Button>
                  <Button onClick={() => router.push('/teacher/dashboard')} size="lg" variant="outline" className="flex-1 border-4 border-gray-600 text-gray-300 font-bold text-xl py-6">
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
