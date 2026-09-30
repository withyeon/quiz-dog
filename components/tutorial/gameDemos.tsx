'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { ComponentType } from 'react'
import type { GameModeId } from '@/lib/game/modes'
import {
  getAimGradeZoneWidth,
  ANSWER_SPEED_THRESHOLDS,
  DOLL_TYPES,
  MACHINE_RANK_THRESHOLDS,
  MAX_COMBO_STREAK,
  MAX_MACHINE_RANK,
  getAccuracyMultiplier,
  getAimGradeLabel,
  getAimTierFloor,
  getAnswerSpeedLabel,
  getComboState,
  getMachineRankName,
  getRankScoreMultiplier,
  getSpeedMultiplier,
  getTierColor,
  type DollTier,
  type MachineRank,
} from '@/lib/game/fishing'
import GoldQuestTutorialDemo from '@/components/GoldQuestTutorialDemo'
import BattleRoyaleTutorialDemo from '@/components/tutorial/BattleRoyaleTutorialDemo'
import MafiaTutorialDemo from '@/components/tutorial/MafiaTutorialDemo'
import DontLookDownTutorialDemo from '@/components/tutorial/DontLookDownTutorialDemo'
import ZombieTutorialDemo from '@/components/tutorial/ZombieTutorialDemo'
import TreatRushTutorialDemo from '@/components/tutorial/TreatRushTutorialDemo'
import FactoryTutorialDemo from '@/components/tutorial/FactoryTutorialDemo'
import CafeTutorialDemo from '@/components/tutorial/CafeTutorialDemo'
import PuppyChaosTutorialDemo from '@/components/tutorial/PuppyChaosTutorialDemo'
import TowerTutorialDemo from '@/components/tutorial/TowerTutorialDemo'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  type DemoPhase,
  type HudMetric,
  type HudChip,
} from '@/components/tutorial/TutorialDemoFrame'
import PixelIcon, { PIXEL_ICON } from '@/components/ui/PixelIcon'
import ItemGlyph from '@/components/ItemGlyph'

/* 공통 4단계(퀴즈→정답→액션→결과) 빌더 */
function buildPhases(captions: [string, string, string, string]): DemoPhase[] {
  return [
    { key: 'quiz', duration: 2000, step: 1, caption: captions[0] },
    { key: 'correct', duration: 1600, step: 2, caption: captions[1] },
    { key: 'action', duration: 2100, step: 3, caption: captions[2] },
    { key: 'result', duration: 2500, step: 4, caption: captions[3] },
  ]
}

/* score가 result에서 오르는 공통 metric */
function risingMetric(opts: { emoji?: string; icon?: string; base: number; gain: number; suffix: string }) {
  return (phase: string): HudMetric => {
    const isUp = phase === 'result'
    return {
      emoji: opts.emoji,
      icon: opts.icon,
      value: isUp ? opts.base + opts.gain : opts.base,
      from: isUp ? opts.base : undefined,
      suffix: opts.suffix,
    }
  }
}

const isAnswered = (phase: string) => phase === 'correct'
const isResult = (phase: string) => phase === 'result'

/* 무대 액션 패널 공통 래퍼 */
function Scene({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <StageCard id="scene" className={`relative w-full max-w-xl ${className}`}>
      {children}
    </StageCard>
  )
}

/* 큰 결과 뱃지 */
function ResultBadge({ show, text }: { show: boolean; text: string }) {
  if (!show) return null
  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 16 }}
      className="lg-banner-correct font-bitbit mx-auto mt-4 w-fit px-5 py-2 text-center text-base font-black text-white drop-shadow sm:text-lg"
    >
      {text}
    </motion.div>
  )
}

/* ─────────────── 1. 눈싸움 대작전 → components/tutorial/BattleRoyaleTutorialDemo.tsx ─────────────── */

/* ─────────────── 2. 두근두근 인형뽑기 ─────────────── */
/**
 * 실제 게임 흐름 그대로 재현합니다.
 *   (lib/game/fishing.ts · hooks/useFishingGame.ts · components/FishingMachine.tsx)
 * 장면 8개는 튜토리얼 규칙 8장과 1:1로 맞춰 두었습니다.
 * 선생님이 규칙을 넘기면 같은 번호의 장면이 뜹니다.
 * 화면에 나오는 숫자는 전부 상수에서 계산하므로 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */
