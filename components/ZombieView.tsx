'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EyeOff, Heart } from 'lucide-react'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAudioContext } from '@/components/AudioProvider'
import {
  formatTime,
  GAME_CONSTANTS,
  isHiding,
  isZombieGameOver,
  roomPlayerToZombiePlayer,
  scanPlayer,
  type RoomZombiePlayer,
  type ZombieActionKind,
  type ZombieGameLog,
  type ZombiePlayer,
  type ZombieRadioState,
} from '@/lib/game/zombie'
import type { ZombieAttackResult, ZombieSabotageResult, ZombieVaccineResult } from '@/lib/services/playerMutations'
import type { Question } from '@/hooks/useGameBase'
import PixelIcon from '@/components/ui/PixelIcon'
import QuizSetName from '@/components/game/QuizSetName'
import { getWrongScreenMs } from '@/lib/quiz/multiSelect'

type ViewState = 'quiz' | 'actionSelect' | 'targetSelect' | 'outcome' | 'wrong'

/** 행동 결과 카드 (공격·스캔·백신·방해 공용) */
type Outcome = {
  icon: ReactNode
  title: string
  detail?: string
  tone: 'good' | 'bad' | 'warn' | 'neutral'
  pending?: boolean
}

type ZombieViewProps = {
  roomCode: string
  playerId: string
  roomStatus: string
  roomStartedAt?: string | null
  roomDurationSeconds?: number | null
  roomPlayers: RoomZombiePlayer[]
  /** 좀비의 공격 대상 목록에 인간의 체력 숫자를 보여줄지 (방 옵션, 기본 false). 방어막·숨는 중은 늘 보인다. */
  showHumanStatusToZombies?: boolean
  /** 구조 무전기 상태 (페이지가 players·rooms.settings 로 유도해 넘긴다) */
  radio: ZombieRadioState
  currentQuestion: Question | null
  onAnswer: (answer: string) => Promise<boolean>
  onNextQuestion: () => void
  onGameEnd?: () => void
  onFinishRoom: () => Promise<boolean>
  /** 정답·오답·치료·방어막·수리를 서버에 보고하고, 권위 있는 최종 상태를 돌려받는다. */
  onZombieAction: (action: ZombieActionKind) => Promise<RoomZombiePlayer | null>
  onZombieAttack: (zombieId: string, targetId: string) => Promise<ZombieAttackResult>
  onZombieVaccinate: (humanId: string, targetId: string) => Promise<ZombieVaccineResult>
  onZombieSabotage: (zombieId: string) => Promise<ZombieSabotageResult>
  questionSetTitle?: string | null
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

function readScannedIds(key: string | null): Set<string> {
  if (!key || typeof window === 'undefined') return new Set()
  try {
    const raw = window.sessionStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set()
  }
}

function secondsLeft(untilMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((untilMs - nowMs) / 1000))
}

const TONE_CLASS: Record<Outcome['tone'], string> = {
  good: 'text-green-400',
  bad: 'text-red-400',
  warn: 'text-yellow-400',
  neutral: 'text-gray-300',
}

