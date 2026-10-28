'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '@/types/database.types'
import SurvivorArena from '@/components/survivor/SurvivorArena'
import SurvivorHudBar from '@/components/survivor/SurvivorHudBar'
import SkillCardPicker from '@/components/survivor/SkillCardPicker'
import SurvivorResultSummary from '@/components/survivor/SurvivorResultSummary'
import { useSurvivorGame } from '@/hooks/useSurvivorGame'
import { createSurvivorState, toSurvivorSave, xpForLevel, type SurvivorSave } from '@/lib/game/survivor'

/**
 * 멍멍 서바이벌 미리보기 — 실제 방 없이 진짜 훅(useSurvivorGame)과 캔버스를 돌려 본다.
 * ?view=play(기본)|summary
 *   play: 전투 → 레벨업·쓰러짐이면 가짜 문제 창(정답!/오답 버튼) → 카드 고르기.
 *     ?preset=strong  Lv.12·스킬 여러 개·전투 3분째로 시작
 *     ?boss=1         5초 뒤 대왕 슬라임
 *     ?bare=1         위 막대 숨김 (화면 캡처용)
 *   window.__survivor 로 전투 상태를 만질 수 있다 (예: __survivor.player.hp = 0 → 쓰러짐)
 *   summary: 학생 결과 화면의 "오늘의 생존 기록" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린']

function strongSave(): SurvivorSave {
  const state = createSurvivorState()
  Object.assign(state, { level: 12, xp: xpForLevel(12) - 3, battleMs: 180_000, diffMs: 180_000, score: 6200 })
  state.skills = { bone: 4, ball: 3, bark: 2, lightning: 2, heart: 2, magnet: 1 }
  state.stats.kills = 340
  return toSurvivorSave(state)
}

function makePlayers(save: SurvivorSave | null): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? save?.score ?? 0 : 9000 - i * 1300,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? save : { ...strongSave(), score: 9000 - i * 1300, stats: { kills: 500 - i * 60, bossKills: i % 2, revives: i, levelUps: 15 - i, cards: 15 - i } },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function PlayPreview({ params }: { params: URLSearchParams }) {
  const initial = useMemo(() => (params.get('preset') === 'strong' ? strongSave() : null), [params])
  const players = useMemo(() => makePlayers(initial), [initial])
  const [view, setView] = useState('battle')
  const [questionNo, setQuestionNo] = useState(1)

  const game = useSurvivorGame({
    playerId: 'p0',
    currentPlayer: players[0],
    currentView: view,
    setCurrentView: setView,
    checkAnswer: async (answer) => answer === 'O',
    goToNextQuestion: () => {
      setQuestionNo((n) => n + 1)
      setView('quiz')
    },
    playSFX: () => {},
    commitPlayerPatch: async () => {},
    wrongScreenMs: 1200,
    isRoomRunning: params.get('paused') !== '1',
  })

  useEffect(() => {
    ;(window as unknown as { __survivor?: unknown }).__survivor = game.stateRef.current
  })
  useEffect(() => {
    if (params.get('boss') === '1') game.stateRef.current.nextBossMs = game.stateRef.current.battleMs + 5000
  }, [game.stateRef, params])

  const [answered, setAnswered] = useState<number | null>(null)
  const answer = useCallback((value: 'O' | 'X') => {
    setAnswered(questionNo)
    void game.handleAnswerSubmit(value)
  }, [game, questionNo])

  return (
    <div className="relative h-dvh overflow-hidden font-bitbit">
      <SurvivorArena stateRef={game.stateRef} running={view === 'battle' && params.get('paused') !== '1'} onEvents={game.handleEvents} />
      <SurvivorHudBar hud={game.hud} nickname="하늘이" rank={2} total={players.length} />

      <div className={`absolute bottom-16 left-2 z-40 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold ${params.get('bare') === '1' ? 'hidden' : ''}`} data-testid="debug">
        view={view} · Lv{game.hud.level} · hp {game.hud.hp}/{game.hud.maxHp} · 문제 {questionNo}
      </div>

      {view === 'quiz' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className={`mx-auto mb-4 w-fit rounded-full px-4 py-1.5 text-sm font-black text-white ${game.quizReason === 'revive' ? 'bg-rose-600' : 'bg-sky-600'}`}>
              {game.quizReason === 'revive' ? '💫 쓰러졌어요! 맞히면 다시 일어나요' : '⬆️ 레벨 업!'}
            </div>
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
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-14 sm:items-center sm:p-6">
          <SkillCardPicker cards={game.cards} onPick={game.pickCard} />
        </div>
      )}

      {game.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[28%] z-[35] flex justify-center px-4">
          <div className="rounded-2xl border-4 border-slate-900 bg-yellow-300 px-5 py-3 text-lg font-black shadow-[0_6px_0_#0f172a]">{game.banner.text}</div>
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
  const players = makePlayers(strongSave())
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <SurvivorResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function SurvivorPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (서버 HTML 과 달라지는 hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-[#86d07a]" />
  const view = params.get('view') ?? 'play'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#86d07a] text-slate-900">
      {view === 'play' && <PlayPreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
