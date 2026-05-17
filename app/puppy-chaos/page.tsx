'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import DodgeMiniGame, { type DodgeResult } from '@/components/강아지대소동/강아지대소동MiniGame'
import GameCard from '@/components/강아지대소동/GameCard'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import {
  DUMMY_QUESTIONS,
  clampRoundReward,
  createPoopBombAttack,
  drawCardChoices,
  getComboMultiplier,
  parsePendingAttacks,
  type PuppyChaosCard,
} from '@/lib/game/강아지대소동'
import { createPuppyChaosEvent } from '@/lib/services/강아지대소동Events'
import { updatePlayer } from '@/lib/services/players'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type Phase = 'waiting' | 'quiz' | 'cardSelect' | 'dodge' | 'roundResult' | 'bonus' | 'finalResult'

type RoundContext = {
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

type RoundSummary = {
  title: string
  scoreDelta: number
  dodgeReward: number
  hits: number
}

function sortByScore(players: Player[]) {
  return [...players].sort((a, b) => {
    const scoreCompare = (b.score ?? 0) - (a.score ?? 0)
    if (scoreCompare !== 0) return scoreCompare
    return String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
  })
}

function PomeMascot({ className = 'h-20 w-20' }: { className?: string }) {
  return (
    <img
      src="/mascot_pome.png"
      alt="퀴즈독 마스코트"
      className={`inline-block object-contain drop-shadow-md ${className}`}
    />
  )
}

function PuppyChaosPageContent() {
  const searchParams = useSearchParams()
  const roomCode = searchParams?.get('room') ?? ''
  const playerId = searchParams?.get('playerId') ?? ''

  const [phase, setPhase] = useState<Phase>('waiting')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [combo, setCombo] = useState(0)
  const [cards, setCards] = useState<PuppyChaosCard[]>([])
  const [cardCountdown, setCardCountdown] = useState(5)
  const [roundContext, setRoundContext] = useState<RoundContext | null>(null)
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null)
  const [isSettling, setIsSettling] = useState(false)

  const { players, refreshPlayers, applyPlayerPatch } = usePlayersRealtime({ roomCode, enabled: Boolean(roomCode) })
  const { room, refreshRoom } = useRoomRealtime({ roomCode, enabled: Boolean(roomCode) })
  const resync = useCallback(async (reason?: string) => {
    if (reason === 'broadcast_hint') return
    await Promise.all([
      refreshRoom({ silent: true }),
      refreshPlayers({ silent: true }),
    ])
  }, [refreshPlayers, refreshRoom])
  const { sendEvent } = useRoomChannel({
    roomCode,
    playerId,
    role: 'student',
    enabled: Boolean(roomCode && playerId),
    onResyncNeeded: resync,
  })

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === playerId) ?? null,
    [playerId, players],
  )
  const currentQuestion = DUMMY_QUESTIONS[questionIndex % DUMMY_QUESTIONS.length]
  const roomStatus = room?.status
  const isPaused = roomStatus === 'paused'

  useEffect(() => {
    if (!currentPlayer) return
    setQuestionIndex(currentPlayer.current_question_index ?? 0)
    setCombo(currentPlayer.combo_count ?? 0)
  }, [currentPlayer?.id])

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
    if (room.status === 'playing' && phase === 'waiting') {
      setPhase((currentPlayer?.current_question_index ?? 0) >= DUMMY_QUESTIONS.length ? 'bonus' : 'quiz')
    }
  }, [currentPlayer?.current_question_index, currentPlayer?.is_kicked, phase, room])

  useEffect(() => {
    if (phase !== 'roundResult' || !roundSummary) return
    const timer = window.setTimeout(() => {
      if (questionIndex >= DUMMY_QUESTIONS.length) {
        setPhase('bonus')
      } else {
        setPhase('quiz')
      }
    }, 1300)
    return () => window.clearTimeout(timer)
  }, [phase, questionIndex, roundSummary])

  const broadcastPlayerPatch = useCallback((targetPlayerId: string, patch: Record<string, unknown>, reason: string) => {
    applyPlayerPatch(targetPlayerId, patch)
    void sendEvent('player:patch', {
      playerId: targetPlayerId,
      patch,
      reason,
    })
    void sendEvent('room:snapshot-hint', { reason })
  }, [applyPlayerPatch, sendEvent])

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

  const handleAnswer = async (choiceIndex: number) => {
    if (!currentPlayer || roomStatus !== 'playing') return
    const correct = currentQuestion.answerIndex === choiceIndex
    const comboAfter = correct ? combo + 1 : 0
    setCombo(comboAfter)

    if (correct && comboAfter >= 5) {
      void createPuppyChaosEvent({
        session_id: roomCode,
        type: 'combo',
        actor_nickname: currentPlayer.nickname,
        payload: { combo: comboAfter },
      })
    }

    if (correct) {
      setCards(drawCardChoices())
      setRoundContext({
        correct,
        isBonus: false,
        questionIndex,
        comboAfter,
        scoreBeforeDodge: 100,
        baseReward: 50,
        durationSeconds: 7,
        multiplier: getComboMultiplier(comboAfter),
        umbrella: false,
        cleaner: false,
        invincible: false,
        poopBombed: false,
      })
      setPhase('cardSelect')
      return
    }

    await beginDodge({
      correct,
      isBonus: false,
      questionIndex,
      comboAfter,
      scoreBeforeDodge: 0,
      baseReward: 20,
      durationSeconds: 4,
      multiplier: 1,
      umbrella: false,
      cleaner: false,
      invincible: false,
    })
  }

  const handleCardSelect = useCallback(async (card: PuppyChaosCard) => {
    if (!currentPlayer || !roundContext || phase !== 'cardSelect') return

    let scoreBeforeDodge = roundContext.scoreBeforeDodge
    let multiplier = roundContext.multiplier
    let umbrella = roundContext.umbrella
    let cleaner = roundContext.cleaner
    let invincible = roundContext.invincible

    if (card.id === 'umbrella') umbrella = true
    if (card.id === 'bone') scoreBeforeDodge += 50
    if (card.id === 'multiplier_1_5') multiplier *= 1.5
    if (card.id === 'multiplier_2') multiplier *= 2
    if (card.id === 'cleaner') cleaner = true

    if (card.id === 'golden_dog') {
      scoreBeforeDodge += 500
      invincible = true
      void createPuppyChaosEvent({
        session_id: roomCode,
        type: 'legendary',
        actor_nickname: currentPlayer.nickname,
        payload: { card: card.id },
      })
    }

    if (card.id === 'poop_bomb') {
      scoreBeforeDodge += 80
      const target = sortByScore(players.filter((player) => player.id !== currentPlayer.id && !player.is_kicked))[0]
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
          payload: { bonus: 80 },
        })
      }
    }

    if (card.id === 'score_thief') {
      const candidates = players.filter((player) => player.id !== currentPlayer.id && !player.is_kicked)
      const target = candidates[Math.floor(Math.random() * candidates.length)]
      if (target) {
        scoreBeforeDodge += 50
        await updatePlayerAndBroadcast(target.id, {
          score: (target.score ?? 0) - 50,
        }, 'poop_dodge_score_thief')
        void createPuppyChaosEvent({
          session_id: roomCode,
          type: 'attack_steal',
          actor_nickname: currentPlayer.nickname,
          target_nickname: target.nickname,
          payload: { amount: 50 },
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
      cardLabel: `${card.label} ${card.emoji}`,
    })
  }, [beginDodge, currentPlayer, phase, players, roomCode, roundContext, updatePlayerAndBroadcast])

  useEffect(() => {
    if (phase !== 'cardSelect' || cards.length === 0) return
    setCardCountdown(5)
    const interval = window.setInterval(() => {
      setCardCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(interval)
          void handleCardSelect(cards[0])
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [cards, handleCardSelect, phase])

  const handleBonusStart = async () => {
    if (!currentPlayer || roomStatus !== 'playing') return
    await beginDodge({
      correct: true,
      isBonus: true,
      questionIndex,
      comboAfter: combo,
      scoreBeforeDodge: 0,
      baseReward: 25,
      durationSeconds: 5,
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
      : Math.min(DUMMY_QUESTIONS.length, questionIndex + 1)
    const nextScore = (currentPlayer.score ?? 0) + totalDelta

    try {
      await updatePlayerAndBroadcast(currentPlayer.id, {
        score: nextScore,
        current_question_index: nextQuestionIndex,
        combo_count: roundContext.comboAfter,
        has_umbrella: false,
      }, 'poop_dodge_round_complete')

      setQuestionIndex(nextQuestionIndex)
      setRoundSummary({
        title: roundContext.isBonus
          ? '보너스 성공!'
          : roundContext.correct
            ? '정답! 살아남았어요!'
            : '다음엔 맞힐 수 있어요!',
        scoreDelta: totalDelta,
        dodgeReward,
        hits: result.hits,
      })
      setPhase('roundResult')
    } finally {
      setIsSettling(false)
    }
  }

  if (!roomCode || !playerId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sky-100 p-6">
        <div className="rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center text-2xl font-black shadow-[6px_6px_0_#0f172a]">
          입장 정보가 없어요. QR로 다시 들어와 주세요.
        </div>
      </main>
    )
  }

  if (!currentPlayer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sky-100 p-6">
        <div className="rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center text-2xl font-black shadow-[6px_6px_0_#0f172a]">
          강아지를 찾는 중...
        </div>
      </main>
    )
  }

  const score = currentPlayer.score ?? 0
  const progressLabel = `${Math.min(questionIndex + 1, DUMMY_QUESTIONS.length)}/${DUMMY_QUESTIONS.length}`

  return (
    <main className="min-h-screen bg-[#E0F2FE] p-4 text-slate-950" style={{ fontFamily: 'BMJUA, sans-serif' }}>
      <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-3xl flex-col gap-4">
        <header className="rounded-[28px] border-4 border-slate-900 bg-white p-4 shadow-[5px_5px_0_#0f172a]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-sky-700">강아지 대소동</div>
              <div className="flex items-center gap-2 text-2xl font-black">
                <PomeMascot className="h-9 w-9" />
                {currentPlayer.nickname}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-black text-slate-500">내 점수</div>
              <div className="text-3xl font-black text-amber-600">{score.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm font-black">
            <div className="rounded-2xl bg-sky-100 px-3 py-2">문제 {progressLabel}</div>
            <div className="rounded-2xl bg-rose-100 px-3 py-2">{combo}콤보</div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {phase === 'waiting' && (
            <motion.section key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
              <div>
                <div className="mb-4 flex justify-center">
                  <PomeMascot className="h-24 w-24" />
                </div>
                <h1 className="text-4xl font-black">선생님이 시작하면 출발!</h1>
                <p className="mt-3 text-lg font-bold text-slate-500">TV 화면을 보고 잠깐만 기다려요.</p>
              </div>
            </motion.section>
          )}

          {phase === 'quiz' && currentQuestion && (
            <motion.section key={`quiz-${questionIndex}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="rounded-[28px] border-4 border-slate-900 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
              <div className="mb-5 rounded-[24px] bg-amber-100 p-5 text-center text-3xl font-black">
                {currentQuestion.question}
              </div>
              <div className="grid gap-3">
                {currentQuestion.choices.map((choice, index) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={roomStatus !== 'playing'}
                    onClick={() => void handleAnswer(index)}
                    className="rounded-[22px] border-4 border-slate-900 bg-white px-5 py-5 text-left text-2xl font-black shadow-[4px_4px_0_#0f172a] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#0f172a] disabled:opacity-60"
                  >
                    {index + 1}. {choice}
                  </button>
                ))}
              </div>
            </motion.section>
          )}

          {phase === 'cardSelect' && (
            <motion.section key="cards" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="rounded-[28px] border-4 border-slate-900 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
              <div className="mb-5 text-center">
                <div className="text-4xl font-black">카드 하나 고르기!</div>
                <div className="mt-2 text-lg font-black text-rose-600">{cardCountdown}초 후 첫 카드 자동 선택</div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {cards.map((card, index) => (
                  <GameCard key={`${card.id}-${index}`} card={card} onSelect={() => void handleCardSelect(card)} />
                ))}
              </div>
            </motion.section>
          )}

          {phase === 'dodge' && roundContext && (
            <motion.section key="dodge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-3 rounded-[24px] border-4 border-slate-900 bg-white p-4 text-center text-xl font-black shadow-[4px_4px_0_#0f172a]">
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

          {phase === 'roundResult' && roundSummary && (
            <motion.section key="round-result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
              <div>
                <div className="mb-3 flex justify-center">
                  {roundSummary.hits === 0 ? (
                    <div className="relative">
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-4xl">🏆</div>
                      <PomeMascot className="h-24 w-24" />
                    </div>
                  ) : (
                    <PomeMascot className="h-24 w-24" />
                  )}
                </div>
                <h2 className="text-4xl font-black">{roundSummary.title}</h2>
                <div className="mt-5 rounded-[24px] bg-amber-100 px-6 py-4 text-4xl font-black text-amber-700">
                  +{roundSummary.scoreDelta}
                </div>
                <p className="mt-3 text-lg font-bold text-slate-500">미니게임 보상 +{roundSummary.dodgeReward}</p>
              </div>
            </motion.section>
          )}

          {phase === 'bonus' && (
            <motion.section key="bonus" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
              <div>
                <div className="mb-4 text-7xl">🎁</div>
                <h2 className="text-4xl font-black">보너스 라운드!</h2>
                <p className="mt-3 text-lg font-bold text-slate-500">문제는 끝! 이제 마지막 대소동을 버티고 보너스 점수를 받아요.</p>
                <button
                  type="button"
                  onClick={() => void handleBonusStart()}
                  className="mt-6 rounded-[24px] border-4 border-slate-900 bg-emerald-400 px-8 py-5 text-3xl font-black shadow-[5px_5px_0_#0f172a]"
                >
                  보너스 시작
                </button>
              </div>
            </motion.section>
          )}

          {phase === 'finalResult' && (
            <motion.section key="final" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
              <div>
                <div className="mb-4 text-7xl">{currentPlayer.is_kicked ? '🚪' : '🏆'}</div>
                <h1 className="text-4xl font-black">{currentPlayer.is_kicked ? '게임에서 나갔어요' : '게임 종료!'}</h1>
                <div className="mt-6 rounded-[24px] bg-amber-100 px-8 py-5 text-5xl font-black text-amber-700">
                  {score.toLocaleString()}
                </div>
                <p className="mt-3 text-lg font-bold text-slate-500">최종 점수</p>
              </div>
            </motion.section>
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

export default function PuppyChaosPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-sky-100" />}>
      <PuppyChaosPageContent />
    </Suspense>
  )
}
