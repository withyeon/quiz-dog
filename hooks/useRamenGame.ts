'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BURN_AT_MS,
  RAMEN,
  addIngredient,
  createEmptyStats,
  createPot,
  drawCustomerCount,
  drawCustomers,
  evaluatePot,
  getPatienceMs,
  getPotPhase,
  makeLeftResult,
  parseStats,
  resolveRound,
  type Customer,
  type IngredientId,
  type Pot,
  type RamenStats,
  type RoundOutcome,
} from '@/lib/game/ramen'
import type { SFXType } from '@/hooks/useAudio'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export type RamenPhase = 'idle' | 'cooking' | 'done'

export type RamenRound = {
  customers: Customer[]
  pots: Pot[]
  /** 손님 인내심 전체(ms)·남은(ms) */
  patienceTotalMs: number
  patienceLeftMs: number
}

interface UseRamenGameParams {
  playerId: string | null
  currentPlayer: Player | null | undefined
  checkAnswer: (answer: string) => Promise<boolean>
  handleWrongAnswer: () => void
  goToNextQuestion: () => void
  playSFX: (sound: SFXType) => void
  setCurrentView: (view: string) => void
  /** 내 행 로컬 반영 + player:patch broadcast + DB 쓰기 (useGameBase.commitPlayerPatch) */
  commitPlayerPatch: (playerId: string, patch: Record<string, unknown>, reason?: string) => Promise<void>
  /** 선생님이 멈춘 동안 냄비 타이머·손님 인내심도 멈춘다 */
  isPaused: boolean
}

/** 한 프레임에 흐를 수 있는 최대 시간. 탭이 숨겨졌다 돌아왔을 때 냄비가 한꺼번에 타 버리지 않게 */
const MAX_FRAME_MS = 250

/**
 * 퀴즈독의 라면가게 게임 로직 훅.
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 "한 판"을 얹는다:
 * 정답 → 손님 1~3명(pendingRound) → 조리 화면(냄비 N개, rAF 타이머) → 냄비마다 재료·쟁반 →
 * 모든 냄비 결과 확정(서빙·탐·손님 떠남) → 판 결과(lib/game/ramen.resolveRound) →
 * 점수·통계 저장(players.score / players.item_effects) → 결과 카드 → 다음 문제.
 */
