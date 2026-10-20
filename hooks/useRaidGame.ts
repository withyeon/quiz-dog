'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameBase } from '@/hooks/useGameBase'
import { useRaidEvents, useRaidHitPopups, useRaidSkill } from '@/hooks/useRaidEffects'
import type { PlayerDeltas } from '@/lib/services/playerMutations'
import {
  RAID,
  computeHitDamage,
  computeRaidState,
  getRaidRole,
  parseRaidSettings,
  type RaidHitBreakdown,
  type RaidRole,
} from '@/lib/game/raid'
import { ARENA, type ArenaEvent } from '@/lib/game/raidArena'
import type { RaidArenaHandle } from '@/components/raid/arena/RaidArena'

export type { RaidEvent, RaidEventKind, RaidHitPopup } from '@/hooks/useRaidEffects'

function streakStorageKey(roomCode: string, playerId: string, startedAt: string | null) {
  return `raid_streak_${roomCode}_${playerId}_${startedAt ?? ''}`
}

/** 정답 하나로 받는 물풍선. 마법사는 하나 더 */
export function getBalloonsPerAnswer(role: RaidRole | null, streak: number): number {
  const base = ARENA.BALLOONS_PER_ANSWER + (role === 'mage' ? 1 : 0)
  // 5연속 정답부터는 보너스 물풍선 하나 더
  return base + (streak >= 5 ? 1 : 0)
}

/**
 * 황제 펭귄을 막아라!의 게임 로직 훅 (크레이지아케이드 몬스터 모드식).
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 레이드 고유의 상태를 얹는다:
 * 역할 선택, 퀴즈 정답 → 물풍선 지급, 아레나에서 펭귄을 맞히면 데미지 계산 → 원자적 증분,
 * 연속 정답(데미지 보너스), 필살기 예고·끊기, 방패 기여, 사건 배너와 타격 팝업(useRaidEffects).
 * 보스 상태 자체는 lib/game/raid.ts 가 players 행에서 유도하므로 여기서 따로 들고 있지 않다 —
 * 선생님 대시보드도 같은 함수로 같은 보스를 본다. 아레나(눈 블록·스노우몬·물풍선)는 내 화면에만 있다.
 */
