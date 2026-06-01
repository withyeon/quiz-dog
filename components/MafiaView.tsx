'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, DollarSign, Gem, Radio, ShieldAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QuizView from '@/components/QuizView'
import {
  applyCheat,
  attemptInvestigate,
  calculateLaunderedCash,
  calculateTotalMultiplier,
  formatTime,
  generateSafeVaults,
  openSafeVault,
  type MultiplierType,
  type Player as MafiaPlayer,
  type SafeVault,
} from '@/lib/game/mafia'
import { subscribeRoomRuntimeEvent, type RoomEventType } from '@/lib/realtime/roomChannel'
import type { Database, Json } from '@/types/database.types'
import type { Question } from '@/hooks/useGameBase'

type PlayerRow = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<PlayerRow> & Record<string, unknown>

type MafiaRuntime = {
  isCheating?: boolean
  cheatEndTime?: number
  multipliers?: MultiplierType[]
}

type GameLog = {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'danger'
  timestamp: number
}

interface MafiaViewProps {
  roomCode: string
  playerId: string
  players: PlayerRow[]
  currentQuestion: Question | null
  timeRemaining: number
  checkAnswer: (answer: string) => Promise<boolean>
  goToNextQuestion: () => void
  commitPlayerPatch: (playerId: string, patch: PlayerPatch, reason?: string) => Promise<void>
  sendRoomEvent: (type: RoomEventType, payload?: unknown) => Promise<unknown> | { ok: boolean; reason?: string }
  playSFX: (sound: 'correct' | 'incorrect' | 'item' | 'click') => void
}

type MafiaViewType = 'quiz' | 'actionSelect' | 'vaultSelection' | 'vaultResult' | 'investigation' | 'wrong'

function parseRuntime(value: Json | null | undefined): MafiaRuntime {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = 'mafia' in value && value.mafia && typeof value.mafia === 'object'
    ? value.mafia
    : value
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const raw = source as Record<string, unknown>
  return {
    isCheating: raw.isCheating === true,
    cheatEndTime: typeof raw.cheatEndTime === 'number' ? raw.cheatEndTime : undefined,
    multipliers: Array.isArray(raw.multipliers)
      ? raw.multipliers.filter((item): item is MultiplierType => item === 1.5 || item === 2)
      : [],
  }
}

function toMafiaPlayer(player: PlayerRow): MafiaPlayer {
  const runtime = parseRuntime(player.active_item)
  return {
    id: player.id,
    name: player.nickname,
    isAi: false,
    cash: player.mafia_cash ?? player.score ?? 0,
    diamonds: player.mafia_diamonds ?? 0,
    status: 'active',
    isCheating: Boolean(runtime.isCheating && runtime.cheatEndTime && runtime.cheatEndTime > Date.now()),
    cheatEndTime: runtime.cheatEndTime,
    multipliers: runtime.multipliers ?? [],
  }
}

function createPatch(player: MafiaPlayer): PlayerPatch {
  const score = calculateLaunderedCash(player)
  return {
    mafia_cash: player.cash,
    mafia_diamonds: player.diamonds,
    score,
    gold: player.cash,
    active_item: {
      mafia: {
        isCheating: player.isCheating,
        cheatEndTime: player.cheatEndTime,
        multipliers: player.multipliers,
      },
    },
  }
}

