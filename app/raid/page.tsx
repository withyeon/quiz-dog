'use client'

import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ShieldCheck, Star, Swords, Zap } from 'lucide-react'
import GameTimeBadge from '@/components/GameTimeBadge'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import BossStage from '@/components/raid/BossStage'
import PartyStrip from '@/components/raid/PartyStrip'
import RaidHeader from '@/components/raid/RaidHeader'
import RaidLobbyPanel from '@/components/raid/RaidLobbyPanel'
import RaidResultPanel from '@/components/raid/RaidResultPanel'
import RoleSelector from '@/components/raid/RoleSelector'
import RaidCountdownOverlay from '@/components/raid/RaidCountdownOverlay'
import { useRaidGame } from '@/hooks/useRaidGame'
import { RAID, type RaidHitBreakdown, type RaidSkillState } from '@/lib/game/raid'

/**
 * 정답 직후 파티 띠 위에 잠깐 뜨는 타격 요약. 무대(체력 바) 바로 아래라 시선이 가까우면서
 * 체력 바를 가리지 않는다. 띠 위에 겹쳐 뜨므로 레이아웃은 밀리지 않는다.
 */
function HitToast({ hit, interrupted }: { hit: RaidHitBreakdown | null; interrupted: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-1" aria-live="polite">
      <AnimatePresence>
        {hit && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-slate-900/90 px-3 py-1.5 shadow-xl ring-1 ring-white/25"
          >
            <span className="inline-flex items-center gap-1 text-sm font-black text-amber-300">
              <Swords className="h-4 w-4" />
              +{hit.damage}
            </span>
            {hit.comboBonus > 0 && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-black text-white">연속 보너스 +{hit.comboBonus}</span>
            )}
            {hit.multiplier > 1 && (
              <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2 py-0.5 text-[11px] font-black text-amber-950">
                기절 ×{hit.multiplier}
              </span>
            )}
            {interrupted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300 px-2 py-0.5 text-[11px] font-black text-cyan-950">
                <Zap className="h-3 w-3" />
                필살기 끊기에 힘을 보탰어요!
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type AlertInfo = {
  kind: 'charging' | 'groggy' | 'shield'
  className: string
  icon: 'alert' | 'star' | 'shield'
  text: string
  /** 예고 남은 시간 막대 (0~1). 없으면 막대를 그리지 않는다 */
  ratio?: number
}

/**
 * 퀴즈 바로 위에 붙는 짧은 알림 한 줄. 필살기 예고 > 기절 > 얼음 방패 순으로 하나만 보여 준다.
 * (무대에도 같은 정보가 있지만 학생 시선은 답 버튼에 있으므로 가까이에서 한 번 더 알려 준다.)
 * 친구별 기여 여부는 어디에도 쓰지 않고, "내가" 이미 보탰는지만 안다.
 */
function getQuizAlert(skill: RaidSkillState, shieldRemaining: number, contributed: boolean): AlertInfo | null {
  if (skill.phase === 'charging') {
    return {
      kind: 'charging',
      icon: 'alert',
      className: 'bg-rose-600 text-white shadow-rose-900/30',
      text: contributed
        ? `${skill.skillName} 예고 · 끊기에 힘을 보탰어요! 계속 맞혀 친구들을 도와요 · ${skill.secondsLeft}초`
        : `${skill.skillName} 예고 · 맞히면 끊기에 힘을 보태요 · ${skill.secondsLeft}초`,
      ratio: 1 - skill.chargeRatio,
    }
  }
  if (skill.phase === 'groggy') {
    return {
      kind: 'groggy',
      icon: 'star',
      className: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 shadow-amber-900/20',
      text: `기절! 지금 맞히면 데미지 ×${RAID.GROGGY_MULTIPLIER} · ${skill.secondsLeft}초`,
    }
  }
  if (shieldRemaining > 0) {
    return {
      kind: 'shield',
      icon: 'shield',
      className: 'bg-cyan-500 text-white shadow-cyan-900/25',
      text: `얼음 방패 · 친구 ${shieldRemaining}명이 더 때려야 깨져요`,
    }
  }
  return null
}

function QuizAlertStrip({ alert }: { alert: AlertInfo | null }) {
  return (
    <AnimatePresence initial={false}>
      {alert && (
        <motion.div
          key={alert.kind}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
          role="status"
        >
          <div className={`relative mb-2 overflow-hidden rounded-[10px] px-3 py-1.5 shadow-md sm:mb-3 sm:py-2 ${alert.className}`}>
            <p className="flex items-center gap-2 break-keep text-xs font-black leading-snug sm:text-sm">
              {alert.icon === 'alert' && <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />}
              {alert.icon === 'star' && <Star className="h-4 w-4 shrink-0 fill-current" />}
              {alert.icon === 'shield' && <ShieldCheck className="h-4 w-4 shrink-0" />}
              <span>{alert.text}</span>
            </p>
            {alert.ratio !== undefined && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                <div
                  className="h-full bg-white/80 transition-[width] duration-500 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(1, alert.ratio)) * 100}%` }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

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
    revealedExplanation,
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
    skill,
    role,
    needsRole,
    streak,
    hits,
    events,
    lastHit,
    lastInterrupt,
    handleRoleSelect,
    handleRaidCountdownComplete,
    handleAnswerSubmit,
    goToNextQuiz,
  } = useRaidGame()

  if (!roomCode || !playerId) {
    return (
      <main className="battle-shell raid-shell flex min-h-dvh items-center justify-center p-4">
        <div className="battle-frost-panel max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <p className="font-bold text-slate-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </main>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <main className="battle-shell raid-shell flex min-h-dvh items-center justify-center p-4">
        <div className="battle-frost-panel px-6 py-5 text-xl font-black text-slate-800">펭귄 군단을 부르는 중</div>
      </main>
    )
  }

  const myDamage = Math.max(0, currentPlayer?.score ?? 0)
  const myHits = Math.max(0, currentPlayer?.gold ?? 0)
  const inBattle = (currentView === 'quiz' || currentView === 'wrong') && !showCountdown
  const showRolePicker = (showCountdown && !role) || (needsRole && !showCountdown && currentView !== 'lobby')
  const showBattle = inBattle && Boolean(role)

  // GameTimeBadge 와 같은 조건 — 화면 위 가운데에 떠 있을 때 HUD·제목 줄이 그 밑에 깔리지 않게 비켜 준다
  const timeBadgeShown = room?.status === 'playing' && Boolean(sessionStartedAt) && (room?.duration_seconds ?? 0) > 0

  // 퀴즈 위 알림 한 줄: 이번 필살기에 내가 이미 끊기 기여를 했는지(revival_streak = 주기 번호 + 1)는 내 행으로만 안다
  const contributedToSkill = skill.cycle >= 0 && (currentPlayer?.revival_streak ?? 0) >= skill.cycle + 1
  const shieldRemaining = raidState.current?.shield.active ? raidState.current.shield.remaining : 0
  const quizAlert = getQuizAlert(skill, shieldRemaining, contributedToSkill)

  return (
    /* overflow-x-clip: hidden 은 스크롤 상자를 만들어 안쪽 sticky(HUD·무대)를 죽인다 */
    <main className="battle-shell raid-shell relative min-h-dvh overflow-x-clip font-bitbit">
      <GameTimeBadge
        startedAt={sessionStartedAt}
        durationSeconds={room?.duration_seconds}
        status={room?.status}
      />

      <div
        className={`relative z-10 px-2 pb-6 sm:px-5 ${
          showBattle ? 'pt-1 sm:pt-2' : timeBadgeShown ? 'pt-11 sm:pt-12' : 'pt-3 sm:pt-6'
        }`}
      >
        <RaidHeader
          variant={showBattle ? 'hud' : 'intro'}
          questionSetTitle={questionSetTitle}
          role={role}
          streak={streak}
          myDamage={myDamage}
          myHits={myHits}
          raidState={raidState}
          skill={skill}
          reserveTimeBadge={timeBadgeShown}
        />

        <div className="mx-auto max-w-7xl">
          {currentView === 'lobby' && !showCountdown && (
            <RaidLobbyPanel players={activePlayers} settings={settings} />
          )}

          {showRolePicker && (
            <RoleSelector onSelect={handleRoleSelect} selectedRole={role} players={activePlayers} />
          )}

          {showBattle && (
            /*
              폰에서는 위에서부터 보스 무대 → 파티 띠 → 퀴즈. xl(1280px~)에서는 무대와 파티 띠를 왼쪽에 고정하고
              퀴즈를 오른쪽에 둔다. 무대는 compact 크기라 폰에서도 체력 바가 퀴즈 위에 늘 보인다.
            */
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start xl:gap-4">
              <div className="min-w-0 space-y-2 sm:space-y-3 xl:sticky xl:top-4">
                <BossStage
                  boss={raidState.current}
                  bossCount={raidState.roster.length}
                  defeatedCount={raidState.defeatedCount}
                  skill={skill}
                  hits={hits}
                  events={events}
                  size="compact"
                />

                <div className="relative">
                  <PartyStrip players={activePlayers} playerId={playerId} />
                  <HitToast hit={currentView === 'quiz' ? lastHit : null} interrupted={currentView === 'quiz' && lastInterrupt} />
                </div>
              </div>

              <div className="relative min-w-0">
                <QuizAlertStrip alert={quizAlert} />

                {currentView === 'quiz' && (
                  currentQuestion ? (
                    <QuizView
                      question={currentQuestion}
                      onAnswer={handleAnswerSubmit}
                      onCorrectClick={goToNextQuiz}
                      timeLimit={RAID.QUESTION_TIME_LIMIT}
                      paused={isPaused}
                      variant="glass"
                      className="lg-panel lg-ink-outline font-bitbit mx-auto w-full max-w-3xl p-4 sm:p-7"
                    />
                  ) : (
                    <div className="battle-frost-panel p-8 text-center">
                      <p className="font-bold text-slate-700">문제를 불러오는 중</p>
                    </div>
                  )
                )}

                {currentView === 'wrong' && (
                  /* 오답: 팀에는 아무 손해가 없다. 퀴즈 패널과 같은 유리 틀에 부드러운 말만 둔다 */
                  <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="lg-panel mx-auto w-full max-w-3xl p-4 text-center sm:p-7"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <PixelIcon name="wrong" size={56} />
                      <h2 className="lg-ink-outline text-2xl font-black text-white sm:text-3xl">아쉬워요!</h2>
                    </div>
                    <AnswerReveal answer={revealedAnswer} explanation={revealedExplanation} />
                    <p className="lg-chip lg-ink-outline mx-auto mt-1 inline-block px-4 py-1.5 text-sm font-bold leading-snug text-white">
                      펭귄은 그대로예요. 팀에는 아무 손해도 없고, 연속 정답만 처음부터 다시 세요.
                    </p>
                  </motion.section>
                )}
              </div>
            </div>
          )}

          {currentView === 'result' && (
            <RaidResultPanel
              raidState={raidState}
              players={activePlayers}
              playerId={playerId}
              role={role}
              onShowResult={() => router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=raid_finished`)}
            />
          )}
        </div>
      </div>

      {/* fixed 오버레이는 transform 이 걸린 상자 밖에 둔다 (눈싸움 BattleCountdownOverlay 주석 참고) */}
      {showCountdown && role && (
        <RaidCountdownOverlay
          onComplete={handleRaidCountdownComplete}
          firstBoss={raidState.roster[0] ?? null}
        />
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
