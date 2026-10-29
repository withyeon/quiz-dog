'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '@/types/database.types'
import BoneRushArena from '@/components/bone-rush/BoneRushArena'
import BoneRushHudBar from '@/components/bone-rush/BoneRushHudBar'
import BoneRushCards from '@/components/bone-rush/BoneRushCards'
import BoneRushResultSummary from '@/components/bone-rush/BoneRushResultSummary'
import { useBoneRushGame } from '@/hooks/useBoneRushGame'
import { BONE_RUSH, createBoneRushState, toBoneRushSave, type BoneRushSave } from '@/lib/game/boneRush'
import { emitRoomRuntimeEvent } from '@/lib/realtime/roomChannel'

/**
 * 뼈다귀 쟁탈전 미리보기 — 실제 방 없이 진짜 훅(useBoneRushGame)과 캔버스를 돌려 본다.
 * ?view=play(기본)|summary
 *   play: 마당 → 상자에 닿으면 가짜 문제 창(정답!/오답 버튼) → 카드 고르기.
 *     ?preset=rich   뼈다귀 48개·울타리 1개로 시작
 *     ?bare=1        디버그 칸 숨김 (화면 캡처용)
 *   버튼: 고양이 받기(친구가 보낸 것처럼), 전리품 받기(내 고양이가 돌아온 것처럼)
 *   window.__boneRush 로 마당 상태를 만질 수 있다
 *   summary: 학생 결과 화면의 "오늘의 쟁탈전 기록" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린']

function richSave(): BoneRushSave {
  const state = createBoneRushState()
  state.bones = 48
  state.fences = 1
  state.stats = { chests: 9, correct: 7, wrong: 2, collected: 30, catsSent: 2, stolen: 8, looted: 11, blocked: 1 }
  return toBoneRushSave(state)
}

function makePlayers(save: BoneRushSave | null): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? save?.bones ?? 0 : 90 - i * 12,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? save : { ...richSave(), bones: 90 - i * 12, stats: { chests: 12 - i, correct: 10 - i, wrong: 2, collected: 40 - i * 5, catsSent: i, stolen: i * 3, looted: 14 - i * 2, blocked: i % 2 } },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function PlayPreview({ params }: { params: URLSearchParams }) {
  const initial = useMemo(() => (params.get('preset') === 'rich' ? richSave() : null), [params])
  const players = useMemo(() => makePlayers(initial), [initial])
  const [view, setView] = useState('play')
  const [questionNo, setQuestionNo] = useState(1)
  const [sent, setSent] = useState<string[]>([])

  const game = useBoneRushGame({
    playerId: 'p0',
    currentPlayer: players[0],
    players,
    currentView: view,
    setCurrentView: setView,
    checkAnswer: async (answer) => answer === 'O',
    goToNextQuestion: () => setQuestionNo((n) => n + 1),
    playSFX: () => {},
    commitPlayerPatch: async () => {},
    sendRoomEvent: async (type, payload) => {
      setSent((current) => [...current, `${type} → ${JSON.stringify(payload)}`])
      return { ok: true }
    },
    wrongScreenMs: 1200,
    isRoomRunning: params.get('paused') !== '1',
  })

  useEffect(() => {
    ;(window as unknown as { __boneRush?: unknown }).__boneRush = game.stateRef.current
  })

  const [answered, setAnswered] = useState<number | null>(null)
  const answer = useCallback((value: 'O' | 'X') => {
    setAnswered(questionNo)
    void game.handleAnswerSubmit(value)
  }, [game, questionNo])

  const receiveCat = () => {
    emitRoomRuntimeEvent({
      type: 'bone_rush:cat',
      roomCode: 'PREVIEW',
      clientId: 'preview',
      playerId: 'p1',
      sentAt: new Date().toISOString(),
      seq: Date.now(),
      payload: { catId: `cat-${Date.now()}`, targetId: 'p0', fromId: 'p1', fromName: '민준' },
    })
  }
  const receiveLoot = () => {
    emitRoomRuntimeEvent({
      type: 'bone_rush:loot',
      roomCode: 'PREVIEW',
      clientId: 'preview',
      playerId: 'p2',
      sentAt: new Date().toISOString(),
      seq: Date.now(),
      payload: { catId: `loot-${Date.now()}`, targetId: 'p0', fromId: 'p2', fromName: '서연', bones: 7, blocked: false },
    })
  }

  const bare = params.get('bare') === '1'

  return (
    <div className="relative h-dvh overflow-hidden font-bitbit">
      <BoneRushArena stateRef={game.stateRef} running={view === 'play' && params.get('paused') !== '1'} onEvents={game.handleEvents} />
      <BoneRushHudBar hud={game.hud} nickname="하늘이" rank={2} total={players.length} />

      <div className={`absolute bottom-14 left-2 z-40 flex flex-wrap items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold ${bare ? 'hidden' : ''}`} data-testid="debug">
        <span>view={view} · 🦴{game.hud.bones} · 울타리 {game.hud.fences} · 문제 {questionNo} · 보냄 {sent.length}</span>
        <button type="button" data-testid="recv-cat" onClick={receiveCat} className="rounded bg-slate-800 px-2 py-0.5 text-white">고양이 받기</button>
        <button type="button" data-testid="recv-loot" onClick={receiveLoot} className="rounded bg-emerald-600 px-2 py-0.5 text-white">전리품 받기</button>
      </div>

      {view === 'quiz' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 w-fit rounded-full bg-sky-600 px-4 py-1.5 text-sm font-black text-white">📦 보물 상자! 기회 {game.triesLeft}/{BONE_RUSH.CHEST_TRIES}</div>
            <div className="mb-5 text-2xl font-black">(가짜 문제 {questionNo}번)</div>
            {answered === questionNo ? (
              <div className="text-lg font-black text-slate-500">채점 중…</div>
            ) : (
              <div className="flex justify-center gap-3">
                <button type="button" data-testid="correct" onClick={() => answer('O')} className="rounded-xl bg-emerald-500 px-6 py-3 text-xl font-black text-white">정답!</button>
                <button type="button" data-testid="wrong" onClick={() => answer('X')} className="rounded-xl bg-red-500 px-6 py-3 text-xl font-black text-white">오답</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'pick' && game.cards && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-24 sm:items-center sm:p-6">
          <BoneRushCards
            cards={game.cards}
            fences={game.hud.fences}
            choosingTarget={game.choosingTarget}
            targets={game.otherPlayers}
            onPick={game.pickCard}
            onSendCat={game.sendCat}
            onCancelTarget={game.cancelTarget}
          />
        </div>
      )}

      {game.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[26%] z-[35] flex justify-center px-4">
          <div className={`rounded-2xl border-4 border-slate-900 px-5 py-3 text-lg font-black shadow-[0_6px_0_#0f172a] ${game.banner.tone === 'good' ? 'bg-lime-300' : 'bg-yellow-300'}`}>{game.banner.text}</div>
        </div>
      )}
      {game.notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-black text-white shadow-xl">{game.notice.text}</div>
        </div>
      )}
    </div>
  )
}

function SummaryPreview() {
  const players = makePlayers(richSave())
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <BoneRushResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function BoneRushPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-[#8fd27f]" />
  const view = params.get('view') ?? 'play'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#8fd27f] text-slate-900">
      {view === 'play' && <PlayPreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
