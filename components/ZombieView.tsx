'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import QuizView from '@/components/QuizView'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAudioContext } from '@/components/AudioProvider'
import {
  applyCorrectBonus,
  applyWrongPenalty,
  checkWinCondition,
  formatTime,
  GAME_CONSTANTS,
  humanHeal,
  humanShield,
  roomPlayerToZombiePlayer,
  scanPlayer,
  zombieAttack,
  zombiePlayerToPatch,
  type RoomZombiePlayer,
  type ZombieActionType,
  type ZombieGameLog,
} from '@/lib/game/zombie'
import type { Question } from '@/hooks/useGameBase'

type ViewState = 'quiz' | 'actionSelect' | 'targetSelect' | 'scanResult' | 'attackResult' | 'wrong'

type ZombieViewProps = {
  roomCode: string
  playerId: string
  roomStatus: string
  roomPlayers: RoomZombiePlayer[]
  currentQuestion: Question | null
  onAnswer: (answer: string) => Promise<boolean>
  onNextQuestion: () => void
  onGameEnd?: () => void
  onFinishRoom: () => Promise<boolean>
  onPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason: string) => void
}

function addLog(logs: ZombieGameLog[], message: string, type: ZombieGameLog['type'] = 'info'): ZombieGameLog[] {
  return [
    ...logs,
    {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      type,
      timestamp: Date.now(),
    },
  ].slice(-30)
}

