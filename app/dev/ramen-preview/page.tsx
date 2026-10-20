'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database.types'
import KitchenScene from '@/components/ramen/KitchenScene'
import CustomerRow from '@/components/ramen/CustomerRow'
import RamenPot from '@/components/ramen/RamenPot'
import IngredientBar from '@/components/ramen/IngredientBar'
import RoundResultCard from '@/components/ramen/RoundResultCard'
import RamenResultSummary from '@/components/ramen/RamenResultSummary'
import Leaderboard from '@/components/Leaderboard'
import { useRamenGame } from '@/hooks/useRamenGame'
import {
  RAMEN,
  createEmptyStats,
  createPot,
  drawCustomers,
  evaluatePot,
  resolveRound,
  type Pot,
  type RamenStats,
} from '@/lib/game/ramen'

/**
 * 퀴즈독의 라면가게 미리보기 — 실제 방 없이 진짜 훅(useRamenGame)과 화면 조각을 돌려 본다.
 * ?view=cook(기본)|result|summary
 *   cook: 「정답!」 → 손님 등장 → 주방. ?customers=3 으로 손님 수 고정(랜덤 대신), ?money=9400 으로 시작 매출.
 *   result: 판 결과 카드만 (?mix=perfect,good,burnt 처럼 판정 나열, ?goal=1 로 목표 달성 축하)
 *   summary: 학생 결과 화면의 "오늘의 라면가게" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린', '시우', '수아']

function makePlayers(stats: RamenStats, money: number): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? money : 7800 - i * 700,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? stats : { ...createEmptyStats(), customers: 10 - i, served: 9 - i, perfect: Math.max(0, 6 - i), money: 7800 - i * 700, bestRound: 2000 },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function CookPreview({ params }: { params: URLSearchParams }) {
  const [view, setView] = useState('quiz')
  const forcedCustomers = params.get('customers')
  const startMoney = Number(params.get('money') ?? 0)
  const initialStats = useMemo(() => {
    const stats = createEmptyStats()
    stats.money = startMoney
    return stats
  }, [startMoney])
  const players = useMemo(() => makePlayers(initialStats, startMoney), [initialStats, startMoney])

  // ?customers=N 이면 손님 수 뽑기를 고정한다 (Math.random 첫 호출만)
  useEffect(() => {
    if (!forcedCustomers) return
    const original = Math.random
    const n = Math.max(1, Math.min(RAMEN.MAX_CUSTOMERS, Number(forcedCustomers)))
    let armed = false
    ;(window as unknown as { __ramenArm: () => void }).__ramenArm = () => { armed = true }
    Math.random = () => {
      if (armed) {
        armed = false
        const weights = RAMEN.CUSTOMER_WEIGHTS
        const total = weights.reduce((sum, weight) => sum + weight, 0)
        const before = weights.slice(0, n - 1).reduce((sum, weight) => sum + weight, 0)
        return (before + weights[n - 1] / 2) / total
      }
      return original()
    }
    return () => { Math.random = original }
  }, [forcedCustomers])

  const game = useRamenGame({
    playerId: 'p0',
    currentPlayer: players[0],
    checkAnswer: async () => true,
    handleWrongAnswer: () => {},
    goToNextQuestion: () => setView('quiz'),
    playSFX: () => {},
    setCurrentView: setView,
    commitPlayerPatch: async () => {},
    isPaused: params.get('paused') === '1',
  })
  const { stats, money, pendingCustomers, round, phase, selectedPot, outcome, handleAnswerSubmit, startCooking, selectPot, addToSelected, servePot, closeOutcome } = game
  const selected = round?.pots[selectedPot] ?? null

  return (
    <div className="relative z-10 p-3 sm:p-4">
      <div className={`mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm font-bold ${params.get('bare') === '1' ? 'invisible' : ''}`}>
        <span data-testid="money">{money}원</span>
        <span>· 손님 {stats.customers}명 · 1,000원 {stats.perfect}개 · view={view} phase={phase}</span>
        {view === 'quiz' && !pendingCustomers && (
          <button
            type="button"
            data-testid="answer"
            onClick={() => { (window as unknown as { __ramenArm?: () => void }).__ramenArm?.(); void handleAnswerSubmit('x') }}
            className="rounded bg-emerald-500 px-3 py-1 text-white"
          >
            정답!
          </button>
        )}
        {view === 'quiz' && pendingCustomers && (
          <button type="button" data-testid="start" onClick={startCooking} className="rounded bg-violet-500 px-3 py-1 text-white">주방으로 ({pendingCustomers.length}명)</button>
        )}
      </div>
      <div className="mx-auto max-w-7xl">
        {view === 'cook' && round && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <KitchenScene>
              <CustomerRow customers={round.customers} pots={round.pots} patienceTotalMs={round.patienceTotalMs} patienceLeftMs={round.patienceLeftMs} />
              <div className={`mt-6 grid gap-3 sm:gap-4 ${round.pots.length === 1 ? 'mx-auto max-w-[220px] grid-cols-1' : round.pots.length === 2 ? 'mx-auto max-w-md grid-cols-2' : 'grid-cols-3'}`}>
                {round.pots.map((pot) => (
                  <RamenPot key={pot.index} pot={pot} selected={selectedPot === pot.index && !pot.result} onSelect={() => selectPot(pot.index)} onServe={() => servePot(pot.index)} compact={round.pots.length === 3} />
                ))}
              </div>
              <div className="mt-4">
                <IngredientBar pot={selected && !selected.result ? selected : null} onAdd={addToSelected} />
              </div>
            </KitchenScene>
            <aside>
              <Leaderboard players={players} currentPlayerId="p0" sortBy="score" gameMode="ramen" title="🍜 매출 순위" />
            </aside>
          </div>
        )}
      </div>
      <AnimatePresence>{outcome && phase === 'done' && <RoundResultCard outcome={outcome} onClose={closeOutcome} />}</AnimatePresence>
    </div>
  )
}

/** 판정 이름으로 냄비를 만든다 (결과 카드 미리보기용) */
function potFor(verdict: string, index: number): Pot {
  const pot = createPot(index)
  switch (verdict) {
    case 'perfect': return { ...pot, noodle: true, soup: true, water: true, leek: 'boiling', egg: 'boiling', cookMs: RAMEN.HEAT_MS + 1000 }
    case 'good': return { ...pot, noodle: true, soup: true, water: true, leek: 'early', egg: 'boiling', cookMs: RAMEN.HEAT_MS + 1000 }
    case 'okay': return { ...pot, noodle: true, soup: true, water: true, leek: 'early', egg: 'early', cookMs: RAMEN.HEAT_MS + 1000 }
    case 'plain': return { ...pot, noodle: true, soup: true, water: true, cookMs: RAMEN.HEAT_MS + 1000 }
    case 'raw': return { ...pot, noodle: true, soup: true, water: true, cookMs: 1000 }
    case 'missing': return { ...pot, noodle: true, water: true, cookMs: RAMEN.HEAT_MS + 1000 }
    case 'burnt': return { ...pot, noodle: true, soup: true, water: true, cookMs: RAMEN.HEAT_MS + RAMEN.BOIL_MS }
    default: return { ...pot, noodle: true, soup: true, water: true, leek: 'boiling', egg: 'boiling', cookMs: RAMEN.HEAT_MS + 1000 }
  }
}

