'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useIsWideLayout } from '@/components/quizpang/useIsWideLayout'
import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import QuizpangBoard from '@/components/quizpang/QuizpangBoard'
import QuizpangHud from '@/components/quizpang/QuizpangHud'
import ItemCardPicker from '@/components/quizpang/ItemCardPicker'
import { useGameBase } from '@/hooks/useGameBase'
import { useQuizpangGame, type QuizpangBanner, type QuizpangNotice } from '@/hooks/useQuizpangGame'
import { QUIZPANG, getBoardSeed } from '@/lib/game/quizpang'
import { getWrongScreenMs } from '@/lib/quiz/multiSelect'

/**
 * 퀴즈팡팡 학생 화면.
 * 화면 흐름: lobby → (시작 전 퀴즈) → puzzle(보드) → 30초마다 quiz(보드 위 문제 창)
 * → 정답이면 pick(아이템 카드 3장) → puzzle. 오답이면 정답 2초 → 추가 문제 → puzzle.
 * 규칙은 lib/game/quizpang.ts, 흐름은 hooks/useQuizpangGame.ts, 보드는 components/quizpang/QuizpangBoard.tsx.
 *
 * 훅(useGameBase)은 게임을 시작할 때 'quiz' 를 넘긴다. 처음 받은 'quiz' 는 시작 신호로 보고 'puzzle' 로 바꾼다
 * (서바이벌·타워 디펜스와 같은 방식). 그 뒤의 'quiz' 는 이 페이지가 연 문제 창이다.
 */
