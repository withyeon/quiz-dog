'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '@/types/database.types'
import QuizpangBoard from '@/components/quizpang/QuizpangBoard'
import QuizpangHud from '@/components/quizpang/QuizpangHud'
import ItemCardPicker from '@/components/quizpang/ItemCardPicker'
import QuizView from '@/components/QuizView'
import QuizpangResultSummary from '@/components/quizpang/QuizpangResultSummary'
import { useQuizpangGame } from '@/hooks/useQuizpangGame'
import { useIsWideLayout } from '@/components/quizpang/useIsWideLayout'
import { QUIZPANG, createQuizpangState, findAnyMove, toQuizpangSave, type ItemId, type QuizpangSave } from '@/lib/game/quizpang'

/**
 * 퀴즈팡팡 미리보기 — 실제 방 없이 진짜 훅(useQuizpangGame)과 보드를 돌려 본다.
 * ?view=play(기본)|summary
 *   play: 퍼즐 → 30초마다 가짜 문제 창(정답!/오답 버튼) → 카드 고르기.
 *     ?seed=123       보드 시드 (기본 777)
 *     ?items=all      보관함에 아이템 4종을 채우고 시작
 *     ?quiz=5         다음 문제까지 5초 (기본 30초)
 *     ?bare=1         숫자판 숨김 (화면 캡처용)
 *     ?realquiz=1     가짜 버튼 대신 실제 문제 화면(QuizView)과 예시 문제 (영상 녹화용, 첫 번째 보기가 정답)
 *   window.__quizpang 으로 상태를 만질 수 있다 (예: __quizpang.quizDueMs = 0 → 바로 문제)
 *   summary: 학생 결과 화면의 "오늘의 팡팡 기록" 칸
 */

type Player = Database['public']['Tables']['players']['Row']

const NAMES = ['하늘이', '민준', '서연', '도윤', '지우', '예린']

function richSave(seed: number, items: boolean, quizInMs: number): QuizpangSave {
  const state = createQuizpangState(seed)
  if (items) state.inventory = ['bomb', 'line', 'shuffle', 'double'] as ItemId[]
  state.quizDueMs = quizInMs
  return toQuizpangSave(state)
}

/** ?realquiz=1 일 때 쓰는 예시 문제 — 첫 번째 보기가 정답 */
const SAMPLE_QUESTIONS = [
  { id: 'sample-1', type: 'CHOICE' as const, question_text: '다음 중 포유류는 무엇일까요?', options: ['강아지', '참새', '개구리', '붕어'], answer: '강아지', image_url: null, explanation: null },
  { id: 'sample-2', type: 'CHOICE' as const, question_text: '물이 얼면 무엇이 될까요?', options: ['얼음', '수증기', '모래', '구름'], answer: '얼음', image_url: null, explanation: null },
  { id: 'sample-3', type: 'CHOICE' as const, question_text: '하루는 몇 시간일까요?', options: ['24시간', '12시간', '36시간', '48시간'], answer: '24시간', image_url: null, explanation: null },
]

function makePlayers(save: QuizpangSave): Player[] {
  return NAMES.map((nickname, i) => ({
    id: `p${i}`,
    room_code: 'PREVIEW',
    nickname,
    avatar: `/character/${(i % 24) + 1}.webp`,
    score: i === 0 ? save.score : 9000 - i * 1300,
    gold: 0,
    is_online: true,
    is_kicked: false,
    item_effects: i === 0 ? save : {
      ...save, score: 9000 - i * 1300, inventory: [],
      stats: { cleared: 500 - i * 60, moves: 120 - i * 10, maxChain: 6 - i, bestMove: 1200 - i * 150, specials: 8 - i, questions: 9, correct: 8 - i, items: 7 - i },
    },
    created_at: '', updated_at: '',
  }) as unknown as Player)
}