const FISHING_TARGET = 50 // 조준 목표 위치(%) — 실제 게임에선 뽑기마다 무작위로 정해집니다
const FISHING_ANSWER_SECONDS = ANSWER_SPEED_THRESHOLDS.perfect - 1 // 번개 정답이 나오는 시간
const FISHING_DEMO_RANK: MachineRank = 3
const FISHING_AIM_ZONE = getAimGradeZoneWidth(FISHING_DEMO_RANK) // 데모 집게 등급에 맞는 조준 칸 폭
const FISHING_AIM_TIER_FLOOR = getAimTierFloor('perfect') ?? '특별' // 노란 칸에 맞혔을 때 보장되는 등급
const FISHING_TIERS: DollTier[] = ['기본', '인기', '특별', '보물']

/** 데모에서 뽑는 보물 인형 — 배경이 비치는 그림이라 무대 위에 얹어도 깔끔합니다 */
const FISHING_DEMO_DOLL = DOLL_TYPES.find((doll) => doll.image === '/fishing/16.webp') ?? DOLL_TYPES[DOLL_TYPES.length - 1]
const FISHING_DEMO_DOLL_IMAGE = FISHING_DEMO_DOLL.image ?? '/fishing/16.webp'
/** 바닥에 깔아 두는 인형들 — 가운데가 집게로 건져 올릴 인형입니다 */
const FISHING_FLOOR_DOLLS = ['/fishing/1.webp', '/fishing/6.webp', FISHING_DEMO_DOLL_IMAGE, '/fishing/4.webp', '/fishing/5.webp']

/**
 * 조준을 완벽히 맞히면(정확도 1.0) tryFishing 의 기본 점수가 maxScore 가 됩니다.
 * 거기에 정답 속도 · 조준 · 집게 등급 배수를 곱하는 것도 실제 계산과 같습니다.
 */
const FISHING_DEMO_SCORE = Math.round(
  FISHING_DEMO_DOLL.maxScore
    * getSpeedMultiplier(FISHING_ANSWER_SECONDS)
    * getAccuracyMultiplier(1)
    * getRankScoreMultiplier(FISHING_DEMO_RANK),
)

/** 점수는 인형을 건져 올릴 때 한 번 오릅니다. 실제 게임과 같은 흐름입니다. */
const FISHING_BASE_POINTS = 1200
const FISHING_TOTAL_POINTS = FISHING_BASE_POINTS + FISHING_DEMO_SCORE
const FISHING_POINTS_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: FISHING_BASE_POINTS },
  correct: { value: FISHING_BASE_POINTS },
  aim: { value: FISHING_BASE_POINTS },
  perfect: { value: FISHING_BASE_POINTS },
  catch: { value: FISHING_TOTAL_POINTS, from: FISHING_BASE_POINTS },
  combo: { value: FISHING_TOTAL_POINTS },
  rank: { value: FISHING_TOTAL_POINTS },
  score: { value: FISHING_TOTAL_POINTS },
}

/** 등급별 최고 점수 — 등급이 오를수록 점수가 확 커지는 걸 보여줍니다 */
function fishingTierMaxScore(tier: DollTier): number {
  return Math.max(...DOLL_TYPES.filter((doll) => doll.tier === tier).map((doll) => doll.maxScore))
}

/* 집게가 내려가 인형을 집어 올리는 한 사이클의 타이밍 */
const CLAW_GRAB_TIMES = [0, 0.28, 0.42, 0.72, 1]
const CLAW_GRAB_TRANSITION = { duration: 3.6, repeat: Infinity, times: CLAW_GRAB_TIMES } as const
const CLAW_DROP_DEPTH = 64

/** 정답 속도 표시 — 실제 화면에서 정답 직후 뜨는 "번개 정답" 과 같은 뜻 */
function FishingSpeedCounter({ answered }: { answered: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
      <div className="font-bitbit flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
        <span className="text-sm font-black text-white sm:text-base">
          <PixelIcon name="time" size={18} alt="" className="mr-1 inline-block align-[-4px]" />{answered ? `${FISHING_ANSWER_SECONDS}초 만에 정답` : '빨리 맞힐수록 점수 UP'}
        </span>
      </div>
      {answered && (
        <motion.span
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          className="font-bitbit rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-[#17262a] shadow-lg sm:text-base"
        >
          {getAnswerSpeedLabel('perfect')} ×{getSpeedMultiplier(FISHING_ANSWER_SECONDS)}
        </motion.span>
      )}
    </div>
  )
}

