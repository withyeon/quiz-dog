'use client'

import Image from 'next/image'
import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Gamepad2 } from 'lucide-react'
import QuizSetName from '@/components/game/QuizSetName'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import AnswerReveal from '@/components/AnswerReveal'
import Leaderboard from '@/components/Leaderboard'
import PixelIcon from '@/components/ui/PixelIcon'
import Griddle from '@/components/bungeoppang/Griddle'
import BakeGauge from '@/components/bungeoppang/BakeGauge'
import BakeResultCard from '@/components/bungeoppang/BakeResultCard'
import NoticeModal from '@/components/bungeoppang/NoticeModal'
import StallScene from '@/components/bungeoppang/StallScene'
import BungeoDog, { type DogMood } from '@/components/bungeoppang/BungeoDog'
import { gradeToSprite, type BungeoSpriteState } from '@/components/bungeoppang/BungeoSprite'
import { useGameBase } from '@/hooks/useGameBase'
import { useBungeoppangGame } from '@/hooks/useBungeoppangGame'
import { BUNGEO, gradeAt } from '@/lib/game/bungeoppang'

/**
 * 붕어빵 굽굽! 학생 화면.
 * 화면 흐름: lobby → (시작 전 퀴즈) → quiz(문제 + 작은 철판) → bake(포장마차 무대: 큰 철판·게이지·뒤집기 버튼)
 * → 결과 카드 → 다음 문제. 규칙은 lib/game/bungeoppang.ts, 상태는 hooks/useBungeoppangGame.ts.
 */