export default function ZombieView({
  roomCode,
  roomStatus,
  roomStartedAt,
  roomDurationSeconds,
  roomPlayers,
  showHumanStatusToZombies = false,
  radio,
  playerId,
  currentQuestion,
  onAnswer,
  onNextQuestion,
  onFinishRoom,
  onZombieAction,
  onZombieAttack,
  onZombieVaccinate,
  onZombieSabotage,
  questionSetTitle,
}: ZombieViewProps) {
  const startedAtMs = roomStartedAt ? new Date(roomStartedAt).getTime() : null
  const totalDurationSec = roomDurationSeconds ?? GAME_CONSTANTS.GAME_DURATION

  const computeRemaining = useCallback(() => {
    if (!startedAtMs) return totalDurationSec
    const elapsedSec = Math.floor((Date.now() - startedAtMs) / 1000)
    return Math.max(0, totalDurationSec - elapsedSec)
  }, [startedAtMs, totalDurationSec])

  const [currentView, setCurrentView] = useState<ViewState>('quiz')
  const { revealedAnswer, revealedExplanation, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [timeRemaining, setTimeRemaining] = useState(computeRemaining)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [gameLog, setGameLog] = useState<ZombieGameLog[]>([])
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [targetNotice, setTargetNotice] = useState<string | null>(null)
  const [scanCooldown, setScanCooldown] = useState(0)
  // 스캔으로 직접 확인한 플레이어만 정체를 계속 볼 수 있다. 새로고침해도 이번 판 동안은 기억한다.
  const scanStorageKey = roomCode && roomStartedAt ? `zombie_scans_${roomCode}_${roomStartedAt}_${playerId}` : null
  const [scannedIds, setScannedIds] = useState<ReadonlySet<string>>(() => readScannedIds(scanStorageKey))
  // 내가 남에게 당한 일을 띄우는 짧은 알림 (피격·백신 맞음). 게임 로그는 각자 화면에만 쌓여서
  // 이것이 없으면 피해자는 수치가 조용히 바뀌는 것 말고는 아무 신호를 받지 못한다.
  const [selfNotice, setSelfNotice] = useState<{ id: number; text: string; tone: 'hit' | 'block' | 'vaccine' } | null>(null)
  const [bigAlert, setBigAlert] = useState<'infected' | 'cured' | 'heli' | null>(null)
  // 오답 페널티처럼 내가 스스로 깎은 체력은 "공격당함"으로 세지 않는다.
  const selfHealthDropGuardRef = useRef(0)
  const prevSelfRef = useRef<{ role: string; health: number; shield: number; vaccine: number } | null>(null)
  const finishingRef = useRef(false)
  // 정답 한 번에 행동은 한 번만. 화면이 바뀌는 동안(AnimatePresence)에도 이전 화면 버튼이 눌려서
  // 예전엔 빠르게 여러 번 누르면 회복·방어막·공격이 그만큼 더 들어가고 문제도 넘어갔다. 다음 정답 때 다시 풀린다.
  const actionDoneRef = useRef(true)
  const { playSFX } = useAudioContext()

  // 방 플레이어 목록은 점수순으로 들어온다. 좀비 모드에서는 점수가 역할과 묶여 있어
  // 그 순서를 그대로 그리면 정렬만 보고도 좀비를 골라낼 수 있다. 역할과 무관한 이름순으로 다시 세운다.
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
  const heliCalled = radio.phase === 'heli'

  useEffect(() => {
    if (!scanStorageKey) return
    try {
      window.sessionStorage.setItem(scanStorageKey, JSON.stringify([...scannedIds]))
    } catch {
      // 비공개 모드 등 — 기억 못 해도 게임은 된다
    }
  }, [scanStorageKey, scannedIds])

  useEffect(() => {
    setTimeRemaining(computeRemaining())
    setNowMs(Date.now())
    if (roomStatus !== 'playing' || isPaused) return
    const timer = window.setInterval(() => {
      setTimeRemaining(computeRemaining())
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [computeRemaining, isPaused, roomStatus])

  useEffect(() => {
    if (finishingRef.current || !isZombieGameOver(players, timeRemaining, radio, nowMs)) return
    finishingRef.current = true
    void onFinishRoom()
  }, [nowMs, onFinishRoom, players, radio, timeRemaining])

  // 헬기 호출은 모두에게 크게 알린다
  const heliAnnouncedRef = useRef(heliCalled)
  useEffect(() => {
    if (!heliCalled || heliAnnouncedRef.current) return
    heliAnnouncedRef.current = true
    setBigAlert('heli')
    setGameLog((logs) => addLog(logs, '🚁 무전기 수리 완료! 구조 헬기가 오고 있어요!', 'success'))
  }, [heliCalled])

  // 내 상태가 남의 행동으로 바뀐 것을 감지해 알려준다 (감염·피격·백신).
  const selfRole = myPlayer?.role ?? null
  const selfHealth = myPlayer?.health ?? null
  const selfShield = myPlayer?.shield ?? null
  const selfVaccine = myPlayer?.vaccine ?? null
  useEffect(() => {
    if (selfRole === null || selfHealth === null || selfShield === null || selfVaccine === null) return
    const prev = prevSelfRef.current
    prevSelfRef.current = { role: selfRole, health: selfHealth, shield: selfShield, vaccine: selfVaccine }
    if (!prev) return

    if (prev.role === 'human' && selfRole === 'zombie') {
      setBigAlert('infected')
      setSelfNotice(null)
      setGameLog((logs) => addLog(logs, '💀 감염되었습니다! 이제 남은 인간을 감염시키세요.', 'infection'))
      return
    }
    if (prev.role === 'zombie' && selfRole === 'human') {
      setBigAlert('cured')
      setSelfNotice(null)
      setGameLog((logs) => addLog(logs, '💉 백신 덕분에 인간으로 돌아왔어요!', 'success'))
      return
    }
    if (selfRole === 'zombie') {
      if (selfVaccine > prev.vaccine) {
        const text = `💉 누군가 백신을 쐈어요 (${selfVaccine}/${GAME_CONSTANTS.VACCINE_DOSES})`
        setSelfNotice({ id: Date.now(), text, tone: 'vaccine' })
        setGameLog((logs) => addLog(logs, text, 'warning'))
      }
      return
    }

    const lostHealth = Math.max(0, prev.health - selfHealth)
    const lostShield = Math.max(0, prev.shield - selfShield)
    if (lostHealth === 0 && lostShield === 0) return

    // 내 오답으로 깎인 체력이면 소비하고 넘어간다.
    if (lostShield === 0 && selfHealthDropGuardRef.current > 0) {
      selfHealthDropGuardRef.current -= 1
      return
    }

    const blocked = lostShield > 0 && lostHealth === 0
    const text = blocked
      ? `🛡 방어막이 공격을 막았어요! ${GAME_CONSTANTS.HIDE_SECONDS}초 동안 숨어요`
      : `🩸 공격당했어요! 체력 -${lostHealth} · ${GAME_CONSTANTS.HIDE_SECONDS}초 동안 숨어요`
    setSelfNotice({ id: Date.now(), text, tone: blocked ? 'block' : 'hit' })
    setGameLog((logs) => addLog(logs, text, 'danger'))
  }, [selfHealth, selfRole, selfShield, selfVaccine])

  useEffect(() => {
    if (!bigAlert) return
    playSFX(bigAlert === 'infected' ? 'incorrect' : 'correct')
    const timer = window.setTimeout(() => setBigAlert(null), 3200)
    return () => window.clearTimeout(timer)
  }, [bigAlert, playSFX])

  useEffect(() => {
    if (!selfNotice) return
    const timer = window.setTimeout(() => setSelfNotice(null), 1800)
    return () => window.clearTimeout(timer)
  }, [selfNotice])

  // 결과 카드는 2.5초 보여 주고 다음 문제로
  useEffect(() => {
    if (!outcome || outcome.pending) return
    const timer = window.setTimeout(() => {
      setOutcome(null)
      setCurrentView('quiz')
      onNextQuestion()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [outcome, onNextQuestion])

  // 규칙 판정은 전부 서버가 한다. 화면에 쓰는 값은 RPC가 돌려준 권위 있는 결과뿐이라,
  // 감염된 직후 아직 그 사실을 모르는 클라이언트가 답을 제출해도 감염이 되돌아가지 않는다.
  const reportAction = (action: ZombieActionKind, onResult: (after: ZombiePlayer) => void) => {
    void onZombieAction(action)
      .then((row) => { if (row) onResult(roomPlayerToZombiePlayer(row)) })
      .catch((error) => { console.error('좀비 행동 처리 실패:', error) })
  }

  const finishAction = () => {
    setScanCooldown((prev) => Math.max(0, prev - 1))
  }

  const handleAnswerSubmit = async (answer: string) => {
    if (!myPlayer || roomStatus !== 'playing') return false

    // 빈 답(시간 초과)도 onAnswer에 넘긴다 — 넘기지 않으면 오답 기록이 남지 않아
    // 리포트 정답률의 분모에서 통째로 빠진다.
    const correct = await onAnswer(answer)

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
      actionDoneRef.current = false
      window.setTimeout(() => setCurrentView('actionSelect'), 700)
      return true
    }

    playSFX('incorrect')
    const wasHuman = myPlayer.role === 'human'
    // 페널티가 0이면 체력이 안 줄어드니 가드를 올리면 안 된다 — 다음 진짜 피격 알림을 삼킨다.
    if (wasHuman && GAME_CONSTANTS.WRONG_PENALTY_HUMAN > 0) selfHealthDropGuardRef.current += 1
    reportAction('wrong', (after) => {
      const becameZombie = wasHuman && after.role === 'zombie'
      setGameLog((logs) => addLog(
        logs,
        becameZombie
          ? `${after.name}이(가) 좀비가 되었습니다!`
          : after.role === 'human' && GAME_CONSTANTS.WRONG_PENALTY_HUMAN > 0
            ? `${after.name} 오답! 체력 -${GAME_CONSTANTS.WRONG_PENALTY_HUMAN} (HP: ${after.health})`
            : `${after.name} 오답! 연속 정답이 끊겼어요.`,
        becameZombie ? 'infection' : 'warning',
      ))
    })
    finishAction()
    setCurrentView('wrong')
    revealAnswer(currentQuestion)
    // 구성치기 문제집은 해설을 읽도록 8초, 그 외는 3초(lib/quiz/multiSelect.ts)
    window.setTimeout(() => {
      setCurrentView('quiz')
      clearRevealedAnswer()
      onNextQuestion()
    }, getWrongScreenMs(questionSetTitle, 3000))
    return false
  }

  const handleSelfAction = (action: 'heal' | 'shield' | 'repair') => {
    if (!myPlayer || actionDoneRef.current) return
    actionDoneRef.current = true
    reportAction(action, (after) => {
      setGameLog((logs) => addLog(
        logs,
        action === 'heal'
          ? `${after.name}이(가) 체력을 회복했습니다! (HP: ${after.health})`
          : action === 'shield'
            ? `${after.name}이(가) 방어막을 둘렀습니다! (공격 1번을 막아요)`
            : `🔧 무전기 수리! +${GAME_CONSTANTS.RADIO_REPAIR_AMOUNT}칸`,
        'success',
      ))
    })
    finishAction()
    playSFX('correct')
    setCurrentView('quiz')
    onNextQuestion()
  }

  const openTargets = () => {
    setTargetNotice(null)
    setCurrentView('targetSelect')
  }

  const handleScan = (target: ZombiePlayer) => {
    if (!myPlayer || actionDoneRef.current || scanCooldown > 0) return
    actionDoneRef.current = true
    const result = scanPlayer(target)
    setScannedIds((prev) => new Set(prev).add(target.id))
    setGameLog((logs) => addLog(logs, result.log, result.isZombie ? 'danger' : 'info'))
    setScanCooldown(GAME_CONSTANTS.SCAN_COOLDOWN_ROUNDS)
    playSFX('click')
    setOutcome({
      icon: <ZombieIcon name={result.isZombie ? 'zombie' : 'correct'} size={96} alt="" />,
      title: !result.isZombie ? '인간 확인!' : result.isHost ? '처음부터 좀비!' : '감염된 친구 발견!',
      detail: !result.isZombie
        ? target.name
        : result.isHost
          ? `${target.name} · 백신이 안 들어요`
          : `${target.name} · 백신 ${GAME_CONSTANTS.VACCINE_DOSES}발이면 돌아와요`,
      tone: result.isZombie ? 'bad' : 'good',
    })
    setCurrentView('outcome')
  }

  const handleVaccinate = (target: ZombiePlayer) => {
    if (!myPlayer || actionDoneRef.current) return
    actionDoneRef.current = true
    finishAction()
    playSFX('click')
    setOutcome({ icon: <ZombieIcon name="vaccine" size={96} alt="" />, title: '백신 발사', tone: 'neutral', pending: true })
    setCurrentView('outcome')

    void onZombieVaccinate(myPlayer.id, target.id)
      .then((result) => {
        const doses = GAME_CONSTANTS.VACCINE_DOSES
        const map: Record<ZombieVaccineResult['outcome'], Pick<Outcome, 'title' | 'detail' | 'tone'>> = {
          dosed: { title: `백신 명중! (${result.doses}/${doses})`, detail: `${target.name} · ${doses - result.doses}발 더 맞으면 돌아와요`, tone: 'good' },
          cured: { title: `${target.name} 구출 성공!`, detail: `인간으로 돌아왔어요 · +${GAME_CONSTANTS.RESCUE_SCORE}점`, tone: 'good' },
          immune: { title: '백신이 안 들어요!', detail: `${target.name}은(는) 처음부터 좀비였어요`, tone: 'warn' },
          not_zombie: { title: '인간이었어요', detail: `${target.name}에게는 백신이 필요 없어요`, tone: 'warn' },
          not_human: { title: '백신을 쏠 수 없어요', detail: '그새 감염됐어요', tone: 'bad' },
        }
        const view = map[result.outcome]
        setOutcome({ icon: <ZombieIcon name="vaccine" size={96} alt="" />, ...view })
        if (result.outcome === 'immune' || result.outcome === 'not_zombie') {
          // 확인된 정보는 스캔한 것처럼 기억해 둔다
          setScannedIds((prev) => new Set(prev).add(target.id))
        }
        setGameLog((logs) => addLog(logs, `💉 ${view.title} ${view.detail ?? ''}`.trim(), result.outcome === 'cured' ? 'success' : 'info'))
      })
      .catch((error) => {
        console.error('백신 처리 실패:', error)
        setOutcome({ icon: <ZombieIcon name="vaccine" size={96} alt="" />, title: '백신을 보내지 못했어요', tone: 'warn' })
      })
  }

  const handleSabotage = () => {
    if (!myPlayer || actionDoneRef.current) return
    actionDoneRef.current = true
    playSFX('incorrect')
    setOutcome({ icon: <ZombieIcon name="sabotage" size={96} alt="" />, title: '무전기 방해 중', tone: 'neutral', pending: true })
    setCurrentView('outcome')

    void onZombieSabotage(myPlayer.id)
      .then((result) => {
        const view: Pick<Outcome, 'title' | 'detail' | 'tone'> = result.outcome === 'sabotaged'
          ? { title: '무전기 방해 성공!', detail: result.amount > 0 ? `무전기 −${Math.round(result.amount * 10) / 10}칸` : '아직 고친 칸이 없었어요', tone: 'good' }
          : result.outcome === 'locked'
            ? { title: '헬기가 이미 오고 있어요!', detail: '이제는 인간을 감염시켜야 해요', tone: 'warn' }
            : { title: '방해할 수 없어요', detail: '인간으로 돌아왔어요', tone: 'warn' }
        setOutcome({ icon: <ZombieIcon name="sabotage" size={96} alt="" />, ...view })
        if (result.outcome === 'sabotaged') setGameLog((logs) => addLog(logs, `📡 ${view.title} ${view.detail ?? ''}`.trim(), 'danger'))
      })
      .catch((error) => {
        console.error('방해 처리 실패:', error)
        setOutcome({ icon: <ZombieIcon name="sabotage" size={96} alt="" />, title: '방해를 보내지 못했어요', tone: 'warn' })
      })
  }

  const handleAttack = (target: ZombiePlayer) => {
    if (!myPlayer || actionDoneRef.current) return
    actionDoneRef.current = true
    playSFX('incorrect')
    // 감염 연출은 서버가 판정한 outcome으로만 띄운다. 여러 좀비가 같은 표적에
    // 막타를 노려도, 실제로 감염을 성사시킨 한 명만 "감염 성공!"을 본다.
    setOutcome({ icon: <ZombieIcon name="attack" size={96} alt="" />, title: '공격 중', detail: target.name, tone: 'neutral', pending: true })
    setCurrentView('outcome')

    void onZombieAttack(myPlayer.id, target.id)
      .then((result) => {
        if (result.outcome === 'hidden') {
          // 그새 다른 좀비가 먼저 때려 숨어 버렸다 — 행동을 쓰지 않고 다른 대상을 고르게 한다
          actionDoneRef.current = false
          setOutcome(null)
          setTargetNotice(`${target.name}은(는) 방금 숨었어요! 다른 친구를 고르세요.`)
          setCurrentView('targetSelect')
          return
        }
        const targetRow = result.players.find((row) => row.id === target.id)
        const after = targetRow ? roomPlayerToZombiePlayer(targetRow) : null
        finishAction()
        const view: Pick<Outcome, 'title' | 'detail' | 'tone'> = result.outcome === 'infected'
          ? { title: '감염 성공!', detail: `${target.name}은(는) 이제 좀비예요`, tone: 'good' }
          : result.outcome === 'damaged'
            ? { title: `${result.damage} 데미지!`, detail: showHumanStatusToZombies && after ? `${target.name} · HP ${after.health}` : target.name, tone: 'bad' }
            : result.outcome === 'blocked'
              ? { title: '방어막에 막혔어요!', detail: `${target.name}의 방어막이 사라졌어요`, tone: 'warn' }
              : result.outcome === 'not_zombie'
                ? { title: '공격할 수 없어요', detail: '인간으로 돌아왔어요', tone: 'warn' }
                : { title: '한발 늦었어요!', detail: `${target.name}은(는) 이미 감염됐어요`, tone: 'warn' }
        setOutcome({
          icon: <ZombieIcon name={result.outcome === 'infected' ? 'zombie' : result.outcome === 'damaged' ? 'attack' : 'wrong'} size={96} alt="" />,
          ...view,
        })
        setGameLog((logs) => addLog(
          logs,
          result.outcome === 'infected'
            ? `${myPlayer.name}이(가) ${target.name}을(를) 감염시켰습니다!`
            : `${myPlayer.name} → ${target.name}: ${view.title}`,
          result.outcome === 'infected' ? 'infection' : result.outcome === 'damaged' ? 'danger' : 'warning',
        ))
      })
      .catch((error) => {
        console.error('좀비 공격 처리 실패:', error)
        finishAction()
        setOutcome({ icon: <ZombieIcon name="wrong" size={96} alt="" />, title: '공격을 보내지 못했어요', tone: 'warn' })
      })
  }

  const overlayColor = isZombie ? 'rgba(5, 46, 22, 0.5)' : 'rgba(30, 27, 75, 0.5)'
  const accentColor = isZombie ? 'text-green-400' : 'text-blue-400'
  const borderColor = isZombie ? 'border-green-600' : 'border-blue-600'
  const myHideLeft = myPlayer && !isZombie ? secondsLeft(myPlayer.hiddenUntilMs, nowMs) : 0
  const humanTargets = otherPlayers.filter((player) => player.role === 'human')
  const allHumansHiding = humanTargets.length > 0 && humanTargets.every((player) => isHiding(player, nowMs))
  const actionBtn = 'flex h-24 flex-col items-center justify-center whitespace-nowrap px-2 text-base font-bold text-white disabled:opacity-50 sm:h-28 sm:px-4 sm:text-lg'

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
        {/* 폰(360px)에서 오른쪽 수치가 화면 밖으로 잘리던 문제: 타이머·칩·수치 모두 폰에서 한 단계 작게 */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-1.5 px-2 py-1.5 sm:gap-4 sm:px-4 sm:py-2">
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1 sm:gap-2">
              <ZombieIcon name="timer" size={22} alt="" className="sm:hidden" />
              <ZombieIcon name="timer" size={28} alt="" className="hidden sm:inline-block" />
              <span className={`text-lg font-bold tabular-nums sm:text-3xl ${isUrgent ? 'animate-pulse text-red-500' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            <QuizSetName title={questionSetTitle} tone="dark" className="hidden lg:flex" />
          </div>
          <div className={`flex shrink-0 items-center whitespace-nowrap rounded-full border-2 px-2 py-0.5 sm:px-4 sm:py-1 ${isZombie ? 'border-green-500 bg-green-950/80' : 'border-blue-500 bg-blue-950/80'}`}>
            <ZombieIcon
              name={isZombie ? 'zombie' : 'human'}
              size={24}
              className="mr-1.5 inline-block shrink-0 align-middle sm:mr-2"
              alt={isZombie ? '좀비' : '인간'}
            />
            <span className={`text-sm font-bold sm:text-lg ${accentColor}`}>{isZombie ? '좀비' : '인간'}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-sm sm:gap-4 sm:text-base">
            <span className="inline-flex items-center gap-0.5 font-bold text-green-400 sm:gap-1">
              <ZombieIcon name="human" size={18} alt="인간" />
              {humanCount}
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-red-400 sm:gap-1">
              <ZombieIcon name="zombie" size={18} alt="좀비" />
              {zombieCount}
            </span>
            {myPlayer && !isZombie && (
              <span className="inline-flex items-center gap-1 font-bold text-red-400 sm:gap-2">
                <Heart className="h-4 w-4 sm:h-5 sm:w-5" />{myPlayer.health}
                {myPlayer.shield > 0 && <ZombieIcon name="shield" size={20} className="ml-1" alt="방어막 있음" />}
              </span>
            )}
            {myPlayer && isZombie && (
              <span className="inline-flex items-center gap-1 font-bold text-red-400 sm:gap-2">
                <ZombieIcon name="attack" size={20} alt="공격력" />
                {heliCalled ? Math.round(myPlayer.attackPower * GAME_CONSTANTS.HELI_RUSH_MULTIPLIER) : myPlayer.attackPower}
                {myPlayer.vaccine > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-cyan-300"><ZombieIcon name="vaccine" size={18} alt="맞은 백신" />{myPlayer.vaccine}</span>
                )}
              </span>
            )}
          </div>
        </div>
        <RadioStrip radio={radio} isZombie={isZombie} nowMs={nowMs} hideLeft={myHideLeft} />
      </div>

      {/* 가로 폰(높이 390)에서 선택지가 하단 로그 뒤로 숨던 문제: 세로 스크롤 + 짧을 땐 가운데 정렬 */}
      <div className="absolute bottom-36 left-0 right-0 top-[4.5rem] overflow-y-auto sm:top-[5.5rem] md:right-80">
        <div className="flex min-h-full items-center justify-center py-3">
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
                  문제를 불러오는 중
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
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                      <Button onClick={openTargets} size="lg" className={`${actionBtn} bg-gradient-to-br from-red-700 to-red-600 hover:from-red-800 hover:to-red-700`}>
                        <ZombieIcon name="attack" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        인간 공격
                      </Button>
                      <Button onClick={handleSabotage} disabled={heliCalled} size="lg" className={`${actionBtn} bg-gradient-to-br from-green-800 to-green-700 hover:from-green-900 hover:to-green-800`}>
                        <ZombieIcon name="sabotage" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        {heliCalled ? '방해 불가' : '무전기 방해'}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                      <Button onClick={() => handleSelfAction('repair')} size="lg" className={`${actionBtn} bg-gradient-to-br from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600`}>
                        <ZombieIcon name="repair" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        수리 +{GAME_CONSTANTS.RADIO_REPAIR_AMOUNT}
                      </Button>
                      <Button
                        onClick={() => handleSelfAction('shield')}
                        disabled={myPlayer.shield >= GAME_CONSTANTS.HUMAN_MAX_SHIELD}
                        size="lg"
                        className={`${actionBtn} bg-gradient-to-br from-cyan-700 to-cyan-600`}
                      >
                        <ZombieIcon name="shield" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        {myPlayer.shield >= GAME_CONSTANTS.HUMAN_MAX_SHIELD ? '방어막 있음' : '방어막'}
                      </Button>
                      <Button
                        onClick={() => handleSelfAction('heal')}
                        disabled={myPlayer.health >= GAME_CONSTANTS.HUMAN_MAX_HEALTH}
                        size="lg"
                        className={`${actionBtn} bg-gradient-to-br from-emerald-700 to-emerald-600`}
                      >
                        <ZombieIcon name="heal" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        치료 +{GAME_CONSTANTS.HUMAN_HEAL_AMOUNT}
                      </Button>
                      <Button onClick={openTargets} size="lg" className={`${actionBtn} bg-gradient-to-br from-purple-700 to-purple-600`}>
                        <ZombieIcon name="scan" size={28} className="mb-1.5 sm:mb-2" alt="" />
                        스캔·백신
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'targetSelect' && myPlayer && (
            <motion.div key="targetSelect" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90`}>
                <CardContent className="p-4 sm:p-6">
                  <h2 className={`mb-2 text-center text-2xl font-bold sm:text-3xl ${accentColor}`}>{isZombie ? '공격할 친구 선택' : '친구 고르기'}</h2>
                  <p className="mb-3 text-center text-sm text-gray-400 break-keep">
                    {isZombie
                      ? `공격받은 친구는 ${GAME_CONSTANTS.HIDE_SECONDS}초 동안 숨어요. 방어막이 있으면 한 번 막혀요.`
                      : scanCooldown > 0
                        ? `스캔은 행동 ${scanCooldown}번 뒤에 다시 쓸 수 있어요. 백신은 지금 쏠 수 있어요.`
                        : `스캔으로 정체를 확인하고, 감염된 친구에게 백신 ${GAME_CONSTANTS.VACCINE_DOSES}발을 맞히면 돌아와요.`}
                  </p>
                  {targetNotice && <p className="mb-3 rounded-lg bg-yellow-900/50 px-3 py-2 text-center text-sm font-bold text-yellow-300">{targetNotice}</p>}
                  {isZombie && allHumansHiding && (
                    <div className="mb-3 rounded-lg bg-green-950/70 p-3 text-center">
                      <p className="mb-2 text-sm font-bold text-green-300">인간이 모두 숨었어요!</p>
                      <Button onClick={handleSabotage} disabled={heliCalled} className="bg-green-700 font-bold text-white hover:bg-green-800">
                        <ZombieIcon name="sabotage" size={18} className="mr-2" alt="" />무전기 방해하기
                      </Button>
                    </div>
                  )}
                  <div className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 sm:gap-3">
                    {isZombie
                      ? humanTargets.map((player) => {
                        const hideLeft = secondsLeft(player.hiddenUntilMs, nowMs)
                        return (
                          <Button
                            key={player.id}
                            onClick={() => handleAttack(player)}
                            disabled={hideLeft > 0}
                            size="lg"
                            className="h-20 justify-start bg-gray-800 px-4 text-lg font-bold text-white hover:bg-gray-700 disabled:opacity-40"
                          >
                            <ZombieIcon name="player" size={28} className="mr-3 shrink-0" alt="" />
                            <div className="min-w-0 text-left">
                              <div className="truncate">{player.name}</div>
                              <div className="flex items-center gap-2 text-xs text-red-300">
                                {hideLeft > 0 && <span className="inline-flex items-center gap-1 text-gray-300"><EyeOff className="h-3 w-3" />숨는 중 {hideLeft}초</span>}
                                {player.shield > 0 && <span className="text-cyan-300">🛡 방어막</span>}
                                {showHumanStatusToZombies && <span>HP {player.health}</span>}
                              </div>
                            </div>
                          </Button>
                        )
                      })
                      : otherPlayers.map((player) => (
                        <FriendRow
                          key={player.id}
                          player={player}
                          scanned={scannedIds.has(player.id)}
                          scanCooldown={scanCooldown}
                          onScan={() => handleScan(player)}
                          onVaccinate={() => handleVaccinate(player)}
                        />
                      ))}
                  </div>
                  <Button onClick={() => setCurrentView('actionSelect')} variant="outline" className="mt-4 w-full border-gray-600 text-gray-300">돌아가기</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'outcome' && outcome && (
            <motion.div key="outcome" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="px-4 text-center">
              <div className="mb-4 flex justify-center">{outcome.icon}</div>
              <p className={`text-3xl font-bold break-keep sm:text-4xl ${outcome.pending ? 'text-gray-300' : TONE_CLASS[outcome.tone]}`}>{outcome.title}</p>
              {outcome.detail && <p className="mt-2 text-lg text-gray-300 break-keep sm:text-xl">{outcome.detail}</p>}
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="mb-4 flex justify-center">
                <PixelIcon name="wrong" size={96} />
              </div>
              <p className="text-4xl font-bold text-red-400">틀렸습니다!</p>
              <AnswerReveal answer={revealedAnswer} explanation={revealedExplanation} />
              {myPlayer?.role === 'human' && (
                <p className="mt-2 text-xl text-gray-400">
                  {GAME_CONSTANTS.WRONG_PENALTY_HUMAN > 0 ? `체력 -${GAME_CONSTANTS.WRONG_PENALTY_HUMAN}` : '이번엔 행동할 수 없어요. 연속 정답도 처음부터!'}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      <div className={`absolute bottom-36 right-0 top-[5.5rem] hidden w-80 overflow-y-auto border-l-2 ${borderColor} bg-black/50 p-4 md:block`}>
          <h3 className={`mb-3 flex items-center gap-2 text-xl font-bold ${accentColor}`}>
            <ZombieIcon name="player" size={22} alt="" />
            플레이어 ({humanCount} 인간 / {zombieCount} 좀비)
          </h3>
        <div className="space-y-2">
          {players.map((player) => {
            const isMe = player.id === playerId
            const revealRole = isMe || isZombie || scannedIds.has(player.id)
            const hiding = isHiding(player, nowMs)
            // 정체를 모르는 상대는 상태도 숨긴다. 인간만 숫자가 뜨면 그 자체로 좀비가 드러난다.
            // 좀비 화면이라도 체력 숫자는 선생님 옵션이 켜졌을 때만.
            const status = !revealRole
              ? '???'
              : player.role === 'zombie'
                ? player.originalRole === 'zombie' ? '처음 좀비' : `감염${player.vaccine > 0 ? ` · 💉${player.vaccine}` : ''}`
                : [
                  isMe || (isZombie && showHumanStatusToZombies) ? `HP ${player.health}` : null,
                  player.shield > 0 ? '🛡' : null,
                  hiding ? '숨는 중' : null,
                ].filter(Boolean).join(' ') || '인간'
            return (
              <Card key={player.id} className={`border ${isMe ? borderColor : 'border-gray-700'} bg-gray-800/30`}>
                <CardContent className="p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{player.name}{isMe ? ' (나)' : ''}</div>
                      <div className="text-xs text-gray-400">{revealRole ? (player.role === 'zombie' ? '좀비' : '인간') : '정체불명'}</div>
                    </div>
                    <div className="text-right text-xs text-gray-400">{status}</div>
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

      {/* 피격·방어·백신 알림 — 피격이면 화면 가장자리를 붉게 번쩍인다 */}
      <AnimatePresence>
        {selfNotice && (
          <motion.div
            key={selfNotice.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center px-4 pt-28"
            style={selfNotice.tone === 'hit' ? { boxShadow: 'inset 0 0 140px 40px rgba(220, 38, 38, 0.55)' } : undefined}
          >
            <motion.div
              initial={{ y: 10, scale: 0.8 }}
              animate={{ y: -14, scale: 1 }}
              className={`rounded-full px-5 py-2 text-center text-lg font-black shadow-2xl break-keep sm:text-2xl ${
                selfNotice.tone === 'hit' ? 'bg-red-950/90 text-red-200' : selfNotice.tone === 'block' ? 'bg-cyan-950/90 text-cyan-200' : 'bg-slate-900/90 text-cyan-200'
              }`}
            >
              {selfNotice.text}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 감염·구출·헬기 — 역할이나 국면이 바뀐 걸 확실히 알아야 한다 */}
      <AnimatePresence>
        {bigAlert && (
          <motion.div
            key={bigAlert}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm ${
              bigAlert === 'infected' ? 'bg-green-950/80' : bigAlert === 'cured' ? 'bg-blue-950/80' : 'bg-amber-950/80'
            }`}
          >
            <motion.div initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.15, 1] }} transition={{ duration: 0.7 }} className="text-center">
              <motion.div animate={{ y: [0, -16, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex justify-center">
                {bigAlert === 'heli'
                  ? <ZombieIcon name="heli" size={120} alt="" />
                  : <ZombieIcon name={bigAlert === 'infected' ? 'zombie' : 'human'} size={120} alt="" />}
              </motion.div>
              <h2 className={`mt-6 text-4xl font-black break-keep sm:text-5xl ${bigAlert === 'infected' ? 'text-green-300' : bigAlert === 'cured' ? 'text-blue-300' : 'text-amber-300'}`}>
                {bigAlert === 'infected' ? '감염되었습니다!' : bigAlert === 'cured' ? '인간으로 돌아왔어요!' : '구조 헬기 호출!'}
              </h2>
              <p className="mt-3 text-xl text-gray-200 break-keep sm:text-2xl">
                {bigAlert === 'infected'
                  ? myPlayer?.originalRole === 'human'
                    ? `이제 인간을 감염시키세요. 백신 ${GAME_CONSTANTS.VACCINE_DOSES}발을 맞으면 다시 돌아올 수 있어요.`
                    : '이제 남은 인간을 감염시키세요.'
                  : bigAlert === 'cured'
                    ? '친구들이 구해 줬어요. 다시 무전기를 고쳐요!'
                    : isZombie
                      ? `헬기가 오기 전에 감염시키세요! 공격력 ×${GAME_CONSTANTS.HELI_RUSH_MULTIPLIER}`
                      : '헬기가 올 때까지 살아남으면 구조 성공!'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </div>
  )
}

/** 상단 바 아래 무전기 띠: 신호 찾는 중 → 수리 % → 헬기 카운트다운 */
function RadioStrip({ radio, isZombie, nowMs, hideLeft }: { radio: ZombieRadioState; isZombie: boolean; nowMs: number; hideLeft: number }) {
  const searchingLeft = radio.goalLockAtMs !== null ? secondsLeft(radio.goalLockAtMs, nowMs) : null
  const heliLeft = radio.heliArrivalMs !== null ? secondsLeft(radio.heliArrivalMs, nowMs) : null
  return (
    <div className="border-t border-white/10 bg-black/60 px-2 py-1 sm:px-4">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-xs font-bold sm:text-sm">
        {radio.phase === 'heli' ? (
          <>
            <ZombieIcon name="heli" size={18} className="shrink-0" alt="" />
            <span className="truncate text-amber-300">
              헬기 도착까지 {formatTime(heliLeft ?? 0)} {isZombie ? `· 공격력 ×${GAME_CONSTANTS.HELI_RUSH_MULTIPLIER}` : '· 끝까지 버텨요!'}
            </span>
          </>
        ) : (
          <>
            <ZombieIcon name="radio" size={18} className="shrink-0" alt="" />
            <span className="shrink-0 text-amber-200">{isZombie ? '인간들의 무전기' : '구조 무전기'}</span>
            {radio.phase === 'searching' ? (
              <span className="truncate text-gray-300">신호 찾는 중… {searchingLeft !== null && searchingLeft > 0 ? `${searchingLeft}초` : ''}</span>
            ) : (
              <>
                <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                    animate={{ width: `${radio.percent}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <span className="shrink-0 tabular-nums text-amber-200">{radio.percent}%</span>
                {!isZombie && radio.repairMultiplier > 1 && (
                  <span className="hidden shrink-0 text-amber-300 sm:inline">수리 효율 ×{radio.repairMultiplier}</span>
                )}
              </>
            )}
          </>
        )}
        {hideLeft > 0 && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-slate-100">
            <EyeOff className="h-3 w-3" />숨는 중 {hideLeft}초
          </span>
        )}
      </div>
    </div>
  )
}

/** 인간 화면의 친구 한 줄: 정체(스캔한 경우) + [스캔] [백신] */
function FriendRow({
  player,
  scanned,
  scanCooldown,
  onScan,
  onVaccinate,
}: {
  player: ZombiePlayer
  scanned: boolean
  scanCooldown: number
  onScan: () => void
  onVaccinate: () => void
}) {
  const knownHuman = scanned && player.role === 'human'
  const knownHost = scanned && player.role === 'zombie' && player.originalRole === 'zombie'
  const knownInfected = scanned && player.role === 'zombie' && player.originalRole === 'human'
  const label = !scanned
    ? '정체불명'
    : knownHuman
      ? '스캔 완료 · 인간'
      : knownHost
        ? '처음 좀비 · 백신 면역'
        : `감염된 친구 · 백신 ${player.vaccine}/${GAME_CONSTANTS.VACCINE_DOSES}`
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2">
      <ZombieIcon name="player" size={26} className="shrink-0" alt="" />
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-base font-bold text-white">{player.name}</div>
        <div className={`text-xs ${knownInfected || knownHost ? 'text-red-300' : knownHuman ? 'text-blue-300' : 'text-gray-400'}`}>{label}</div>
      </div>
      <Button
        onClick={onScan}
        disabled={scanned || scanCooldown > 0}
        size="sm"
        className="h-10 shrink-0 bg-purple-700 px-3 font-bold text-white hover:bg-purple-800 disabled:opacity-40"
      >
        스캔
      </Button>
      <Button
        onClick={onVaccinate}
        disabled={knownHuman || knownHost}
        size="sm"
        className="h-10 shrink-0 bg-cyan-700 px-3 font-bold text-white hover:bg-cyan-800 disabled:opacity-40"
      >
        <ZombieIcon name="vaccine" size={16} className="mr-1" alt="" />백신
      </Button>
    </div>
  )
}
