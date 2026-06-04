'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import ZombieView from '@/components/ZombieView'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AnimatedBackground from '@/components/AnimatedBackground'
import { Button } from '@/components/ui/button'
import { Heart, Trophy } from 'lucide-react'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import {
  getZombieMeta,
  roomPlayerToZombiePlayer,
} from '@/lib/game/zombie'
import { updatePlayer } from '@/lib/services/players'
import { useGameBase } from '@/hooks/useGameBase'

export default function ZombiePage() {
  const router = useRouter()
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    room,
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
    handlePreStartQuizAnswer,
    checkAnswer,
    goToNextQuestion,
    sendRoomEvent,
    applyPlayerPatch,
    roomLoading,
    playersLoading,
  } = useGameBase({
    expectedGameMode: 'zombie',
    preStartQuizTotal: 0,
    redirectToResultPage: false,
  })
  const [showRoleReveal, setShowRoleReveal] = useState(false)

  const activeRoomPlayers = useMemo(
    () => players.filter((player) => !player.is_kicked),
    [players],
  )
  const zombiePlayers = useMemo(
    () => activeRoomPlayers.map(roomPlayerToZombiePlayer),
    [activeRoomPlayers],
  )
  const myPlayer = currentPlayer ? roomPlayerToZombiePlayer(currentPlayer) : null
  const humanSurvivors = zombiePlayers.filter((player) => player.role === 'human')
  const zombies = zombiePlayers.filter((player) => player.role === 'zombie')
  const winner = humanSurvivors.length === 0 && zombiePlayers.length > 0 ? 'zombie' : 'human'
  const winReason = winner === 'zombie'
    ? '모든 인간이 감염되었습니다! 좀비 팀 승리!'
    : `${humanSurvivors.length}명의 인간이 생존했습니다! 인간 팀 승리!`
  const myWon = myPlayer ? myPlayer.role === winner : false
  const hasAssignedRoles = activeRoomPlayers.length > 0 && activeRoomPlayers.every((player) => getZombieMeta(player))

  useEffect(() => {
    if (room?.status === 'waiting' && currentView !== 'lobby') {
      setShowRoleReveal(false)
      setCurrentView('lobby')
      return
    }

    if (room?.status === 'finished' && currentView !== 'result') {
      setShowRoleReveal(false)
      setCurrentView('result')
      return
    }

    if (room?.status === 'playing' && currentView === 'lobby' && isPreStartQuizComplete) {
      setCurrentView('playing')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView])

  const roleRevealKey = useMemo(() => {
    if (!roomCode || !playerId || !room?.started_at) return null
    return `zombie_role_reveal_${roomCode}_${playerId}_${room.started_at}`
  }, [playerId, room?.started_at, roomCode])

  useEffect(() => {
    if (room?.status !== 'playing' || !myPlayer || !hasAssignedRoles || !roleRevealKey) return
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(roleRevealKey) === '1') return

    setShowRoleReveal(true)
    window.sessionStorage.setItem(roleRevealKey, '1')
    const timer = window.setTimeout(() => setShowRoleReveal(false), 3000)
    return () => window.clearTimeout(timer)
  }, [hasAssignedRoles, myPlayer, roleRevealKey, room?.status])

  useEffect(() => {
    if (room?.status !== 'playing' || !hasAssignedRoles || zombiePlayers.length === 0) return
    if (humanSurvivors.length > 0) return
    // 학생은 자기 화면만 로컬 종료. 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당.
    setCurrentView('result')
  }, [hasAssignedRoles, humanSurvivors.length, room?.status, setCurrentView, zombiePlayers.length])

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-6 text-white">
        방 코드와 플레이어 정보가 필요합니다.
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black p-6 text-2xl font-black text-green-300">
        좀비 모드를 준비하는 중...
      </div>
    )
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.65)), url('/zombie/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
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

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-4">
            <Card className="w-full max-w-2xl border-4 border-green-600 bg-black/90 shadow-2xl backdrop-blur-sm">
              <CardHeader className="pb-4 text-center">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mb-4 flex justify-center">
                  <ZombieIcon name="zombie" size={80} alt="좀비" />
                </motion.div>
                <CardTitle className="mb-2 text-5xl font-bold text-green-400">좀비를 피해라!</CardTitle>
                <p className="text-xl text-gray-300">반 친구들과 함께 감염을 막고 생존하세요.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border-2 border-green-600 bg-gray-800/50 p-4">
                  <h3 className="mb-2 text-xl font-bold text-green-400">참가자 {activeRoomPlayers.length}명</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeRoomPlayers.map((player) => (
                      <div key={player.id} className="rounded-lg bg-black/40 px-3 py-2 font-bold text-white">
                        {player.nickname}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border-2 border-green-600 bg-gray-800/50 p-4">
                  <ul className="space-y-3 text-base text-gray-300">
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="zombie" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>15~20%가 랜덤으로 좀비가 됩니다.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="quiz" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>퀴즈를 맞히면 역할에 맞는 행동을 할 수 있어요.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="heal" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>인간은 치료, 방어막, 스캔으로 생존합니다.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <ZombieIcon name="attack" size={22} className="mt-0.5 shrink-0" alt="" />
                      <span>좀비는 실제 친구를 공격해 감염시킵니다.</span>
                    </li>
                  </ul>
                </div>
                <p className="text-center text-lg font-black text-green-300">선생님이 시작하면 역할이 공개됩니다.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentView === 'playing' && showRoleReveal && myPlayer && (
          <motion.div key="role_reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.8 }} className="text-center">
              <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 1, repeat: Infinity }} className="flex justify-center">
                <ZombieIcon
                  name={myPlayer.role === 'zombie' ? 'zombie' : 'human'}
                  size={120}
                  alt={myPlayer.role === 'zombie' ? '좀비' : '인간'}
                />
              </motion.div>
              <h1 className={`mt-6 text-6xl font-bold ${myPlayer.role === 'zombie' ? 'text-green-400' : 'text-blue-400'}`}>
                당신은 {myPlayer.role === 'zombie' ? '좀비' : '인간'}입니다!
              </h1>
              <p className="mt-4 text-2xl text-gray-400">
                {myPlayer.role === 'zombie' ? '모든 인간을 감염시키세요!' : '끝까지 생존하세요!'}
              </p>
            </motion.div>
          </motion.div>
        )}

        {currentView === 'playing' && !showRoleReveal && (
          hasAssignedRoles ? (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-dvh w-full">
              <ZombieView
                roomCode={roomCode}
                playerId={playerId}
                roomStatus={room?.status ?? 'waiting'}
                roomStartedAt={room?.started_at ?? null}
                roomDurationSeconds={room?.duration_seconds ?? null}
                roomPlayers={activeRoomPlayers}
                currentQuestion={currentQuestion}
                onAnswer={checkAnswer}
                onNextQuestion={goToNextQuestion}
                onGameEnd={() => setCurrentView('result')}
                // 학생은 방을 종료(DB 기록)할 권한이 없다. 자기 화면만 로컬 종료하고,
                // 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당한다.
                onFinishRoom={async () => { setCurrentView('result'); return false }}
                onPlayerPatch={(targetPlayerId, patch, reason) => {
                  applyPlayerPatch(targetPlayerId, patch)
                  void sendRoomEvent('player:patch', { playerId: targetPlayerId, patch, reason })
                  void updatePlayer(targetPlayerId, patch).catch((error) => {
                    console.error('좀비 플레이어 업데이트 실패:', error)
                  })
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="assigning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-dvh items-center justify-center p-6 text-center">
              <div className="rounded-2xl border-4 border-green-600 bg-black/80 p-8 text-3xl font-black text-green-300">
                역할을 배정하는 중...
              </div>
            </motion.div>
          )
        )}

        {currentView === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex min-h-dvh items-center justify-center p-4">
            <Card className={`w-full max-w-3xl border-4 ${winner === 'human' ? 'border-blue-500' : 'border-green-500'} bg-black/90 shadow-2xl backdrop-blur-sm`}>
              <CardHeader className="pb-4 text-center">
                <div className="mb-4 flex justify-center">
                  {winner === 'human' ? (
                    <Trophy className="mx-auto h-20 w-20 text-blue-300" />
                  ) : (
                    <ZombieIcon name="zombie" size={80} alt="좀비 승리" />
                  )}
                </div>
                <CardTitle className={`mb-2 text-5xl font-bold ${winner === 'human' ? 'text-blue-400' : 'text-green-400'}`}>
                  {winner === 'human' ? '인간 팀 승리!' : '좀비 팀 승리!'}
                </CardTitle>
                <p className="text-xl text-gray-300">{winReason}</p>
                {myPlayer && (
                  <p className={`mt-2 text-2xl font-bold ${myWon ? 'text-yellow-400' : 'text-red-400'}`}>
                    {myWon ? '당신이 이겼습니다!' : '당신은 졌습니다...'}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-3 text-2xl font-bold text-blue-400">생존자 ({humanSurvivors.length}명)</h3>
                  <div className="space-y-2">
                    {humanSurvivors.map((player) => (
                      <div key={player.id} className="flex items-center justify-between rounded-xl border-2 border-blue-500/50 bg-blue-950/30 p-3">
                        <span className="font-bold text-white">{player.name}</span>
                        <span className="inline-flex items-center gap-2 text-red-400"><Heart className="h-4 w-4" />{player.health}</span>
                      </div>
                    ))}
                    {humanSurvivors.length === 0 && <p className="text-center text-gray-500">생존자 없음</p>}
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 text-2xl font-bold text-green-400">좀비 ({zombies.length}명)</h3>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {zombies.map((player) => (
                      <div key={player.id} className={`flex items-center justify-between rounded-xl border-2 p-3 ${player.originalRole === 'zombie' ? 'border-red-500/50 bg-red-950/30' : 'border-green-500/30 bg-green-950/20'}`}>
                        <span className="font-bold text-white">{player.name}</span>
                        <span className="text-sm text-gray-400">감염 {player.infectCount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => router.push('/teacher/dashboard')} size="lg" variant="outline" className="w-full border-4 border-gray-600 py-6 text-xl font-bold text-gray-300">
                  대시보드로
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
