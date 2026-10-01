'use client'

import { motion } from 'framer-motion'
import QuizView from '@/components/QuizView'
import SnowBattlefield from '@/components/battle/SnowBattlefield'
import { REVIVAL_STREAK_REQUIRED } from '@/lib/game/battleRoyale'
import type { BattlePlayer } from '@/hooks/useSnowBattleGame'
import type { ComponentProps } from 'react'

type Question = ComponentProps<typeof QuizView>['question']

type EliminatedOverlayProps = {
  players: BattlePlayer[]
  playerId: string
  currentPlayer: BattlePlayer | null
  currentQuestion: Question | null
  isPaused: boolean
  zoneLevel: number
  onAnswer: (answer: string) => Promise<boolean>
  onCorrectClick: () => void
}

/**
 * 눈사람이 된 뒤 덮이는 전체 화면. 부활 게이지(3연속 정답)와 계속 풀 수 있는 퀴즈,
 * 그리고 구경만 하는 전장을 보여준다. AnimatePresence 안에서 쓴다.
 */
export default function EliminatedOverlay({
  players,
  playerId,
  currentPlayer,
  currentQuestion,
  isPaused,
  zoneLevel,
  onAnswer,
  onCorrectClick,
}: EliminatedOverlayProps) {
  const revivalStreak = currentPlayer?.revival_streak ?? 0
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col items-center [justify-content:safe_center] overflow-y-auto bg-slate-950/90 p-5"
    >
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mb-6 text-9xl"
      >
        ⛄
      </motion.div>
      <h2 className="mb-3 text-center text-5xl font-black text-white">눈사람이 되었습니다</h2>
      <p className="mb-6 text-center text-xl font-bold text-cyan-200">체온이 0°까지 떨어졌습니다</p>

      {/* 부활 진행도 — 3연속 정답으로 50% 체력 부활 */}
      <div className="mb-8 w-full max-w-md rounded-2xl border-2 border-amber-300/40 bg-amber-500/10 p-5">
        <div className="mb-2 flex items-center justify-between text-amber-200">
          <span className="text-sm font-black">🔥 부활 게이지</span>
          <span className="text-sm font-black tabular-nums">
            {revivalStreak} / {REVIVAL_STREAK_REQUIRED}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-950/60">
          <motion.div
            animate={{
              width: `${Math.min(100, (revivalStreak / REVIVAL_STREAK_REQUIRED) * 100)}%`,
            }}
            transition={{ duration: 0.4 }}
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
          />
        </div>
        <p className="mt-3 text-center text-xs font-bold text-amber-100">
          퀴즈를 3연속 맞히면 50% 체력으로 부활!
        </p>
      </div>

      {currentQuestion && (
        <div className="w-full max-w-3xl">
          <QuizView
            question={currentQuestion}
            onAnswer={onAnswer}
            onCorrectClick={onCorrectClick}
            timeLimit={30}
            paused={isPaused}
            variant="glass"
            className="lg-panel lg-ink-outline font-bitbit mx-auto p-5 sm:p-7"
          />
        </div>
      )}

      <div className="mt-6 w-full max-w-4xl">
        <p className="mb-4 text-center font-bold text-slate-400">전장은 계속됩니다</p>
        <SnowBattlefield
          players={players}
          currentPlayerId={playerId}
          zoneLevel={zoneLevel}
          className="h-[clamp(220px,32dvh,340px)]"
        />
      </div>
    </motion.div>
  )
}