export function useRamenGame({
  playerId,
  currentPlayer,
  checkAnswer,
  handleWrongAnswer,
  goToNextQuestion,
  playSFX,
  setCurrentView,
  commitPlayerPatch,
  isPaused,
}: UseRamenGameParams) {
  const [stats, setStats] = useState<RamenStats>(() => createEmptyStats())
  const [money, setMoney] = useState(0)
  const [pendingCustomers, setPendingCustomers] = useState<Customer[] | null>(null)
  const [round, setRound] = useState<RamenRound | null>(null)
  const [phase, setPhase] = useState<RamenPhase>('idle')
  const [selectedPot, setSelectedPot] = useState(0)
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null)

  const statsRef = useRef(stats)
  const moneyRef = useRef(0)
  const pendingRef = useRef<Customer[] | null>(null)
  const roundRef = useRef<RamenRound | null>(null)
  const phaseRef = useRef<RamenPhase>('idle')
  const selectedRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)
  const pausedRef = useRef(isPaused)
  // 끓기 시작 효과음은 냄비마다 한 번
  const boilNotifiedRef = useRef<Set<number>>(new Set())
  // 결과 카드는 뜰 때마다 한 번만 닫힌다 (사라지는 애니메이션 중에 또 눌려 문제가 두 개 넘어가지 않게)
  const outcomeClosedRef = useRef(true)

  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { pendingRef.current = pendingCustomers }, [pendingCustomers])
  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { selectedRef.current = selectedPot }, [selectedPot])
  useEffect(() => { pausedRef.current = isPaused }, [isPaused])

  // 저장된 데이터 복원 (새로고침 방어) — 플레이어당 한 번만.
  // currentPlayer 는 DB 갱신마다 새 객체가 되므로 매번 복원하면 방금 판 결과가 옛 값으로 되돌아간다.
  const restoredPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentPlayer || restoredPlayerIdRef.current === currentPlayer.id) return
    restoredPlayerIdRef.current = currentPlayer.id
    const saved = parseStats(currentPlayer.item_effects)
    statsRef.current = saved
    setStats(saved)
    const savedMoney = typeof currentPlayer.score === 'number' ? currentPlayer.score : 0
    moneyRef.current = savedMoney
    setMoney(savedMoney)
  }, [currentPlayer])

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => stopLoop, [stopLoop])

  const persist = useCallback(async (nextStats: RamenStats, nextMoney: number, reason: string) => {
    if (!playerId) return
    try {
      await commitPlayerPatch(playerId, { score: nextMoney, item_effects: nextStats }, reason)
    } catch (error) {
      console.error('Error saving ramen progress:', error)
    }
  }, [commitPlayerPatch, playerId])

  const commitRound = useCallback((next: RamenRound) => {
    roundRef.current = next
    setRound(next)
  }, [])

  // ─── 판 끝 ───
  const finishRound = useCallback((current: RamenRound) => {
    stopLoop()
    const results = current.pots.map((pot) => pot.result ?? makeLeftResult())
    const result = resolveRound(statsRef.current, current.customers, results, moneyRef.current)
    statsRef.current = result.stats
    moneyRef.current = result.stats.money
    setStats(result.stats)
    setMoney(result.stats.money)
    outcomeClosedRef.current = false
    setOutcome(result)
    phaseRef.current = 'done'
    setPhase('done')
    if (result.goalReached || result.tripleCrown) playSFX('item')
    void persist(result.stats, result.stats.money, 'ramen_round')
  }, [persist, playSFX, stopLoop])

  const settleIfComplete = useCallback((current: RamenRound) => {
    if (current.pots.every((pot) => pot.result)) finishRound(current)
  }, [finishRound])

  // ─── 타이머 루프: 물 부은 냄비는 익어 가고, 손님 인내심은 줄어든다 ───
  const runLoop = useCallback(() => {
    const tick = (now: number) => {
      const current = roundRef.current
      if (!current || phaseRef.current !== 'cooking') return
      const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrameRef.current))
      lastFrameRef.current = now
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      let boiledNow = false
      const pots = current.pots.map((pot) => {
        if (pot.result || !pot.water) return pot
        const wasBoiling = pot.cookMs >= RAMEN.HEAT_MS
        const next = { ...pot, cookMs: pot.cookMs + dt }
        if (!wasBoiling && next.cookMs >= RAMEN.HEAT_MS && !boilNotifiedRef.current.has(pot.index)) {
          boilNotifiedRef.current.add(pot.index)
          boiledNow = true
        }
        if (next.cookMs >= BURN_AT_MS) {
          return { ...next, cookMs: BURN_AT_MS, result: evaluatePot({ ...next, cookMs: BURN_AT_MS }) }
        }
        return next
      })
      if (boiledNow) playSFX('item')

      const patienceLeftMs = Math.max(0, current.patienceLeftMs - dt)
      let nextRound: RamenRound = { ...current, pots, patienceLeftMs }
      if (patienceLeftMs <= 0) {
        nextRound = {
          ...nextRound,
          pots: pots.map((pot) => (pot.result ? pot : { ...pot, result: makeLeftResult() })),
        }
      }
      commitRound(nextRound)

      if (nextRound.pots.every((pot) => pot.result)) {
        rafRef.current = null
        finishRound(nextRound)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    lastFrameRef.current = performance.now()
    rafRef.current = requestAnimationFrame(tick)
  }, [commitRound, finishRound, playSFX])

  // ─── 조리 시작(손님이 자리에 앉는다) ───
  const startCooking = useCallback(() => {
    const customers = pendingRef.current
    if (!customers || phaseRef.current !== 'idle') return
    const patience = getPatienceMs(customers.length)
    const next: RamenRound = {
      customers,
      pots: customers.map((_, index) => createPot(index)),
      patienceTotalMs: patience,
      patienceLeftMs: patience,
    }
    boilNotifiedRef.current = new Set()
    setOutcome(null)
    commitRound(next)
    selectedRef.current = 0
    setSelectedPot(0)
    phaseRef.current = 'cooking'
    setPhase('cooking')
    setCurrentView('cook')
    playSFX('click')
    runLoop()
  }, [commitRound, playSFX, runLoop, setCurrentView])

  // ─── 정답 제출 ───
  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)
    if (!correct) {
      playSFX('incorrect')
      handleWrongAnswer()
      return false
    }
    playSFX('correct')
    const customers = drawCustomers(drawCustomerCount())
    pendingRef.current = customers
    setPendingCustomers(customers)
    return true
  }

  // ─── 냄비 조작 ───
  const selectPot = useCallback((index: number) => {
    const current = roundRef.current
    if (!current || index < 0 || index >= current.pots.length) return
    selectedRef.current = index
    setSelectedPot(index)
  }, [])

  const addToPot = useCallback((index: number, id: IngredientId) => {
    const current = roundRef.current
    if (!current || phaseRef.current !== 'cooking' || pausedRef.current) return
    const pot = current.pots[index]
    if (!pot) return
    const next = addIngredient(pot, id)
    if (next === pot) return
    const pots = current.pots.map((item, i) => (i === index ? next : item))
    commitRound({ ...current, pots })
    playSFX('click')
  }, [commitRound, playSFX])

  const addToSelected = useCallback((id: IngredientId) => {
    addToPot(selectedRef.current, id)
  }, [addToPot])

  const servePot = useCallback((index: number) => {
    const current = roundRef.current
    if (!current || phaseRef.current !== 'cooking' || pausedRef.current) return
    const pot = current.pots[index]
    if (!pot || pot.result) return
    const result = evaluatePot(pot)
    const pots = current.pots.map((item, i) => (i === index ? { ...item, result } : item))
    const next = { ...current, pots }
    commitRound(next)
    if (result.verdict === 'perfect') playSFX('correct')
    else if (result.money === 0) playSFX('incorrect')
    else playSFX('click')
    // 다음 안 끝난 냄비로 선택을 옮긴다
    const nextOpen = pots.findIndex((item) => !item.result)
    if (nextOpen >= 0) {
      selectedRef.current = nextOpen
      setSelectedPot(nextOpen)
    }
    settleIfComplete(next)
  }, [commitRound, playSFX, settleIfComplete])

  const serveSelected = useCallback(() => {
    servePot(selectedRef.current)
  }, [servePot])

  const closeOutcome = useCallback(() => {
    if (outcomeClosedRef.current) return
    outcomeClosedRef.current = true
    setOutcome(null)
    roundRef.current = null
    setRound(null)
    phaseRef.current = 'idle'
    setPhase('idle')
    pendingRef.current = null
    setPendingCustomers(null)
    goToNextQuestion()
  }, [goToNextQuestion])

  // ─── 키보드: 1~3 냄비 선택 · Q/W/E/R/T 재료 · 스페이스/엔터 쟁반 ───
  useEffect(() => {
    const KEY_TO_INGREDIENT: Record<string, IngredientId> = {
      KeyQ: 'noodle', KeyW: 'soup', KeyE: 'water', KeyR: 'leek', KeyT: 'egg',
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (phaseRef.current === 'done') {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault()
          closeOutcome()
        }
        return
      }
      if (phaseRef.current !== 'cooking') return
      if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
        event.preventDefault()
        selectPot(Number(event.code.slice(-1)) - 1)
        return
      }
      const ingredient = KEY_TO_INGREDIENT[event.code]
      if (ingredient) {
        event.preventDefault()
        addToSelected(ingredient)
        return
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        if (target && target.tagName === 'BUTTON') return
        event.preventDefault()
        serveSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [addToSelected, closeOutcome, selectPot, serveSelected])

  /** 지금 끓고 있는(쟁반에 올릴 타이밍인) 냄비가 있는지 — 화면 강조용 */
  const anyBoiling = useMemo(() => {
    if (!round) return false
    return round.pots.some((pot) => !pot.result && (getPotPhase(pot) === 'boiling' || getPotPhase(pot) === 'overcooking'))
  }, [round])

  return {
    stats,
    money,
    pendingCustomers,
    round,
    phase,
    selectedPot,
    outcome,
    anyBoiling,
    handleAnswerSubmit,
    startCooking,
    selectPot,
    addToPot,
    addToSelected,
    servePot,
    serveSelected,
    closeOutcome,
  }
}
