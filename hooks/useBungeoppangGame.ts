'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUNGEO,
  applyEvent,
  applyHelpItem,
  createEmptyStats,
  getBakeSetup,
  getPerfectComboLabel,
  isHelpEligible,
  makeEventNotice,
  makeHelpNotice,
  parseStats,
  resolveBake,
  rollEvent,
  rollHelpItem,
  type BakeOutcome,
  type BakeSetup,
  type BungeoNotice,
  type BungeoStats,
} from '@/lib/game/bungeoppang'
import type { SFXType } from '@/hooks/useAudio'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type BakePhase = 'idle' | 'baking' | 'done'

interface UseBungeoppangGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  players: Player[]
  checkAnswer: (answer: string) => Promise<boolean>
  handleWrongAnswer: () => void
  goToNextQuestion: () => void
  playSFX: (sound: SFXType) => void
  setCurrentView: (view: string) => void
  /** 내 행 로컬 반영 + player:patch broadcast + DB 쓰기 (useGameBase.commitPlayerPatch) */
  commitPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  /** 선생님이 멈춘 동안 게이지도 멈춘다 (안 멈추면 모달 뒤에서 혼자 타 버린다) */
  isPaused: boolean
}

/**
 * 붕어빵 굽굽! 게임 로직 훅.
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 굽기 상태를 얹는다:
 * 정답 → 굽기 찬스(pendingBake) → 게이지(rAF) → 뒤집기 판정(lib/game/bungeoppang.resolveBake) →
 * 점수·통계 저장(players.score / players.item_effects) → 결과 카드 → 다음 문제.
 * 랜덤 이벤트·도움 아이템은 정답 순간에 굴려 알림 모달로 보여 준다.
 */
