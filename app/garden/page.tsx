'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Gamepad2 } from 'lucide-react'
import QuizSetName from '@/components/game/QuizSetName'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import AnswerReveal from '@/components/AnswerReveal'
import Leaderboard from '@/components/Leaderboard'
import PixelIcon from '@/components/ui/PixelIcon'
import IsoGarden from '@/components/garden/IsoGarden'
import GardenScreen from '@/components/garden/GardenScreen'
import RewardCards from '@/components/garden/RewardCards'
import { useGameBase } from '@/hooks/useGameBase'
import { useGardenGame, type GardenNotice } from '@/hooks/useGardenGame'
import { GARDEN, isRipe, unlockedCount } from '@/lib/game/garden'
import { withJosa } from '@/lib/utils/korean'

/**
 * 블록 텃밭 키우기 학생 화면.
 * 화면 흐름: lobby → (시작 전 퀴즈) → quiz(문제 + 옆에 내 밭 미리보기) → 정답이면 reward(무료 카드 3장)
 * → garden(밭 화면, GARDEN.VISIT_MS) → 다음 문제. 규칙은 lib/game/garden.ts, 상태는 hooks/useGardenGame.ts.
 */
export default function GardenPage() {
  const gameBase = useGameBase({
    expectedGameMode: 'garden',
    timeLimit: GARDEN.QUESTION_TIME_LIMIT,
    wrongAnswerDelay: GARDEN.WRONG_ANSWER_DELAY_MS,
  })
  const {
    roomCode, playerId, currentView, setCurrentView, revealedAnswer, revealedExplanation,
    showCountdown, players, room, roomLoading, playersLoading,
    currentPlayer, currentQuestion, questionsLoading, questionsError, questionSetTitle,
    preStartQuizQuestion, preStartSubmittedCount, preStartQuizTotal,
    shouldShowPreStartQuiz, isPreStartQuizComplete,
    playSFX, handlePreStartQuizAnswer,
    checkAnswer, handleWrongAnswer, handleCountdownComplete,
    goToNextQuestion, commitPlayerPatch, sendRoomEvent,
  } = gameBase

  const isPaused = room?.status === 'paused'

  const game = useGardenGame({
    playerId,
    currentPlayer,
    players,
    currentView,
    setCurrentView,
    checkAnswer,
    handleWrongAnswer,
    goToNextQuestion,
    playSFX,
    commitPlayerPatch,
    sendRoomEvent,
    isRunning: room?.status === 'playing' && isPreStartQuizComplete,
  })
  const { garden, rewardCards, incomingCrows, notice, handleAnswerSubmit, openReward } = game

  useEffect(() => {
    if (room?.status === 'playing' && currentView === 'lobby' && !showCountdown && isPreStartQuizComplete) {
      setCurrentView('quiz')
    }
  }, [currentView, isPreStartQuizComplete, room?.status, setCurrentView, showCountdown])

  // 정답 뒤 1.4초가 지나면 저절로 카드 고르기로 (폰에서 '정답입니다 →' 배너가 아래로 밀려도 진행되게)
  useEffect(() => {
    if (currentView !== 'quiz' || !rewardCards) return
    const timer = window.setTimeout(() => openReward(), 1400)
    return () => window.clearTimeout(timer)
  }, [currentView, openReward, rewardCards])

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

  const ripeCount = garden.plots.filter((plot) => isRipe(plot, garden.clockMs)).length

  return (
    <main className="relative min-h-dvh overflow-hidden bg-sky-300 font-bitbit text-slate-900">
      <GameTimeBadge
        startedAt={gameBase.sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(180deg,#7dd3fc_0%,#bae6fd_45%,#bbf7d0_75%,#86efac_100%)]" />

      <div className="relative z-10 p-3 sm:p-4">
        {/* ── 상단 헤더 ── */}
        <div className="mx-auto mb-4 max-w-7xl">
          <div className="rounded-xl border border-white/80 bg-white/90 px-3 py-2 shadow-lg sm:px-4 sm:py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/title/garden.webp"
                  alt="블록 텃밭 키우기"
                  width={96}
                  height={96}
                  className="h-12 w-auto max-w-full object-contain sm:h-16"
                  priority
                />
                <QuizSetName title={questionSetTitle} />
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                <div className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 sm:min-w-[110px] sm:px-3 sm:py-2">
                  <div className="mb-0.5 truncate text-[10px] font-bold text-amber-700">지갑</div>
                  <div className="flex items-center gap-1 truncate text-base font-extrabold text-amber-900 sm:text-xl">
                    <Image unoptimized width={256} height={256} src="/garden/icon-coin.webp" alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
                    {garden.coins.toLocaleString()}
                  </div>
                </div>
                <div className="min-w-0 rounded-lg border border-lime-200 bg-lime-50 px-2 py-1.5 sm:min-w-[120px] sm:px-3 sm:py-2">
                  <div className="mb-0.5 truncate text-[10px] font-bold text-lime-700">{currentPlayer?.nickname || '플레이어'} · 번 돈</div>
                  <div className="truncate text-base font-extrabold text-lime-900 sm:text-xl">{garden.earned.toLocaleString()}</div>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 sm:px-3 sm:py-2">
                  <div className="mb-0.5 text-[10px] font-bold text-slate-500">내 밭</div>
                  <div className="text-base font-extrabold text-slate-900 sm:text-xl">{unlockedCount(garden)}칸</div>
                </div>
              </div>
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
              className="rounded-xl border-4 border-lime-200 bg-white/90 p-10 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                <Gamepad2 size={34} />
              </div>
              <h2 className="mb-3 text-4xl font-black text-slate-900">텃밭 준비 중</h2>
              <p className="text-lg text-slate-600">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 뷰: 문제 + 옆에 내 밭(보기만) */}
          {currentView === 'quiz' && !showCountdown && (
            currentQuestion ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-4">
                  <QuizView
                    question={currentQuestion}
                    onAnswer={handleAnswerSubmit}
                    timeLimit={GARDEN.QUESTION_TIME_LIMIT}
                    onCorrectClick={openReward}
                    paused={isPaused}
                    variant="glass"
                    className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-6 sm:p-8"
                  />
                  {incomingCrows.length > 0 && (
                    <div className="mx-auto max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-black text-red-700 sm:text-base">
                      🐦 {withJosa(incomingCrows[0].fromName, '이/가')} 까마귀를 보냈어요! 문제를 맞히고 밭에 가서 쫓아요
                    </div>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="rounded-xl border border-white/80 bg-gradient-to-b from-sky-200 to-lime-100 p-3 shadow-lg">
                    <div className="mb-1 flex items-center justify-between text-sm font-black text-slate-800">
                      <span>🌱 내 밭 (자라는 중)</span>
                      {ripeCount > 0 && <span className="rounded-full bg-yellow-300 px-2 py-0.5 text-xs text-yellow-900">수확 {ripeCount}개 기다려요</span>}
                    </div>
                    <IsoGarden garden={garden} raining={game.raining} interactive={false} />
                  </div>
                  <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="garden" title="🌱 번 돈 순위" />
                </aside>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white/90 p-10 text-center shadow-xl">
                <h2 className="text-3xl font-black text-slate-900">문제를 불러오는 중</h2>
                <p className="mt-3 text-base font-bold text-slate-500">잠시 후 퀴즈가 자동으로 표시됩니다.</p>
              </div>
            )
          )}

          {/* 정답 보상 카드 */}
          {currentView === 'reward' && rewardCards && (
            <RewardCards
              cards={rewardCards}
              choosingCrowTarget={game.choosingCrowTarget}
              targets={game.otherPlayers}
              onPick={game.pickCard}
              onSendCrow={game.sendCrow}
              onCancelCrow={game.cancelCrowTarget}
            />
          )}

          {/* 밭 */}
          {currentView === 'garden' && (
            <GardenScreen game={game} players={players} playerId={playerId} disabled={isPaused} />
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
              <p className="text-xl text-slate-600">밭은 계속 자라고 있어요. 다음 문제로!</p>
            </motion.div>
          )}

          {currentView === 'result' && (
            <GameResult players={players} currentPlayerId={playerId} gameMode="garden" />
          )}
        </div>
      </div>

      <NoticeToast notice={notice} />

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
            <div className="mt-2 text-base font-bold text-slate-500">밭도 같이 멈춰 있어요</div>
          </div>
        </div>
      )}
    </main>
  )
}

function NoticeToast({ notice }: { notice: GardenNotice | null }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
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
