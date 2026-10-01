'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGameBase } from '@/hooks/useGameBase'
import { useRaidEvents, useRaidFrenzyClock, useRaidHitPopups } from '@/hooks/useRaidEffects'
import { updatePlayer } from '@/lib/services/players'
import type { PlayerDeltas } from '@/lib/services/playerMutations'
import {
  RAID,
  computeHitDamage,
  computeRaidState,
  getRaidFrenzyState,
  getRaidRole,
  parseRaidSettings,
  type RaidHitBreakdown,
  type RaidRole,
} from '@/lib/game/raid'

export type { RaidEvent, RaidEventKind, RaidHitPopup } from '@/hooks/useRaidEffects'

function streakStorageKey(roomCode: string, playerId: string, startedAt: string | null) {
  return `raid_streak_${roomCode}_${playerId}_${startedAt ?? ''}`
}

/**
 * 황제 펭귄을 막아라!의 게임 로직 훅.
 *
 * 방·플레이어·퀴즈 흐름은 useGameBase 가 맡고, 이 훅은 그 위에 레이드 고유의 상태를 얹는다:
 * 역할 선택, 정답 → 데미지 계산 → 원자적 증분, 연속 정답, 집중 공격 시계, 방패 기여,
 * 사건 배너와 타격 팝업(useRaidEffects). 보스 상태 자체는 lib/game/raid.ts 가 players 행에서
 * 유도하므로 여기서 따로 들고 있지 않다 — 선생님 대시보드도 같은 함수로 같은 보스를 본다.
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
  // 플레이어 행이 로드된 뒤에도 역할이 없으면 고르게 한다 (새로고침·도중 입장 포함)
  const needsRole = isPlaying && currentPlayer !== null && !role && currentView !== 'result'

  const handleRoleSelect = useCallback(async (next: RaidRole) => {
    if (!playerId) return
    setSelectedRole(next)
    playSFX('click')
    try {
      await updatePlayer(playerId, { player_class: next })
    } catch (error) {
      console.error('역할 저장 실패:', error)
    }
  }, [playSFX, playerId])

  // ─── 연속 정답 (새로고침해도 이어지도록 sessionStorage) ───
  const [streak, setStreak] = useState(0)
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

  // ─── 집중 공격 시계 · 타격 팝업 · 사건 배너 ───
  const frenzy = useRaidFrenzyClock(startedAt, isPlaying, getRaidFrenzyState)
  const frenzyRef = useRef(frenzy)
  frenzyRef.current = frenzy
  const { hits, pushHit } = useRaidHitPopups(activePlayers, isPlaying, playerId)
  const events = useRaidEvents(raidState, frenzy, isPlaying, (kind) => {
    if (kind === 'boss_defeated' || kind === 'shield_broken' || kind === 'frenzy_start') playSFX('item')
  })

  // ─── 전부 쓰러뜨리면 내 화면은 결과로 (방의 finished 기록은 선생님 화면이 담당) ───
  useEffect(() => {
    if (!isPlaying || !raidState.allDefeated || raidState.roster.length === 0) return
    if (currentView === 'result') return
    setCurrentView('result')
  }, [currentView, isPlaying, raidState.allDefeated, raidState.roster.length, setCurrentView])

  // ─── 정답 → 데미지 ───
  const [lastHit, setLastHit] = useState<RaidHitBreakdown | null>(null)
  const nextQuestionTimerRef = useRef<number | null>(null)
  useEffect(() => () => {
    if (nextQuestionTimerRef.current) window.clearTimeout(nextQuestionTimerRef.current)
  }, [])

  const goToNextQuiz = useCallback(() => {
    if (nextQuestionTimerRef.current) {
      window.clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }
    setLastHit(null)
    goToNextQuestion()
  }, [goToNextQuestion])

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
    const nextStreak = streak + 1
    setStreak(nextStreak)

    const hit = computeHitDamage({ role, streak: nextStreak, frenzyActive: frenzyRef.current.active })
    const deltas: PlayerDeltas = { score: hit.damage, gold: 1 }

    // 방패가 올라와 있고 아직 이 방패에 기여하지 않았으면 기여 표시 (defense = 보스 순번 + 1)
    const boss = raidStateRef.current.current
    const myDefense = Math.max(0, currentPlayer?.defense ?? 0)
    if (boss && boss.shield.active && !boss.shield.broken && myDefense < boss.def.index + 1) {
      deltas.defense = boss.def.index + 1 - myDefense
    }

    setLastHit(hit)
    pushHit({ damage: hit.damage, nickname: null, mine: true, frenzy: hit.multiplier > 1, comboBonus: hit.comboBonus })

    try {
      await commitPlayerDelta(playerId, deltas, { reason: 'raid_hit' })
    } catch (error) {
      console.error('펭귄 공격 저장 실패:', error)
    }

    nextQuestionTimerRef.current = window.setTimeout(() => {
      nextQuestionTimerRef.current = null
      goToNextQuiz()
    }, RAID.NEXT_QUESTION_DELAY_MS)
    return true
  }, [checkAnswer, commitPlayerDelta, currentPlayer?.defense, goToNextQuiz, handleWrongAnswer, playSFX, playerId, pushHit, role, streak])

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
    frenzy,
    role,
    needsRole,
    streak,
    hits,
    events,
    lastHit,
    handleRoleSelect,
    handleRaidCountdownComplete,
    handleAnswerSubmit,
    goToNextQuiz,
  }
}
