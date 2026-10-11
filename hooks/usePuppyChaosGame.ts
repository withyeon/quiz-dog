'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DodgeResult } from '@/components/강아지대소동/강아지대소동MiniGame'
import { useGameBase } from '@/hooks/useGameBase'
import {
  BONE_CARD_SCORE,
  BONUS_ROUND_BASE_REWARD,
  BONUS_ROUND_SECONDS,
  CARD_PICK_SECONDS,
  COMBO_STEPS,
  CORRECT_ROUND_BASE_REWARD,
  CORRECT_ROUND_SCORE,
  CORRECT_ROUND_SECONDS,
  GOLDEN_DOG_SCORE,
  MULTIPLIER_BIG,
  MULTIPLIER_SMALL,
  POOP_BOMB_SCORE,
  SCORE_THIEF_AMOUNT,
  WRONG_ROUND_BASE_REWARD,
  WRONG_ROUND_SECONDS,
  clampRoundReward,
  createPoopBombAttack,
  drawCardChoices,
  getComboMultiplier,
  parsePendingAttacks,
  type PuppyChaosCard,
} from '@/lib/game/강아지대소동'
import { createPuppyChaosEvent } from '@/lib/services/강아지대소동Events'
import { updatePlayer } from '@/lib/services/players'
import { checkQuestionAnswer } from '@/lib/services/questions'
import { sortPlayersByScore } from '@/lib/utils/playerSorting'

/** 콤보 이벤트(TV 알림)는 배수가 가장 높은 단계부터 알립니다 */
const COMBO_EVENT_STREAK = Math.max(...COMBO_STEPS.map((step) => step.streak))

export type Phase = 'waiting' | 'quiz' | 'cardSelect' | 'dodge' | 'roundResult' | 'bonus' | 'finalResult'

export type RoundContext = {
  correct: boolean
  isBonus: boolean
  questionIndex: number
  comboAfter: number
  scoreBeforeDodge: number
  baseReward: number
  durationSeconds: number
  multiplier: number
  umbrella: boolean
  cleaner: boolean
  invincible: boolean
  poopBombed: boolean
  cardLabel?: string
}

export type RoundSummary = {
  title: string
  scoreDelta: number
  dodgeReward: number
  hits: number
  bones: number
}

/**
 * 강아지 대소동 한 판의 상태와 규칙.
 * 퀴즈 → 랜덤박스 → 대소동 미니게임 → 결과 → (시간 끝) 보너스 → 최종 결과 단계 전환,
 * 콤보·카드 효과·똥폭탄/점수 도둑 공격, 제한 시간을 모두 여기서 처리하고
 * 페이지(app/puppy-chaos/page.tsx)는 돌려준 값으로 화면만 그린다.
 */
