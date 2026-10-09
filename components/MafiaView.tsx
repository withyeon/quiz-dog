'use client'

import { withJosa } from '@/lib/utils/korean'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, DollarSign, Gem, Radio, ShieldAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import {
  applyCheat,
  attemptInvestigate,
  calculateLaunderedCash,
  calculateTotalMultiplier,
  DIAMOND_CASH_VALUE,
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
import PixelIcon from '@/components/ui/PixelIcon'
import VaultIcon, { getVaultDisplay, VaultReveal } from '@/components/mafia/VaultIcon'
import QuizSetName from '@/components/game/QuizSetName'
import { getPlayerById } from '@/lib/services/players'

type PlayerRow = Database['public']['Tables']['players']['Row']
type PlayerPatch = Partial<PlayerRow> & Record<string, unknown>

type MafiaRuntime = {
  isCheating?: boolean
  cheatPendingVault?: boolean
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
  commitPlayerDelta: (playerId: string, deltas: Partial<Record<'mafia_cash' | 'mafia_diamonds' | 'score' | 'gold', number>>, options?: { reason?: string }) => Promise<unknown>
  commitPlayerSteal: (victimId: string, thiefId: string, amount: number, columns: Array<'mafia_cash' | 'score' | 'gold'>, reason?: string) => Promise<unknown>
  sendRoomEvent: (type: RoomEventType, payload?: unknown) => Promise<unknown> | { ok: boolean; reason?: string }
  playSFX: (sound: 'correct' | 'incorrect' | 'item' | 'click') => void
  questionSetTitle?: string | null
}

type MafiaViewType = 'quiz' | 'actionSelect' | 'vaultSelection' | 'vaultResult' | 'investigation' | 'wrong'

/** 발각 경고가 화면에 보이는 시간(ms). 화면이 보이는 동안만 센다. */
const CAUGHT_NOTICE_MS = 4000

function parseRuntime(value: Json | null | undefined): MafiaRuntime {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = 'mafia' in value && value.mafia && typeof value.mafia === 'object'
    ? value.mafia
    : value
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {}
  const raw = source as Record<string, unknown>
  return {
    isCheating: raw.isCheating === true,
    cheatPendingVault: raw.cheatPendingVault === true,
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
    // 라운드 기반 수상함: 시간 만료 없이 플래그가 그대로 유지된다.
    isCheating: runtime.isCheating === true,
    cheatPendingVault: runtime.cheatPendingVault === true,
    multipliers: runtime.multipliers ?? [],
  }
}

/** 수상함/배수 등 비숫자 플래그만 담은 부분 patch (숫자 컬럼은 원자 delta로 별도 처리). */
function createFlagPatch(player: MafiaPlayer): PlayerPatch {
  return {
    active_item: {
      mafia: {
        isCheating: player.isCheating,
        cheatPendingVault: player.cheatPendingVault ?? false,
        multipliers: player.multipliers,
      },
    },
  }
}

/**
 * 로컬에서 계산한 old→new 변화를 "절대값 덮어쓰기" 대신 원자적 delta로 커밋한다.
 * 동시에 조사(강탈)당하는 경우에도 자금 변화가 유실되지 않도록 보장한다.
 * mafia는 DB(mafia_cash)를 권위로 삼으므로 score(=cash+diamonds*100)/gold(=cash)도 함께 delta.
 */
function mafiaNumericDelta(
  oldP: MafiaPlayer,
  newP: MafiaPlayer,
): Partial<Record<'mafia_cash' | 'mafia_diamonds' | 'score' | 'gold', number>> {
  const cashDelta = newP.cash - oldP.cash
  const diamondsDelta = newP.diamonds - oldP.diamonds
  const deltas: Partial<Record<'mafia_cash' | 'mafia_diamonds' | 'score' | 'gold', number>> = {}
  if (cashDelta !== 0) {
    deltas.mafia_cash = cashDelta
    deltas.gold = cashDelta
  }
  if (diamondsDelta !== 0) deltas.mafia_diamonds = diamondsDelta
  const scoreDelta = cashDelta + diamondsDelta * DIAMOND_CASH_VALUE
  if (scoreDelta !== 0) deltas.score = scoreDelta
  return deltas
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
  commitPlayerDelta,
  commitPlayerSteal,
  sendRoomEvent,
  playSFX,
  questionSetTitle,
}: MafiaViewProps) {
  const [currentView, setCurrentView] = useState<MafiaViewType>('quiz')
  const { revealedAnswer, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [currentVaults, setCurrentVaults] = useState<SafeVault[]>([])
  const [cheatVaultContents, setCheatVaultContents] = useState<SafeVault[] | null>(null)
  const [selectedVaultResult, setSelectedVaultResult] = useState<{ vault: SafeVault; log: string } | null>(null)
  const [investigatingPlayer, setInvestigatingPlayer] = useState<string | null>(null)
  const [investigationResult, setInvestigationResult] = useState<'CHEATER' | 'CLEAR' | null>(null)
  const [gameLog, setGameLog] = useState<GameLog[]>([])
  const [showCheatCaught, setShowCheatCaught] = useState(false)
  // 내가 친구 조사에 발각됐을 때 내 화면에 띄우는 경고 (조사자 이름 + 환수 금액)
  const [caughtNotice, setCaughtNotice] = useState<{ investigatorName: string; recovered: number } | null>(null)
  const caughtNoticeAtRef = useRef(0)
  // 내가 스스로 수상함을 해제한 시각(금고 열기·친구 조사). DB 폴백이 이를 '발각'으로 오인하지 않게 한다.
  const selfFlagClearAtRef = useRef(0)
  const wasCheatingRef = useRef<boolean | null>(null)
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

  // 발각 경고 표시. 같은 발각이 broadcast(mafia:caught)와 player:patch 폴백으로 두 번 들어와도 한 번만 띄운다.
  const showCaughtNotice = useCallback((investigatorName: string, recovered: number) => {
    const now = Date.now()
    if (now - caughtNoticeAtRef.current < 5000) {
      // 이미 떠 있는 경고에 더 자세한 정보(조사자 이름·환수 금액)가 뒤늦게 오면 내용만 갱신한다.
      setCaughtNotice((prev) => {
        if (!prev) return prev
        const richer = recovered > prev.recovered || (prev.investigatorName === '친구' && investigatorName !== '친구')
        return richer ? { investigatorName, recovered: Math.max(recovered, prev.recovered) } : prev
      })
      return
    }
    caughtNoticeAtRef.current = now
    setCaughtNotice({ investigatorName, recovered })
    playSFX('incorrect')
  }, [playSFX])

  // 발각 경고는 "화면이 보이는 동안" CAUGHT_NOTICE_MS 뒤에 닫는다.
  // 탭이 뒤에 숨어 있거나 폰 화면이 꺼진 채 발각되면(애니메이션·렌더가 멈춘 상태) 타이머를 돌리지 않고,
  // 다시 보이는 순간부터 세기 시작한다. (예전엔 숨은 탭에서 3초 만에 조용히 사라져 "안 떴다"고 보였다.)
  useEffect(() => {
    if (!caughtNotice || typeof document === 'undefined') return
    let timer: number | null = null
    const arm = () => {
      if (timer !== null) return
      timer = window.setTimeout(() => setCaughtNotice(null), CAUGHT_NOTICE_MS)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') arm()
    }
    if (document.visibilityState === 'visible') arm()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [caughtNotice])

  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode) return

      if (event.type === 'game:effect') {
        const payload = event.payload as {
          kind?: string
          message?: string
          logType?: GameLog['type']
          targetPlayerId?: string
          investigatorName?: string
          recovered?: number
        } | undefined
        if (!payload) return
        if (payload.kind === 'mafia:log' && payload.message) {
          addLog(payload.message, payload.logType ?? 'info')
          return
        }
        // 내가 친구 조사에 발각됐을 때: 조사자가 보낸 대상 지정 이벤트
        if (payload.kind === 'mafia:caught' && payload.targetPlayerId === playerId) {
          showCaughtNotice(payload.investigatorName ?? '누군가', payload.recovered ?? 0)
        }
        return
      }

      // 폴백: mafia:caught broadcast를 놓쳐도 조사자가 내 플래그를 해제하는 patch(reason)로 발각을 감지한다.
      if (event.type === 'player:patch') {
        const payload = event.payload as { playerId?: string; reason?: string } | undefined
        if (payload?.playerId === playerId && payload.reason === 'mafia_target_caught') {
          showCaughtNotice('친구', 0)
        }
      }
    })
  }, [addLog, playerId, roomCode, showCaughtNotice])

  // 최후 폴백: broadcast(mafia:caught·player:patch)가 모두 유실돼도 DB(postgres_changes·3초 재동기화)로
  // 내 수상함 플래그가 '남에 의해' 해제된 것을 감지하면 발각 경고를 띄운다.
  // 내가 금고를 열거나 친구를 조사해 스스로 해제한 경우(selfFlagClearAtRef)는 제외한다.
  const isCheatingNow = player?.isCheating ?? null
  useEffect(() => {
    const was = wasCheatingRef.current
    wasCheatingRef.current = isCheatingNow
    if (was !== true || isCheatingNow !== false) return
    const now = Date.now()
    if (now - selfFlagClearAtRef.current < 5000) return
    if (now - caughtNoticeAtRef.current < 15000) return // 이미 broadcast로 띄웠다
    showCaughtNotice('친구', 0)
  }, [isCheatingNow, showCaughtNotice])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameLog])

  const goToQuiz = useCallback(() => {
    setCurrentView('quiz')
    setCurrentVaults([])
    setCheatVaultContents(null)
    setSelectedVaultResult(null)
    setInvestigatingPlayer(null)
    setInvestigationResult(null)
    clearRevealedAnswer()
    goToNextQuestion()
  }, [goToNextQuestion, clearRevealedAnswer])

  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (correct) {
      playSFX('correct')
      window.setTimeout(() => setCurrentView('actionSelect'), 600)
    } else {
      playSFX('incorrect')
      setCurrentView('wrong')
      revealAnswer(currentQuestion?.id)
      window.setTimeout(goToQuiz, 3000)
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
    // 라운드 기반 수상함 처리:
    // - 방금 몰래본 그 라운드의 금고 열기(cheatPendingVault)는 수상함을 해제하지 않는다.
    // - 그 외(이전 라운드에 몰래보고 이번 라운드에 다시 금고를 여는 경우)는 '다음 행동'이므로 해제한다.
    if (result.newPlayer.cheatPendingVault) {
      result.newPlayer.cheatPendingVault = false
    } else if (result.newPlayer.isCheating) {
      result.newPlayer.isCheating = false
      selfFlagClearAtRef.current = Date.now()
    }
    setSelectedVaultResult({ vault, log: result.log })
    setCurrentView('vaultResult')
    // 자금/다이아 획득은 원자 delta로 — 동시에 조사(강탈)당해도 유실되지 않는다.
    const deltas = mafiaNumericDelta(player, result.newPlayer)
    await Promise.all([
      Object.keys(deltas).length > 0
        ? commitPlayerDelta(player.id, deltas, { reason: 'mafia_vault_opened' })
        : Promise.resolve(),
      commitPlayerPatch(player.id, createFlagPatch(result.newPlayer), 'mafia_vault_flags'),
    ])
    broadcastLog(result.log, vault.reward === 'empty' ? 'info' : 'success')
    playSFX('item')
    window.setTimeout(goToQuiz, 1800)
  }

  const handleCheat = async () => {
    if (!player || currentVaults.length === 0) return
    const result = applyCheat(currentVaults, player, Date.now())
    setCheatVaultContents(result.vaultContents)
    // 몰래보기는 보통 자금 변화 없이 플래그만 바뀌지만, 변화가 있으면 원자 delta로 처리.
    const deltas = mafiaNumericDelta(player, result.newPlayer)
    await Promise.all([
      Object.keys(deltas).length > 0
        ? commitPlayerDelta(player.id, deltas, { reason: 'mafia_cheat_started' })
        : Promise.resolve(),
      commitPlayerPatch(player.id, createFlagPatch(result.newPlayer), 'mafia_cheat_flags'),
    ])
    // 누가 몰래봤는지는 절대 공개하지 않는다(Deceptive Dinos 규칙: 조사로 직접 잡아내야 한다).
    // 본인 화면에만 경고를 남긴다.
    addLog('금고를 몰래 들여다봤습니다. 친구가 조사하면 들킵니다!', 'warning')
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
    // 상대의 잔액·수상함은 내 화면 복제본이 아니라 DB 최신값으로 판정한다.
    // 실시간 갱신이 늦어 내 화면의 상대 자금이 낡았어도 환수액이 어긋나지 않는다. (읽기 실패 시에만 복제본 사용)
    const freshTargetPromise = getPlayerById(target.id)
      .then((row) => (row ? toMafiaPlayer(row) : target))
      .catch(() => target)
    window.setTimeout(async () => {
      const freshTarget = await freshTargetPromise
      const result = attemptInvestigate(player, freshTarget, Date.now())
      setInvestigationResult(result.result)
      // 친구 조사는 본인의 '다음 라운드 행동'이므로, 조사하는 순간 본인의 수상함은 해제된다.
      const clearedInvestigator = { ...result.newInvestigator, isCheating: false, cheatPendingVault: false }
      selfFlagClearAtRef.current = Date.now()

      // 발각 알림은 아래 patch/steal 커밋(각각 broadcast를 동반)보다 먼저 보내, 발각된 친구 화면에 이름·환수 금액이 바로 뜨게 한다.
      if (result.success) {
        void sendRoomEvent('game:effect', {
          kind: 'mafia:caught',
          targetPlayerId: target.id,
          investigatorName: player.name,
          recovered: result.recovered ?? 0,
        })
      }

      const ops: Array<Promise<unknown>> = [
        // 조사자 본인 수상함 해제 (플래그만)
        commitPlayerPatch(player.id, createFlagPatch(clearedInvestigator), 'mafia_investigator_clear'),
      ]

      if (result.success) {
        // 발각된 친구의 수상함 해제 (플래그만) — 환수액이 0이어도 반드시 해제한다
        ops.push(commitPlayerPatch(target.id, createFlagPatch(result.newTarget), 'mafia_target_caught'))
      }

      if (result.success && (result.recovered ?? 0) > 0) {
        // 자금 환수는 원자적 이동으로 — 동시 조사/획득 시 lost update 방지, 총량 보존.
        // 기준은 화면에 보이는 자금(현금 + 다이아몬드)이라, 현금이 모자라면 상대 다이아몬드를 먼저 현금으로 바꾼 뒤 옮긴다.
        // (score = cash + diamonds × DIAMOND_CASH_VALUE, gold = cash → 바꿀 때는 score 그대로, 옮길 때는 세 컬럼이 같이 움직인다)
        const diamondsToConvert = result.diamondsConverted ?? 0
        ops.push(
          (async () => {
            if (diamondsToConvert > 0) {
              await commitPlayerDelta(
                target.id,
                {
                  mafia_diamonds: -diamondsToConvert,
                  mafia_cash: diamondsToConvert * DIAMOND_CASH_VALUE,
                  gold: diamondsToConvert * DIAMOND_CASH_VALUE,
                },
                { reason: 'mafia_diamonds_to_cash' },
              )
            }
            await commitPlayerSteal(target.id, player.id, result.recovered!, ['mafia_cash', 'score', 'gold'], 'mafia_investigate_recover')
          })(),
        )
      }

      await Promise.all(ops)
      // 잡았을 때만 전체에 알린다. CLEAR를 공개하면 소거법으로 몰래본 사람이 드러나므로 조사자 본인만 본다.
      if (result.success) broadcastLog(result.log, 'danger')
      else addLog(result.log, 'info')
      if (result.success) {
        setShowCheatCaught(true)
        window.setTimeout(() => setShowCheatCaught(false), 2400)
      }
      window.setTimeout(goToQuiz, 1800)
    }, 1400)
  }

  const isUrgent = timeRemaining <= 30

  if (!player) {
    return (
      <div className="flex h-dvh items-center justify-center bg-black text-2xl font-black text-yellow-300">
        플레이어 정보를 불러오는 중
      </div>
    )
  }

  return (
    <div className="mafia-ambient relative h-dvh w-full overflow-hidden bg-slate-950" style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}>
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
            <QuizSetName title={questionSetTitle} tone="dark" className="hidden lg:flex" />
            <Users className="h-5 w-5 shrink-0 text-yellow-300" />
            {players.length}명
          </div>
        </div>
      </div>

      <div className="absolute bottom-28 left-0 right-0 top-16 overflow-y-auto md:right-80">
        <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
        <AnimatePresence mode="wait">
          {currentView === 'quiz' && currentQuestion && (
            <motion.div key="quiz" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-4xl">
              <QuizView question={currentQuestion} onAnswer={handleAnswerSubmit} onCorrectClick={() => setCurrentView('actionSelect')} timeLimit={30} variant="glass" />
            </motion.div>
          )}

          {currentView === 'actionSelect' && (
            <motion.div key="action" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }} className="w-full max-w-2xl">
              <Card className="border-4 border-yellow-600 bg-black/90">
                <CardContent className="p-4 text-center sm:p-8">
                  <h2 className="mb-4 text-2xl font-bold text-yellow-400 sm:mb-6 sm:text-4xl">정답입니다. 다음 행동을 고르세요.</h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <Button onClick={handleOpenVaultChoice} className="h-28 bg-yellow-500 text-xl font-black text-black hover:bg-yellow-400 sm:h-32 sm:text-2xl">
                      <span className="flex flex-col items-center gap-2"><PixelIcon name="vaultOpen" size={48} alt="" className="h-10 w-10 sm:h-12 sm:w-12" />금고 열기</span>
                    </Button>
                    <Button onClick={handleInvestigate} className="h-28 bg-blue-600 text-xl font-black text-white hover:bg-blue-500 sm:h-32 sm:text-2xl" disabled={otherPlayers.length === 0}>
                      <span className="flex flex-col items-center gap-2"><PixelIcon name="scan" size={48} alt="" className="h-10 w-10 sm:h-12 sm:w-12" />친구 조사</span>
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
                          {/* 안 연 금고는 글자가 없으니 그림을 크게 */}
                          <div className="text-4xl sm:text-7xl">
                            <VaultIcon display={display} size={display.text ? 40 : 64} className="sm:hidden" />
                            <VaultIcon display={display} size={display.text ? 72 : 128} className="hidden sm:inline-block" />
                          </div>
                          {display.text && <div className="mt-1.5 text-base font-black text-white sm:mt-3 sm:text-2xl">{display.text}</div>}
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
                          <div className="mb-4 flex justify-center">
                            <PixelIcon name={investigationResult === 'CHEATER' ? 'siren' : 'correct'} size={112} alt="" />
                          </div>
                          <p className={`text-4xl font-black ${investigationResult === 'CHEATER' ? 'text-red-400' : 'text-green-400'}`}>
                            {investigationResult}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mb-4 flex justify-center">
                            <PixelIcon name="scan" size={112} alt="조사" />
                          </div>
                          <p className="text-3xl text-gray-200">조사 중</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {otherPlayers.map((target) => (
                        <Button key={target.id} onClick={() => void handleStartInvestigation(target.id)} className="w-full justify-between bg-gray-800 px-5 py-6 text-xl font-bold text-white hover:bg-gray-700">
                          <span className="flex items-center gap-3">
                            <ShieldAlert className="h-6 w-6 text-gray-400" />
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
              <VaultReveal vault={selectedVaultResult.vault} className="mx-auto mb-4 w-40 sm:w-52" />
              <div className="max-w-2xl break-keep rounded-xl border-4 border-yellow-600 bg-black/90 p-8 text-3xl font-black text-yellow-300">
                {selectedVaultResult.log}
              </div>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center text-4xl font-black text-red-400">
              <div className="mb-4 flex justify-center">
                <PixelIcon name="wrong" size={112} />
              </div>
              틀렸습니다
              <AnswerReveal answer={revealedAnswer} className="text-left" />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      <aside className="absolute bottom-28 right-0 top-16 hidden w-80 overflow-y-auto border-l-2 border-yellow-600 bg-black/60 p-5 md:block">
        <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold text-yellow-400">
          <Users className="h-7 w-7" /> 조직원
        </h2>
        <div className="space-y-3">
          {sortedPlayers.map((member, index) => (
            <Card key={member.id} className={`border-2 ${member.id === playerId ? 'border-yellow-400 bg-yellow-950/40' : 'border-gray-700 bg-gray-900/70'}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white">#{index + 1} {member.name}</div>
                  {/* 몰래보기 여부는 다른 사람에게 절대 표시하지 않는다 — 추측해서 조사하는 게 이 게임의 재미. */}
                </div>
                <div className="mt-2 text-xl font-black text-yellow-300">${calculateLaunderedCash(member).toLocaleString()}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </aside>

      <div className="absolute bottom-0 left-0 right-0 z-20 border-t-2 border-yellow-600 bg-black/90 shadow-lg">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-yellow-400 sm:text-lg">
            <Radio className="h-4 w-4 sm:h-5 sm:w-5" /> 도청 장치
          </h3>
          <div className="h-14 overflow-y-auto rounded-lg bg-black/55 p-2 font-mono text-sm sm:h-16 sm:text-base">
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
            <div className="relative flex flex-col items-center gap-2">
              <PixelIcon name="siren" size={160} alt="" className="h-28 w-28 drop-shadow-2xl sm:h-40 sm:w-40" />
              <div className="text-8xl font-black text-white drop-shadow-2xl">발각!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 내가 발각당했을 때 (조사당한 쪽 화면) */}
      <AnimatePresence>
        {caughtNotice && (
          <motion.div
            key="caught-by-friend"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4"
          >
            <motion.div
              className="absolute inset-0 bg-red-700/70"
              animate={{ opacity: [0.9, 0.5, 0.9, 0.5, 0.9] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.div
              initial={{ scale: 0.5, rotate: -6 }}
              animate={{ scale: [0.5, 1.15, 1], rotate: [-6, 3, 0] }}
              transition={{ duration: 0.45 }}
              className="relative flex max-w-2xl flex-col items-center gap-3 rounded-3xl border-4 border-red-300 bg-black/85 px-6 py-6 text-center shadow-2xl sm:px-10 sm:py-8"
            >
              <PixelIcon name="siren" size={96} alt="" className="h-16 w-16 sm:h-24 sm:w-24" />
              <div className="text-5xl font-black leading-tight text-white drop-shadow-2xl sm:text-7xl">발각됐습니다!</div>
              <p className="text-xl font-bold text-red-200 sm:text-3xl">
                {caughtNotice.investigatorName}의 조사에 몰래보기가 들통났어요!
              </p>
              {caughtNotice.recovered > 0 && (
                <p className="text-2xl font-black text-yellow-300 sm:text-4xl">
                  -${caughtNotice.recovered.toLocaleString()} 환수당했습니다
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
