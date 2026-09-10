'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAudioContext } from '@/components/AudioProvider'
import {
  checkWinCondition,
  formatTime,
  GAME_CONSTANTS,
  roomPlayerToZombiePlayer,
  scanPlayer,
  type RoomZombiePlayer,
  type ZombieActionKind,
  type ZombieActionType,
  type ZombieGameLog,
} from '@/lib/game/zombie'
import type { ZombieAttackResult } from '@/lib/services/playerMutations'
import type { Question } from '@/hooks/useGameBase'

type ViewState = 'quiz' | 'actionSelect' | 'targetSelect' | 'scanResult' | 'attackResult' | 'wrong'

type ZombieViewProps = {
  roomCode: string
  playerId: string
  roomStatus: string
  roomStartedAt?: string | null
  roomDurationSeconds?: number | null
  roomPlayers: RoomZombiePlayer[]
  currentQuestion: Question | null
  onAnswer: (answer: string) => Promise<boolean>
  onNextQuestion: () => void
  onGameEnd?: () => void
  onFinishRoom: () => Promise<boolean>
  /** 정답·오답·치료·방어막을 서버에 보고하고, 권위 있는 최종 상태를 돌려받는다. */
  onZombieAction: (action: ZombieActionKind) => Promise<RoomZombiePlayer | null>
  onZombieAttack: (zombieId: string, targetId: string, damage: number) => Promise<ZombieAttackResult>
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
  roomStartedAt,
  roomDurationSeconds,
  roomPlayers,
  playerId,
  currentQuestion,
  onAnswer,
  onNextQuestion,
  onFinishRoom,
  onZombieAction,
  onZombieAttack,
}: ZombieViewProps) {
  const startedAtMs = roomStartedAt ? new Date(roomStartedAt).getTime() : null
  const totalDurationSec = roomDurationSeconds ?? GAME_CONSTANTS.GAME_DURATION

  const computeRemaining = useCallback(() => {
    if (!startedAtMs) return totalDurationSec
    const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000)
    return Math.max(0, totalDurationSec - elapsedSec)
  }, [startedAtMs, totalDurationSec])

  const [currentView, setCurrentView] = useState<ViewState>('quiz')
  const { revealedAnswer, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [timeRemaining, setTimeRemaining] = useState(computeRemaining)
  const [gameLog, setGameLog] = useState<ZombieGameLog[]>([])
  const [lastScanResult, setLastScanResult] = useState<{ playerId: string; isZombie: boolean } | null>(null)
  const [lastAttackResult, setLastAttackResult] = useState<
    { targetId: string; damage: number; infected: boolean; missed: boolean; log: string; pending: boolean } | null
  >(null)
  const [scanCooldown, setScanCooldown] = useState(0)
  // 스캔으로 직접 확인한 플레이어만 정체를 계속 볼 수 있다.
  const [scannedIds, setScannedIds] = useState<ReadonlySet<string>>(() => new Set())
  // 내가 공격당했을 때 띄우는 피드백. 게임 로그는 각자 화면에만 쌓이므로,
  // 이것이 없으면 피해자는 체력이 조용히 줄어드는 것 말고는 아무 신호를 받지 못한다.
  const [selfHit, setSelfHit] = useState<{ id: number; lostHealth: number; lostShield: number } | null>(null)
  const [showInfectedAlert, setShowInfectedAlert] = useState(false)
  // 오답 페널티처럼 내가 스스로 깎은 체력은 "공격당함"으로 세지 않는다.
  const selfHealthDropGuardRef = useRef(0)
  const prevSelfRef = useRef<{ role: string; health: number; shield: number } | null>(null)
  const finishingRef = useRef(false)
  const { playSFX } = useAudioContext()

  // 방 플레이어 목록은 점수순으로 들어온다. 좀비 모드에서는 점수가 역할과 묶여 있어
  // (인간 = 200+체력, 좀비 = 감염수) 그 순서를 그대로 그리면 정렬만 보고도 좀비를 골라낼 수 있다.
  // 정체를 감춰야 하는 화면이므로 역할과 무관한 이름순으로 다시 세운다.
  const players = useMemo(
    () => roomPlayers
      .map(roomPlayerToZombiePlayer)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [roomPlayers],
  )
  const myPlayer = players.find((player) => player.id === playerId) ?? null
  const otherPlayers = players.filter((player) => player.id !== playerId)
  const isZombie = myPlayer?.role === 'zombie'
  const isPaused = roomStatus === 'paused'
  const humanCount = players.filter((player) => player.role === 'human').length
  const zombieCount = players.filter((player) => player.role === 'zombie').length
  const isUrgent = timeRemaining <= 60 && roomStatus === 'playing'

  useEffect(() => {
    setTimeRemaining(computeRemaining())
    if (roomStatus !== 'playing' || isPaused) return
    const timer = window.setInterval(() => {
      setTimeRemaining(computeRemaining())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [computeRemaining, isPaused, roomStatus])

  useEffect(() => {
    const winCheck = checkWinCondition(players, timeRemaining)
    if (!winCheck.gameOver || finishingRef.current) return
    finishingRef.current = true
    setGameLog((logs) => addLog(logs, winCheck.reason, winCheck.winner === 'human' ? 'success' : 'danger'))
    void onFinishRoom()
  }, [onFinishRoom, players, timeRemaining])

  // 내 상태가 남의 행동으로 바뀐 것을 감지해 알려준다 (감염·피격).
  const selfRole = myPlayer?.role ?? null
  const selfHealth = myPlayer?.health ?? null
  const selfShield = myPlayer?.shield ?? null
  useEffect(() => {
    if (selfRole === null || selfHealth === null || selfShield === null) return
    const prev = prevSelfRef.current
    prevSelfRef.current = { role: selfRole, health: selfHealth, shield: selfShield }
    if (!prev) return

    if (prev.role === 'human' && selfRole === 'zombie') {
      setShowInfectedAlert(true)
      setSelfHit(null)
      return
    }
    if (selfRole !== 'human') return

    const lostHealth = Math.max(0, prev.health - selfHealth)
    const lostShield = Math.max(0, prev.shield - selfShield)
    if (lostHealth === 0 && lostShield === 0) return

    // 내 오답으로 깎인 체력이면 소비하고 넘어간다.
    if (lostShield === 0 && selfHealthDropGuardRef.current > 0) {
      selfHealthDropGuardRef.current -= 1
      return
    }

    setSelfHit({ id: Date.now(), lostHealth, lostShield })
    setGameLog((logs) => addLog(
      logs,
      lostShield > 0 && lostHealth === 0
        ? `🩸 공격당했습니다! 방어막 -${lostShield} (남은 방어막 ${selfShield})`
        : `🩸 공격당했습니다! 체력 -${lostHealth} (HP ${selfHealth})`,
      'danger',
    ))
  }, [selfHealth, selfRole, selfShield])

  useEffect(() => {
    if (!showInfectedAlert) return
    playSFX('incorrect')
    setGameLog((logs) => addLog(logs, '💀 감염되었습니다! 이제 남은 인간을 감염시키세요.', 'infection'))
    const timer = window.setTimeout(() => setShowInfectedAlert(false), 3200)
    return () => window.clearTimeout(timer)
  }, [playSFX, showInfectedAlert])

  useEffect(() => {
    if (!selfHit) return
    const timer = window.setTimeout(() => setSelfHit(null), 1400)
    return () => window.clearTimeout(timer)
  }, [selfHit])

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
    if (!lastAttackResult || lastAttackResult.pending) return
    const timer = window.setTimeout(() => {
      setLastAttackResult(null)
      setCurrentView('quiz')
      onNextQuestion()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [lastAttackResult, onNextQuestion])

  // 규칙 판정(체력·공격력·역할 전이)은 전부 서버가 한다.
  // 화면에 쓰는 값은 RPC가 돌려준 권위 있는 결과뿐이라, 감염된 직후 아직 그 사실을
  // 모르는 클라이언트가 답을 제출해도 감염이 되돌아가지 않는다.
  const reportAction = (action: ZombieActionKind, onResult: (after: ReturnType<typeof roomPlayerToZombiePlayer>) => void) => {
    void onZombieAction(action)
      .then((row) => { if (row) onResult(roomPlayerToZombiePlayer(row)) })
      .catch((error) => { console.error('좀비 행동 처리 실패:', error) })
  }

  const handleAnswerSubmit = async (answer: string) => {
    if (!myPlayer || roomStatus !== 'playing') return false

    const correct = answer ? await onAnswer(answer) : false

    if (correct) {
      playSFX('correct')
      reportAction('correct', (after) => {
        if (after.correctStreak === 0 || after.correctStreak % 3 !== 0) return
        setGameLog((logs) => addLog(
          logs,
          after.role === 'human'
            ? `🔥 ${after.name} ${after.correctStreak}연속 정답! 보너스 체력 +${GAME_CONSTANTS.CORRECT_STREAK_3_BONUS}`
            : `🔥 ${after.name} ${after.correctStreak}연속 정답! 공격력 +${GAME_CONSTANTS.ZOMBIE_STREAK_BONUS}`,
          'success',
        ))
      })
      window.setTimeout(() => setCurrentView('actionSelect'), 700)
      return true
    }

    playSFX('incorrect')
    const wasHuman = myPlayer.role === 'human'
    if (wasHuman) selfHealthDropGuardRef.current += 1
    reportAction('wrong', (after) => {
      const becameZombie = wasHuman && after.role === 'zombie'
      setGameLog((logs) => addLog(
        logs,
        becameZombie
          ? `${after.name}이(가) 좀비가 되었습니다!`
          : after.role === 'human'
            ? `${after.name} 오답! 체력 -${GAME_CONSTANTS.WRONG_PENALTY_HUMAN} (HP: ${after.health})`
            : `${after.name} 오답!`,
        becameZombie ? 'infection' : 'warning',
      ))
    })
    setScanCooldown((prev) => Math.max(0, prev - 1))
    setCurrentView('wrong')
    revealAnswer(currentQuestion?.id)
    window.setTimeout(() => {
      setCurrentView('quiz')
      clearRevealedAnswer()
      onNextQuestion()
    }, 3000)
    return false
  }

  const handleHumanAction = (action: 'heal' | 'shield') => {
    if (!myPlayer) return
    reportAction(action, (after) => {
      setGameLog((logs) => addLog(
        logs,
        action === 'heal'
          ? `${after.name}이(가) 체력을 회복했습니다! (HP: ${after.health})`
          : `${after.name}이(가) 방어막을 획득했습니다! (방어막: ${after.shield})`,
        'success',
      ))
    })
    setScanCooldown((prev) => Math.max(0, prev - 1))
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
      setScannedIds((prev) => new Set(prev).add(targetId))
      setLastScanResult({ playerId: targetId, isZombie: result.isZombie })
      setGameLog((logs) => addLog(logs, result.log, result.isZombie ? 'danger' : 'info'))
      setScanCooldown(GAME_CONSTANTS.SCAN_COOLDOWN_ROUNDS)
      setCurrentView('scanResult')
      playSFX('click')
      return
    }

    // 감염 연출은 서버가 판정한 outcome으로만 띄운다. 여러 좀비가 같은 표적에
    // 막타를 노려도, 실제로 감염을 성사시킨 한 명만 "감염 성공!"을 본다.
    setLastAttackResult({ targetId, damage: myPlayer.attackPower, infected: false, missed: false, log: '', pending: true })
    setCurrentView('attackResult')
    playSFX('incorrect')

    void onZombieAttack(myPlayer.id, target.id, myPlayer.attackPower)
      .then((result) => {
        const targetRow = result.players.find((row) => row.id === target.id)
        const after = targetRow ? roomPlayerToZombiePlayer(targetRow) : null
        const infected = result.outcome === 'infected'
        const log = infected
          ? `${myPlayer.name}이(가) ${target.name}을(를) 감염시켰습니다! ${target.name}은(는) 이제 좀비입니다!`
          : result.outcome === 'damaged'
            ? `${myPlayer.name}이(가) ${target.name}을(를) 공격했습니다! (HP: ${after?.health ?? target.health}${after && after.shield > 0 ? `, 방어막 ${after.shield}` : ''})`
            : `${target.name}은(는) 이미 다른 좀비에게 감염됐습니다. 공격이 빗나갔어요.`
        setLastAttackResult({
          targetId,
          damage: myPlayer.attackPower,
          infected,
          missed: !infected && result.outcome !== 'damaged',
          log,
          pending: false,
        })
        setGameLog((logs) => addLog(logs, log, infected ? 'infection' : result.outcome === 'damaged' ? 'danger' : 'warning'))
      })
      .catch((error) => {
        console.error('좀비 공격 처리 실패:', error)
        setLastAttackResult({ targetId, damage: 0, infected: false, missed: true, log: '공격을 전송하지 못했습니다.', pending: false })
      })
  }

  const overlayColor = isZombie ? 'rgba(5, 46, 22, 0.5)' : 'rgba(30, 27, 75, 0.5)'
  const accentColor = isZombie ? 'text-green-400' : 'text-blue-400'
  const borderColor = isZombie ? 'border-green-600' : 'border-blue-600'

  return (
    <div
      className="relative h-dvh w-full overflow-hidden"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        backgroundImage: `linear-gradient(${overlayColor}, rgba(0,0,0,0.7)), url('/zombie/background.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className={`absolute left-0 right-0 top-0 z-20 border-b-2 ${borderColor} bg-black/80 shadow-lg backdrop-blur-sm`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-4">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <ZombieIcon name="timer" size={28} alt="" />
              <span className={`text-2xl font-bold tabular-nums sm:text-3xl ${isUrgent ? 'animate-pulse text-red-500' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
          </div>
          <div className={`flex shrink-0 items-center whitespace-nowrap rounded-full border-2 px-3 py-1 sm:px-4 ${isZombie ? 'border-green-500 bg-green-950/80' : 'border-blue-500 bg-blue-950/80'}`}>
            <ZombieIcon
              name={isZombie ? 'zombie' : 'human'}
              size={24}
              className="mr-1.5 inline-block shrink-0 align-middle sm:mr-2"
              alt={isZombie ? '좀비' : '인간'}
            />
            <span className={`text-base font-bold sm:text-lg ${accentColor}`}>{isZombie ? '좀비' : '인간'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
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

      <div className="absolute bottom-36 left-0 right-0 top-14 flex items-center justify-center md:right-80">
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
                  variant="glass"
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
              <Card className={`border-4 ${borderColor} bg-black/90`}>
                <CardContent className="p-4 text-center sm:p-8">
                  <h2 className={`mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl ${accentColor}`}>정답! 행동을 선택하세요</h2>
                  {isZombie ? (
                    <Button onClick={() => setCurrentView('targetSelect')} size="lg" className="h-24 w-full bg-gradient-to-br from-red-700 to-red-600 text-xl font-bold text-white hover:from-red-800 hover:to-red-700">
                      <ZombieIcon name="attack" size={32} className="mr-3" alt="" />
                      인간 공격하기
                    </Button>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                      <Button onClick={() => handleHumanAction('heal')} size="lg" className="flex h-24 flex-col items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-600 text-base font-bold text-white sm:h-28 sm:text-lg">
                        <ZombieIcon name="heal" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        치료
                      </Button>
                      <Button onClick={() => handleHumanAction('shield')} size="lg" className="flex h-24 flex-col items-center justify-center bg-gradient-to-br from-cyan-700 to-cyan-600 text-base font-bold text-white sm:h-28 sm:text-lg">
                        <ZombieIcon name="shield" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        방어막
                      </Button>
                      <Button
                        onClick={() => setCurrentView('targetSelect')}
                        disabled={scanCooldown > 0}
                        size="lg"
                        className="flex h-24 flex-col items-center justify-center bg-gradient-to-br from-purple-700 to-purple-600 text-base font-bold text-white disabled:opacity-50 sm:h-28 sm:text-lg"
                      >
                        <ZombieIcon name="scan" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        {scanCooldown > 0 ? `스캔 (${scanCooldown})` : '스캔'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'targetSelect' && (
            <motion.div key="targetSelect" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90`}>
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
                          {!isZombie && (
                            scannedIds.has(player.id)
                              ? <div className={`text-xs ${player.role === 'zombie' ? 'text-red-300' : 'text-blue-300'}`}>스캔 완료 · {player.role === 'zombie' ? '좀비' : '인간'}</div>
                              : <div className="text-xs text-gray-400">정체불명</div>
                          )}
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
                  name={lastAttackResult.infected ? 'zombie' : lastAttackResult.missed ? 'wrong' : 'attack'}
                  size={96}
                  alt={lastAttackResult.infected ? '감염' : lastAttackResult.missed ? '빗나감' : '공격'}
                />
              </div>
              <p className={`text-4xl font-bold ${lastAttackResult.pending ? 'text-gray-300' : lastAttackResult.infected ? 'text-green-400' : lastAttackResult.missed ? 'text-yellow-400' : 'text-red-400'}`}>
                {lastAttackResult.pending
                  ? '공격 중...'
                  : lastAttackResult.infected
                    ? '감염 성공!'
                    : lastAttackResult.missed
                      ? '한발 늦었어요!'
                      : `${lastAttackResult.damage} 데미지!`}
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
              <AnswerReveal answer={revealedAnswer} />
              {myPlayer?.role === 'human' && <p className="mt-2 text-xl text-gray-400">체력 -{GAME_CONSTANTS.WRONG_PENALTY_HUMAN}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`absolute bottom-36 right-0 top-14 hidden w-80 overflow-y-auto border-l-2 ${borderColor} bg-black/50 p-4 md:block`}>
          <h3 className={`mb-3 flex items-center gap-2 text-xl font-bold ${accentColor}`}>
            <ZombieIcon name="player" size={22} alt="" />
            플레이어 ({humanCount} 인간 / {zombieCount} 좀비)
          </h3>
        <div className="space-y-2">
          {players.map((player) => {
            const isMe = player.id === playerId
            const revealRole = isMe || isZombie || scannedIds.has(player.id)
            return (
              <Card key={player.id} className={`border ${isMe ? borderColor : 'border-gray-700'} bg-gray-800/30`}>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{player.name}{isMe ? ' (나)' : ''}</div>
                      <div className="text-xs text-gray-400">{revealRole ? (player.role === 'zombie' ? '좀비' : '인간') : '정체불명'}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {/* 정체를 모르는 상대는 HP도 숨긴다. 인간만 숫자가 뜨면 그 자체로 좀비가 드러난다. */}
                      {!revealRole ? '???' : player.role === 'human' ? `HP ${player.health}` : '좀비'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 z-20 border-t-2 ${borderColor} bg-black/90 shadow-lg`}>
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

      {/* 피격 피드백 — 화면 가장자리를 붉게 번쩍이고 잃은 수치를 띄운다 */}
      <AnimatePresence>
        {selfHit && (
          <motion.div
            key={selfHit.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center pt-24"
            style={{ boxShadow: 'inset 0 0 140px 40px rgba(220, 38, 38, 0.55)' }}
          >
            <motion.div
              initial={{ y: 10, scale: 0.8 }}
              animate={{ y: -14, scale: 1 }}
              className="rounded-full bg-red-950/85 px-6 py-2 text-3xl font-black text-red-300 shadow-2xl"
            >
              {selfHit.lostShield > 0 && selfHit.lostHealth === 0
                ? `방어막 -${selfHit.lostShield}`
                : `-${selfHit.lostHealth}`}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 감염 순간 — 역할이 바뀐 걸 본인이 확실히 알아야 한다 */}
      <AnimatePresence>
        {showInfectedAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/80 p-6 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.15, 1] }} transition={{ duration: 0.7 }} className="text-center">
              <motion.div animate={{ y: [0, -16, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex justify-center">
                <ZombieIcon name="zombie" size={120} alt="감염" />
              </motion.div>
              <h2 className="mt-6 text-5xl font-black text-green-300">감염되었습니다!</h2>
              <p className="mt-3 text-2xl text-gray-200">이제 남은 인간을 감염시키세요.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