export default function MafiaView({
  roomCode,
  playerId,
  players,
  currentQuestion,
  timeRemaining,
  checkAnswer,
  goToNextQuestion,
  commitPlayerPatch,
  sendRoomEvent,
  playSFX,
}: MafiaViewProps) {
  const [currentView, setCurrentView] = useState<MafiaViewType>('quiz')
  const [currentVaults, setCurrentVaults] = useState<SafeVault[]>([])
  const [cheatVaultContents, setCheatVaultContents] = useState<SafeVault[] | null>(null)
  const [selectedVaultResult, setSelectedVaultResult] = useState<{ vault: SafeVault; log: string } | null>(null)
  const [investigatingPlayer, setInvestigatingPlayer] = useState<string | null>(null)
  const [investigationResult, setInvestigationResult] = useState<'CHEATER' | 'CLEAR' | null>(null)
  const [gameLog, setGameLog] = useState<GameLog[]>([])
  const [showCheatCaught, setShowCheatCaught] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

  const mafiaPlayers = useMemo(() => players.map(toMafiaPlayer), [players])
  const player = mafiaPlayers.find((p) => p.id === playerId) ?? null
  const otherPlayers = mafiaPlayers.filter((p) => p.id !== playerId)
  const sortedPlayers = useMemo(
    () => [...mafiaPlayers].sort((a, b) => calculateLaunderedCash(b) - calculateLaunderedCash(a)),
    [mafiaPlayers],
  )

  const addLog = useCallback((message: string, type: GameLog['type'] = 'info') => {
    setGameLog((prev) => [
      ...prev.slice(-24),
      { id: `${Date.now()}-${Math.random()}`, message, type, timestamp: Date.now() },
    ])
  }, [])

  const broadcastLog = useCallback((message: string, type: GameLog['type'] = 'info') => {
    addLog(message, type)
    void sendRoomEvent('game:effect', {
      kind: 'mafia:log',
      message,
      logType: type,
    })
  }, [addLog, sendRoomEvent])

  useEffect(() => {
    addLog('게임이 시작되었습니다. 정답을 맞히고 금고를 열거나 친구를 조사하세요.', 'info')
  }, [addLog])

  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode || event.type !== 'game:effect') return
      const payload = event.payload as { kind?: string; message?: string; logType?: GameLog['type'] } | undefined
      if (payload?.kind !== 'mafia:log' || !payload.message) return
      addLog(payload.message, payload.logType ?? 'info')
    })
  }, [addLog, roomCode])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameLog])

  useEffect(() => {
    if (!player?.isCheating || !player.cheatEndTime) return
    const delay = Math.max(0, player.cheatEndTime - Date.now())
    const timer = window.setTimeout(() => {
      void commitPlayerPatch(player.id, createPatch({ ...player, isCheating: false, cheatEndTime: undefined }), 'mafia_cheat_expired')
    }, delay + 150)
    return () => window.clearTimeout(timer)
  }, [commitPlayerPatch, player])

  const goToQuiz = useCallback(() => {
    setCurrentView('quiz')
    setCurrentVaults([])
    setCheatVaultContents(null)
    setSelectedVaultResult(null)
    setInvestigatingPlayer(null)
    setInvestigationResult(null)
    goToNextQuestion()
  }, [goToNextQuestion])

  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (correct) {
      playSFX('correct')
      window.setTimeout(() => setCurrentView('actionSelect'), 600)
    } else {
      playSFX('incorrect')
      setCurrentView('wrong')
      window.setTimeout(goToQuiz, 1300)
    }
    return correct
  }

  const handleOpenVaultChoice = () => {
    setCurrentVaults(generateSafeVaults())
    setCheatVaultContents(null)
    setSelectedVaultResult(null)
    setCurrentView('vaultSelection')
    playSFX('click')
  }

  const handleVaultSelect = async (vaultId: string) => {
    if (!player) return
    const vault = currentVaults.find((v) => v.id === vaultId)
    if (!vault) return
    const result = openSafeVault(vault, player)
    setSelectedVaultResult({ vault, log: result.log })
    setCurrentView('vaultResult')
    await commitPlayerPatch(player.id, createPatch(result.newPlayer), 'mafia_vault_opened')
    broadcastLog(result.log, vault.reward === 'empty' ? 'info' : 'success')
    playSFX('item')
    window.setTimeout(goToQuiz, 1800)
  }

  const handleCheat = async () => {
    if (!player || currentVaults.length === 0) return
    const result = applyCheat(currentVaults, player, Date.now())
    setCheatVaultContents(result.vaultContents)
    await commitPlayerPatch(player.id, createPatch(result.newPlayer), 'mafia_cheat_started')
    broadcastLog(`${player.name}가 금고 쪽에서 수상한 움직임을 보였습니다.`, 'warning')
    playSFX('click')
  }

  const handleInvestigate = () => {
    setCurrentView('investigation')
    setInvestigationResult(null)
    setInvestigatingPlayer(null)
    playSFX('click')
  }

  const handleStartInvestigation = async (targetId: string) => {
    if (!player) return
    const target = mafiaPlayers.find((p) => p.id === targetId)
    if (!target) return

    setInvestigatingPlayer(targetId)
    setInvestigationResult(null)
    window.setTimeout(async () => {
      const result = attemptInvestigate(player, target, Date.now())
      setInvestigationResult(result.result)
      await Promise.all([
        commitPlayerPatch(player.id, createPatch(result.newInvestigator), 'mafia_investigator_reward'),
        commitPlayerPatch(target.id, createPatch(result.newTarget), 'mafia_target_investigated'),
      ])
      broadcastLog(result.log, result.success ? 'danger' : 'info')
      if (result.success) {
        setShowCheatCaught(true)
        window.setTimeout(() => setShowCheatCaught(false), 2400)
      }
      window.setTimeout(goToQuiz, 1800)
    }, 1400)
  }

  const getVaultDisplay = (vault: SafeVault, isRevealed: boolean) => {
    if (!isRevealed) return { icon: '🔒', text: '???' }
    if (vault.reward === 'cash') return { icon: '💵', text: `$${vault.amount}` }
    if (vault.reward === 'diamond') return { icon: '💎', text: `${vault.amount}개` }
    if (vault.reward === 'multiplier_1.5') return { icon: '⚡', text: 'x1.5' }
    if (vault.reward === 'multiplier_2') return { icon: '⚡⚡', text: 'x2' }
    return { icon: '❌', text: '빈 금고' }
  }

  const isUrgent = timeRemaining <= 30

  if (!player) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-2xl font-black text-yellow-300">
        플레이어 정보를 불러오는 중...
      </div>
    )
  }

  return (
    <div className="mafia-ambient relative h-screen w-full overflow-hidden bg-slate-950" style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}>
      <div className="absolute left-0 right-0 top-0 z-20 border-b-2 border-yellow-600 bg-black/85 shadow-lg backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-5">
            <span className={`whitespace-nowrap text-2xl font-bold tabular-nums sm:text-4xl ${isUrgent ? 'animate-pulse text-red-500' : 'text-yellow-400'}`}>
              {formatTime(timeRemaining)}
            </span>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-xl font-bold text-yellow-400 sm:gap-2 sm:text-3xl">
              <DollarSign className="h-5 w-5 shrink-0 sm:h-8 sm:w-8" />
              {calculateLaunderedCash(player).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-lg font-bold text-cyan-300 sm:gap-2 sm:text-2xl">
              <Gem className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
              {player.diamonds}
            </div>
            {player.multipliers.length > 0 && (
              <div className="whitespace-nowrap rounded bg-yellow-500 px-2 py-0.5 text-base font-black text-black sm:px-3 sm:py-1 sm:text-xl">
                x{calculateTotalMultiplier(player.multipliers).toFixed(1)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap text-base font-bold text-white sm:text-lg">
            <Users className="h-5 w-5 shrink-0 text-yellow-300" />
            {players.length}명
          </div>
        </div>
      </div>

      <div className="absolute bottom-36 left-0 right-0 top-16 flex items-center justify-center p-3 sm:p-5 md:right-80">
        <AnimatePresence mode="wait">
          {currentView === 'quiz' && currentQuestion && (
            <motion.div key="quiz" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-4xl">
              <QuizView question={currentQuestion} onAnswer={handleAnswerSubmit} onCorrectClick={() => setCurrentView('actionSelect')} timeLimit={30} />
            </motion.div>
          )}

          {currentView === 'actionSelect' && (
            <motion.div key="action" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="w-full max-w-2xl">
              <Card className="border-4 border-yellow-600 bg-black/90">
                <CardContent className="p-4 text-center sm:p-8">
                  <h2 className="mb-4 text-2xl font-bold text-yellow-400 sm:mb-6 sm:text-4xl">정답입니다. 다음 행동을 고르세요.</h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <Button onClick={handleOpenVaultChoice} className="h-28 bg-yellow-500 text-xl font-black text-black hover:bg-yellow-400 sm:h-32 sm:text-2xl">
                      <span className="flex flex-col items-center gap-2"><span className="text-4xl sm:text-5xl">🔐</span>금고 열기</span>
                    </Button>
                    <Button onClick={handleInvestigate} className="h-28 bg-blue-600 text-xl font-black text-white hover:bg-blue-500 sm:h-32 sm:text-2xl" disabled={otherPlayers.length === 0}>
                      <span className="flex flex-col items-center gap-2"><Eye className="h-8 w-8 sm:h-9 sm:w-9" />친구 조사</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'vaultSelection' && (
            <motion.div key="vault" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-4xl">
              <Card className="border-4 border-yellow-600 bg-black/90 shadow-2xl">
                <CardContent className="p-4 sm:p-8">
                  <h2 className="mb-4 text-center text-2xl font-bold text-yellow-400 sm:mb-6 sm:text-4xl">금고를 선택하세요</h2>
                  <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-5">
                    {currentVaults.map((vault) => {
                      const revealed = cheatVaultContents !== null
                      const shownVault = revealed ? cheatVaultContents?.find((item) => item.id === vault.id) ?? vault : vault
                      const display = getVaultDisplay(shownVault, revealed)
                      return (
                        <button
                          key={vault.id}
                          onClick={() => void handleVaultSelect(vault.id)}
                          className={`aspect-square rounded-xl border-4 p-2 transition hover:scale-105 sm:p-5 ${revealed ? 'border-cyan-400 bg-cyan-900' : 'border-yellow-600 bg-yellow-900'}`}
                        >
                          <div className="text-4xl sm:text-7xl">{display.icon}</div>
                          <div className="mt-1.5 text-base font-black text-white sm:mt-3 sm:text-2xl">{display.text}</div>
                        </button>
                      )
                    })}
                  </div>
                  <Button onClick={() => void handleCheat()} className="w-full bg-red-600 py-4 text-lg font-black text-white hover:bg-red-500 sm:py-6 sm:text-2xl">
                    <Eye className="mr-2 h-5 w-5 sm:h-6 sm:w-6" /> 금고 몰래보기
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'investigation' && (
            <motion.div key="investigation" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-3xl">
              <Card className="border-4 border-blue-600 bg-black/90">
                <CardContent className="p-8">
                  <h2 className="mb-6 text-center text-4xl font-bold text-blue-300">누구를 조사할까요?</h2>
                  {investigatingPlayer ? (
                    <div className="py-12 text-center">
                      {investigationResult ? (
                        <>
                          <div className="mb-4 text-7xl">{investigationResult === 'CHEATER' ? '🚨' : '✅'}</div>
                          <p className={`text-4xl font-black ${investigationResult === 'CHEATER' ? 'text-red-400' : 'text-green-400'}`}>
                            {investigationResult}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mb-4 text-7xl">🔍</div>
                          <p className="text-3xl text-gray-200">조사 중...</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {otherPlayers.map((target) => (
                        <Button key={target.id} onClick={() => void handleStartInvestigation(target.id)} className="w-full justify-between bg-gray-800 px-5 py-6 text-xl font-bold text-white hover:bg-gray-700">
                          <span className="flex items-center gap-3">
                            <ShieldAlert className={target.isCheating ? 'h-6 w-6 text-orange-400' : 'h-6 w-6 text-gray-400'} />
                            {target.name}
                          </span>
                          <span className="text-yellow-300">${calculateLaunderedCash(target).toLocaleString()}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'vaultResult' && selectedVaultResult && (
            <motion.div key="vaultResult" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="text-center">
              <div className="mb-4 text-8xl">{getVaultDisplay(selectedVaultResult.vault, true).icon}</div>
              <div className="max-w-2xl rounded-xl border-4 border-yellow-600 bg-black/90 p-8 text-3xl font-black text-yellow-300">
                {selectedVaultResult.log}
              </div>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-4xl font-black text-red-400">
              <div className="mb-4 text-7xl">❌</div>
              틀렸습니다
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <aside className="absolute bottom-36 right-0 top-16 hidden w-80 overflow-y-auto border-l-2 border-yellow-600 bg-black/60 p-5 md:block">
        <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold text-yellow-400">
          <Users className="h-7 w-7" /> 조직원
        </h2>
        <div className="space-y-3">
          {sortedPlayers.map((member, index) => (
            <Card key={member.id} className={`border-2 ${member.id === playerId ? 'border-yellow-400 bg-yellow-950/40' : member.isCheating ? 'border-orange-500 bg-orange-950/40' : 'border-gray-700 bg-gray-900/70'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white">#{index + 1} {member.name}</div>
                  {member.isCheating && <span className="rounded bg-orange-600 px-2 py-1 text-xs font-bold text-white">수상함</span>}
                </div>
                <div className="mt-2 text-xl font-black text-yellow-300">${calculateLaunderedCash(member).toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </aside>

      <div className="absolute bottom-0 left-0 right-0 z-20 border-t-2 border-yellow-600 bg-black/90 shadow-lg backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <h3 className="mb-2 flex items-center gap-2 text-xl font-bold text-yellow-400">
            <Radio className="h-5 w-5" /> 도청 장치
          </h3>
          <div className="h-28 overflow-y-auto rounded-lg bg-black/55 p-3 font-mono text-base">
            {gameLog.map((log) => (
              <div key={log.id} className={log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : log.type === 'danger' ? 'text-red-400' : 'text-gray-300'}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCheatCaught && (
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-red-600/50" />
            <div className="relative text-8xl font-black text-white drop-shadow-2xl">🚨 발각!</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