export function usePuppyChaosGame() {
  const {
    roomCode,
    playerId,
    players,
    room,
    currentPlayer,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    questions,
    questionsLoading,
    questionsError,
    questionSetTitle,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    isPreStartQuizComplete,
    handlePreStartQuizAnswer,
    goToNextQuestion,
    applyPlayerPatch,
    sendRoomEvent,
    sessionStartedAt,
  } = useGameBase({ expectedGameMode: 'poop_dodge', preStartQuizTotal: 0 })
  const [phase, setPhase] = useState<Phase>('waiting')
  const [combo, setCombo] = useState(0)
  const [cards, setCards] = useState<PuppyChaosCard[]>([])
  const [cardCountdown, setCardCountdown] = useState(CARD_PICK_SECONDS)
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null)
  const [isOpeningBox, setIsOpeningBox] = useState(false)
  const [roundContext, setRoundContext] = useState<RoundContext | null>(null)
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null)
  const [isSettling, setIsSettling] = useState(false)
  const [isAnswerLocked, setIsAnswerLocked] = useState(false)
  const [randomQuestionIndex, setRandomQuestionIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [hasTimeExpired, setHasTimeExpired] = useState(false)
  const [bonusCompleted, setBonusCompleted] = useState(false)

  const questionCount = questions.length
  const roomStatus = room?.status
  const isPaused = roomStatus === 'paused'
  const questionIndex = currentQuestionIndex
  const activeQuestion = questionCount > 0
    ? questions[randomQuestionIndex % questionCount]
    : null
  const durationSeconds = (room as { duration_seconds?: number | null } | null)?.duration_seconds ?? null
  // 제한 시간의 기준. 일반 방은 room.started_at, 과제 방은 이 학생이 게임에 들어간 시각.
  // 예전에는 room.started_at을 직접 써서 과제로 낸 방에서는 늦게 들어온 학생의 시간이
  // 선생님이 방을 만든 시각부터 흘러, 들어오자마자 끝나 있었다.
  const startedAt = sessionStartedAt
  const bonusSessionKey = useMemo(() => {
    if (!roomCode || !playerId || !startedAt) return null
    return `puppy_bonus_completed_${roomCode}_${playerId}_${startedAt}`
  }, [playerId, roomCode, startedAt])

  const pickRandomQuestionIndex = useCallback(() => {
    if (questionCount <= 0) return 0
    return Math.floor(Math.random() * questionCount)
  }, [questionCount])

  useEffect(() => {
    if (!currentPlayer) return
    setCurrentQuestionIndex(currentPlayer.current_question_index ?? 0)
    setCombo(currentPlayer.combo_count ?? 0)
  }, [currentPlayer, setCurrentQuestionIndex])

  useEffect(() => {
    if (questionCount <= 0) return
    setRandomQuestionIndex(pickRandomQuestionIndex())
  }, [pickRandomQuestionIndex, questionCount])

  useEffect(() => {
    if (!bonusSessionKey || typeof window === 'undefined') {
      setBonusCompleted(false)
      return
    }
    setBonusCompleted(window.sessionStorage.getItem(bonusSessionKey) === 'true')
  }, [bonusSessionKey])

  useEffect(() => {
    if (!bonusSessionKey || typeof window === 'undefined') return
    if (bonusCompleted) window.sessionStorage.setItem(bonusSessionKey, 'true')
  }, [bonusCompleted, bonusSessionKey])

  useEffect(() => {
    if (roomStatus !== 'playing' || !durationSeconds || !startedAt) {
      setRemainingSeconds(null)
      setHasTimeExpired(false)
      return
    }

    const startedMs = new Date(startedAt).getTime()
    if (!Number.isFinite(startedMs)) return

    const tick = () => {
      const elapsed = (Date.now() - startedMs) / 1000
      const remaining = Math.max(0, Math.ceil(durationSeconds - elapsed))
      setRemainingSeconds(remaining)
      setHasTimeExpired(remaining <= 0)
    }

    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [durationSeconds, roomStatus, startedAt])

  useEffect(() => {
    if (!room) return
    if (room.status === 'ended' || room.status === 'finished') {
      setPhase('finalResult')
      return
    }
    if (currentPlayer?.is_kicked) {
      setPhase('finalResult')
      return
    }
    if (room.status === 'waiting') {
      setPhase('waiting')
      return
    }
    if (room.status === 'playing' && !isPreStartQuizComplete) {
      return
    }
    if (room.status === 'playing' && phase === 'waiting' && questionCount > 0) {
      setPhase(hasTimeExpired ? (bonusCompleted ? 'finalResult' : 'bonus') : 'quiz')
    }
  }, [bonusCompleted, currentPlayer?.current_question_index, currentPlayer?.is_kicked, hasTimeExpired, isPreStartQuizComplete, phase, questionCount, room])

  useEffect(() => {
    if (roomStatus !== 'playing' || !isPreStartQuizComplete || !hasTimeExpired) return
    if (bonusCompleted) {
      if (phase !== 'finalResult') setPhase('finalResult')
      return
    }
    if (phase === 'waiting' || phase === 'quiz') {
      setPhase('bonus')
    }
  }, [bonusCompleted, hasTimeExpired, isPreStartQuizComplete, phase, roomStatus])

  useEffect(() => {
    if (phase !== 'roundResult' || !roundSummary) return
    const timer = window.setTimeout(() => {
      if (roundContext?.isBonus || bonusCompleted) {
        setPhase('finalResult')
      } else if (hasTimeExpired) {
        setPhase('bonus')
      } else {
        setPhase('quiz')
      }
    }, 1300)
    return () => window.clearTimeout(timer)
  }, [bonusCompleted, hasTimeExpired, phase, roundContext?.isBonus, roundSummary])

  const broadcastPlayerPatch = useCallback((targetPlayerId: string, patch: Record<string, unknown>, reason: string) => {
    applyPlayerPatch(targetPlayerId, patch)
    void sendRoomEvent('player:patch', {
      playerId: targetPlayerId,
      patch,
      reason,
    })
  }, [applyPlayerPatch, sendRoomEvent])

  const updatePlayerAndBroadcast = useCallback(async (
    targetPlayerId: string,
    patch: Record<string, unknown>,
    reason: string,
  ) => {
    broadcastPlayerPatch(targetPlayerId, patch, reason)
    await updatePlayer(targetPlayerId, patch)
  }, [broadcastPlayerPatch])

  const beginDodge = useCallback(async (context: Omit<RoundContext, 'poopBombed'>) => {
    if (!currentPlayer) return
    const latestSelf = players.find((player) => player.id === currentPlayer.id) ?? currentPlayer
    const attacks = parsePendingAttacks(latestSelf.pending_attacks)
    const poopBombed = attacks.some((attack) => attack.type === 'poop_bomb')

    if (attacks.length > 0) {
      await updatePlayerAndBroadcast(currentPlayer.id, { pending_attacks: [] }, 'poop_dodge_attack_consumed')
    }

    setRoundContext({ ...context, poopBombed })
    setPhase('dodge')
  }, [currentPlayer, players, updatePlayerAndBroadcast])

  const handleAnswer = async (answer: string) => {
    if (!currentPlayer || !activeQuestion || roomStatus !== 'playing' || isAnswerLocked) return false
    if (hasTimeExpired) {
      setPhase(bonusCompleted ? 'finalResult' : 'bonus')
      return false
    }

    setIsAnswerLocked(true)
    const submittedAnswer = String(answer).trim()
    let correct = false
    if (submittedAnswer) {
      try {
        correct = await checkQuestionAnswer(activeQuestion.id, submittedAnswer)
      } catch (error) {
        console.error('강아지 대소동 채점 오류, 오답 처리함:', error)
      }
    }

    const comboAfter = correct ? combo + 1 : 0
    setCombo(comboAfter)

    if (correct && comboAfter >= COMBO_EVENT_STREAK) {
      void createPuppyChaosEvent({
        session_id: roomCode,
        type: 'combo',
        actor_nickname: currentPlayer.nickname,
        payload: { combo: comboAfter },
      })
    }

    if (correct) {
      setCards(drawCardChoices())
      setSelectedBoxIndex(null)
      setIsOpeningBox(false)
      setRoundContext({
        correct,
        isBonus: false,
        questionIndex,
        comboAfter,
        scoreBeforeDodge: CORRECT_ROUND_SCORE,
        baseReward: CORRECT_ROUND_BASE_REWARD,
        durationSeconds: CORRECT_ROUND_SECONDS,
        multiplier: getComboMultiplier(comboAfter),
        umbrella: false,
        cleaner: false,
        invincible: false,
        poopBombed: false,
      })
      setPhase('cardSelect')
      return true
    }

    await beginDodge({
      correct,
      isBonus: false,
      questionIndex,
      comboAfter,
      scoreBeforeDodge: 0,
      baseReward: WRONG_ROUND_BASE_REWARD,
      durationSeconds: WRONG_ROUND_SECONDS,
      multiplier: 1,
      umbrella: false,
      cleaner: false,
      invincible: false,
    })
    return false
  }

  const handleCardSelect = useCallback(async (card: PuppyChaosCard) => {
    if (!currentPlayer || !roundContext || phase !== 'cardSelect') return

    let scoreBeforeDodge = roundContext.scoreBeforeDodge
    let multiplier = roundContext.multiplier
    let umbrella = roundContext.umbrella
    let cleaner = roundContext.cleaner
    let invincible = roundContext.invincible

    if (card.id === 'umbrella') umbrella = true
    if (card.id === 'bone') scoreBeforeDodge += BONE_CARD_SCORE
    if (card.id === 'multiplier_1_5') multiplier *= MULTIPLIER_SMALL
    if (card.id === 'multiplier_2') multiplier *= MULTIPLIER_BIG
    if (card.id === 'cleaner') cleaner = true

    if (card.id === 'golden_dog') {
      scoreBeforeDodge += GOLDEN_DOG_SCORE
      invincible = true
      void createPuppyChaosEvent({
        session_id: roomCode,
        type: 'legendary',
        actor_nickname: currentPlayer.nickname,
        payload: { card: card.id },
      })
    }

    if (card.id === 'poop_bomb') {
      scoreBeforeDodge += POOP_BOMB_SCORE
      const target = sortPlayersByScore(players.filter((player) => player.id !== currentPlayer.id && !player.is_kicked))[0]
      if (target) {
        const pending = parsePendingAttacks(target.pending_attacks)
        await updatePlayerAndBroadcast(target.id, {
          pending_attacks: [...pending, createPoopBombAttack(currentPlayer.nickname)],
        }, 'poop_dodge_poop_bomb')
        void createPuppyChaosEvent({
          session_id: roomCode,
          type: 'attack_poop',
          actor_nickname: currentPlayer.nickname,
          target_nickname: target.nickname,
          payload: { bonus: POOP_BOMB_SCORE },
        })
      }
    }

    if (card.id === 'score_thief') {
      const candidates = players.filter((player) => player.id !== currentPlayer.id && !player.is_kicked)
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      if (target) {
        scoreBeforeDodge += SCORE_THIEF_AMOUNT
        await updatePlayerAndBroadcast(target.id, {
          score: (target.score ?? 0) - SCORE_THIEF_AMOUNT,
        }, 'poop_dodge_score_thief')
        void createPuppyChaosEvent({
          session_id: roomCode,
          type: 'attack_steal',
          actor_nickname: currentPlayer.nickname,
          target_nickname: target.nickname,
          payload: { amount: SCORE_THIEF_AMOUNT },
        })
      }
    }

    await beginDodge({
      ...roundContext,
      scoreBeforeDodge,
      multiplier,
      umbrella,
      cleaner,
      invincible,
      cardLabel: card.label,
    })
  }, [beginDodge, currentPlayer, phase, players, roomCode, roundContext, updatePlayerAndBroadcast])

  const handleRandomBoxSelect = useCallback((boxIndex: number) => {
    if (phase !== 'cardSelect' || isOpeningBox || !cards[boxIndex]) return

    setSelectedBoxIndex(boxIndex)
    setIsOpeningBox(true)

    window.setTimeout(() => {
      void handleCardSelect(cards[boxIndex])
    }, 950)
  }, [cards, handleCardSelect, isOpeningBox, phase])

  useEffect(() => {
    if (phase !== 'cardSelect' || cards.length === 0) return
    setCardCountdown(CARD_PICK_SECONDS)
    const interval = window.setInterval(() => {
      setCardCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(interval)
          handleRandomBoxSelect(Math.floor(Math.random() * cards.length))
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [cards, handleRandomBoxSelect, phase])

  const handleBonusStart = async () => {
    if (!currentPlayer || roomStatus !== 'playing') return
    await beginDodge({
      correct: true,
      isBonus: true,
      questionIndex,
      comboAfter: combo,
      scoreBeforeDodge: 0,
      baseReward: BONUS_ROUND_BASE_REWARD,
      durationSeconds: BONUS_ROUND_SECONDS,
      multiplier: 1,
      umbrella: false,
      cleaner: false,
      invincible: false,
    })
  }

  const handleDodgeComplete = async (result: DodgeResult) => {
    if (!currentPlayer || !roundContext || isSettling) return
    setIsSettling(true)

    const dodgeReward = clampRoundReward(result.reward)
    const totalDelta = roundContext.scoreBeforeDodge + dodgeReward
    const nextQuestionIndex = roundContext.isBonus
      ? questionIndex
      : Math.min(questionCount, questionIndex + 1)
    const nextScore = (currentPlayer.score ?? 0) + totalDelta

    try {
      await updatePlayerAndBroadcast(currentPlayer.id, {
        score: nextScore,
        current_question_index: nextQuestionIndex,
        combo_count: roundContext.comboAfter,
        has_umbrella: false,
      }, 'poop_dodge_round_complete')

      if (!roundContext.isBonus) {
        goToNextQuestion()
        setRandomQuestionIndex(pickRandomQuestionIndex())
      } else {
        setBonusCompleted(true)
        setCurrentQuestionIndex(nextQuestionIndex)
      }
      setRoundSummary({
        title: roundContext.isBonus
          ? '보너스 성공!'
          : roundContext.correct
            ? '정답! 살아남았어요!'
            : '다음엔 맞힐 수 있어요!',
        scoreDelta: totalDelta,
        dodgeReward,
        hits: result.hits,
        bones: result.bones,
      })
      setPhase('roundResult')
    } finally {
      setIsSettling(false)
      setIsAnswerLocked(false)
    }
  }

  return {
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
    // 단계·상태
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
    // 핸들러
    handleAnswer,
    handleRandomBoxSelect,
    handleBonusStart,
    handleDodgeComplete,
  }
}