/**
 * 뽑기 기계 무대 — 조준 바 · 집게 · 바닥 인형.
 * 규칙 3·4·5 가 같은 무대를 쓰고 장면만 달라집니다.
 */
function ClawMachineScene({ mode }: { mode: 'aim' | 'perfect' | 'catch' }) {
  const isAiming = mode === 'aim'
  const isCatching = mode === 'catch'

  return (
    <StageCard id="claw-machine" className="w-full max-w-2xl">
      <div className="font-bitbit relative overflow-hidden rounded-3xl border border-white/25 bg-slate-900/60 p-3 shadow-2xl backdrop-blur-md">
        {/* 실제 게임 화면 위쪽에 뜨는 표시와 같은 것 */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-black text-white/85">
            {getMachineRankName(FISHING_DEMO_RANK)}
          </span>
          <motion.span
            key={isAiming ? 'moving' : 'locked'}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-full px-3 py-1 text-xs font-black ${
              isAiming ? 'bg-black/50 text-white/85' : 'bg-amber-400 text-[#17262a]'
            }`}
          >
            {isAiming ? '조준 중' : `조준 ${getAimGradeLabel('perfect')}`}
          </motion.span>
        </div>

        {/* 조준 바 — 가운데 노란 칸이 PERFECT */}
        <div className="relative mt-2 h-11 overflow-hidden rounded-xl border border-white/20 bg-white/10">
          <div
            className="absolute inset-y-0 -translate-x-1/2 border-x border-sky-300/60 bg-sky-400/25"
            style={{ left: `${FISHING_TARGET}%`, width: `${FISHING_AIM_ZONE.good}%` }}
          />
          <div
            className="absolute inset-y-0 -translate-x-1/2 border-x border-violet-300/60 bg-violet-400/30"
            style={{ left: `${FISHING_TARGET}%`, width: `${FISHING_AIM_ZONE.great}%` }}
          />
          <div
            className="absolute inset-y-0 -translate-x-1/2 border-x-2 border-amber-400 bg-amber-300/50"
            style={{ left: `${FISHING_TARGET}%`, width: `${FISHING_AIM_ZONE.perfect}%` }}
          />
          <span
            className="absolute top-1 -translate-x-1/2 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black text-[#17262a] shadow"
            style={{ left: `${FISHING_TARGET}%` }}
          >
            PERFECT
          </span>
          {/* 조준선 — 내리기를 누르면 그 자리에 멈춥니다 */}
          <motion.div
            className="absolute inset-y-0 w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]"
            style={{ left: `${FISHING_TARGET}%` }}
            animate={{ left: isAiming ? ['12%', '88%', '12%'] : `${FISHING_TARGET}%` }}
            transition={
              isAiming
                ? { duration: 2.6, repeat: Infinity, ease: 'linear' }
                : { type: 'spring', stiffness: 260, damping: 20 }
            }
          />
        </div>

        {/* 기계 안 — 실제 FishingMachine 과 같은 케이스 배경 위에 집게와 바닥 인형 */}
        <div className="relative mt-2 h-48 overflow-hidden rounded-2xl border border-white/25">
          <Image src="/fishing/machine/case-bg.webp" alt="" fill className="object-cover" sizes="640px" />
          <div className="absolute inset-x-2 bottom-1 flex items-end justify-around opacity-90">
            {['pink', 'purple', 'mint', 'gold', 'red', 'blue', 'shine'].map((tone, i) => (
              <Image key={tone} src={`/fishing/machine/box-${tone}.webp`} alt="" width={40} height={40} className="h-10 w-10 object-contain" style={{ transform: `rotate(${(i % 3) * 4 - 4}deg)` }} />
            ))}
          </div>
          {/* 바닥 인형들 */}
          <div className="absolute inset-x-3 bottom-2 flex items-end justify-around">
            {FISHING_FLOOR_DOLLS.map((src, i) => {
              const isTargetDoll = i === 2
              return (
                <motion.div
                  key={src}
                  className="relative h-14 w-14"
                  animate={isCatching && isTargetDoll ? { opacity: [1, 1, 0, 0, 0] } : { opacity: 1 }}
                  transition={isCatching && isTargetDoll ? CLAW_GRAB_TRANSITION : { duration: 0.2 }}
                >
                  <Image src={src} alt="" fill className="object-contain" sizes="56px" />
                </motion.div>
              )
            })}
          </div>

          {/* 집게 */}
          <motion.div
            className="absolute top-0 z-20 -ml-10 w-20"
            style={{ left: `${FISHING_TARGET}%` }}
            animate={{
              left: isAiming ? ['12%', '88%', '12%'] : `${FISHING_TARGET}%`,
              y: isCatching ? [0, CLAW_DROP_DEPTH, CLAW_DROP_DEPTH, 0, 0] : 0,
            }}
            transition={{
              left: isAiming
                ? { duration: 2.6, repeat: Infinity, ease: 'linear' }
                : { type: 'spring', stiffness: 260, damping: 20 },
              y: isCatching ? CLAW_GRAB_TRANSITION : { duration: 0.2 },
            }}
          >
            <div className="mx-auto h-7 w-0.5 rounded-b-full bg-slate-400/80" />
            <div className="relative mx-auto h-16 w-20">
              {/* 실제 기계의 집게 그림 — 잡을 때 닫힌 집게로 바뀐다 */}
              <motion.div
                className="absolute inset-x-0 top-0 h-14"
                animate={{ opacity: isCatching ? [1, 1, 0, 0, 0] : 1 }}
                transition={isCatching ? CLAW_GRAB_TRANSITION : { duration: 0.2 }}
              >
                <Image src="/fishing/machine/claw-open.webp" alt="" fill className="object-contain drop-shadow-lg" sizes="80px" />
              </motion.div>
              <motion.div
                className="absolute inset-x-0 top-0 h-14"
                animate={{ opacity: isCatching ? [0, 0, 1, 1, 1] : 0 }}
                transition={isCatching ? CLAW_GRAB_TRANSITION : { duration: 0.2 }}
              >
                <Image src="/fishing/machine/claw-closed.webp" alt="" fill className="object-contain drop-shadow-lg" sizes="80px" />
              </motion.div>
              {/* 집게에 매달려 올라오는 인형 */}
              {isCatching && (
                <motion.div
                  className="absolute left-1/2 top-[40px] h-14 w-14 -translate-x-1/2"
                  animate={{ opacity: [0, 0, 1, 1, 1], scale: [0.7, 0.7, 1, 1, 1] }}
                  transition={CLAW_GRAB_TRANSITION}
                >
                  <Image
                    src={FISHING_DEMO_DOLL_IMAGE}
                    alt=""
                    fill
                    className="object-contain drop-shadow-[0_0_14px_rgba(250,204,21,0.85)]"
                    sizes="56px"
                  />
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* 규칙 4 — 노란 칸에 멈추면 등급이 보장됩니다 */}
          {mode === 'perfect' && (
            <motion.span
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 320, damping: 18 }}
              className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-black text-[#17262a] shadow-lg"
            >
              {FISHING_AIM_TIER_FLOOR} 인형 이상 확정!
            </motion.span>
          )}
        </div>

        {/* 등급별 점수 — 실제 화면 아래쪽 등급 표시와 같은 것 */}
        <div className="mt-2 flex items-center justify-between gap-1 px-1">
          {FISHING_TIERS.map((tier) => (
            <motion.span
              key={tier}
              animate={{ opacity: isCatching && tier !== FISHING_DEMO_DOLL.tier ? 0.45 : 1 }}
              className="flex items-center gap-1 text-[11px] font-black text-white/85"
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${getTierColor(tier)}`} />
              {tier} ~{fishingTierMaxScore(tier).toLocaleString()}점
            </motion.span>
          ))}
        </div>

        {/* 내리기 버튼 — 실제 화면 아래쪽 버튼과 같은 것 */}
        <div
          className={`relative mt-2 flex items-center justify-center gap-2 rounded-xl py-3 text-base font-black ${
            isAiming ? 'bg-red-500 text-white' : 'bg-white/15 text-white/40'
          }`}
        >
          내리기
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">SPACE</span>
          {isAiming && <TapPointer />}
        </div>
      </div>

      {isCatching && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 1.6 }}
          className="lg-banner-correct font-bitbit mx-auto mt-4 w-fit px-5 py-2 text-center text-base font-black text-white drop-shadow sm:text-lg"
        >
          {FISHING_DEMO_DOLL.tier} 인형을 뽑았어요! +{FISHING_DEMO_SCORE.toLocaleString()}점
        </motion.div>
      )}
    </StageCard>
  )
}

