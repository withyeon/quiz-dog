'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import SurvivorArena from '@/components/survivor/SurvivorArena'
import SurvivorHudBar from '@/components/survivor/SurvivorHudBar'
import SkillCardPicker from '@/components/survivor/SkillCardPicker'
import { useGameBase } from '@/hooks/useGameBase'
import { useSurvivorGame, type SurvivorNotice } from '@/hooks/useSurvivorGame'
import { SURVIVOR } from '@/lib/game/survivor'
import { getWrongScreenMs } from '@/lib/quiz/multiSelect'

const WRONG_ANSWER_DELAY_MS = 2200

/**
 * 멍멍 서바이벌 학생 화면.
 * 화면 흐름: lobby → (시작 전 퀴즈) → battle(전투 캔버스) → 레벨업·쓰러짐이면 quiz(전투 위 문제 창)
 * → 레벨업 정답이면 pick(스킬 카드 3장) → battle. 규칙은 lib/game/survivor.ts, 흐름은 hooks/useSurvivorGame.ts.
 *
 * 훅(useGameBase)은 게임을 시작할 때 'quiz' 를 넘긴다. 처음 받은 'quiz' 는 시작 신호로 보고 'battle' 로 바꾼다
 * (타워 디펜스와 같은 방식). 그 뒤의 'quiz' 는 이 페이지가 연 문제 창이다.
 */
export default function SurvivorPage() {
  const gameBase = useGameBase({
    expectedGameMode: 'survivor',
    timeLimit: SURVIVOR.QUESTION_TIME_LIMIT,
    wrongAnswerDelay: WRONG_ANSWER_DELAY_MS,
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

  const isPaused = room?.status === 'paused'
  const isRoomRunning = room?.status === 'playing' && isPreStartQuizComplete

  const game = useSurvivorGame({
    playerId,
    currentPlayer,
    currentView,
    setCurrentView,
    checkAnswer,
    goToNextQuestion,
    playSFX,
    commitPlayerPatch,
    wrongScreenMs: getWrongScreenMs(questionSetTitle, WRONG_ANSWER_DELAY_MS),
    isRoomRunning,
  })
  const { hud, quizReason, cards, notice, banner } = game

  // 훅이 넘기는 첫 'quiz' = 게임 시작 신호 → 전투 화면으로
  const [runStarted, setRunStarted] = useState(false)
  useEffect(() => {
    if (currentView !== 'quiz' || showCountdown || runStarted) return
    setRunStarted(true)
    setCurrentView('battle')
  }, [currentView, runStarted, setCurrentView, showCountdown])
  useEffect(() => {
    if (room?.status !== 'playing' && room?.status !== 'paused') setRunStarted(false)
  }, [room?.status])

  const handleEvents = game.handleEvents
  const onArenaEvents = useCallback((events: Parameters<typeof handleEvents>[0]) => handleEvents(events), [handleEvents])

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

  const inGame = currentView === 'battle' || currentView === 'quiz' || currentView === 'pick'
  const showQuiz = currentView === 'quiz' && runStarted && !showCountdown

  return (
    <main className="relative h-dvh overflow-hidden bg-[#86d07a] font-bitbit text-slate-900">
      <GameTimeBadge startedAt={gameBase.sessionStartedAt} durationSeconds={room?.duration_seconds} status={room?.status} />

      {inGame && (
        <>
          <SurvivorArena stateRef={game.stateRef} running={currentView === 'battle' && isRoomRunning && !isPaused} onEvents={onArenaEvents} />
          <SurvivorHudBar hud={hud} nickname={currentPlayer?.nickname || '플레이어'} rank={rank.rank} total={rank.total} />
        </>
      )}

      {/* 대기 로비·시작 전 퀴즈 */}
      {!inGame && currentView !== 'result' && (
        <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-4 p-4">
          <Image src="/title/survivor.webp" alt="멍멍 서바이벌" width={320} height={320} className="h-auto w-56 object-contain sm:w-72" priority unoptimized onError={(event) => { event.currentTarget.style.display = 'none' }} />
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
              <h2 className="mb-3 text-3xl font-black text-slate-900 sm:text-4xl">몬스터가 몰려오기 전이에요</h2>
              <p className="text-base font-bold text-slate-600 break-keep sm:text-lg">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <p className="mt-4 text-sm font-bold text-slate-500 break-keep">방향키·WASD 또는 화면을 누르고 끌어서 움직여요. 공격은 저절로!</p>
            </motion.div>
          )}
        </div>
      )}

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      {/* 문제 창 (전투는 멈춰 있다) */}
      {showQuiz && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-14 sm:items-center sm:p-6">
          <div className="w-full max-w-3xl">
            <div className={`mx-auto mb-3 w-fit rounded-full px-5 py-2 text-center text-base font-black text-white shadow-lg break-keep sm:text-lg ${quizReason === 'revive' ? 'bg-rose-600' : 'bg-sky-600'}`}>
              {quizReason === 'revive' ? '💫 쓰러졌어요! 문제를 맞히면 다시 일어나요' : `⬆️ 레벨 업! 맞히면 스킬 ${SURVIVOR.CHOICES}장 중 하나를 골라요`}
            </div>
            {currentQuestion ? (
              <QuizView
                key={`${currentQuestionIndex}-${currentQuestion.id}`}
                question={currentQuestion}
                onAnswer={game.handleAnswerSubmit}
                onCorrectClick={game.skipCorrectBanner}
                timeLimit={SURVIVOR.QUESTION_TIME_LIMIT}
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

      {/* 스킬 카드 */}
      {currentView === 'pick' && cards && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 pt-14 sm:items-center sm:p-6">
          <SkillCardPicker cards={cards} onPick={game.pickCard} />
        </div>
      )}

      {currentView === 'result' && (
        <div className="absolute inset-0 z-40 overflow-auto bg-slate-950/[0.82]">
          <GameResult players={players} currentPlayerId={playerId} gameMode="survivor" />
        </div>
      )}

      <BannerToast banner={banner} />
      <NoticeToast notice={notice} />

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
            <div className="mt-2 text-base font-bold text-slate-500">몬스터도 같이 멈춰 있어요</div>
          </div>
        </div>
      )}
    </main>
  )
}

function BannerToast({ banner }: { banner: { id: number; text: string } | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[28%] z-[35] flex justify-center px-4">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            className="rounded-2xl border-4 border-slate-900 bg-yellow-300 px-5 py-3 text-center text-lg font-black text-slate-900 shadow-[0_6px_0_#0f172a] break-keep sm:text-2xl"
          >
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NoticeToast({ notice }: { notice: SurvivorNotice | null }) {
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