export default function QuizpangPage() {
  const gameBase = useGameBase({
    expectedGameMode: 'quizpang',
    timeLimit: QUIZPANG.QUESTION_TIME_LIMIT,
    wrongAnswerDelay: QUIZPANG.WRONG_REVEAL_MS,
    fallbackDurationSeconds: QUIZPANG.DEFAULT_DURATION_SECONDS,
  })
  const {
    roomCode, playerId, currentView, setCurrentView,
    showCountdown, players, room, roomLoading, playersLoading,
    currentPlayer, currentQuestion, currentQuestionIndex, questionsLoading, questionsError, questionSetTitle,
    preStartQuizQuestion, preStartSubmittedCount, preStartQuizTotal,
    shouldShowPreStartQuiz, isPreStartQuizComplete,
    playSFX, handlePreStartQuizAnswer, handleCountdownComplete,
    checkAnswer, goToNextQuestion, commitPlayerPatch,
  } = gameBase

  const isWide = useIsWideLayout()
  const isPaused = room?.status === 'paused'
  const isRoomRunning = room?.status === 'playing' && isPreStartQuizComplete

  // 보드 시드: 방이 시작된 뒤에만 정해진다 (같은 판 = 같은 보드)
  const boardSeed = useMemo(() => {
    if (!roomCode || !room || (room.status !== 'playing' && room.status !== 'paused')) return null
    return getBoardSeed(roomCode, room.started_at, room.settings)
  }, [room, roomCode])

  const game = useQuizpangGame({
    playerId,
    currentPlayer,
    currentView,
    setCurrentView,
    checkAnswer,
    goToNextQuestion,
    playSFX,
    commitPlayerPatch,
    wrongScreenMs: getWrongScreenMs(questionSetTitle, QUIZPANG.WRONG_REVEAL_MS),
    isRoomRunning,
    boardSeed,
  })
  const { hud, quizReason, cards, notice, banner, targeting } = game

  // 훅이 넘기는 첫 'quiz' = 게임 시작 신호 → 퍼즐 화면으로
  const [runStarted, setRunStarted] = useState(false)
  useEffect(() => {
    if (currentView !== 'quiz' || showCountdown || runStarted) return
    setRunStarted(true)
    setCurrentView('puzzle')
  }, [currentView, runStarted, setCurrentView, showCountdown])
  useEffect(() => {
    if (room?.status !== 'playing' && room?.status !== 'paused') setRunStarted(false)
  }, [room?.status])

  const rank = useMemo(() => {
    const active = players.filter((player) => !player.is_kicked)
    const sorted = [...active].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const index = sorted.findIndex((player) => player.id === playerId)
    return { rank: index >= 0 ? index + 1 : null, total: active.length }
  }, [playerId, players])

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

  const inGame = currentView === 'puzzle' || currentView === 'quiz' || currentView === 'pick'
  const showQuiz = currentView === 'quiz' && runStarted && !showCountdown
  const boardRunning = currentView === 'puzzle' && isRoomRunning && !isPaused && game.ready
  const nickname = currentPlayer?.nickname || '플레이어'
  const hudProps = hud ? {
    hud, nickname, rank: rank.rank, total: rank.total, targeting,
    onUseItem: game.useItem, onCancelTargeting: game.cancelTargeting, onSetLineDir: game.setLineDir,
  } : null

  return (
    <main className="relative h-dvh overflow-hidden bg-[#fdf2f8] bg-[url('/quizpang/bg-pattern.webp'),radial-gradient(circle_at_20%_10%,#fde2f3_0,#dbeafe_45%,#fef3c7_100%)] bg-[length:360px_360px,auto] font-bitbit text-slate-900">
      <GameTimeBadge startedAt={gameBase.sessionStartedAt} durationSeconds={room?.duration_seconds} status={room?.status} />

      {inGame && (
        <div className="mx-auto flex h-full max-w-6xl flex-col gap-2 p-2 pt-11 sm:gap-3 sm:p-4 sm:pt-12 lg:flex-row lg:items-stretch">
          {/* 폰·태블릿 세로: 위 숫자판 */}
          {hudProps && <div className="lg:hidden"><QuizpangHud {...hudProps} layout="stack" part="stats" /></div>}

          {/* 보드 */}
          <div className="relative min-h-0 min-w-0 flex-1">
            <QuizpangBoard
              ref={game.boardRef}
              align={isWide ? 'center' : 'top'}
              stateRef={game.stateRef}
              running={boardRunning}
              targeting={targeting}
              onEvents={game.handleBoardEvents}
              onBusy={game.handleBusyChange}
              onTarget={game.handleBoardTarget}
            />
            {!game.ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl bg-white/90 px-6 py-4 text-xl font-black">보드를 준비하는 중</div>
              </div>
            )}
          </div>

          {/* 폰·태블릿 세로: 아래 보관함 */}
          {hudProps && <div className="lg:hidden"><QuizpangHud {...hudProps} layout="stack" part="items" /></div>}

          {/* 넓은 화면: 옆 칸 */}
          {hudProps && (
            <div className="hidden w-72 shrink-0 lg:block xl:w-80">
              <QuizpangHud {...hudProps} layout="side" />
              <p className="mt-3 px-1 text-xs font-bold text-slate-600 break-keep">
                강아지를 끌어서 이웃과 바꿔요. 같은 강아지 3마리가 모이면 팡! 4마리는 줄 폭탄, 5마리·ㄱ자는 대폭탄 강아지가 돼요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 대기 로비·시작 전 퀴즈 */}
      {!inGame && currentView !== 'result' && (
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-4">
          <Image src="/title/quizpang.webp" alt="퀴즈팡팡" width={320} height={320} className="h-auto w-56 object-contain sm:w-72" priority unoptimized onError={(event) => { event.currentTarget.style.display = 'none' }} />
          {shouldShowPreStartQuiz ? (
            <PreStartQuizGate
              question={preStartQuizQuestion}
              submittedCount={preStartSubmittedCount}
              total={preStartQuizTotal}
              onAnswer={handlePreStartQuizAnswer}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
              variant="fishing"
            />
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full rounded-2xl border-4 border-slate-900 bg-white/95 p-8 text-center shadow-[0_8px_0_#0f172a]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mb-3 text-3xl font-black text-slate-900 sm:text-4xl">강아지들이 줄을 서는 중이에요</h2>
              <p className="text-base font-bold text-slate-600 break-keep sm:text-lg">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <p className="mt-4 text-sm font-bold text-slate-500 break-keep">같은 강아지 3마리를 가로·세로로 모으면 팡! {QUIZPANG.QUESTION_INTERVAL_MS / 1000}초마다 문제가 나오고, 맞히면 아이템을 받아요.</p>
            </motion.div>
          )}
        </div>
      )}

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      {/* 문제 창 (퍼즐은 멈춰 있다) */}
      {showQuiz && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-14 sm:items-center sm:p-6">
          <div className="w-full max-w-3xl">
            <div className={`mx-auto mb-3 w-fit rounded-full px-5 py-2 text-center text-base font-black text-white shadow-lg break-keep sm:text-lg ${quizReason === 'bonus' ? 'bg-rose-600' : 'bg-sky-600'}`}>
              {quizReason === 'bonus' ? '한 문제 더! 맞든 틀리든 퍼즐로 돌아가요' : `📝 문제 시간! 맞히면 아이템 ${QUIZPANG.CHOICES}장 중 하나를 골라요`}
            </div>
            {currentQuestion ? (
              <QuizView
                key={`${currentQuestionIndex}-${currentQuestion.id}`}
                question={currentQuestion}
                onAnswer={game.handleAnswerSubmit}
                onCorrectClick={game.skipCorrectBanner}
                timeLimit={QUIZPANG.QUESTION_TIME_LIMIT}
                paused={isPaused}
                variant="glass"
                className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-5 sm:p-8"
              />
            ) : (
              <div className="rounded-xl bg-white/95 p-8 text-center text-xl font-black">문제를 불러오는 중</div>
            )}
          </div>
        </div>
      )}

      {/* 아이템 카드 */}
      {currentView === 'pick' && cards && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-14 sm:items-center sm:p-6">
          <ItemCardPicker cards={cards} onPick={game.pickCard} />
        </div>
      )}

      {currentView === 'result' && (
        <div className="absolute inset-0 z-40 overflow-auto bg-slate-950/[0.82]">
          <GameResult players={players} currentPlayerId={playerId} gameMode="quizpang" />
        </div>
      )}

      <BannerToast banner={banner} />
      <NoticeToast notice={notice} />

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
            <div className="mt-2 text-base font-bold text-slate-500">강아지들도 같이 멈춰 있어요</div>
          </div>
        </div>
      )}
    </main>
  )
}

