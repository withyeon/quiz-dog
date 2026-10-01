'use client'

import { AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import GameTimeBadge from '@/components/GameTimeBadge'
import GameResult from '@/components/GameResult'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import ClassSelector from '@/components/ClassSelector'
import SnowEffect from '@/components/SnowEffect'
import HitOverlay from '@/components/HitOverlay'
import BlizzardOverlay from '@/components/BlizzardOverlay'
import ScreenShake from '@/components/ScreenShake'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import FrostVignette from '@/components/battle/FrostVignette'
import TeamRevealOverlay from '@/components/battle/TeamRevealOverlay'
import BattleHeader from '@/components/battle/BattleHeader'
import BattleLobbyPanel from '@/components/battle/BattleLobbyPanel'
import BattleQuizArena from '@/components/battle/BattleQuizArena'
import BattleCountdownOverlay from '@/components/battle/BattleCountdownOverlay'
import EliminatedOverlay from '@/components/battle/EliminatedOverlay'
import { motion } from 'framer-motion'
import { useSnowBattleGame, type BattlePlayer } from '@/hooks/useSnowBattleGame'
import { PLAYER_CLASSES, type Team } from '@/lib/game/battleRoyale'

/**
 * 눈싸움 대작전 학생 화면. 게임 규칙·상태는 useSnowBattleGame 에 있고,
 * 여기서는 어느 화면 조각을 언제 보여줄지만 정한다.
 */
export default function BattlePage() {
  const {
    roomCode,
    playerId,
    currentView,
    revealedAnswer,
    showCountdown,
    players,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    handlePreStartQuizAnswer,
    consecutiveCorrect,
    sessionStartedAt,
    isPaused,
    attackResult,
    selectedClass,
    hasSnowball,
    currentItem,
    isShaking,
    showSnowEffect,
    isBlizzardActive,
    isReloading,
    zoneLevel,
    lockedTarget,
    incomingAttack,
    isEliminated,
    showEliminationEffect,
    showTeamReveal,
    teamRevealComplete,
    currentPlayerTeam,
    handleClassSelect,
    handleBattleCountdownComplete,
    handleTeamRevealComplete,
    goToNextQuiz,
    handleTargetLock,
    handleAnswerSubmit,
    handlePlayerAttack,
    handleUseItem,
  } = useSnowBattleGame()

  if (!roomCode || !playerId) {
    return (
      <main className="battle-shell flex min-h-dvh items-center justify-center p-4">
        <div className="battle-frost-panel max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <p className="font-bold text-slate-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </main>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <main className="battle-shell flex min-h-dvh items-center justify-center p-4">
        <div className="battle-frost-panel px-6 py-5 text-xl font-black text-slate-800">
          로딩 중
        </div>
      </main>
    )
  }

  const battlePlayers = players as BattlePlayer[]
  const me = currentPlayer as BattlePlayer | null
  const currentHealth = Math.round(currentPlayer?.health ?? 100)
  const selectedClassInfo = selectedClass ? PLAYER_CLASSES[selectedClass] : null
  const isAlive = !!currentPlayer && (currentPlayer.health ?? 100) > 0 && !isEliminated

  return (
    <main
      className="battle-shell relative min-h-dvh overflow-x-hidden font-bitbit"
    >
      <GameTimeBadge
        startedAt={sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />
      <SnowEffect
        isActive={showSnowEffect}
        intensity={showEliminationEffect || isEliminated ? 'blizzard' : 'normal'}
        duration={showEliminationEffect || isEliminated ? 3000 : 2000}
      />
      <HitOverlay attack={incomingAttack} />
      {currentView !== 'result' && selectedClassInfo && currentHealth > 0 && (
        <FrostVignette healthPercent={(currentHealth / selectedClassInfo.maxHealth) * 100} />
      )}
      {isBlizzardActive && <BlizzardOverlay isActive={true} />}

      <AnimatePresence>
        {showTeamReveal && !teamRevealComplete && (
          <TeamRevealOverlay
            players={battlePlayers
              .filter((p) => p.team)
              .map((p) => ({
                id: p.id,
                nickname: p.nickname,
                team: p.team as Team,
              }))}
            currentPlayerId={playerId}
            onComplete={handleTeamRevealComplete}
          />
        )}
      </AnimatePresence>

      <ScreenShake intensity={15} duration={500} isShaking={isShaking}>
        <div className="relative z-10 px-3 py-4 sm:px-5 sm:py-6">
          <BattleHeader
            questionSetTitle={questionSetTitle}
            players={battlePlayers}
            currentHealth={currentHealth}
            selectedClass={selectedClass}
            myTeam={currentPlayerTeam}
            isReloading={isReloading}
            hasSnowball={hasSnowball}
            currentItem={currentItem}
            onUseItem={handleUseItem}
            zoneLevel={zoneLevel}
            consecutiveCorrect={consecutiveCorrect}
          />

          <div className="mx-auto max-w-7xl">
            {shouldShowPreStartQuiz && (
              <PreStartQuizGate
                question={preStartQuizQuestion}
                submittedCount={preStartSubmittedCount}
                total={preStartQuizTotal}
                onAnswer={handlePreStartQuizAnswer}
                questionsLoading={questionsLoading}
                questionsError={questionsError}
                variant="battle"
              />
            )}

            {showCountdown && !selectedClass && (
              <ClassSelector
                onSelect={handleClassSelect}
                selectedClass={selectedClass || undefined}
              />
            )}

            {currentView === 'lobby' && !showCountdown && (
              <BattleLobbyPanel players={battlePlayers} />
            )}

            {currentView === 'quiz' && !showCountdown && isAlive && (
              <BattleQuizArena
                players={battlePlayers}
                playerId={playerId}
                currentQuestion={currentQuestion}
                isPaused={isPaused}
                lockedTarget={lockedTarget}
                hasSnowball={hasSnowball}
                isReloading={isReloading}
                zoneLevel={zoneLevel}
                attackResult={attackResult}
                onTargetSelect={hasSnowball ? handlePlayerAttack : handleTargetLock}
                onAnswer={handleAnswerSubmit}
                onCorrectClick={goToNextQuiz}
              />
            )}

            {currentView === 'wrong' && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="battle-frost-panel mx-auto max-w-2xl p-8 text-center"
              >
                <div className="mx-auto mb-4 flex justify-center">
                  <PixelIcon name="wrong" size={96} />
                </div>
                <h2 className="text-3xl font-black text-slate-950">틀렸습니다</h2>
                <AnswerReveal answer={revealedAnswer} />
                <p className="mt-2 font-semibold text-slate-500">눈뭉치가 녹아버렸습니다.</p>
              </motion.section>
            )}

            {currentView === 'result' && (
              <GameResult
                players={players}
                currentPlayerId={playerId}
                gameMode="battle_royale"
              />
            )}
          </div>
        </div>
      </ScreenShake>

      {/* fixed 오버레이는 ScreenShake 밖에 둔다 (BattleCountdownOverlay 주석 참고) */}
      {showCountdown && selectedClass && (
        <BattleCountdownOverlay onComplete={handleBattleCountdownComplete} />
      )}

      <AnimatePresence>
        {isEliminated && currentView !== 'result' && (
          <EliminatedOverlay
            players={battlePlayers}
            playerId={playerId}
            currentPlayer={me}
            currentQuestion={currentQuestion}
            isPaused={isPaused}
            zoneLevel={zoneLevel}
            onAnswer={handleAnswerSubmit}
            onCorrectClick={goToNextQuiz}
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
