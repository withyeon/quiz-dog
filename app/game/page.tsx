'use client'

import { AnimatePresence, motion } from 'framer-motion'
import QuizView from '@/components/QuizView'
import GameTimeBadge from '@/components/GameTimeBadge'
import ShieldPromptModal from '@/components/ShieldPromptModal'
import ChestView from '@/components/ChestView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import GoldQuestHeader from '@/components/goldquest/GoldQuestHeader'
import GoldQuestLobbyPanel from '@/components/goldquest/GoldQuestLobbyPanel'
import QuizUnavailablePanel from '@/components/goldquest/QuizUnavailablePanel'
import PlayerSelectStage from '@/components/goldquest/PlayerSelectStage'
import WrongAnswerPanel from '@/components/goldquest/WrongAnswerPanel'
import GoldRanking from '@/components/goldquest/GoldRanking'
import { useGoldQuestGame } from '@/hooks/useGoldQuestGame'

/**
 * 해적왕의 보물찾기 학생 화면. 규칙·상태는 useGoldQuestGame 훅이 맡고,
 * 여기서는 currentView 에 따라 어떤 패널을 보여줄지만 정한다.
 */
export default function GamePage() {
  const {
    roomCode,
    playerId,
    currentView,
    currentQuestionIndex,
    revealedAnswer,
    showCountdown,
    handleCountdownComplete,
    answerHistory,
    questions,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    players,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    handlePreStartQuizAnswer,
    sessionStartedAt,
    isPaused,
    rankedPlayers,
    leaderGold,
    quizUnavailableMessage,
    selectedChest,
    boxEvent,
    isProcessingReward,
    hasShield,
    shieldNotice,
    pendingEvent,
    playerSelectTimeLeft,
    awaitingShieldText,
    shieldAsk,
    answerShield,
    goToChestView,
    handleAnswerSubmit,
    handleChestSelect,
    handlePlayerSelect,
  } = useGoldQuestGame()

  if (!roomCode || !playerId) {
    return (
      <div className="gold-quest-ambient min-h-dvh flex items-center justify-center p-6">
        <div className="gold-quest-panel p-6">
          <p className="font-bold text-[#17262a]">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="gold-quest-ambient min-h-dvh flex items-center justify-center p-6">
        <div className="gold-quest-panel p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
          <div className="text-xl font-black text-[#17262a]">로딩 중</div>
        </div>
      </div>
    )
  }

  return (
    <main className="gold-quest-ambient min-h-dvh p-4 sm:p-6 lg:p-8 relative overflow-hidden font-bitbit">
      <GameTimeBadge
        startedAt={sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />
      <div className="max-w-6xl mx-auto relative z-10">
        <GoldQuestHeader
          questionSetTitle={questionSetTitle}
          currentPlayer={currentPlayer}
          hasShield={hasShield}
        />

        {shieldNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="mb-6 rounded-lg border border-emerald-300/80 bg-emerald-100/90 px-5 py-4 text-center text-xl font-black text-emerald-900 shadow-lg shadow-emerald-950/10"
          >
            {shieldNotice}
          </motion.div>
        )}

        {/* 카운트다운 */}
        {shouldShowPreStartQuiz && (
          <PreStartQuizGate
            question={preStartQuizQuestion}
            submittedCount={preStartSubmittedCount}
            total={preStartQuizTotal}
            onAnswer={handlePreStartQuizAnswer}
            questionsLoading={questionsLoading}
            questionsError={questionsError}
            variant="goldQuest"
          />
        )}

        {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

        {/* 게임 화면 */}
        <div className="mb-6">
          {currentView === 'lobby' && <GoldQuestLobbyPanel />}

          {currentView === 'quiz' && currentQuestion && (
            <QuizView
              question={currentQuestion}
              onAnswer={handleAnswerSubmit}
              onCorrectClick={goToChestView}
              timeLimit={30}
              paused={isPaused}
              variant="glass"
            />
          )}

          {currentView === 'quiz' && !currentQuestion && (
            <QuizUnavailablePanel questionsLoading={questionsLoading} message={quizUnavailableMessage} />
          )}

          {currentView === 'chest' && (
            <ChestView
              key={currentQuestionIndex} // 문제가 바뀔 때마다 컴포넌트 재마운트
              onChestSelect={handleChestSelect}
              selectedChest={selectedChest}
              reward={boxEvent}
              isProcessing={isProcessingReward}
            />
          )}

          {currentView === 'playerSelect' && pendingEvent && (
            <PlayerSelectStage
              pendingEvent={pendingEvent}
              boxEvent={boxEvent}
              isProcessingReward={isProcessingReward}
              awaitingShieldText={awaitingShieldText}
              players={players}
              playerId={playerId}
              playerSelectTimeLeft={playerSelectTimeLeft}
              onSelect={handlePlayerSelect}
            />
          )}

          {currentView === 'wrong' && <WrongAnswerPanel revealedAnswer={revealedAnswer} />}
        </div>

        {/* 게임 결과 화면 */}
        {currentView === 'result' && (
          <GameResult
            players={players}
            currentPlayerId={playerId}
            answerHistory={answerHistory}
            questions={questions}
          />
        )}

        {/* 플레이어 순위 (결과 화면이 아닐 때만 표시) */}
        {currentView !== 'result' && (
          <GoldRanking rankedPlayers={rankedPlayers} leaderGold={leaderGold} playerId={playerId} />
        )}
      </div>
      <AnimatePresence>
        {shieldAsk && (
          <ShieldPromptModal
            message={shieldAsk.message}
            expiresAt={shieldAsk.expiresAt}
            onAnswer={answerShield}
          />
        )}
      </AnimatePresence>
      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </main>
  )
}