function ResultPreview({ params }: { params: URLSearchParams }) {
  const outcome = useMemo(() => {
    const mix = (params.get('mix') ?? 'perfect,good,burnt').split(',').filter(Boolean).slice(0, 3)
    const customers = drawCustomers(mix.length, () => 0.37)
    const results = mix.map((verdict, index) => evaluatePot(potFor(verdict, index), () => 0.1))
    const stats = createEmptyStats()
    const before = params.get('goal') === '1' ? RAMEN.GOAL_MONEY - 500 : 3200
    return resolveRound(stats, customers, results, before)
  }, [params])
  return <RoundResultCard outcome={outcome} onClose={() => {}} />
}

function SummaryPreview() {
  const stats = createEmptyStats()
  Object.assign(stats, { rounds: 9, customers: 16, served: 14, perfect: 7, bestRound: 3000, tripleCrowns: 1, money: 11400 })
  const players = makePlayers(stats, 11400)
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <RamenResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function RamenPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (서버 HTML 과 달라지는 hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-[#3f1d0b]" />
  const view = params.get('view') ?? 'cook'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#3f1d0b] font-bitbit text-slate-900">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.25),transparent_55%),linear-gradient(180deg,#5b2b12_0%,#3f1d0b_60%,#2a1208_100%)]" />
      {view === 'cook' && <CookPreview params={params} />}
      {view === 'result' && <ResultPreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
