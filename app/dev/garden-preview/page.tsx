'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Database } from '@/types/database.types'
import IsoGarden from '@/components/garden/IsoGarden'
import GardenScreen from '@/components/garden/GardenScreen'
import RewardCards from '@/components/garden/RewardCards'
import GardenResultSummary from '@/components/garden/GardenResultSummary'
import Leaderboard from '@/components/Leaderboard'
import { useGardenGame } from '@/hooks/useGardenGame'
import { emitRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import { CROP_BY_ID, createGarden, type CropId, type GardenState, type Mutation } from '@/lib/game/garden'

/**
 * 블록 텃밭 키우기 미리보기 — 실제 방 없이 진짜 훅(useGardenGame)과 화면 조각을 돌려 본다.
 * ?view=play(기본)|summary
 *   play: 퀴즈(정답!/오답 버튼) → 카드 고르기 → 밭. 위 막대의 「까마귀 받기」로 친구 까마귀를 흉내 낸다.
 *     ?preset=rich  밭 10칸·코인 3,000·여러 단계 작물(황금·무지개·촉촉 포함)·스프링클러 1단계로 시작
 *     ?view0=garden 처음부터 밭 화면
 *   summary: 학생 결과 화면의 "오늘의 텃밭" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린', '시우', '수아']

function richGarden(): GardenState {
  const garden = createGarden()
  const unlocked = [5, 6, 9, 10, 1, 2, 4, 8, 7, 11]
  const crops: Array<[number, CropId, number, Mutation | null]> = [
    // [칸, 작물, 진행도(0~1), 다 자랐을 때 변이]
    [5, 'carrot', 1, 'none'],
    [6, 'strawberry', 1, 'gold'],
    [9, 'pumpkin', 1, 'rainbow'],
    [10, 'tomato', 0.7, null],
    [1, 'corn', 0.4, null],
    [2, 'watermelon', 1, 'wet'],
    [4, 'blueberry', 0.1, null],
    [8, 'apple_tree', 1, 'none'],
    [7, 'dragonfruit', 0.85, null],
  ]
  const clockMs = 200000
  garden.clockMs = clockMs
  garden.coins = 3000
  garden.sprinkler = 1
  garden.seeds = { carrot: 3, blueberry: 1, corn: 1 }
  garden.shop = { carrot: 3, strawberry: 2, tomato: 1, watermelon: 1, apple_tree: 1 }
  garden.plots = garden.plots.map((plot, index) => ({ ...plot, unlocked: plot.unlocked || unlocked.includes(index) }))
  for (const [index, cropId, progress, mutation] of crops) {
    const def = CROP_BY_ID[cropId]
    garden.plots[index] = {
      unlocked: true,
      crop: { cropId, startedAt: clockMs - def.growMs * progress, needMs: def.growMs, harvestsLeft: def.harvests, mutation },
    }
  }
  return garden
}

function makePlayers(garden: GardenState): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? garden.earned : 2400 - i * 260,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? garden : { ...createGarden(), earned: 2400 - i * 260, stats: { ...createGarden().stats, harvests: 20 - i, mutated: Math.max(0, 4 - i) } },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function PlayPreview({ params }: { params: URLSearchParams }) {
  const initial = useMemo(() => (params.get('preset') === 'rich' ? richGarden() : createGarden()), [params])
  const players = useMemo(() => makePlayers(initial), [initial])
  const [view, setView] = useState(params.get('view0') ?? 'quiz')
  const [sent, setSent] = useState<string[]>([])

  const game = useGardenGame({
    playerId: 'p0',
    currentPlayer: players[0],
    players,
    currentView: view,
    setCurrentView: setView,
    checkAnswer: async (answer) => answer === 'O',
    handleWrongAnswer: () => {
      setView('wrong')
      window.setTimeout(() => setView('quiz'), 1200)
    },
    goToNextQuestion: () => setView('quiz'),
    playSFX: () => {},
    commitPlayerPatch: async () => {},
    sendRoomEvent: async (type, payload) => {
      setSent((current) => [...current, `${type} → ${(payload as { targetId?: string })?.targetId}`])
      return { ok: true }
    },
    isRunning: params.get('paused') !== '1',
  })

  // 처음부터 밭 화면이면 밭 시간을 다시 세게 한 번 들어간다
  useEffect(() => {
    if (params.get('view0') === 'garden') setView('garden')
  }, [params])

  const receiveCrow = () => {
    emitRoomRuntimeEvent({
      type: 'garden:crow',
      roomCode: 'PREVIEW',
      clientId: 'preview',
      playerId: 'p1',
      sentAt: new Date().toISOString(),
      seq: Date.now(),
      payload: { targetId: 'p0', fromId: 'p1', fromName: '민준', crowId: `crow-${Date.now()}` },
    })
  }

  return (
    <div className="relative z-10 p-3 sm:p-4">
      <div className={`mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm font-bold ${params.get('bare') === '1' ? 'hidden' : ''}`}>
        <span data-testid="coins">지갑 {game.garden.coins} · 번 돈 {game.garden.earned}</span>
        <span>· view={view} · 비={String(game.raining)} · 까마귀 대기 {game.incomingCrows.length}</span>
        {view === 'quiz' && !game.rewardCards && (
          <>
            <button type="button" data-testid="correct" onClick={() => void game.handleAnswerSubmit('O')} className="rounded bg-emerald-500 px-3 py-1 text-white">정답!</button>
            <button type="button" data-testid="wrong" onClick={() => void game.handleAnswerSubmit('X')} className="rounded bg-red-500 px-3 py-1 text-white">오답</button>
          </>
        )}
        {view === 'quiz' && game.rewardCards && (
          <button type="button" data-testid="reward" onClick={game.openReward} className="rounded bg-lime-600 px-3 py-1 text-white">카드 고르기 →</button>
        )}
        <button type="button" data-testid="crow" onClick={receiveCrow} className="rounded bg-slate-800 px-3 py-1 text-white">까마귀 받기</button>
        {sent.length > 0 && <span className="text-xs text-slate-500">보냄: {sent.join(', ')}</span>}
      </div>

      <div className="mx-auto max-w-7xl">
        {view === 'quiz' && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="flex min-h-[260px] items-center justify-center rounded-2xl bg-white/80 text-2xl font-black text-slate-500 shadow-lg">
              (여기에 퀴즈 문제)
            </div>
            <aside className="space-y-4">
              <div className="rounded-xl border border-white/80 bg-gradient-to-b from-sky-200 to-lime-100 p-3 shadow-lg">
                <div className="mb-1 text-sm font-black text-slate-800">🌱 내 밭 (자라는 중)</div>
                <IsoGarden garden={game.garden} raining={game.raining} interactive={false} />
              </div>
              <Leaderboard compact players={players} currentPlayerId="p0" sortBy="score" gameMode="garden" title="🌱 번 돈 순위" />
            </aside>
          </div>
        )}
        {view === 'wrong' && <div className="rounded-xl bg-white/90 p-10 text-center text-4xl font-black text-red-600">틀렸습니다</div>}
        {view === 'reward' && game.rewardCards && (
          <RewardCards
            cards={game.rewardCards}
            choosingCrowTarget={game.choosingCrowTarget}
            targets={game.otherPlayers}
            onPick={game.pickCard}
            onSendCrow={game.sendCrow}
            onCancelCrow={game.cancelCrowTarget}
          />
        )}
        {view === 'garden' && <GardenScreen game={game} players={players} playerId="p0" />}
      </div>

      {game.notice && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-xl">{game.notice.text}</div>
        </div>
      )}
    </div>
  )
}

function SummaryPreview() {
  const garden = richGarden()
  Object.assign(garden, { earned: 4120 })
  Object.assign(garden.stats, { harvests: 31, mutated: 5, rainbow: 1, bestHarvest: 5200, crowsShooed: 2 })
  const players = makePlayers(garden)
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <GardenResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function GardenPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (서버 HTML 과 달라지는 hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-sky-300" />
  const view = params.get('view') ?? 'play'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-sky-300 font-bitbit text-slate-900">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,#7dd3fc_0%,#bae6fd_45%,#bbf7d0_75%,#86efac_100%)]" />
      {view === 'play' && <PlayPreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