function PlayPreview({ params }: { params: URLSearchParams }) {
  const seed = Number(params.get('seed') ?? 777)
  const quizInMs = Number(params.get('quiz') ?? QUIZPANG.QUESTION_INTERVAL_MS / 1000) * 1000
  const initial = useMemo(() => richSave(seed, params.get('items') === 'all', quizInMs), [params, quizInMs, seed])
  const players = useMemo(() => makePlayers(initial), [initial])
  const [view, setView] = useState('puzzle')
  const [questionNo, setQuestionNo] = useState(1)
  const isWide = useIsWideLayout()

  const game = useQuizpangGame({
    playerId: 'p0',
    currentPlayer: players[0],
    currentView: view,
    setCurrentView: setView,
    checkAnswer: async (answer) => answer === 'O' || SAMPLE_QUESTIONS.some((q) => q.answer === answer),
    goToNextQuestion: () => {
      setQuestionNo((n) => n + 1)
      setView('quiz')
    },
    playSFX: () => {},
    commitPlayerPatch: async () => {},
    wrongScreenMs: QUIZPANG.WRONG_REVEAL_MS,
    isRoomRunning: params.get('paused') !== '1',
    boardSeed: seed,
  })

  useEffect(() => {
    const w = window as unknown as { __quizpang?: unknown; __quizpangHint?: () => unknown }
    w.__quizpang = game.stateRef.current
    // 검수 드라이버용: 지금 보드에서 가능한 수 하나 ([{r,c},{r,c}])
    w.__quizpangHint = () => (game.stateRef.current ? findAnyMove(game.stateRef.current.board) : null)
  })

  const [answered, setAnswered] = useState<number | null>(null)
  const answer = useCallback((value: 'O' | 'X') => {
    setAnswered(questionNo)
    void game.handleAnswerSubmit(value)
  }, [game, questionNo])

  const bare = params.get('bare') === '1'
  const hudProps = game.hud ? {
    hud: game.hud, nickname: '하늘이', rank: 2, total: players.length, targeting: game.targeting,
    onUseItem: game.useItem, onCancelTargeting: game.cancelTargeting, onSetLineDir: game.setLineDir,
  } : null
  const running = view === 'puzzle' && params.get('paused') !== '1' && game.ready

  return (
    <div className="relative h-dvh overflow-hidden font-bitbit">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-2 p-2 sm:gap-3 sm:p-4 lg:flex-row lg:items-stretch">
        {hudProps && !bare && <div className="lg:hidden"><QuizpangHud {...hudProps} layout="stack" part="stats" /></div>}
        <div className="relative min-h-0 min-w-0 flex-1">
          <QuizpangBoard ref={game.boardRef} stateRef={game.stateRef} running={running} align={isWide ? 'center' : 'top'} targeting={game.targeting} onEvents={game.handleBoardEvents} onBusy={game.handleBusyChange} onTarget={game.handleBoardTarget} />
        </div>
        {hudProps && !bare && <div className="lg:hidden"><QuizpangHud {...hudProps} layout="stack" part="items" /></div>}
        {hudProps && !bare && <div className="hidden w-72 shrink-0 lg:block xl:w-80"><QuizpangHud {...hudProps} layout="side" /></div>}
      </div>

      <div className={`absolute bottom-1 left-2 z-40 rounded-lg bg-white/90 px-2 py-1 text-xs font-bold ${bare ? 'hidden' : ''}`} data-testid="debug">
        view={view} · 점수 {game.hud?.score ?? 0} · 문제 {questionNo} · 보관함 {game.hud?.inventory.join(',') || '-'}
      </div>

      {view === 'quiz' && params.get('realquiz') === '1' && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-14 sm:items-center sm:p-6">
          <div className="w-full max-w-3xl">
            <div className={`mx-auto mb-3 w-fit rounded-full px-5 py-2 text-center text-base font-black text-white shadow-lg sm:text-lg ${game.quizReason === 'bonus' ? 'bg-rose-600' : 'bg-sky-600'}`}>
              {game.quizReason === 'bonus' ? '한 문제 더! 맞든 틀리든 퍼즐로 돌아가요' : `📝 문제 시간! 맞히면 아이템 ${QUIZPANG.CHOICES}장 중 하나를 골라요`}
            </div>
            <QuizView
              key={questionNo}
              question={SAMPLE_QUESTIONS[(questionNo - 1) % SAMPLE_QUESTIONS.length]}
              onAnswer={game.handleAnswerSubmit}
              onCorrectClick={game.skipCorrectBanner}
              timeLimit={QUIZPANG.QUESTION_TIME_LIMIT}
              variant="glass"
              className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-5 sm:p-8"
            />
          </div>
        </div>
      )}

      {view === 'quiz' && params.get('realquiz') !== '1' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className={`mx-auto mb-4 w-fit rounded-full px-4 py-1.5 text-sm font-black text-white ${game.quizReason === 'bonus' ? 'bg-rose-600' : 'bg-sky-600'}`}>
              {game.quizReason === 'bonus' ? '한 문제 더!' : '📝 문제 시간!'}
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
          <ItemCardPicker cards={game.cards} onPick={game.pickCard} />
        </div>
      )}

      {game.banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[35] flex justify-center px-4">
          <div className={`rounded-2xl border-4 border-slate-900 px-5 py-3 text-xl font-black shadow-[0_6px_0_#0f172a] ${game.banner.big ? 'bg-rose-300' : 'bg-yellow-300'}`}>{game.banner.text}</div>
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
  const players = makePlayers({ ...richSave(1, true, 0), score: 4200, stats: { cleared: 320, moves: 80, maxChain: 5, bestMove: 980, specials: 4, questions: 8, correct: 6, items: 5 } })
  return (
    <div className="mx-auto max-w-3xl p-4 font-bitbit">
      <QuizpangResultSummary players={players} playerId="p0" />
    </div>
  )
}

export default function QuizpangPreviewPage() {
  // 주소의 ?view= 는 브라우저에서만 읽을 수 있으므로 마운트 뒤에 읽는다 (서버 HTML 과 달라지는 hydration 오류 방지)
  const [params, setParams] = useState<URLSearchParams | null>(null)
  useEffect(() => { setParams(new URLSearchParams(window.location.search)) }, [])
  if (!params) return <main className="min-h-dvh bg-[#fde2f3]" />
  const view = params.get('view') ?? 'play'
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#fde2f3_0,#dbeafe_45%,#fef3c7_100%)] text-slate-900">
      {view === 'play' && <PlayPreview params={params} />}
      {view === 'summary' && <SummaryPreview />}
    </main>
  )
}