function BannerToast({ banner }: { banner: QuizpangBanner | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[35] flex justify-center px-4">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, scale: 0.5, rotate: -6 }}
            animate={{ opacity: 1, scale: banner.big ? 1.15 : 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.2, y: -20 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className={banner.burst
              ? 'relative flex h-44 w-44 items-center justify-center sm:h-60 sm:w-60'
              : `rounded-2xl border-4 border-slate-900 px-5 py-3 text-center text-xl font-black text-slate-900 shadow-[0_6px_0_#0f172a] break-keep sm:text-3xl ${banner.big ? 'bg-rose-300' : 'bg-yellow-300'}`}
          >
            {banner.burst ? (
              <>
                {/* 콤보: 폭발 그림(public/quizpang/fx-burst.webp) 위에 글자 */}
                <span className="absolute inset-0 bg-[url('/quizpang/fx-burst.webp')] bg-contain bg-center bg-no-repeat" />
                <span className="relative max-w-[70%] text-center text-xl font-black leading-tight text-rose-600 break-keep [paint-order:stroke] [-webkit-text-stroke:5px_#fff] sm:text-3xl">
                  {banner.text}
                </span>
              </>
            ) : banner.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NoticeToast({ notice }: { notice: QuizpangNotice | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className={`rounded-full px-5 py-2.5 text-center text-sm font-black shadow-xl break-keep sm:text-base ${
              notice.tone === 'good' ? 'bg-lime-500 text-white' : notice.tone === 'bad' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {notice.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
