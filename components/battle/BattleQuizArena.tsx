'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Flame, Snowflake } from 'lucide-react'
import QuizView from '@/components/QuizView'
import SnowBattlefield from '@/components/battle/SnowBattlefield'
import type { AttackResult } from '@/lib/game/battleRoyale'
import type { BattlePlayer } from '@/hooks/useSnowBattleGame'
import type { ComponentProps } from 'react'

type Question = ComponentProps<typeof QuizView>['question']

type BattleQuizArenaProps = {
  players: BattlePlayer[]
  playerId: string
  currentQuestion: Question | null
  isPaused: boolean
  lockedTarget: string | null
  hasSnowball: boolean
  isReloading: boolean
  zoneLevel: number
  attackResult: AttackResult | null
  onTargetSelect: (targetId: string) => void
  onAnswer: (answer: string) => Promise<boolean>
  onCorrectClick: () => void
}

/** 본 경기 화면: 상태 안내 띠 + 전장(왼쪽) + 퀴즈(오른쪽, xl에서 고정). */
export default function BattleQuizArena({
  players,
  playerId,
  currentQuestion,
  isPaused,
  lockedTarget,
  hasSnowball,
  isReloading,
  zoneLevel,
  attackResult,
  onTargetSelect,
  onAnswer,
  onCorrectClick,
}: BattleQuizArenaProps) {
  return (
    <div className="space-y-4">
      {lockedTarget ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="battle-status-ready flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-center text-base font-black text-white"
        >
          <Crosshair className="h-5 w-5" />
          조준 완료! 퀴즈를 맞히면 즉시 발사됩니다
        </motion.div>
      ) : hasSnowball ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="battle-status-ready flex items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-center text-base font-black text-white"
        >
          <Crosshair className="h-5 w-5" />
          눈뭉치 준비 완료! 전장에서 상대를 누르면 바로 던집니다
        </motion.div>
      ) : isReloading ? (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="battle-frost-panel flex items-center justify-center gap-2 px-4 py-3 text-center text-base font-black text-slate-700"
        >
          <Snowflake className="h-5 w-5 text-cyan-600" />
          눈뭉치 장전 중
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="battle-frost-panel flex items-center justify-center gap-2 px-4 py-3 text-center text-base font-black text-slate-700"
        >
          <Crosshair className="h-5 w-5 text-rose-500" />
          전장에서 상대를 눌러 조준하고 퀴즈를 풀면 바로 날아갑니다
        </motion.div>
      )}

      {/*
        학생이 많으면 생존자 카드가 길게 늘어져 퀴즈가 화면 밖으로 밀린다.
        xl(1280px~, 크롬북·노트북·갤럭시탭 가로)에서는 아레나 왼쪽 + 퀴즈 오른쪽 고정(sticky),
        그보다 작은 화면에서는 아레나를 화면 높이의 45%까지만 보여주고 안에서 스크롤한다.
      */}
      <div className="grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <SnowBattlefield
          players={players}
          currentPlayerId={playerId}
          lockedTarget={lockedTarget}
          onTargetSelect={onTargetSelect}
          canAttack={(hasSnowball || (!isReloading && !hasSnowball))}
          zoneLevel={zoneLevel}
          className="h-[clamp(300px,48dvh,480px)] xl:h-[clamp(320px,calc(100dvh_-_330px),640px)]"
        />

        <div className="relative xl:sticky xl:top-4">
          <AnimatePresence>
            {attackResult && (
              <motion.div
                key={`${attackResult.targetId}-${attackResult.damage}`}
                initial={{ opacity: 0, y: -14, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className={`pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-center gap-2 rounded-[8px] px-4 py-2.5 text-center text-base font-black text-white shadow-xl ${
                  attackResult.isCritical
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'battle-status-ready'
                }`}
              >
                {attackResult.isCritical ? <Flame className="h-5 w-5" /> : <Snowflake className="h-5 w-5" />}
                {attackResult.isCritical ? '크리티컬 히트!' : '눈뭉치 명중!'}
                {' '}
                {players.find((p) => p.id === attackResult.targetId)?.nickname ?? '상대'} -{attackResult.damage}°
                {attackResult.itemType === 'giant_ball' && ' · 왕눈덩이'}
              </motion.div>
            )}
          </AnimatePresence>
          {currentQuestion ? (
            <QuizView
              question={currentQuestion}
              onAnswer={onAnswer}
              onCorrectClick={onCorrectClick}
              timeLimit={30}
              paused={isPaused}
              variant="glass"
              className="lg-panel lg-ink-outline font-bitbit mx-auto max-w-3xl p-5 sm:p-7"
            />
          ) : (
            <div className="battle-frost-panel p-8 text-center">
              <p className="font-bold text-slate-700">문제를 불러오는 중</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
