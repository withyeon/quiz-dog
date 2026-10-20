'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database.types'
import Griddle from '@/components/bungeoppang/Griddle'
import BakeGauge from '@/components/bungeoppang/BakeGauge'
import BakeResultCard from '@/components/bungeoppang/BakeResultCard'
import NoticeModal from '@/components/bungeoppang/NoticeModal'
import StallScene from '@/components/bungeoppang/StallScene'
import BungeoDog, { type DogMood } from '@/components/bungeoppang/BungeoDog'
import BungeoResultSummary from '@/components/bungeoppang/BungeoResultSummary'
import { gradeToSprite, type BungeoSpriteState } from '@/components/bungeoppang/BungeoSprite'
import Leaderboard from '@/components/Leaderboard'
import { useBungeoppangGame } from '@/hooks/useBungeoppangGame'
import {
  BUNGEO,
  createEmptyStats,
  getBakeSetup,
  gradeAt,
  makeEventNotice,
  makeHelpNotice,
  resolveBake,
  type EventId,
  type HelpItemId,
  type BungeoStats,
} from '@/lib/game/bungeoppang'

/**
 * 붕어빵 굽굽! 미리보기 — 실제 방 없이 진짜 훅(useBungeoppangGame)과 화면 조각을 돌려 본다.
 * ?view=bake(기본)|result|notice|summary
 *   bake: 「정답!」 버튼이 정답 처리 → 굽기 시작, 「뒤집기!」/스페이스로 뒤집기. ?tray=5 로 판 진행, ?buff=slow|fast|wide 로 효과.
 *   result: 결과 카드만 (?filling=golden|twin, ?grade=perfect|burnt)
 *   notice: 이벤트 알림 (?event=cold_wave|fire_surge|butter_time|golden_dough|regular_customer|warm_gloves|master_help)
 *   summary: 학생 결과 화면의 "오늘의 붕어빵 장인" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린', '시우', '수아']

function makePlayers(stats: BungeoStats): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? 0 : 900 - i * 90,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? stats : { ...createEmptyStats(), baked: 8 - i, perfect: Math.max(0, 5 - i), golden: i === 2 ? 1 : 0, fillings: { ...createEmptyStats().fillings, redbean: 6 - i, cream: i } },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function BakePreview({ params }: { params: URLSearchParams }) {
  const [view, setView] = useState('quiz')
  const tray = Math.max(0, Math.min(5, Number(params.get('tray') ?? 2)))
  const buff = params.get('buff')
  const initialStats = useMemo(() => {
    const stats = createEmptyStats()
    stats.tray = tray
    stats.baked = tray
    stats.perfectStreak = Number(params.get('streak') ?? 0)
    if (buff === 'slow') stats.buffs.slowBakes = 2
    if (buff === 'fast') stats.buffs.fastBakes = 2
    if (buff === 'wide') stats.buffs.wideBakes = 2
    if (buff === 'fire') stats.buffs.fireMode = true
    return stats
  }, [buff, params, tray])
  const players = useMemo(() => makePlayers(initialStats), [initialStats])

  const game = useBungeoppangGame({
    playerId: 'p0',
    currentPlayer: players[0],
    players,
    checkAnswer: async () => true,
    handleWrongAnswer: () => {},
    goToNextQuestion: () => setView('quiz'),
    playSFX: () => {},
    setCurrentView: setView,
    commitPlayerPatch: async () => {},
    isPaused: false,
  })
  const { stats, score, pendingBake, phase, gauge, setup, outcome, notice, comboLabel, handleAnswerSubmit, startBaking, closeOutcome, closeNotice, handleMainButton } = game

  const cookingSprite: BungeoSpriteState | null = (() => {
    if (phase === 'idle') return pendingBake ? 'dough' : null
    if (!setup) return 'dough'
    if (phase === 'done' && outcome) return outcome.filling.id === 'golden' ? 'golden' : gradeToSprite(outcome.grade.id)
    if (gauge < 2) return 'dough'
    return gradeToSprite(gradeAt(gauge, setup.zones).id)
  })()
  const dogMood: DogMood = !outcome || phase !== 'done' ? 'idle'
    : outcome.filling.id === 'golden' ? 'wow' : outcome.grade.id === 'perfect' ? 'happy' : outcome.grade.id === 'burnt' ? 'sweat' : 'idle'

  return (
    <div className="relative z-10 p-3 sm:p-4">
      <div className={`mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm font-bold ${params.get('bare') === '1' ? 'invisible' : ''}`}>
        <span data-testid="score">{score}점</span>
        <span>· 붕어빵 {stats.baked}개 · 판 {stats.tray}/{BUNGEO.TRAY_SIZE} · 콤보 {stats.perfectStreak}</span>
        <span>· view={view} phase={phase}</span>
        {view === 'quiz' && !pendingBake && (
          <button type="button" data-testid="answer" onClick={() => void handleAnswerSubmit('x')} className="rounded bg-emerald-500 px-3 py-1 text-white">정답!</button>
        )}
        {view === 'quiz' && pendingBake && (
          <button type="button" data-testid="start" onClick={startBaking} className="rounded bg-amber-500 px-3 py-1 text-white">굽기 화면으로</button>
        )}
      </div>
      <div className="mx-auto max-w-7xl">
        {view === 'quiz' && (
          <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg">
            <div className="mb-3 text-base font-extrabold text-slate-800">내 철판 {stats.tray} / {BUNGEO.TRAY_SIZE}</div>
            <Griddle filled={stats.tray} cooking={pendingBake ? 'dough' : null} size="sm" flames={pendingBake ? 'low' : 'off'} />
          </div>
        )}
        {view === 'bake' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <StallScene>
              <div className="mb-2 flex items-end justify-between">
                <BungeoDog mood={dogMood} size={80} />
                <div className="text-right text-amber-100">
                  <div className="text-xs font-bold opacity-80">이번 판</div>
                  <div className="text-2xl font-black">{stats.tray} / {BUNGEO.TRAY_SIZE}</div>
                </div>
              </div>
              <Griddle filled={stats.tray} cooking={cookingSprite} size="lg" flames={phase === 'baking' ? (setup?.fast ? 'high' : 'low') : 'low'} />
              <div className="mx-auto mt-5 max-w-md">
                <BakeGauge zones={setup?.zones ?? []} value={gauge} running={phase === 'baking'} />
              </div>
              <div className="mx-auto mt-5 max-w-md">
                <button
                  type="button"
                  data-testid="flip"
                  onClick={handleMainButton}
                  disabled={phase === 'done'}
                  className={`w-full rounded-2xl border-4 border-[#1f1a17] py-5 text-3xl font-black text-white shadow-[0_8px_0_#7c2d12] sm:py-6 sm:text-4xl ${phase === 'baking' ? 'bg-orange-500 bungeo-pulse' : 'bg-amber-500'} disabled:opacity-60`}
                >
                  {phase === 'baking' ? '🔄 뒤집기!' : phase === 'done' ? '구웠어요!' : '🔥 굽기 시작'}
                </button>
              </div>
            </StallScene>
            <aside className="flex flex-col gap-4">
              {comboLabel && <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center text-2xl font-black text-orange-700">{comboLabel}</div>}
              <Leaderboard players={players} currentPlayerId="p0" sortBy="score" gameMode="bungeoppang" title="🐟 붕어빵 순위" />
            </aside>
          </div>
        )}
      </div>
      <AnimatePresence>{outcome && phase === 'done' && <BakeResultCard outcome={outcome} onClose={closeOutcome} />}</AnimatePresence>
      <AnimatePresence>{notice && <NoticeModal notice={notice} onClose={closeNotice} />}</AnimatePresence>
    </div>
  )
}

function ResultPreview({ params }: { params: URLSearchParams }) {
  const outcome = useMemo(() => {
    const stats = createEmptyStats()
    stats.tray = Number(params.get('tray') ?? 2)
    stats.perfectStreak = Number(params.get('streak') ?? 2)
    if (params.get('fire') === '1') stats.buffs.fireMode = true
    const setup = getBakeSetup(stats.buffs)
    const grade = params.get('grade') ?? 'perfect'
    const position = grade === 'burnt' ? 99 : grade === 'underdone' ? 5 : grade === 'crispy' ? 80 : grade === 'tasty' ? 30 : 55
    const filling = params.get('filling') ?? 'redbean'
    const rolls = filling === 'golden' ? [0.0] : filling === 'twin' ? [0.9, 0.999] : filling === 'cheese' ? [0.9, 0.78] : filling === 'cream' ? [0.9, 0.6] : filling === 'choco' ? [0.9, 0.86] : [0.9, 0.0]
    let i = 0
    return resolveBake(stats, position, setup, () => rolls[i++ % rolls.length])
  }, [params])
  return <BakeResultCard outcome={outcome} onClose={() => {}} />
}

function NoticePreview({ params }: { params: URLSearchParams }) {
  const id = params.get('event') ?? 'golden_dough'
  const notice = id === 'warm_gloves' || id === 'master_help' ? makeHelpNotice(id as HelpItemId) : makeEventNotice(id as EventId)
  return <NoticeModal notice={notice} onClose={() => {}} />
}

function SummaryPreview() {
  const stats = createEmptyStats()
  Object.assign(stats, { baked: 12, perfect: 5, golden: 1, traysDone: 2, bestPerfectStreak: 3 })
  stats.fillings.redbean = 7
  const players = makePlayers(stats)
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <BungeoResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function BungeoppangPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (서버 HTML 과 달라지는 hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-[#1e1b4b]" />
  const view = params.get('view') ?? 'bake'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#1e1b4b] font-bitbit text-slate-900">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.18),transparent_55%),linear-gradient(180deg,#0f172a_0%,#1e1b4b_60%,#312e81_100%)]" />
      {view === 'bake' && <BakePreview params={params} />}
      {view === 'result' && <ResultPreview params={params} />}
      {view === 'notice' && <NoticePreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