export default function ZombieView({
  roomStatus,
  roomPlayers,
  playerId,
  currentQuestion,
  onAnswer,
  onNextQuestion,
  onFinishRoom,
  onPlayerPatch,
}: ZombieViewProps) {
  const [currentView, setCurrentView] = useState<ViewState>('quiz')
  const [timeRemaining, setTimeRemaining] = useState(GAME_CONSTANTS.GAME_DURATION)
  const [gameLog, setGameLog] = useState<ZombieGameLog[]>([])
  const [lastScanResult, setLastScanResult] = useState<{ playerId: string; isZombie: boolean } | null>(null)
  const [lastAttackResult, setLastAttackResult] = useState<{ targetId: string; damage: number; infected: boolean; log: string } | null>(null)
  const finishingRef = useRef(false)
  const { playSFX } = useAudioContext()

  const players = useMemo(() => roomPlayers.map(roomPlayerToZombiePlayer), [roomPlayers])
  const myPlayer = players.find((player) => player.id === playerId) ?? null
  const otherPlayers = players.filter((player) => player.id !== playerId)
  const isZombie = myPlayer?.role === 'zombie'
  const isPaused = roomStatus === 'paused'
  const humanCount = players.filter((player) => player.role === 'human').length
  const zombieCount = players.filter((player) => player.role === 'zombie').length
  const isUrgent = timeRemaining <= 60 && roomStatus === 'playing'

  const commitZombiePlayer = (player: ReturnType<typeof roomPlayerToZombiePlayer>, reason: string) => {
    onPlayerPatch(player.id, zombiePlayerToPatch(player), reason)
  }

  useEffect(() => {
    if (roomStatus !== 'playing' || isPaused) return
    const timer = window.setInterval(() => {
      setTimeRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isPaused, roomStatus])

  useEffect(() => {
    const winCheck = checkWinCondition(players, timeRemaining)
    if (!winCheck.gameOver || finishingRef.current) return
    finishingRef.current = true
    setGameLog((logs) => addLog(logs, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'))
    void onFinishRoom()
  }, [onFinishRoom, players, timeRemaining])

  useEffect(() => {
    if (!lastScanResult) return
    const timer = window.setTimeout(() => {
      setLastScanResult(null)
      setCurrentView('quiz')
      onNextQuestion()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [lastScanResult, onNextQuestion])

  useEffect(() => {
    if (!lastAttackResult) return
    const timer = window.setTimeout(() => {
      setLastAttackResult(null)
      setCurrentView('quiz')
      onNextQuestion()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [lastAttackResult, onNextQuestion])

  const handleAnswerSubmit = async (answer: string) => {
    if (!myPlayer || roomStatus !== 'playing') return false

    const correct = answer ? await onAnswer(answer) : false
    if (correct) {
      playSFX('correct')
      const { newPlayer, bonusLog } = applyCorrectBonus(myPlayer)
      commitZombiePlayer(newPlayer, 'zombie_correct_answer')
      if (bonusLog) setGameLog((logs) => addLog(logs, bonusLog, 'success'))
      window.setTimeout(() => setCurrentView('actionSelect'), 700)
      return true
    }

    playSFX('incorrect')
    const { newPlayer, log } = applyWrongPenalty(myPlayer)
    let updatedPlayer = newPlayer
    let logType: ZombieGameLog['type'] = 'warning'

    if (newPlayer.health <= 0 && newPlayer.role === 'human') {
      updatedPlayer = {
        ...newPlayer,
        role: 'zombie',
        health: 999,
        shield: 0,
        attackPower: GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
      }
      logType = 'infection'
    }

    commitZombiePlayer(updatedPlayer, 'zombie_wrong_answer')
    setGameLog((logs) => addLog(logs, updatedPlayer.role === 'zombie' && myPlayer.role === 'human' ? `${myPlayer.name}이(가) 좀비가 되었습니다!` : log, logType))
    setCurrentView('wrong')
    window.setTimeout(() => {
      setCurrentView('quiz')
      onNextQuestion()
    }, 1500)
    return false
  }

  const handleHumanAction = (action: 'heal' | 'shield') => {
    if (!myPlayer) return
    const result = action === 'heal' ? humanHeal(myPlayer) : humanShield(myPlayer)
    commitZombiePlayer(result.newPlayer, `zombie_${action}`)
    setGameLog((logs) => addLog(logs, result.log, 'success'))
    playSFX('correct')
    setCurrentView('quiz')
    onNextQuestion()
  }

  const handleTargetSelect = (targetId: string, action: Extract<ZombieActionType, 'attack' | 'scan'>) => {
    if (!myPlayer) return
    const target = players.find((player) => player.id === targetId)
    if (!target) return

    if (action === 'scan') {
      const result = scanPlayer(myPlayer, target)
      setLastScanResult({ playerId: targetId, isZombie: result.isZombie })
      setGameLog((logs) => addLog(logs, result.log, result.isZombie ? 'danger' : 'info'))
      setCurrentView('scanResult')
      playSFX('click')
      return
    }

    const result = zombieAttack(myPlayer, target)
    commitZombiePlayer(result.newZombie, 'zombie_attack_actor')
    commitZombiePlayer(result.newTarget, 'zombie_attack_target')
    setLastAttackResult({
      targetId,
      damage: myPlayer.attackPower,
      infected: result.infected,
      log: result.log,
    })
    setGameLog((logs) => addLog(logs, result.log, result.infected ? 'infection' : 'danger'))
    setCurrentView('attackResult')
    playSFX('incorrect')
  }

  const overlayColor = isZombie ? 'rgba(5, 46, 22, 0.5)' : 'rgba(30, 27, 75, 0.5)'
  const accentColor = isZombie ? 'text-green-400' : 'text-blue-400'
  const borderColor = isZombie ? 'border-green-600' : 'border-blue-600'

  return (
    <div
      className="relative h-screen w-full overflow-hidden"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        backgroundImage: `linear-gradient(${overlayColor}, rgba(0,0,0,0.7)), url('/zombie/background.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className={`absolute left-0 right-0 top-0 z-20 border-b-2 ${borderColor} bg-black/80 shadow-lg backdrop-blur-sm`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ZombieIcon name="timer" size={28} alt="" />
              <span className={`text-3xl font-bold tabular-nums ${isUrgent ? 'animate-pulse text-red-500' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
          <div className={`rounded-full border-2 px-4 py-1 ${isZombie ? 'border-green-500 bg-green-950/80' : 'border-blue-500 bg-blue-950/80'}`}>
            <ZombieIcon
              name={isZombie ? 'zombie' : 'human'}
              size={28}
              className="mr-2 inline-block align-middle"
              alt={isZombie ? '좀비' : '인간'}
            />
            <span className={`text-lg font-bold ${accentColor}`}>{isZombie ? '좀비' : '인간'}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1 font-bold text-green-400">
              <ZombieIcon name="human" size={22} alt="인간" />
              {humanCount}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-red-400">
              <ZombieIcon name="zombie" size={22} alt="좀비" />
              {zombieCount}
            </span>
            {myPlayer && !isZombie && (
              <span className="inline-flex items-center gap-2 font-bold text-red-400">
                <Heart className="h-5 w-5" />{myPlayer.health}
                {myPlayer.shield > 0 && (
                  <>
                    <ZombieIcon name="shield" size={20} className="ml-2" alt="방어막" />
                    <span className="text-cyan-400">{myPlayer.shield}</span>
                  </>
                )}
              </span>
            )}
            {myPlayer && isZombie && (
              <span className="inline-flex items-center gap-2 font-bold text-red-400">
                <ZombieIcon name="attack" size={20} alt="공격력" />
                {myPlayer.attackPower}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-36 left-0 right-80 top-14 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentView === 'quiz' && (
            <motion.div key="quiz" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              {currentQuestion ? (
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={() => setCurrentView('actionSelect')}
                  timeLimit={GAME_CONSTANTS.ROUND_DURATION}
                  paused={isPaused}
                />
              ) : (
                <div className="rounded-2xl bg-black/80 p-8 text-center text-2xl font-black text-white">
                  문제를 불러오는 중...
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'actionSelect' && myPlayer && (
            <motion.div key="actionSelect" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-2xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90 backdrop-blur-sm`}>
                <CardContent className="p-8 text-center">
                  <h2 className={`mb-6 text-3xl font-bold ${accentColor}`}>정답! 행동을 선택하세요</h2>
                  {isZombie ? (
                    <Button onClick={() => setCurrentView('targetSelect')} size="lg" className="h-24 w-full bg-gradient-to-br from-red-700 to-red-600 text-xl font-bold text-white hover:from-red-800 hover:to-red-700">
                      <ZombieIcon name="attack" size={32} className="mr-3" alt="" />
                      인간 공격하기
                    </Button>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <Button onClick={() => handleHumanAction('heal')} size="lg" className="flex h-28 flex-col items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-600 text-lg font-bold text-white">
                        <ZombieIcon name="heal" size={28} className="mb-2" alt="" />
                        치료
                      </Button>
                      <Button onClick={() => handleHumanAction('shield')} size="lg" className="flex h-28 flex-col items-center justify-center bg-gradient-to-br from-cyan-700 to-cyan-600 text-lg font-bold text-white">
                        <ZombieIcon name="shield" size={28} className="mb-2" alt="" />
                        방어막
                      </Button>
                      <Button onClick={() => setCurrentView('targetSelect')} size="lg" className="flex h-28 flex-col items-center justify-center bg-gradient-to-br from-purple-700 to-purple-600 text-lg font-bold text-white">
                        <ZombieIcon name="scan" size={28} className="mb-2" alt="" />
                        스캔
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'targetSelect' && (
            <motion.div key="targetSelect" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90 backdrop-blur-sm`}>
                <CardContent className="p-6">
                  <h2 className={`mb-4 text-center text-3xl font-bold ${accentColor}`}>{isZombie ? '공격할 친구 선택' : '스캔할 친구 선택'}</h2>
                  <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto">
                    {otherPlayers.filter((player) => isZombie ? player.role === 'human' : true).map((player) => (
                      <Button
                        key={player.id}
                        onClick={() => handleTargetSelect(player.id, isZombie ? 'attack' : 'scan')}
                        size="lg"
                        className="h-20 justify-start bg-gray-800 px-4 text-lg font-bold text-white hover:bg-gray-700"
                      >
                        <ZombieIcon name="player" size={28} className="mr-3 shrink-0" alt="" />
                        <div className="min-w-0 text-left">
                          <div className="truncate">{player.name}</div>
                          {isZombie && <div className="text-xs text-red-300">HP {player.health} {player.shield > 0 ? `방어막 ${player.shield}` : ''}</div>}
                          {!isZombie && <div className="text-xs text-gray-400">정체불명</div>}
                        </div>
                      </Button>
                    ))}
                  </div>
                  <Button onClick={() => setCurrentView('actionSelect')} variant="outline" className="mt-4 w-full border-gray-600 text-gray-300">돌아가기</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'scanResult' && lastScanResult && (
            <motion.div key="scanResult" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
              <div className="mb-4 flex justify-center">
                <ZombieIcon
                  name={lastScanResult.isZombie ? 'zombie' : 'correct'}
                  size={96}
                  alt={lastScanResult.isZombie ? '좀비' : '인간 확인'}
                />
              </div>
              <p className={`text-4xl font-bold ${lastScanResult.isZombie ? 'text-red-400' : 'text-green-400'}`}>
                {lastScanResult.isZombie ? '좀비 발견!' : '인간 확인!'}
              </p>
              <p className="mt-2 text-xl text-gray-300">{players.find((player) => player.id === lastScanResult.playerId)?.name}</p>
            </motion.div>
          )}

          {currentView === 'attackResult' && lastAttackResult && (
            <motion.div key="attackResult" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
              <div className="mb-4 flex justify-center">
                <ZombieIcon
                  name={lastAttackResult.infected ? 'zombie' : 'attack'}
                  size={96}
                  alt={lastAttackResult.infected ? '감염' : '공격'}
                />
              </div>
              <p className={`text-4xl font-bold ${lastAttackResult.infected ? 'text-green-400' : 'text-red-400'}`}>
                {lastAttackResult.infected ? '감염 성공!' : `${lastAttackResult.damage} 데미지!`}
              </p>
              <p className="mt-2 text-xl text-gray-300">{players.find((player) => player.id === lastAttackResult.targetId)?.name}</p>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="mb-4 flex justify-center">
                <ZombieIcon name="wrong" size={84} alt="오답" />
              </div>
              <p className="text-4xl font-bold text-red-400">틀렸습니다!</p>
              {myPlayer?.role === 'human' && <p className="mt-2 text-xl text-gray-400">체력 -{GAME_CONSTANTS.WRONG_PENALTY_HUMAN}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`absolute bottom-36 right-0 top-14 w-80 overflow-y-auto border-l-2 ${borderColor} bg-black/50 p-4`}>
          <h3 className={`mb-3 flex items-center gap-2 text-xl font-bold ${accentColor}`}>
            <ZombieIcon name="player" size={22} alt="" />
            플레이어 ({humanCount} 인간 / {zombieCount} 좀비)
          </h3>
        <div className="space-y-2">
          {players.map((player) => {
            const isMe = player.id === playerId
            const revealRole = isMe || isZombie
            return (
              <Card key={player.id} className={`border ${isMe ? borderColor : 'border-gray-700'} bg-gray-800/30`}>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{player.name}{isMe ? ' (나)' : ''}</div>
                      <div className="text-xs text-gray-400">{revealRole ? (player.role === 'zombie' ? '좀비' : '인간') : '정체불명'}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {player.role === 'human' ? `HP ${player.health}` : revealRole ? '좀비' : '???'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-20 border-t-2 ${borderColor} bg-black/90 shadow-lg backdrop-blur-sm`}>
        <div className="mx-auto max-w-7xl px-4 py-2">
          <h3 className={`mb-1 flex items-center gap-2 text-sm font-bold ${accentColor}`}>
            <ZombieIcon name="log" size={18} alt="" />
            생존 로그
          </h3>
          <div className="h-24 space-y-0.5 overflow-y-auto rounded-lg bg-black/50 p-2 font-mono text-xs">
            {gameLog.map((log) => (
              <div key={log.id} className={`${log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : log.type === 'danger' ? 'text-red-400' : log.type === 'infection' ? 'text-purple-400' : 'text-gray-300'}`}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </div>
  )
}