export default function BungeoppangPage() {
  const gameBase = useGameBase({
    expectedGameMode: 'bungeoppang',
    timeLimit: BUNGEO.QUESTION_TIME_LIMIT,
    wrongAnswerDelay: BUNGEO.WRONG_ANSWER_DELAY_MS,
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

  const game = useBungeoppangGame({
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
  })
  const {
    stats, score, pendingBake, phase, gauge, setup, outcome, notice,
    comboLabel, activeEffects,
    handleAnswerSubmit, startBaking, closeOutcome, closeNotice, handleMainButton,
  } = game

  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && !showCountdown && isPreStartQuizComplete) {
      setCurrentView('quiz')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView, showCountdown])

  // 정답 뒤 1.5초가 지나면 저절로 굽기 화면으로 (폰에서 '정답입니다 →' 배너가 화면 아래로 밀려도 진행되게).
  // 이벤트·아이템 알림이 떠 있으면 닫힌 뒤부터 센다.
  useEffect(() => {
    if (currentView !== 'quiz' || !pendingBake || notice || phase !== 'idle') return
    const timer = window.setTimeout(() => startBaking(), 1500)
    return () => window.clearTimeout(timer)
  }, [currentView, pendingBake, notice, phase, startBaking])

  /** 굽는 중인 붕어빵 모습 — 게이지 위치의 등급을 그대로 보여 준다 */
  const cookingSprite: BungeoSpriteState | null = useMemo(() => {
    if (phase === 'idle') return pendingBake ? 'dough' : null
    if (!setup) return 'dough'
    if (phase === 'done' && outcome) return outcome.filling.id === 'golden' ? 'golden' : gradeToSprite(outcome.grade.id)
    if (gauge < 2) return 'dough'
    return gradeToSprite(gradeAt(gauge, setup.zones).id)
  }, [gauge, outcome, pendingBake, phase, setup])

  const dogMood: DogMood = useMemo(() => {
    if (!outcome || phase !== 'done') return 'idle'
    if (outcome.filling.id === 'golden') return 'wow'
    if (outcome.grade.id === 'perfect') return 'happy'
    if (outcome.grade.id === 'burnt') return 'sweat'
    return 'idle'
  }, [outcome, phase])

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

  const flamesLevel = phase === 'baking' ? (setup?.fast ? 'high' : 'low') : 'low'

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#1e1b4b] font-bitbit text-slate-900">
      <GameTimeBadge
        startedAt={gameBase.sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.18),transparent_55%),linear-gradient(180deg,#0f172a_0%,#1e1b4b_60%,#312e81_100%)]" />

      <div className="relative z-10 p-3 sm:p-4">
        {/* ── 상단 헤더 ── */}
        <div className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-lg sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/title/bungeoppang.webp"
                  alt="붕어빵 굽굽!"
                  width={360}
                  height={96}
                  className="h-10 w-auto max-w-full object-contain sm:h-14"
                  priority
                />
                <QuizSetName title={questionSetTitle} />
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                <div className="min-w-0 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 sm:min-w-[110px] sm:px-3 sm:py-2">
                  <div className="mb-0.5 truncate text-[10px] font-bold text-slate-500">{currentPlayer?.nickname || '플레이어'}</div>
                  <div className="truncate text-base font-extrabold text-slate-900 sm:text-xl">{score.toLocaleString()}점</div>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">붕어빵</div>
                  <div className="text-base font-extrabold text-slate-900 sm:text-xl">{stats.baked}개</div>
                </div>
                <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-amber-700">이번 판</div>
                  <div className="text-base font-extrabold text-amber-800 sm:text-xl">{stats.tray} / {BUNGEO.TRAY_SIZE}</div>
                </div>
                <div className={`min-w-0 rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2 ${stats.perfectStreak >= 2 ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white/80'}`}>
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">완벽 콤보</div>
                  <div className={`truncate text-base font-extrabold sm:text-xl ${stats.perfectStreak >= 2 ? 'text-orange-600' : 'text-slate-400'}`}>
                    {stats.perfectStreak >= 2 ? `×${stats.perfectStreak}` : '-'}
                  </div>
                </div>
              </div>
            </div>

            {activeEffects.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {activeEffects.map((effect) => (
                  <div key={effect.id} className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">
                    <span>{effect.emoji}</span>
                    {effect.label}
                  </div>
                ))}
              </div>
            )}
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
              className="rounded-xl border-4 border-amber-200 bg-white/90 p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mb-3 text-4xl font-black text-slate-900">붕어빵 가게 여는 중</h2>
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
                    timeLimit={BUNGEO.QUESTION_TIME_LIMIT}
                    onCorrectClick={startBaking}
                    paused={isPaused}
                    variant="glass"
                    className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-6 sm:p-8"
                  />

                  <AnimatePresence>
                    {comboLabel && (
                      <motion.div
                        key={stats.perfectStreak}
                        initial={{ opacity: 0, scale: 0.7, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="mx-auto max-w-3xl rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-center"
                      >
                        <span className="text-xl font-extrabold text-orange-700">{comboLabel}</span>
                        <span className="ml-2 text-sm font-bold text-orange-600">
                          {BUNGEO.FIRE_MODE_STREAK - (stats.perfectStreak % BUNGEO.FIRE_MODE_STREAK) === BUNGEO.FIRE_MODE_STREAK
                            ? '불맛 모드 준비 완료!'
                            : `${BUNGEO.FIRE_MODE_STREAK - (stats.perfectStreak % BUNGEO.FIRE_MODE_STREAK)}번 더 완벽이면 불맛 모드`}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 내 철판 진행 */}
                  <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-800">
                        <Flame size={16} className="text-orange-500" /> 내 철판 {stats.tray} / {BUNGEO.TRAY_SIZE}
                      </h3>
                      <span className="text-xs font-bold text-slate-500">
                        {BUNGEO.TRAY_SIZE - stats.tray}개 더 구우면 +{BUNGEO.TRAY_BONUS}점
                      </span>
                    </div>
                    <Griddle filled={stats.tray} cooking={pendingBake ? 'dough' : null} size="sm" flames={pendingBake ? 'low' : 'off'} />
                  </div>
                </div>

                <aside className="space-y-4">
                  <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="bungeoppang" title="🐟 붕어빵 순위" />
                  <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-700 shadow-lg">
                    <div className="mb-2 text-sm font-extrabold text-slate-800">굽기 점수표</div>
                    <div className="grid grid-cols-5 gap-1 text-center text-[11px] font-bold">
                      <div className="rounded-md bg-amber-50 py-1">😵<br />70</div>
                      <div className="rounded-md bg-amber-100 py-1">😋<br />100</div>
                      <div className="rounded-md bg-orange-200 py-1">✨<br />160</div>
                      <div className="rounded-md bg-orange-300 py-1">🔥<br />120</div>
                      <div className="rounded-md bg-stone-300 py-1">💀<br />50</div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500 leading-relaxed break-keep">
                      완벽 {BUNGEO.FIRE_MODE_STREAK}연속이면 불맛 모드(다음 붕어빵 {BUNGEO.FIRE_MODE_MULTIPLIER}배). 황금 붕어빵은 점수 3배 잭팟!
                    </p>
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

          {/* 굽기 뷰 */}
          {currentView === 'bake' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <StallScene>
                <div className="mb-2 flex items-end justify-between">
                  <BungeoDog mood={dogMood} size={80} />
                  <div className="text-right text-amber-100">
                    <div className="text-xs font-bold opacity-80">이번 판</div>
                    <div className="text-2xl font-black">{stats.tray} / {BUNGEO.TRAY_SIZE}</div>
                  </div>
                </div>

                <Griddle filled={stats.tray} cooking={cookingSprite} size="lg" flames={flamesLevel} />

                <div className="mx-auto mt-5 max-w-md">
                  <BakeGauge zones={setup?.zones ?? []} value={gauge} running={phase === 'baking'} />
                  {setup && (setup.slow || setup.fast || setup.wide) && (
                    <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs font-black">
                      {setup.slow && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">🐢 게이지 느림</span>}
                      {setup.fast && <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">🔥 게이지 빠름</span>}
                      {setup.wide && <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-800">🧈 완벽 구간 넓음</span>}
                    </div>
                  )}
                </div>

                <div className="mx-auto mt-5 max-w-md">
                  <motion.button
                    type="button"
                    onClick={handleMainButton}
                    disabled={phase === 'done'}
                    whileTap={{ scale: 0.95 }}
                    className={`w-full rounded-2xl border-4 border-[#1f1a17] py-5 text-3xl font-black text-white shadow-[0_8px_0_#7c2d12] transition-colors sm:py-6 sm:text-4xl ${
                      phase === 'baking' ? 'bg-orange-500 hover:bg-orange-400 bungeo-pulse' : 'bg-amber-500 hover:bg-amber-400'
                    } disabled:opacity-60`}
                  >
                    {phase === 'baking' ? '🔄 뒤집기!' : phase === 'done' ? '구웠어요!' : '🔥 굽기 시작'}
                  </motion.button>
                  <p className="mt-2 text-center text-xs font-bold text-amber-100/80">스페이스바나 엔터로도 뒤집을 수 있어요</p>
                </div>
              </StallScene>

              <aside className="flex flex-col gap-4">
                {comboLabel && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-center shadow-lg"
                  >
                    <div className="mb-1 text-sm font-bold text-orange-600">완벽 콤보</div>
                    <div className="text-3xl font-black text-orange-700">{comboLabel}</div>
                  </motion.div>
                )}
                <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="bungeoppang" title="🐟 붕어빵 순위" />
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
              <p className="text-xl text-slate-600">이번엔 굽기 없이 다음 문제로! 완벽 콤보는 그대로예요</p>
            </motion.div>
          )}

          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} gameMode="bungeoppang" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {outcome && phase === 'done' && <BakeResultCard outcome={outcome} onClose={closeOutcome} />}
      </AnimatePresence>

      <AnimatePresence>
        {notice && <NoticeModal notice={notice} onClose={closeNotice} />}
      </AnimatePresence>

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </main>
  )
}
