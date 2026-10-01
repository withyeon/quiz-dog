'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import GameTimeBadge from '@/components/GameTimeBadge'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import BossStage from '@/components/raid/BossStage'
import RaidHeader from '@/components/raid/RaidHeader'
import RaidLobbyPanel from '@/components/raid/RaidLobbyPanel'
import RaidResultPanel from '@/components/raid/RaidResultPanel'
import RoleSelector from '@/components/raid/RoleSelector'
import RaidCountdownOverlay from '@/components/raid/RaidCountdownOverlay'
import { useRaidGame } from '@/hooks/useRaidGame'
import { RAID } from '@/lib/game/raid'

/**
 * 황제 펭귄을 막아라! 학생 화면. 게임 규칙·상태는 useRaidGame 에 있고,
 * 여기서는 어느 화면 조각을 언제 보여줄지만 정한다.
 */
export default function RaidPage() {
  const router = useRouter()
  const {
    roomCode,
    playerId,
    currentView,
    revealedAnswer,
    showCountdown,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    questionSetTitle,
    sessionStartedAt,
    isPaused,
    settings,
    activePlayers,
    raidState,
    frenzy,
    role,
    needsRole,
    streak,
    hits,
    events,
    handleRoleSelect,
    handleRaidCountdownComplete,
    handleAnswerSubmit,
    goToNextQuiz,
  } = useRaidGame()

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
        <div className="battle-frost-panel px-6 py-5 text-xl font-black text-slate-800">펭귄 군단을 부르는 중</div>
      </main>
    )
  }

  const myDamage = Math.max(0, currentPlayer?.score ?? 0)
  const myHits = Math.max(0, currentPlayer?.gold ?? 0)
  const inBattle = (currentView === 'quiz' || currentView === 'wrong') && !showCountdown
  const showRolePicker = (showCountdown && !role) || (needsRole && !showCountdown && currentView !== 'lobby')

  return (
    <main className="battle-shell relative min-h-dvh overflow-x-hidden font-bitbit">
      <GameTimeBadge
        startedAt={sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />

      <div className="relative z-10 px-3 py-4 sm:px-5 sm:py-6">
        <RaidHeader
          questionSetTitle={questionSetTitle}
          role={role}
          streak={streak}
          myDamage={myDamage}
          myHits={myHits}
          raidState={raidState}
          frenzy={frenzy}
        />

        <div className="mx-auto max-w-7xl">
          {currentView === 'lobby' && !showCountdown && (
            <RaidLobbyPanel players={activePlayers} settings={settings} />
          )}

          {showRolePicker && (
            <RoleSelector onSelect={handleRoleSelect} selectedRole={role} />
          )}

          {inBattle && role && (
            /*
              폰에서는 보스 무대가 위, 퀴즈가 아래. xl(1280px~)에서는 무대를 왼쪽에 고정하고 퀴즈를 오른쪽에 둔다.
              무대는 compact 크기라 폰에서도 체력 바가 퀴즈 위에 늘 보인다.
            */
            <div className="grid gap-3 sm:gap-4 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
              <div className="xl:sticky xl:top-4">
                <BossStage
                  boss={raidState.current}
                  bossCount={raidState.roster.length}
                  defeatedCount={raidState.defeatedCount}
                  frenzy={frenzy}
                  hits={hits}
                  events={events}
                  size="compact"
                />
              </div>

              <div className="relative">
                {currentView === 'quiz' && (
                  currentQuestion ? (
                    <QuizView
                      question={currentQuestion}
                      onAnswer={handleAnswerSubmit}
                      onCorrectClick={goToNextQuiz}
                      timeLimit={RAID.QUESTION_TIME_LIMIT}
                      paused={isPaused}
                      variant="glass"
                      className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-5 sm:p-7"
                    />
                  ) : (
                    <div className="battle-frost-panel p-8 text-center">
                      <p className="font-bold text-slate-700">문제를 불러오는 중</p>
                    </div>
                  )
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
                    <h2 className="text-3xl font-black text-slate-950">아쉬워요!</h2>
                    <AnswerReveal answer={revealedAnswer} />
                    <p className="mt-2 font-semibold text-slate-500">펭귄은 그대로예요. 연속 정답만 처음부터 다시 세요.</p>
                  </motion.section>
                )}
              </div>
            </div>
          )}

          {currentView === 'result' && (
            <RaidResultPanel
              raidState={raidState}
              role={role}
              myDamage={myDamage}
              myHits={myHits}
              onShowResult={() => router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=raid_finished`)}
            />
          )}
        </div>
      </div>

      {/* fixed 오버레이는 transform 이 걸린 상자 밖에 둔다 (눈싸움 BattleCountdownOverlay 주석 참고) */}
      {showCountdown && role && (
        <RaidCountdownOverlay onComplete={handleRaidCountdownComplete} />
      )}

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
