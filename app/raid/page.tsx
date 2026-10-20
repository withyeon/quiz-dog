'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Droplets, ShieldCheck, Star, Swords, X } from 'lucide-react'
import GameTimeBadge from '@/components/GameTimeBadge'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import RaidArena from '@/components/raid/arena/RaidArena'
import BossHpBar from '@/components/raid/stage/BossHpBar'
import PartyStrip from '@/components/raid/PartyStrip'
import RaidHeader from '@/components/raid/RaidHeader'
import RaidLobbyPanel from '@/components/raid/RaidLobbyPanel'
import RaidResultPanel from '@/components/raid/RaidResultPanel'
import RoleSelector from '@/components/raid/RoleSelector'
import RaidCountdownOverlay from '@/components/raid/RaidCountdownOverlay'
import { getBalloonsPerAnswer, useRaidGame, type RaidEvent, type RaidHitPopup } from '@/hooks/useRaidGame'
import { RAID, type RaidHitBreakdown, type RaidSkillState, type RaidState } from '@/lib/game/raid'
import { ARENA } from '@/lib/game/raidArena'

/** 파티 띠 위에 잠깐 뜨는 타격 요약 (펭귄을 맞혔을 때) */
function HitToast({ hit }: { hit: RaidHitBreakdown | null }) {
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
              펭귄 명중 +{hit.damage}
            </span>
            {hit.comboBonus > 0 && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-black text-white">연속 보너스 +{hit.comboBonus}</span>
            )}
            {hit.multiplier > 1 && (
              <span className="rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 px-2 py-0.5 text-[11px] font-black text-amber-950">
                기절 ×{hit.multiplier}
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
  ratio?: number
}

/** 아레나 위에 붙는 짧은 알림 한 줄. 필살기 예고 > 기절 > 얼음 방패 순으로 하나만 */
function getArenaAlert(skill: RaidSkillState, shieldRemaining: number, contributed: boolean): AlertInfo | null {
  if (skill.phase === 'charging') {
    return {
      kind: 'charging',
      icon: 'alert',
      className: 'bg-rose-600 text-white shadow-rose-900/30',
      text: contributed
        ? `${skill.skillName} 예고 · 끊기에 힘을 보탰어요! 보라색 줄을 피해요 · ${skill.secondsLeft}초`
        : `${skill.skillName} 예고 · 지금 펭귄을 맞히면 끊기에 힘을 보태요 · ${skill.secondsLeft}초`,
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
      text: `얼음 방패 · 친구 ${shieldRemaining}명이 더 맞혀야 깨져요`,
    }
  }
  return null
}

function AlertStrip({ alert }: { alert: AlertInfo | null }) {
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
          <div className={`relative mb-2 overflow-hidden rounded-[10px] px-3 py-1.5 shadow-md ${alert.className}`}>
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

/** 아레나 위 펭귄 체력 줄 — 이름·순번·체력 바. 선생님 화면과 같은 BossHpBar 를 쓴다 */
function BossBar({ raidState, hits, events }: { raidState: RaidState; hits: RaidHitPopup[]; events: RaidEvent[] }) {
  const boss = raidState.current
  const latest = events[events.length - 1] ?? null
  return (
    <div className="mb-2 rounded-[10px] bg-slate-900/85 px-3 py-2 text-white shadow-md ring-1 ring-white/15">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-black sm:text-base">{boss ? boss.def.name : '펭귄 군단 격파!'}</span>
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-black tabular-nums">
            {Math.min(raidState.defeatedCount + 1, raidState.roster.length)}/{raidState.roster.length}마리
          </span>
        </div>
        {boss && (
          <span className="shrink-0 text-xs font-black tabular-nums text-sky-100">
            {boss.hp.toLocaleString()} / {boss.def.maxHp.toLocaleString()}
          </span>
        )}
      </div>
      {boss && <BossHpBar hp={boss.hp} maxHp={boss.def.maxHp} isFinal={boss.def.isFinal} shield={boss.shield} isLarge={false} />}
      <div className="relative mt-1 h-5">
        <AnimatePresence>
          {latest && (
            <motion.div
              key={latest.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 truncate text-center text-[11px] font-black text-amber-200"
            >
              {latest.text}
            </motion.div>
          )}
          {!latest && hits.length > 0 && (
            <motion.div
              key={`hit-${hits[hits.length - 1].id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-x-0 truncate text-center text-[11px] font-bold text-sky-100"
            >
              {hits[hits.length - 1].mine ? '내 물풍선이 펭귄을 맞혔어요!' : `${hits[hits.length - 1].nickname}의 물풍선이 펭귄을 맞혔어요`}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * 황제 펭귄을 막아라! 학생 화면 (크레이지아케이드 몬스터 모드식).
 * 게임 규칙·상태는 useRaidGame 에, 아레나 규칙은 lib/game/raidArena 에 있고,
 * 여기서는 어느 화면 조각을 언제 보여줄지만 정한다. 퀴즈는 아레나 위에 창으로 뜨고, 열려 있는 동안 내 아레나는 멈춘다.
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
    lastBalloons,
    quizOpen,
    arenaRef,
    openQuiz,
    closeQuiz,
    handleArenaEvent,
    handleRoleSelect,
    handleRaidCountdownComplete,
    handleAnswerSubmit,
    goToNextQuiz,
  } = useRaidGame()

  // 훅은 마운트 뒤 효과에서 URL 의 room·playerId 를 읽는다. 그 전(서버 렌더·첫 그림)에 "방 코드가 필요합니다"를
  // 보여 주면 새로고침할 때마다 오류 문구가 번쩍이므로, URL 을 확인한 뒤에만 오류를 말한다.
  const [urlChecked, setUrlChecked] = useState(false)
  useEffect(() => {
    setUrlChecked(true)
  }, [])

  if (!roomCode || !playerId) {
    if (!urlChecked) {
      return (
        <main className="battle-shell raid-shell flex min-h-dvh items-center justify-center p-4">
          <div className="battle-frost-panel px-6 py-5 text-xl font-black text-slate-800">펭귄 군단을 부르는 중</div>
        </main>
      )
    }
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

  const timeBadgeShown = room?.status === 'playing' && Boolean(sessionStartedAt) && (room?.duration_seconds ?? 0) > 0

  const contributedToSkill = skill.cycle >= 0 && (currentPlayer?.revival_streak ?? 0) >= skill.cycle + 1
  const shieldRemaining = raidState.current?.shield.active ? raidState.current.shield.remaining : 0
  const arenaAlert = getArenaAlert(skill, shieldRemaining, contributedToSkill)

  const boss = raidState.current
  const seedKey = `${roomCode}:${room?.started_at ?? ''}`
  const arenaFrozen = quizOpen || isPaused || currentView === 'wrong'

  return (
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
              폰에서는 위에서부터 펭귄 체력 → 아레나(+조작부) → 파티 띠. lg 부터는 아레나를 왼쪽에,
              파티 띠와 안내를 오른쪽 열에 둔다. 퀴즈는 아레나 위 창으로 뜬다.
            */
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-4">
              <div className="min-w-0">
                <BossBar raidState={raidState} hits={hits} events={events} />
                <AlertStrip alert={arenaAlert} />
                <RaidArena
                  ref={arenaRef}
                  seedKey={seedKey}
                  role={role}
                  bossIndex={boss ? boss.def.index : raidState.roster.length}
                  bossPresent={Boolean(boss)}
                  bossSprite={boss ? boss.def.sprite : null}
                  rosterSprites={raidState.roster.map((def) => def.sprite)}
                  bossGroggy={skill.phase === 'groggy'}
                  shieldActive={Boolean(boss?.shield.active)}
                  skillPhase={skill.phase}
                  skillCycle={skill.cycle}
                  frozen={arenaFrozen}
                  avatar={currentPlayer?.avatar ?? ''}
                  onEvent={handleArenaEvent}
                  onOpenQuiz={openQuiz}
                />
              </div>

              <div className="min-w-0 space-y-2 lg:sticky lg:top-4">
                <div className="relative">
                  <PartyStrip players={activePlayers} playerId={playerId} />
                  <HitToast hit={lastHit} />
                </div>
                <div className="hidden rounded-[10px] border border-slate-300/50 bg-white/80 p-3 text-xs font-semibold leading-relaxed text-slate-600 lg:block">
                  <div className="mb-1 flex items-center gap-1.5 text-sm font-black text-slate-800">
                    <Droplets className="h-4 w-4 text-sky-600" />
                    이렇게 싸워요
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>퀴즈를 맞히면 물풍선이 생겨요 (Q)</li>
                    <li>물풍선을 놓으면 {ARENA.BALLOON_FUSE}초 뒤 십자 물줄기 — 펭귄에 닿으면 데미지</li>
                    <li>스노우몬은 얼린 뒤 몸으로 부딪혀 깨요. 녹으면 폭주!</li>
                    <li>물줄기·스노우몬·펭귄에 닿으면 갇혀요. 출발 칸에서 다시 시작</li>
                  </ul>
                </div>
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

      {/* 퀴즈 창 — 아레나 위. 정답이면 물풍선을 받고 잠시 뒤 닫히고, 오답이면 정답을 보여 준 뒤 닫힌다 */}
      <AnimatePresence>
        {showBattle && (quizOpen || currentView === 'wrong') && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          >
            <motion.div
              initial={{ y: 24, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.97 }}
              className="my-auto w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-2 text-white">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1 text-xs font-black shadow sm:text-sm">
                  <Droplets className="h-4 w-4" />
                  맞히면 물풍선 +{getBalloonsPerAnswer(role, streak + 1)} · 아레나는 멈춰 있어요
                </span>
                {currentView === 'quiz' && (
                  <button
                    type="button"
                    onClick={closeQuiz}
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black hover:bg-white/30"
                  >
                    <X className="h-3.5 w-3.5" />
                    닫기
                  </button>
                )}
              </div>

              {currentView === 'quiz' && (
                currentQuestion ? (
                  <div className="relative">
                    <QuizView
                      question={currentQuestion}
                      onAnswer={handleAnswerSubmit}
                      onCorrectClick={goToNextQuiz}
                      timeLimit={RAID.QUESTION_TIME_LIMIT}
                      paused={isPaused}
                      variant="glass"
                      className="lg-panel lg-ink-outline font-bitbit mx-auto w-full p-4 sm:p-7"
                    />
                    <AnimatePresence>
                      {lastBalloons > 0 && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="pointer-events-none absolute inset-x-0 top-3 flex justify-center"
                        >
                          <span className="rounded-full bg-emerald-500 px-4 py-1.5 text-base font-black text-white shadow-xl">
                            🎈 물풍선 +{lastBalloons}!
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
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
                  className="lg-panel mx-auto w-full p-4 text-center sm:p-7"
                >
                  <div className="flex items-center justify-center gap-3">
                    <PixelIcon name="wrong" size={56} />
                    <h2 className="lg-ink-outline text-2xl font-black text-white sm:text-3xl">아쉬워요!</h2>
                  </div>
                  <AnswerReveal answer={revealedAnswer} explanation={revealedExplanation} />
                  <p className="lg-chip lg-ink-outline mx-auto mt-1 inline-block px-4 py-1.5 text-sm font-bold leading-snug text-white">
                    물풍선은 그대로예요. 연속 정답만 처음부터 다시 세요.
                  </p>
                </motion.section>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* fixed 오버레이는 transform 이 걸린 상자 밖에 둔다 */}
      {showCountdown && role && (
        <RaidCountdownOverlay
          onComplete={handleRaidCountdownComplete}
          firstBoss={raidState.roster[0] ?? null}
        />
      )}

      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black break-keep text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </main>
  )
}
