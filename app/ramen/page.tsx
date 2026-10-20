'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2, Soup } from 'lucide-react'
import QuizSetName from '@/components/game/QuizSetName'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import AnswerReveal from '@/components/AnswerReveal'
import Leaderboard from '@/components/Leaderboard'
import PixelIcon from '@/components/ui/PixelIcon'
import KitchenScene from '@/components/ramen/KitchenScene'
import CustomerRow from '@/components/ramen/CustomerRow'
import RamenPot from '@/components/ramen/RamenPot'
import IngredientBar from '@/components/ramen/IngredientBar'
import RoundResultCard from '@/components/ramen/RoundResultCard'
import { useGameBase } from '@/hooks/useGameBase'
import { useRamenGame } from '@/hooks/useRamenGame'
import { RAMEN } from '@/lib/game/ramen'

/**
 * 퀴즈독의 라면가게 학생 화면.
 * 화면 흐름: lobby → (시작 전 퀴즈) → quiz(문제) → 정답이면 손님 등장 → cook(주방: 손님·냄비·재료 선반)
 * → 판 결과 카드 → 다음 문제. 규칙은 lib/game/ramen.ts, 상태는 hooks/useRamenGame.ts.
 */
export default function RamenPage() {
  const gameBase = useGameBase({
    expectedGameMode: 'ramen',
    timeLimit: RAMEN.QUESTION_TIME_LIMIT,
    wrongAnswerDelay: RAMEN.WRONG_ANSWER_DELAY_MS,
  })
  const {
    roomCode, playerId, currentView, setCurrentView, revealedAnswer, revealedExplanation,
    showCountdown, players, room, roomLoading, playersLoading,
    currentPlayer, currentQuestion, questionsLoading, questionsError, questionSetTitle,
    preStartQuizQuestion, preStartSubmittedCount, preStartQuizTotal,
    shouldShowPreStartQuiz, isPreStartQuizComplete,
    playSFX, handlePreStartQuizAnswer,
    checkAnswer, handleWrongAnswer, handleCountdownComplete,
    goToNextQuestion, commitPlayerPatch,
  } = gameBase

  const isPaused = room?.status === 'paused'

  const game = useRamenGame({
    playerId,
    currentPlayer,
    checkAnswer,
    handleWrongAnswer,
    goToNextQuestion,
    playSFX,
    setCurrentView,
    commitPlayerPatch,
    isPaused,
  })
  const {
    stats, money, pendingCustomers, round, phase, selectedPot, outcome,
    handleAnswerSubmit, startCooking, selectPot, addToSelected, servePot, closeOutcome,
  } = game

  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && !showCountdown && isPreStartQuizComplete) {
      setCurrentView('quiz')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView, showCountdown])

  // 정답 뒤 1.6초가 지나면 저절로 주방으로 (폰에서 '정답입니다 →' 배너가 아래로 밀려도 진행되게)
  useEffect(() => {
    if (currentView !== 'quiz' || !pendingCustomers || phase !== 'idle') return
    const timer = window.setTimeout(() => startCooking(), 1600)
    return () => window.clearTimeout(timer)
  }, [currentView, pendingCustomers, phase, startCooking])

  if (!roomCode || !playerId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <p className="rounded-lg bg-white p-6 text-gray-800 shadow-lg">방 코드와 플레이어 ID가 필요합니다.</p>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <p className="text-2xl font-bold text-gray-800">로딩 중</p>
      </div>
    )
  }

  const goalProgress = Math.min(100, ((money % RAMEN.GOAL_MONEY) / RAMEN.GOAL_MONEY) * 100)
  const goalsDone = Math.floor(money / RAMEN.GOAL_MONEY)
  const selected = round?.pots[selectedPot] ?? null

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#3f1d0b] font-bitbit text-slate-900">
      <GameTimeBadge
        startedAt={gameBase.sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.25),transparent_55%),linear-gradient(180deg,#5b2b12_0%,#3f1d0b_60%,#2a1208_100%)]" />

      <div className="relative z-10 p-3 sm:p-4">
        {/* ── 상단 헤더 ── */}
        <div className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-lg sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/title/ramen.webp"
                  alt="퀴즈독의 라면가게"
                  width={360}
                  height={96}
                  className="h-10 w-auto max-w-full object-contain sm:h-14"
                  priority
                />
                <QuizSetName title={questionSetTitle} />
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                <div className="min-w-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 sm:min-w-[120px] sm:px-3 sm:py-2">
                  <div className="mb-0.5 truncate text-[10px] font-bold text-violet-600">{currentPlayer?.nickname || '플레이어'} · 매출</div>
                  <div className="truncate text-base font-extrabold text-violet-900 sm:text-xl">{money.toLocaleString()}원</div>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">받은 손님</div>
                  <div className="text-base font-extrabold text-slate-900 sm:text-xl">{stats.customers}명</div>
                </div>
                <div className="min-w-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-emerald-700">1,000원 라면</div>
                  <div className="text-base font-extrabold text-emerald-800 sm:text-xl">{stats.perfect}개</div>
                </div>
              </div>
            </div>

            {/* 목표 10,000원 진행 */}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-600 sm:text-xs">
                🎯 목표 {RAMEN.GOAL_MONEY.toLocaleString()}원{goalsDone > 0 && ` · ${goalsDone}번 달성!`}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-500" style={{ width: `${goalProgress}%` }} />
              </div>
              <span className="text-[11px] font-black text-slate-500 sm:text-xs">{(money % RAMEN.GOAL_MONEY).toLocaleString()} / {RAMEN.GOAL_MONEY.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl">
          {shouldShowPreStartQuiz && (
            <PreStartQuizGate
              question={preStartQuizQuestion}
              submittedCount={preStartSubmittedCount}
              total={preStartQuizTotal}
              onAnswer={handlePreStartQuizAnswer}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
              variant="fishing"
            />
          )}

          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {/* 대기 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border-4 border-orange-200 bg-white/90 p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mb-3 text-4xl font-black text-slate-900">라면가게 문 여는 중</h2>
              <p className="text-lg text-slate-600">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 뷰 */}
          {currentView === 'quiz' && !showCountdown && (
            currentQuestion ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  <QuizView
                    question={currentQuestion}
                    onAnswer={handleAnswerSubmit}
                    timeLimit={RAMEN.QUESTION_TIME_LIMIT}
                    onCorrectClick={startCooking}
                    paused={isPaused}
                    variant="glass"
                    className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-6 sm:p-8"
                  />

                  <AnimatePresence>
                    {pendingCustomers && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.7, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="mx-auto max-w-3xl rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center"
                      >
                        <span className="text-xl font-extrabold text-violet-700">🔔 손님 {pendingCustomers.length}명이 왔어요!</span>
                        <span className="ml-2 text-sm font-bold text-violet-600">냄비 {pendingCustomers.length}개를 동시에 끓여요</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 레시피 */}
                  <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg">
                    <h3 className="mb-2 flex items-center gap-2 text-base font-extrabold text-slate-800">
                      <Soup size={16} className="text-orange-500" /> 1,000원 라면 레시피
                    </h3>
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[11px] font-bold text-slate-700 sm:text-xs">
                      <div className="rounded-md bg-amber-50 px-1 py-2">🍜🧂<br />면·스프 먼저</div>
                      <div className="rounded-md bg-sky-50 px-1 py-2">💧<br />물 (타이머 시작)</div>
                      <div className="rounded-md bg-orange-100 px-1 py-2">🥬🥚<br />끓을 때 파·계란</div>
                      <div className="rounded-md bg-violet-100 px-1 py-2">🍽️<br />바로 쟁반에!</div>
                    </div>
                  </div>
                </div>

                <aside className="space-y-4">
                  <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="ramen" title="🍜 매출 순위" />
                  <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 shadow-lg">
                    <div className="mb-2 text-sm font-extrabold text-slate-800">라면 값</div>
                    <div className="space-y-1 text-xs font-bold">
                      <div className="flex justify-between"><span>✨ 끓을 때 파·계란 + 잘 익음</span><span className="text-emerald-700">1,000원</span></div>
                      <div className="flex justify-between"><span>고명 하나를 일찍 넣음</span><span>800원</span></div>
                      <div className="flex justify-between"><span>둘 다 일찍 / 고명 하나</span><span>600원</span></div>
                      <div className="flex justify-between"><span>기본 라면(고명 없음)</span><span>400원</span></div>
                      <div className="flex justify-between"><span>덜 익음·많이 익음</span><span className="text-amber-700">200~500원</span></div>
                      <div className="flex justify-between"><span>💀 탔다 / 재료 빠짐</span><span className="text-red-600">0원</span></div>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white/90 p-10 text-center shadow-xl">
                <h2 className="text-3xl font-black text-slate-900">문제를 불러오는 중</h2>
                <p className="mt-3 text-base font-bold text-slate-500">잠시 후 퀴즈가 자동으로 표시됩니다.</p>
              </div>
            )
          )}

          {/* 주방 뷰 */}
          {currentView === 'cook' && round && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <KitchenScene>
                <CustomerRow
                  customers={round.customers}
                  pots={round.pots}
                  patienceTotalMs={round.patienceTotalMs}
                  patienceLeftMs={round.patienceLeftMs}
                />

                <div className={`mt-6 grid gap-3 sm:gap-4 ${round.pots.length === 1 ? 'mx-auto max-w-[220px] grid-cols-1' : round.pots.length === 2 ? 'mx-auto max-w-md grid-cols-2' : 'grid-cols-3'}`}>
                  {round.pots.map((pot) => (
                    <RamenPot
                      key={pot.index}
                      pot={pot}
                      selected={selectedPot === pot.index && !pot.result}
                      onSelect={() => selectPot(pot.index)}
                      onServe={() => servePot(pot.index)}
                      disabled={isPaused || phase !== 'cooking'}
                      compact={round.pots.length === 3}
                    />
                  ))}
                </div>

                <div className="mt-4">
                  <IngredientBar pot={selected && !selected.result ? selected : null} onAdd={addToSelected} disabled={isPaused || phase !== 'cooking'} />
                </div>
              </KitchenScene>

              <aside className="flex flex-col gap-4">
                <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-xs font-bold text-slate-700 shadow-lg">
                  <div className="mb-1.5 text-sm font-extrabold text-slate-800">💡 사장님 메모</div>
                  <ul className="space-y-1 break-keep">
                    <li>· 면·스프를 먼저 넣고 물을 부으면 여유가 생겨요</li>
                    <li>· 「끓는다!」가 깜빡이면 파·계란 → 바로 쟁반</li>
                    <li>· 냄비를 눌러 고르고, 선반에서 재료를 넣어요</li>
                    <li>· 끓고 몇 초 지나면 타요. 탄 냄비는 0원!</li>
                  </ul>
                </div>
                <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="ramen" title="🍜 매출 순위" />
              </aside>
            </div>
          )}

          {/* 오답 뷰 */}
          {currentView === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-red-200 bg-white/90 p-10 text-center shadow-xl"
            >
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.5 }} className="mx-auto mb-4 flex justify-center">
                <PixelIcon name="wrong" size={96} />
              </motion.div>
              <h2 className="mb-2 text-4xl font-extrabold text-red-600">틀렸습니다</h2>
              <AnswerReveal answer={revealedAnswer} explanation={revealedExplanation} />
              <p className="text-xl text-slate-600">이번엔 손님이 안 왔어요. 다음 문제로!</p>
            </motion.div>
          )}

          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} gameMode="ramen" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {outcome && phase === 'done' && <RoundResultCard outcome={outcome} onClose={closeOutcome} />}
      </AnimatePresence>

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
            <div className="mt-2 text-base font-bold text-slate-500">냄비도 같이 멈춰 있어요</div>
          </div>
        </div>
      )}
    </main>
  )
}