export function useRaidGame() {
  const base = useGameBase({
    expectedGameMode: 'raid',
    preStartQuizTotal: 0,
    wrongAnswerDelay: RAID.WRONG_ANSWER_DELAY_MS,
    timeLimit: RAID.QUESTION_TIME_LIMIT,
  })
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    players,
    room,
    currentPlayer,
    playSFX,
    checkAnswer,
    handleWrongAnswer,
    handleCountdownComplete,
    goToNextQuestion,
    commitPlayerDelta,
    commitPlayerPatch,
  } = base

  const settings = useMemo(() => parseRaidSettings(room?.settings), [room?.settings])
  const activePlayers = useMemo(() => players.filter((player) => !player.is_kicked), [players])
  const raidState = useMemo(() => computeRaidState(activePlayers, settings), [activePlayers, settings])
  const raidStateRef = useRef(raidState)
  raidStateRef.current = raidState

  const isPlaying = room?.status === 'playing'
  const isPaused = room?.status === 'paused'
  const startedAt = room?.started_at ?? null

  // ─── 역할 ───
  const savedRole = getRaidRole(currentPlayer)
  const [selectedRole, setSelectedRole] = useState<RaidRole | null>(null)
  useEffect(() => {
    if (savedRole) setSelectedRole(savedRole)
  }, [savedRole])
  const role: RaidRole | null = selectedRole ?? savedRole
  const roleRef = useRef(role)
  roleRef.current = role
  // 플레이어 행이 로드된 뒤에도 역할이 없으면 고르게 한다 (새로고침·도중 입장 포함)
  const needsRole = isPlaying && currentPlayer !== null && !role && currentView !== 'result'

  const handleRoleSelect = useCallback(async (next: RaidRole) => {
    if (!playerId) return
    setSelectedRole(next)
    playSFX('click')
    try {
      await commitPlayerPatch(playerId, { player_class: next }, 'raid_role_select')
    } catch (error) {
      console.error('역할 저장 실패:', error)
    }
  }, [commitPlayerPatch, playSFX, playerId])

  // ─── 연속 정답 (새로고침해도 이어지도록 sessionStorage) ───
  const [streak, setStreak] = useState(0)
  const streakRef = useRef(0)
  streakRef.current = streak
  const streakKey = roomCode && playerId ? streakStorageKey(roomCode, playerId, startedAt) : null
  useEffect(() => {
    if (!streakKey || typeof window === 'undefined') return
    try {
      const saved = Number(window.sessionStorage.getItem(streakKey) ?? '0')
      setStreak(Number.isFinite(saved) ? Math.max(0, saved) : 0)
    } catch {
      setStreak(0)
    }
  }, [streakKey])
  useEffect(() => {
    if (!streakKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(streakKey, String(streak))
    } catch {
      // 비공개 모드 등 — 새로고침 복구만 포기한다
    }
  }, [streak, streakKey])

  // ─── 필살기 · 타격 팝업 · 사건 배너 ───
  const skill = useRaidSkill(startedAt, isPlaying, activePlayers, raidState)
  const skillRef = useRef(skill)
  skillRef.current = skill
  const { hits, pushHit } = useRaidHitPopups(activePlayers, isPlaying, playerId)
  const events = useRaidEvents(raidState, skill, isPlaying, (kind) => {
    if (kind === 'boss_defeated' || kind === 'shield_broken' || kind === 'skill_interrupted' || kind === 'skill_charge') playSFX('item')
  })

  // ─── 전부 쓰러뜨리면 내 화면은 결과로 (방의 finished 기록은 선생님 화면이 담당) ───
  useEffect(() => {
    if (!isPlaying || !raidState.allDefeated || raidState.roster.length === 0) return
    if (currentView === 'result') return
    setCurrentView('result')
  }, [currentView, isPlaying, raidState.allDefeated, raidState.roster.length, setCurrentView])

  // ─── 퀴즈 창 (아레나 위에 뜨고, 열려 있는 동안 내 아레나는 멈춘다) ───
  const [quizOpen, setQuizOpen] = useState(false)
  const [lastHit, setLastHit] = useState<RaidHitBreakdown | null>(null)
  /** 직전 정답으로 받은 물풍선 수 (정답 연출용) */
  const [lastBalloons, setLastBalloons] = useState(0)
  const nextQuestionTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (nextQuestionTimerRef.current) window.clearTimeout(nextQuestionTimerRef.current)
  }, [])

  const openQuiz = useCallback(() => {
    if (currentView !== 'quiz' && currentView !== 'wrong') return
    setQuizOpen(true)
  }, [currentView])

  const closeQuiz = useCallback(() => {
    setQuizOpen(false)
  }, [])

  const goToNextQuiz = useCallback(() => {
    if (nextQuestionTimerRef.current) {
      window.clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }
    setLastBalloons(0)
    setQuizOpen(false)
    goToNextQuestion()
  }, [goToNextQuestion])

  const arenaRef = useRef<RaidArenaHandle | null>(null)

  const handleAnswerSubmit = useCallback(async (answer: string): Promise<boolean> => {
    if (!playerId) return false
    const correct = await checkAnswer(answer)

    if (!correct) {
      playSFX('incorrect')
      setStreak(0)
      handleWrongAnswer()
      return false
    }

    playSFX('correct')
    const nextStreak = streakRef.current + 1
    setStreak(nextStreak)
    const granted = getBalloonsPerAnswer(roleRef.current, nextStreak)
    setLastBalloons(granted)
    arenaRef.current?.grantBalloons(granted)
    try {
      // 명중(gold)이 아니라 "맞힌 문제 수"는 answer_history 가 가진다. 여기서는 아무 점수도 쓰지 않는다
    } finally {
      nextQuestionTimerRef.current = window.setTimeout(() => {
        nextQuestionTimerRef.current = null
        goToNextQuiz()
      }, RAID.NEXT_QUESTION_DELAY_MS)
    }
    return true
  }, [checkAnswer, goToNextQuiz, handleWrongAnswer, playSFX, playerId])

  // 오답 뒤 훅이 다음 문제로 넘기면(currentView 가 wrong → quiz) 퀴즈 창은 닫는다
  const previousViewRef = useRef(currentView)
  useEffect(() => {
    if (previousViewRef.current === 'wrong' && currentView === 'quiz') setQuizOpen(false)
    previousViewRef.current = currentView
  }, [currentView])

  // ─── 아레나 사건 → 데미지 ───
  const currentPlayerRef = useRef(currentPlayer)
  currentPlayerRef.current = currentPlayer

  const commitDamage = useCallback(async (deltas: PlayerDeltas, reason: string) => {
    if (!playerId) return
    try {
      await commitPlayerDelta(playerId, deltas, { reason })
    } catch (error) {
      console.error('펭귄 공격 저장 실패:', error)
    }
  }, [commitPlayerDelta, playerId])

  const handleArenaEvent = useCallback((event: ArenaEvent) => {
    if (event.type === 'boss_hit') {
      const currentSkill = skillRef.current
      const currentRole = roleRef.current
      const hit = computeHitDamage({ role: currentRole, streak: streakRef.current, groggy: currentSkill.phase === 'groggy' })
      const deltas: PlayerDeltas = { score: hit.damage, gold: 1 }
      const me = currentPlayerRef.current

      // 필살기 예고 중이고 이번 필살기에 아직 기여하지 않았으면 끊기 기여 (revival_streak = 주기 번호 + 1)
      const myInterrupt = Math.max(0, me?.revival_streak ?? 0)
      if (currentSkill.inChargeWindow && currentSkill.cycle >= 0 && myInterrupt < currentSkill.cycle + 1) {
        deltas.revival_streak = currentSkill.cycle + 1 - myInterrupt
      }
      // 방패가 올라와 있고 아직 이 방패에 기여하지 않았으면 기여 표시 (defense = 보스 순번 + 1)
      const boss = raidStateRef.current.current
      const myDefense = Math.max(0, me?.defense ?? 0)
      if (boss && boss.shield.active && !boss.shield.broken && myDefense < boss.def.index + 1) {
        deltas.defense = boss.def.index + 1 - myDefense
      }

      setLastHit(hit)
      window.setTimeout(() => setLastHit((prev) => (prev === hit ? null : prev)), 1500)
      arenaRef.current?.showBossDamage(hit.damage, hit.multiplier > 1)
      pushHit({ damage: hit.damage, nickname: null, mine: true, groggy: hit.multiplier > 1, comboBonus: hit.comboBonus, role: currentRole })
      playSFX('item')
      void commitDamage(deltas, 'raid_hit')
      return
    }
    if (event.type === 'snowman_killed') {
      // 부하가 쓰러지면 펭귄의 힘이 조금 빠진다 (position = 깬 스노우몬 수, 결과 칭호용)
      playSFX('item')
      pushHit({ damage: ARENA.SNOWMAN_KILL_DAMAGE, nickname: null, mine: true, groggy: false, comboBonus: 0, role: roleRef.current })
      void commitDamage({ score: ARENA.SNOWMAN_KILL_DAMAGE, position: 1 }, 'raid_snowman')
      return
    }
    if (event.type === 'egg_crushed') {
      void commitDamage({ score: ARENA.EGG_CRUSH_DAMAGE }, 'raid_egg')
      return
    }
    if (event.type === 'balloon_placed') {
      playSFX('click')
      return
    }
    if (event.type === 'trapped') {
      playSFX('incorrect')
      return
    }
    if (event.type === 'item' || event.type === 'guarded') {
      playSFX('item')
    }
  }, [commitDamage, playSFX, pushHit])

  const handleRaidCountdownComplete = useCallback(() => {
    handleCountdownComplete()
  }, [handleCountdownComplete])

  return {
    ...base,
    isPlaying,
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
  }
}
