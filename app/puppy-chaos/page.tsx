'use client'

import { AnimatePresence, motion } from 'framer-motion'
import DodgeMiniGame from '@/components/강아지대소동/강아지대소동MiniGame'
import PuppyHeader from '@/components/강아지대소동/PuppyHeader'
import WaitingPanel from '@/components/강아지대소동/WaitingPanel'
import QuizLoadingPanel from '@/components/강아지대소동/QuizLoadingPanel'
import RandomBoxPicker from '@/components/강아지대소동/RandomBoxPicker'
import RoundResultPanel from '@/components/강아지대소동/RoundResultPanel'
import BonusPanel from '@/components/강아지대소동/BonusPanel'
import FinalResultPanel from '@/components/강아지대소동/FinalResultPanel'
import QuizView from '@/components/QuizView'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import { usePuppyChaosGame } from '@/hooks/usePuppyChaosGame'

/**
 * 강아지 대소동 학생 화면. 단계 전환과 규칙은 usePuppyChaosGame 훅이 맡고,
 * 여기서는 phase 에 따라 어떤 패널을 보여줄지만 정한다.
 */
export default function PuppyChaosPage() {
  const {
    roomCode,
    playerId,
    currentPlayer,
    questionIndex,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    handlePreStartQuizAnswer,
    phase,
    combo,
    cards,
    cardCountdown,
    selectedBoxIndex,
    isOpeningBox,
    roundContext,
    roundSummary,
    remainingSeconds,
    activeQuestion,
    isPaused,
    handleAnswer,
    handleRandomBoxSelect,
    handleBonusStart,
    handleDodgeComplete,
  } = usePuppyChaosGame()

  if (!roomCode || !playerId) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-sky-100 p-6">
        <div className="rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center text-2xl font-black shadow-[6px_6px_0_#0f172a]">
          입장 정보가 없어요. QR로 다시 들어와 주세요.
        </div>
      </main>
    )
  }

  if (!currentPlayer) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-sky-100 p-6">
        <div className="rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center text-2xl font-black shadow-[6px_6px_0_#0f172a]">
          강아지를 찾는 중
        </div>
      </main>
    )
  }

  const score = currentPlayer.score ?? 0

  return (
    <main
      className="min-h-dvh bg-[#E0F2FE] bg-cover bg-center bg-no-repeat p-4 text-slate-950"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        backgroundImage: "linear-gradient(180deg, rgba(224, 242, 254, 0.12), rgba(255, 255, 255, 0.16)), url('/background/puppy-chaos.webp')",
      }}
    >
      <div className="mx-auto flex min-h-[calc(100dvh-32px)] w-full max-w-3xl flex-col gap-4">
        {shouldShowPreStartQuiz && (
          <PreStartQuizGate
            question={preStartQuizQuestion}
            submittedCount={preStartSubmittedCount}
            total={preStartQuizTotal}
            onAnswer={handlePreStartQuizAnswer}
            questionsLoading={questionsLoading}
            questionsError={questionsError}
          />
        )}

        <PuppyHeader
          questionSetTitle={questionSetTitle}
          nickname={currentPlayer.nickname}
          score={score}
          remainingSeconds={remainingSeconds}
          combo={combo}
        />

        <AnimatePresence mode="wait">
          {phase === 'waiting' && <WaitingPanel key="waiting" />}

          {phase === 'quiz' && activeQuestion && (
            <motion.section key={`quiz-${questionIndex}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="rounded-[28px] border-4 border-slate-900 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
              <QuizView
                key={`${activeQuestion.id}-${questionIndex}`}
                question={activeQuestion}
                onAnswer={handleAnswer}
                timeLimit={30}
                paused={isPaused}
                variant="glass"
                className="lg-panel lg-ink-outline font-bitbit p-6 sm:p-8"
              />
            </motion.section>
          )}

          {phase === 'quiz' && !activeQuestion && <QuizLoadingPanel key="quiz-loading" questionsError={questionsError} />}

          {phase === 'cardSelect' && (
            <RandomBoxPicker
              key="cards"
              cards={cards}
              cardCountdown={cardCountdown}
              selectedBoxIndex={selectedBoxIndex}
              isOpeningBox={isOpeningBox}
              onSelect={handleRandomBoxSelect}
            />
          )}

          {phase === 'dodge' && roundContext && (
            <motion.section key="dodge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-3 rounded-[24px] border-4 border-slate-900 bg-white p-2.5 text-center text-base font-black shadow-[4px_4px_0_#0f172a] sm:p-4 sm:text-xl">
                {roundContext.cardLabel ? `${roundContext.cardLabel} 발동! ` : ''}
                대소동을 버텨요!
              </div>
              <DodgeMiniGame
                durationSeconds={roundContext.durationSeconds}
                baseReward={roundContext.baseReward}
                questionIndex={roundContext.questionIndex}
                umbrella={roundContext.umbrella}
                cleaner={roundContext.cleaner}
                multiplier={roundContext.multiplier}
                invincible={roundContext.invincible}
                poopBombed={roundContext.poopBombed}
                paused={isPaused}
                onComplete={(result) => void handleDodgeComplete(result)}
              />
            </motion.section>
          )}

          {phase === 'roundResult' && roundSummary && <RoundResultPanel key="round-result" summary={roundSummary} />}

          {phase === 'bonus' && <BonusPanel key="bonus" onStart={() => void handleBonusStart()} />}

          {phase === 'finalResult' && (
            <FinalResultPanel key="final" score={score} isKicked={Boolean(currentPlayer.is_kicked)} />
          )}
        </AnimatePresence>

        {isPaused && phase !== 'waiting' && phase !== 'finalResult' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-6">
            <div className="rounded-[28px] border-4 border-slate-900 bg-white px-8 py-6 text-center text-4xl font-black shadow-[6px_6px_0_#0f172a]">
              선생님이 잠깐 멈췄어요
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