/** 규칙 6 — 연속 정답 콤보 */
function FishingComboScene() {
  return (
    <StageCard id="fishing-combo" className="w-full max-w-xl">
      <div className="font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
        <p className="mb-4 text-center text-base font-black text-amber-300">연속 정답 콤보</p>
        <div className="flex items-end justify-center gap-2">
          {Array.from({ length: MAX_COMBO_STREAK }, (_, i) => {
            const streak = i + 1
            const isMax = streak === MAX_COMBO_STREAK
            return (
              <motion.div
                key={streak}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.16, type: 'spring', stiffness: 320, damping: 20 }}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-3 ${isMax ? 'bg-amber-400' : 'bg-white/15'}`}
              >
                <span className={`text-xs font-black ${isMax ? 'text-[#17262a]/70' : 'text-white/60'}`}>{streak}연속</span>
                <span className={`text-xl font-black ${isMax ? 'text-[#17262a]' : 'text-white'}`}>
                  ×{getComboState(streak).multiplier}
                </span>
              </motion.div>
            )
          })}
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: MAX_COMBO_STREAK * 0.16 }}
          className="mt-4 text-center text-sm font-black text-white/70"
        >
          한 번이라도 틀리면 콤보는 처음부터
        </motion.p>
      </div>
    </StageCard>
  )
}

/** 규칙 7 — 정답이 쌓이면 집게가 좋아집니다 */
function FishingRankScene() {
  const ranks: MachineRank[] = [1, 2, 3, 4, 5]
  return (
    <StageCard id="fishing-rank" className="w-full max-w-xl">
      <div className="font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
        <p className="mb-4 text-center text-base font-black text-amber-300">맞힌 문제 수에 따라 집게가 바뀌어요</p>
        <div className="space-y-2">
          {ranks.map((rank, i) => {
            const isMax = rank === MAX_MACHINE_RANK
            return (
              <motion.div
                key={rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.14, type: 'spring', stiffness: 280, damping: 22 }}
                className={`flex items-center justify-between rounded-2xl px-4 py-2.5 ${isMax ? 'bg-amber-400' : 'bg-white/15'}`}
              >
                <span className={`text-base font-black ${isMax ? 'text-[#17262a]' : 'text-white'}`}>
                  {isMax ? '🏆 ' : ''}
                  {getMachineRankName(rank)}
                </span>
                <span className={`text-sm font-black tabular-nums ${isMax ? 'text-[#17262a]/70' : 'text-white/60'}`}>
                  정답 {MACHINE_RANK_THRESHOLDS[rank]}개
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>
    </StageCard>
  )
}

/** 실제 인형뽑기 헤더의 칩 4개 (기계 등급 · 점수 · 컬렉션 · 뽑기 전력) */
function fishingChips(phase: string): HudChip[] {
  const points = FISHING_POINTS_BY_PHASE[phase] ?? { value: FISHING_TOTAL_POINTS }
  const caught = ['catch', 'combo', 'rank', 'score'].includes(phase)
  return [
    { label: '기계 등급', value: getMachineRankName(FISHING_DEMO_RANK), emoji: '⚙️' },
    { label: '점수', value: points.value, from: points.from, suffix: '점', emoji: '🧸', tone: 'amber' },
    { label: '컬렉션', value: caught ? '1개' : '0개', emoji: '🎁' },
    { label: '뽑기 전력', value: phase === 'aim' || phase === 'perfect' ? '조준' : caught ? '완료' : '대기', emoji: '⚡', tone: phase === 'aim' || phase === 'perfect' ? 'sky' : 'default' },
  ]
}

function FishingDemo() {
  return (
    <TutorialDemoFrame
      mode="fishing"
      backgroundSrc="/background/fishing.webp"
      chips={fishingChips}
      /* 규칙 8장과 1:1 — lib/game/tutorials.ts 의 fishing 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 2400, step: 1, caption: '퀴즈를 맞혀야 뽑기 기회가 생겨요' },
        { key: 'correct', duration: 2000, step: 2, caption: `${FISHING_ANSWER_SECONDS}초 안에 맞히면 점수 UP` },
        { key: 'aim', duration: 3200, step: 3, caption: '집게가 좌우로 움직여요 — 내리기!' },
        { key: 'perfect', duration: 2600, step: 4, caption: '노란색 칸에 가까울 수록 좋아요' },
        { key: 'catch', duration: 4000, step: 5, caption: `${FISHING_DEMO_DOLL.tier} 인형! +${FISHING_DEMO_SCORE.toLocaleString()}점` },
        { key: 'combo', duration: 3000, step: 6, caption: `${MAX_COMBO_STREAK}연속 정답이면 점수 ${getComboState(MAX_COMBO_STREAK).multiplier}배` },
        { key: 'rank', duration: 3000, step: 7, caption: `${MACHINE_RANK_THRESHOLDS[MAX_MACHINE_RANK]}문제를 맞히면 ${getMachineRankName(MAX_MACHINE_RANK)}` },
        { key: 'score', duration: 3000, step: 8, caption: '인형 점수를 모두 더해 순위를 정해요' },
      ]}
    >
      {({ phase }) => {
        /* 1·2단계 — 퀴즈를 맞혀야 뽑기 기회가 생깁니다 */
        if (phase === 'quiz' || phase === 'correct') {
          const answered = isAnswered(phase)
          return (
            <StageCard id="fishing-quiz" className="w-full max-w-xl">
              <FishingSpeedCounter answered={answered} />
              <GlassQuizStep
                question="곰이 겨울에 하는 것은?"
                options={['겨울잠', '수영', '소풍', '등산']}
                correctIndex={0}
                answered={answered}
              />
            </StageCard>
          )
        }

        /* 6·7·8단계 — 점수를 더 크게 만드는 방법과 순위 */
        if (phase === 'combo') return <FishingComboScene />
        if (phase === 'rank') return <FishingRankScene />
        if (phase === 'score') {
          return (
            <MiniLeaderboard
              rows={[
                { name: PLAYER_NAME, value: FISHING_TOTAL_POINTS, me: true },
                { name: '밥톨이', value: Math.round(FISHING_TOTAL_POINTS * 0.78) },
                { name: '알밤이', value: Math.round(FISHING_TOTAL_POINTS * 0.55) },
              ]}
              suffix="점"
            />
          )
        }

        /* 3·4·5단계 — 조준하고 집게를 내리는 무대 */
        return <ClawMachineScene mode={phase === 'aim' ? 'aim' : phase === 'perfect' ? 'perfect' : 'catch'} />
      }}
    </TutorialDemoFrame>
  )
}

/* ─────────────── 3. 전설의 편의점 → components/tutorial/FactoryTutorialDemo.tsx ─────────────── */

/* ─────────────── 4. 달콤 바삭 카페 → components/tutorial/CafeTutorialDemo.tsx ─────────────── */

/* ─────────────── 5. 쉿! 마피아 → components/tutorial/MafiaTutorialDemo.tsx ─────────────── */

/* ─────────────── 6. 점프점프 → components/tutorial/DontLookDownTutorialDemo.tsx ─────────────── */

/* ─────────────── 7. 타워 디펜스 → components/tutorial/TowerTutorialDemo.tsx ─────────────── */

/* ─────────────── 8. 좀비를 피해라! → components/tutorial/ZombieTutorialDemo.tsx ─────────────── */

/* ─────────────── 9. 간식런 → components/tutorial/TreatRushTutorialDemo.tsx ─────────────── */

/* 레지스트리 — 장면이 많은 모드는 파일을 따로 두었습니다 */
export const GAME_DEMO_REGISTRY: Partial<Record<GameModeId, ComponentType>> = {
  gold_quest: GoldQuestTutorialDemo,
  battle_royale: BattleRoyaleTutorialDemo,
  fishing: FishingDemo,
  factory: FactoryTutorialDemo,
  cafe: CafeTutorialDemo,
  mafia: MafiaTutorialDemo,
  dontlookdown: DontLookDownTutorialDemo,
  tower: TowerTutorialDemo,
  zombie: ZombieTutorialDemo,
  treat_rush: TreatRushTutorialDemo,
  poop_dodge: PuppyChaosTutorialDemo,
}