export function useBungeoppangGame({
  playerId,
  currentPlayer,
  players,
  checkAnswer,
  handleWrongAnswer,
  goToNextQuestion,
  playSFX,
  setCurrentView,
  commitPlayerPatch,
  isPaused,
}: UseBungeoppangGameParams) {
  const [stats, setStats] = useState<BungeoStats>(() => createEmptyStats())
  const [score, setScore] = useState(0)
  const [pendingBake, setPendingBake] = useState(false)
  const [phase, setPhase] = useState<BakePhase>('idle')
  const [gauge, setGauge] = useState(0)
  const [setup, setSetup] = useState<BakeSetup | null>(null)
  const [outcome, setOutcome] = useState<BakeOutcome | null>(null)
  const [notice, setNotice] = useState<BungeoNotice | null>(null)

  const statsRef = useRef(stats)
  const scoreRef = useRef(0)
  const pendingBakeRef = useRef(false)
  const phaseRef = useRef<BakePhase>('idle')
  const noticeRef = useRef<BungeoNotice | null>(null)
  const setupRef = useRef<BakeSetup | null>(null)
  const gaugeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const bakeStartRef = useRef(0)
  const pausedRef = useRef(isPaused)
  const lastFrameRef = useRef(0)
  // 결과 카드는 뜰 때마다 한 번만 닫힌다 (사라지는 애니메이션 중에 또 눌려 문제가 두 개 넘어가지 않게)
  const outcomeClosedRef = useRef(true)

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { pendingBakeRef.current = pendingBake }, [pendingBake])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { noticeRef.current = notice }, [notice])
  useEffect(() => { setupRef.current = setup }, [setup])
  useEffect(() => { pausedRef.current = isPaused }, [isPaused])

  // 저장된 데이터 복원 (새로고침 방어) — 플레이어당 한 번만.
  // currentPlayer 는 DB 갱신마다 새 객체가 되므로 매번 복원하면 방금 구운 결과가 옛 값으로 되돌아간다.
  const restoredPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentPlayer || restoredPlayerIdRef.current === currentPlayer.id) return
    restoredPlayerIdRef.current = currentPlayer.id
    const saved = parseStats(currentPlayer.item_effects)
    statsRef.current = saved
    setStats(saved)
    const savedScore = typeof currentPlayer.score === 'number' ? currentPlayer.score : 0
    scoreRef.current = savedScore
    setScore(savedScore)
  }, [currentPlayer])

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => stopLoop, [stopLoop])

  const persist = useCallback(async (nextStats: BungeoStats, nextScore: number, reason: string) => {
    if (!playerId) return
    try {
      await commitPlayerPatch(playerId, { score: nextScore, item_effects: nextStats }, reason)
    } catch (error) {
      console.error('Error saving bungeoppang progress:', error)
    }
  }, [commitPlayerPatch, playerId])

  // ─── 뒤집기 ───
  const flip = useCallback((forcedPosition?: number) => {
    if (phaseRef.current !== 'baking' || !setupRef.current) return
    stopLoop()
    const position = forcedPosition ?? gaugeRef.current
    const result = resolveBake(statsRef.current, position, setupRef.current, Math.random)
    const nextScore = scoreRef.current + result.points

    statsRef.current = result.stats
    scoreRef.current = nextScore
    setStats(result.stats)
    setScore(nextScore)
    setGauge(position)
    gaugeRef.current = position
    outcomeClosedRef.current = false
    setOutcome(result)
    setPhase('done')

    if (result.filling.id === 'golden') playSFX('item')
    else if (result.grade.id === 'perfect') playSFX('correct')
    else if (result.grade.id === 'burnt') playSFX('incorrect')
    else playSFX('click')

    void persist(result.stats, nextScore, 'bungeo_bake')
  }, [persist, playSFX, stopLoop])

  // ─── 게이지 루프 ───
  const runLoop = useCallback(() => {
    const tick = (now: number) => {
      const current = setupRef.current
      if (!current || phaseRef.current !== 'baking') return
      const dt = now - lastFrameRef.current
      lastFrameRef.current = now
      if (pausedRef.current) {
        // 멈춘 시간만큼 시작 시각을 뒤로 밀어 게이지가 그 자리에 머문다
        bakeStartRef.current += dt
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const elapsed = now - bakeStartRef.current
      const value = Math.min(100, (elapsed / current.durationMs) * 100)
      gaugeRef.current = value
      setGauge(value)
      if (value >= 100) {
        rafRef.current = null
        flip(100)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    const start = performance.now()
    bakeStartRef.current = start
    lastFrameRef.current = start
    rafRef.current = requestAnimationFrame(tick)
  }, [flip])

  // ─── 굽기 시작 ───
  const startBaking = useCallback(() => {
    if (!pendingBakeRef.current || phaseRef.current !== 'idle' || noticeRef.current) return
    const nextSetup = getBakeSetup(statsRef.current.buffs)
    setupRef.current = nextSetup
    setSetup(nextSetup)
    gaugeRef.current = 0
    setGauge(0)
    setOutcome(null)
    phaseRef.current = 'baking'
    setPhase('baking')
    setCurrentView('bake')
    playSFX('click')
    runLoop()
  }, [playSFX, runLoop, setCurrentView])

  // ─── 정답 제출 ───
  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (!correct) {
      playSFX('incorrect')
      handleWrongAnswer()
      return false
    }

    playSFX('correct')
    setPendingBake(true)
    pendingBakeRef.current = true

    // 랜덤 이벤트 → 없으면 (조건이 맞을 때만) 도움 아이템. 한 정답에 알림은 하나만.
    const buffs = statsRef.current.buffs
    const eventId = rollEvent(buffs, Math.random)
    if (eventId) {
      const nextStats = { ...statsRef.current, buffs: applyEvent(buffs, eventId) }
      statsRef.current = nextStats
      setStats(nextStats)
      setNotice(makeEventNotice(eventId))
      playSFX('item')
      return true
    }
    if (playerId && isHelpEligible(players, playerId)) {
      const helpId = rollHelpItem(buffs, Math.random)
      if (helpId) {
        const nextStats = { ...statsRef.current, buffs: applyHelpItem(buffs, helpId) }
        statsRef.current = nextStats
        setStats(nextStats)
        setNotice(makeHelpNotice(helpId))
        playSFX('item')
      }
    }
    return true
  }

  const closeNotice = useCallback(() => {
    setNotice(null)
    noticeRef.current = null
  }, [])

  const closeOutcome = useCallback(() => {
    if (outcomeClosedRef.current) return
    outcomeClosedRef.current = true
    setOutcome(null)
    setSetup(null)
    setupRef.current = null
    setPhase('idle')
    phaseRef.current = 'idle'
    setPendingBake(false)
    pendingBakeRef.current = false
    goToNextQuestion()
  }, [goToNextQuestion])

  /** 큰 버튼 하나: 굽기 전엔 시작, 굽는 중엔 뒤집기, 결과 카드가 떠 있으면 닫기 */
  const handleMainButton = useCallback(() => {
    if (phaseRef.current === 'baking') { flip(); return }
    if (phaseRef.current === 'done') { closeOutcome(); return }
    startBaking()
  }, [closeOutcome, flip, startBaking])

  // 스페이스바 & 엔터
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return
      if (noticeRef.current) return
      if (phaseRef.current === 'idle' && !pendingBakeRef.current) return
      event.preventDefault()
      handleMainButton()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleMainButton])

  const comboLabel = useMemo(() => getPerfectComboLabel(stats.perfectStreak), [stats.perfectStreak])

  /** HUD 에 보여 줄 걸려 있는 효과 */
  const activeEffects = useMemo(() => {
    const items: Array<{ id: string; emoji: string; label: string }> = []
    const { buffs } = stats
    if (buffs.fireMode) items.push({ id: 'fire', emoji: '🔥', label: `불맛 모드 ×${BUNGEO.FIRE_MODE_MULTIPLIER}` })
    if (buffs.coldBakes > 0) items.push({ id: 'cold', emoji: '❄️', label: `한파 +${Math.round(BUNGEO.COLD_WAVE_BONUS * 100)}% (${buffs.coldBakes}개)` })
    if (buffs.slowBakes > 0) items.push({ id: 'slow', emoji: '🐢', label: `게이지 느림 (${buffs.slowBakes}개)` })
    if (buffs.fastBakes > 0) items.push({ id: 'fast', emoji: '🔥', label: `화력 폭주 (${buffs.fastBakes}개)` })
    if (buffs.wideBakes > 0) items.push({ id: 'wide', emoji: '🧈', label: `완벽 구간 UP (${buffs.wideBakes}개)` })
    if (buffs.goldenBakes > 0) items.push({ id: 'gold', emoji: '🌟', label: '황금 확률 UP' })
    if (buffs.customer) items.push({ id: 'dog', emoji: '🐶', label: `단골손님: 완벽이면 +${BUNGEO.REGULAR_CUSTOMER_BONUS}` })
    return items
  }, [stats])

  return {
    stats,
    score,
    pendingBake,
    phase,
    gauge,
    setup,
    outcome,
    notice,
    comboLabel,
    activeEffects,
    handleAnswerSubmit,
    startBaking,
    flip,
    closeOutcome,
    closeNotice,
    handleMainButton,
  }
}
