'use client'

import QuizView from '@/components/QuizView'
import ConvenienceStore from '@/components/ConvenienceStore'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import ScreenFlash from '@/components/ScreenFlash'
import StoreHeader from '@/components/store/StoreHeader'
import StoreLobbyPanel from '@/components/store/StoreLobbyPanel'
import StoreWrongPanel from '@/components/store/StoreWrongPanel'
import SpeedBonusToast from '@/components/store/SpeedBonusToast'
import { QUIZ_TIME_LIMIT } from '@/lib/game/convenienceStore'
import { PRE_START_QUIZ_TOTAL, useConvenienceStoreGame } from '@/hooks/useConvenienceStoreGame'

/**
 * 전설의 편의점 학생 화면. 규칙·상태는 useConvenienceStoreGame 훅이 맡고,
 * 여기서는 currentView 에 따라 어떤 패널을 보여줄지만 정한다.
 */
export default function FactoryPage() {
  const {
    roomCode,
    playerId,
    roomLoading,
    players,
    playersLoading,
    currentPlayer,
    isPaused,
    currentView,
    showCountdown,
    showFlash,
    questionSetTitle,
    questionsLoading,
    questionsError,
    currentQuestion,
    preStartQuizQuestion,
    preStartSubmittedCount,
    products,
    money,
    isQuizMode,
    isCorrect,
    correctAnswersCount,
    showOrderModal,
    remainingSeconds,
    lastAnswerSpeed,
    speedBonusDisplay,
    wrongPenalty,
    revealedAnswer,
    handleCountdownComplete,
    handlePreStartQuizAnswer,
    handleAnswerSubmit,
    goToNextQuiz,
    handleQuizStart,
    applyMoneyDelta,
    handleProductsChange,
    handleProductSelected,
  } = useConvenienceStoreGame()

  if (!roomCode || !playerId) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">로딩 중</div>
      </div>
    )
  }

  return (
    <main className="factory-ambient relative min-h-dvh overflow-hidden font-bitbit">
      <ScreenFlash show={showFlash} color="rgba(34, 197, 94, 0.3)" />

      {/* 속도 보너스 플로팅 표시 */}
      {speedBonusDisplay !== null && <SpeedBonusToast amount={speedBonusDisplay} />}

      <div className="relative z-10 p-4">
        <StoreHeader
          roomCode={roomCode}
          questionSetTitle={questionSetTitle}
          remainingSeconds={remainingSeconds}
          correctAnswersCount={correctAnswersCount}
          currentPlayer={currentPlayer}
          money={money}
        />

        {/* 메인 컨텐츠 */}
        <div className="max-w-[1600px] mx-auto">
          {/* 카운트다운 */}
          {currentView === 'prestartQuiz' && (
            <PreStartQuizGate
              question={preStartQuizQuestion}
              submittedCount={preStartSubmittedCount}
              total={PRE_START_QUIZ_TOTAL}
              onAnswer={handlePreStartQuizAnswer}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
            />
          )}

          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {currentView === 'lobby' && <StoreLobbyPanel />}

          {/* 퀴즈 + 편의점 — 좌우 분리 레이아웃 (모바일은 세로 스택) */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {/* 왼쪽: 퀴즈 */}
              <div className="w-full min-w-0 lg:flex-1 lg:sticky lg:top-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={goToNextQuiz}
                  timeLimit={QUIZ_TIME_LIMIT}
                  paused={isPaused}
                  variant="glass"
                  className="lg-panel lg-ink-outline font-bitbit w-full p-5 sm:p-8"
                />
              </div>

              {/* 오른쪽: 편의점 */}
              <div className="w-full min-w-0 lg:flex-1 lg:overflow-y-auto lg:max-h-[calc(100dvh-160px)]">
                <ConvenienceStore
                  money={money}
                  onMoneyDelta={applyMoneyDelta}
                  products={products}
                  onProductsChange={handleProductsChange}
                  onQuizStart={handleQuizStart}
                  canInteract={!isQuizMode}
                  quizCorrect={isCorrect && currentView === 'quiz'}
                  onProductSelected={handleProductSelected}
                  showOrderModal={showOrderModal}
                  answerSpeed={lastAnswerSpeed}
                />
              </div>
            </div>
          )}

          {currentView === 'wrong' && (
            <StoreWrongPanel revealedAnswer={revealedAnswer} wrongPenalty={wrongPenalty} />
          )}

          {/* 결과 */}
          {currentView === 'result' && (
            <GameResult
              players={players}
              currentPlayerId={playerId}
              gameMode="factory"
            />
          )}
        </div>
        {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
              선생님이 잠깐 멈췄어요
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
