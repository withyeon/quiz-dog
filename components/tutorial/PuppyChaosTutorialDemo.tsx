'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  BONE_PICKUP_REWARD,
  BONUS_ROUND_SECONDS,
  CARD_CHOICE_COUNT,
  CARD_DEFS,
  CARD_PICK_SECONDS,
  CLEANER_DELAY_SECONDS,
  COMBO_STEPS,
  CORRECT_ROUND_BASE_REWARD,
  CORRECT_ROUND_SCORE,
  CORRECT_ROUND_SECONDS,
  GOLDEN_DOG_CHANCE,
  GOLDEN_DOG_SCORE,
  POOP_BOMB_SCORE,
  POOP_HIT_PENALTY,
  SCORE_THIEF_AMOUNT,
} from '@/lib/game/강아지대소동'
import { withJosa } from '@/lib/utils/korean'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 강아지 대소동 튜토리얼 데모.
 *   (lib/game/강아지대소동.ts · app/puppy-chaos/page.tsx · components/강아지대소동/강아지대소동MiniGame.tsx)
 * 장면 9개는 튜토리얼 규칙 9장과 1:1로 맞춰 두었습니다.
 * 화면에 나오는 숫자·낱말은 전부 실제 상수에서 가져오므로
 * 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

const POOP = '/puppy-chaos/poop.svg'
const FAST_POOP = '/puppy-chaos/fast-poop.svg'
const BONE = '/puppy-chaos/bone.svg'
const RANDOM_BOX = '/puppy-chaos/random-box.svg'
/** 무대에 서는 강아지 — HUD의 밤톨이와 같은 마스코트의 큰 버전 */
const MASCOT = '/assets/icons/mascot-pome-128.png'

/** 콤보 단계 — 낮은 연속수부터 (3연속 1.5배 → 5연속 2배) */
const COMBO_LADDER = [...COMBO_STEPS].sort((a, b) => a.streak - b.streak)
const COMBO_SMALL = COMBO_LADDER[0]
const COMBO_BIG = COMBO_LADDER[COMBO_LADDER.length - 1]
const COMBO_BIG_REWARD = Math.round(CORRECT_ROUND_BASE_REWARD * COMBO_BIG.multiplier)

/** 랜덤박스에서 뽑히는 예시 카드 — 실제로는 drawCardChoices() 가 매번 무작위로 뽑아 줍니다 */
const PICKED_CARD = CARD_DEFS.umbrella
const PICKED_BOX_INDEX = 1

/** HUD 점수 사다리 — 규칙을 하나씩 볼 때마다 점수가 어떻게 쌓이는지 보여줍니다 */
const BASE_SCORE = 320
const AFTER_QUIZ = BASE_SCORE + CORRECT_ROUND_SCORE
const AFTER_DODGE = AFTER_QUIZ + BONE_PICKUP_REWARD - POOP_HIT_PENALTY
const AFTER_COMBO = AFTER_DODGE + COMBO_BIG_REWARD
const AFTER_ATTACK = AFTER_COMBO + POOP_BOMB_SCORE
const AFTER_LEGEND = AFTER_ATTACK + GOLDEN_DOG_SCORE

const SCORE_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: AFTER_QUIZ, from: BASE_SCORE },
  box: { value: AFTER_QUIZ },
  move: { value: AFTER_QUIZ },
  hit: { value: AFTER_DODGE, from: AFTER_QUIZ },
  guard: { value: AFTER_DODGE },
  combo: { value: AFTER_COMBO, from: AFTER_DODGE },
  attack: { value: AFTER_ATTACK, from: AFTER_COMBO },
  legend: { value: AFTER_LEGEND, from: AFTER_ATTACK },
  rank: { value: AFTER_LEGEND },
}

/** 장면이 뜬 뒤 한 박자 늦게 켜지는 스위치 (정답 표시처럼 순서를 두고 보여줄 때) */
function useDelayedFlag(delayMs: number) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setOn(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs])
  return on
}

/** 다른 데모와 같은 어두운 유리 패널 */
function PuppyPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`font-bitbit relative overflow-hidden rounded-3xl border border-white/25 bg-slate-900/60 shadow-2xl backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  )
}

/** 실제 미니게임 왼쪽 위에 뜨는 흰 표시(시간 · 맞음 · 뼈다귀)와 같은 모양 */
function GameChip({
  children,
  tone = 'plain',
}: {
  children: React.ReactNode
  tone?: 'plain' | 'danger' | 'bone' | 'guard'
}) {
  const toneClass = {
    plain: 'bg-white text-slate-900',
    danger: 'bg-white text-rose-600',
    bone: 'bg-amber-50 text-amber-700',
    guard: 'bg-cyan-100 text-cyan-800',
  }[tone]
  return (
    <span
      className={`rounded-xl border-2 border-slate-900 px-2.5 py-1 text-xs font-black shadow-[2px_2px_0_#0f172a] sm:text-sm ${toneClass}`}
    >
      {children}
    </span>
  )
}

/** 점수가 오르내릴 때 무대 위로 떠오르는 숫자 */
function FloatingScore({
  text,
  tone,
  className = '',
  times,
  duration,
}: {
  text: string
  tone: 'gain' | 'loss'
  className?: string
  times: number[]
  duration: number
}) {
  return (
    <motion.span
      className={`absolute z-30 rounded-full px-3 py-1 text-sm font-black shadow-lg ${
        tone === 'gain' ? 'bg-amber-400 text-[#17262a]' : 'bg-rose-500 text-white'
      } ${className}`}
      animate={{ opacity: [0, 0, 1, 1, 0], y: [0, 0, -12, -20, -30] }}
      transition={{ duration, times, repeat: Infinity, ease: 'easeOut' }}
    >
      {text}
    </motion.span>
  )
}

const STAGE_HEIGHT = 232
const GROUND_Y = STAGE_HEIGHT - 92

/** 하늘에서 떨어지는 똥·뼈다귀 한 개 */
function Falling({
  src,
  left,
  size = 34,
  delay = 0,
  duration = 2.2,
  repeatDelay = 0,
  landY = GROUND_Y,
}: {
  src: string
  left: string
  size?: number
  delay?: number
  duration?: number
  repeatDelay?: number
  landY?: number
}) {
  return (
    <motion.div
      className="absolute top-0 z-10"
      style={{ left, width: size, height: size }}
      initial={{ y: -size, opacity: 0 }}
      animate={{ y: [-size, landY / 2, landY], opacity: [0, 1, 1], rotate: [0, 90, 180] }}
      transition={{ duration, delay, repeatDelay, repeat: Infinity, ease: 'linear' }}
    >
      <Image src={src} alt="" fill unoptimized className="object-contain" sizes="48px" />
    </motion.div>
  )
}

/** 바닥에 서 있는 강아지 (무적일 때는 황금 강아지 왕관을 씁니다) */
function Puppy({
  crowned = false,
  umbrella = false,
  className = '',
  ...motionProps
}: {
  crowned?: boolean
  umbrella?: boolean
  className?: string
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div className={`absolute bottom-6 z-20 ${className}`} {...motionProps}>
      {umbrella && (
        <Image
          src={CARD_DEFS.umbrella.icon}
          alt=""
          width={52}
          height={52}
          unoptimized
          className="absolute -top-10 left-1/2 -translate-x-1/2 object-contain"
          style={{ width: 52, height: 52 }}
        />
      )}
      {crowned && (
        <Image
          src={CARD_DEFS.golden_dog.icon}
          alt=""
          width={44}
          height={44}
          unoptimized
          className="absolute -top-8 left-1/2 -translate-x-1/2 object-contain"
          style={{ width: 44, height: 44 }}
        />
      )}
      <Image src={MASCOT} alt={PLAYER_NAME} width={72} height={72} className="h-[72px] w-[72px] object-contain" />
    </motion.div>
  )
}

/** 미니게임 무대 — 규칙 3·4·5 가 같은 무대를 쓰고 장면만 달라집니다 */
function DodgeStage({ mode }: { mode: 'move' | 'hit' | 'guard' }) {
  const isMove = mode === 'move'
  const isHit = mode === 'hit'
  const isGuard = mode === 'guard'
  /** 청소기는 실제 게임처럼 2초 뒤에 화면을 싹 비웁니다 */
  const cleanerSwept = useDelayedFlag(CLEANER_DELAY_SECONDS * 1000)

  return (
    <StageCard id={`puppy-stage-${mode}`} className="w-full max-w-2xl">
      <PuppyPanel className="p-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300/45 via-sky-100/25 to-emerald-300/35" style={{ height: STAGE_HEIGHT }}>
          {/* 실제 게임 화면 왼쪽 위 표시 */}
          <div className="absolute left-3 top-3 z-30 flex flex-wrap gap-1.5">
            <GameChip>{CORRECT_ROUND_SECONDS.toFixed(1)}초</GameChip>
            <GameChip tone="danger">맞음 {isHit ? 1 : 0}</GameChip>
            <GameChip tone="bone">뼈다귀 {isHit ? 1 : 0}</GameChip>
            {isGuard && <GameChip tone="guard">우산 방어!</GameChip>}
          </div>

          {/* 바닥 */}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-emerald-400/40" />
          <div className="absolute inset-x-0 bottom-14 h-1 bg-emerald-500/40" />

          {/* 규칙 3 — 좌우로 움직여 똥을 피합니다 */}
          {isMove && (
            <>
              <Falling src={POOP} left="18%" duration={2.4} />
              <Falling src={FAST_POOP} left="52%" duration={1.7} delay={0.7} size={30} />
              <Falling src={POOP} left="78%" duration={2.1} delay={1.3} />
              <Puppy
                className="left-1/2 -ml-9"
                animate={{ x: [-78, 78, -78] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="absolute bottom-4 right-3 z-30 flex items-center gap-1.5">
                {['←', '→'].map((key) => (
                  <motion.span
                    key={key}
                    animate={{ scale: [1, 0.92, 1] }}
                    transition={{ duration: 1.7, repeat: Infinity, delay: key === '←' ? 0 : 0.85 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-900 bg-white text-lg font-black text-slate-900 shadow-[2px_2px_0_#0f172a]"
                  >
                    {key}
                  </motion.span>
                ))}
                <span className="ml-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white">
                  폰은 화면을 밀어요
                </span>
              </div>
            </>
          )}

          {/* 규칙 4 — 뼈다귀는 먹고, 똥은 맞으면 점수를 잃습니다.
              둘 다 강아지 머리 위(가운데)로 떨어지도록 맞춰 둡니다. */}
          {isHit && (
            <>
              <Falling src={BONE} left="calc(50% - 46px)" duration={1.4} repeatDelay={2.8} landY={GROUND_Y} />
              <Falling
                src={POOP}
                left="calc(50% + 12px)"
                duration={1.4}
                delay={1.8}
                repeatDelay={2.8}
                landY={GROUND_Y}
              />
              <FloatingScore
                text={`+${BONE_PICKUP_REWARD}`}
                tone="gain"
                className="bottom-24 left-1/2 -ml-16"
                duration={4.2}
                times={[0, 0.28, 0.34, 0.46, 0.6]}
              />
              <FloatingScore
                text={`-${POOP_HIT_PENALTY}`}
                tone="loss"
                className="bottom-24 left-1/2 ml-4"
                duration={4.2}
                times={[0, 0.71, 0.77, 0.88, 1]}
              />
              {/* 뼈다귀를 먹을 땐 폴짝, 똥에 맞을 땐 휘청 */}
              <Puppy
                className="left-1/2 -ml-9"
                animate={{ y: [0, 0, -12, 0, 0, 0], rotate: [0, 0, 0, 0, -10, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.28, 0.33, 0.4, 0.78, 0.88] }}
              />
            </>
          )}

          {/* 규칙 5 — 우산은 한 번 막아주고, 청소기는 잠시 뒤 화면을 비웁니다 */}
          {isGuard && (
            <>
              {!cleanerSwept && (
                <>
                  <Falling src={POOP} left="22%" duration={2.2} />
                  <Falling src={FAST_POOP} left="70%" duration={1.9} delay={0.5} size={30} />
                </>
              )}
              {/* 우산에 맞고 튕겨 나가는 똥 */}
              <motion.div
                className="absolute left-1/2 top-0 z-10 -ml-4 h-9 w-9"
                animate={{ y: [-36, 96, 96, 150], x: [0, 0, 0, 70], opacity: [0, 1, 1, 0], rotate: [0, 120, 120, 260] }}
                transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.42, 0.5, 0.85], ease: 'easeIn' }}
              >
                <Image src={POOP} alt="" fill unoptimized className="object-contain" sizes="36px" />
              </motion.div>
              <Puppy className="left-1/2 -ml-9" umbrella animate={{ x: 0 }} />

              {/* 청소기 — 지나간 자리는 깨끗해집니다 */}
              <motion.div
                className="pointer-events-none absolute inset-y-0 z-20 w-24 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                initial={{ x: '-20%', opacity: 0 }}
                animate={{ x: ['-20%', '900%'], opacity: [0, 1, 0] }}
                transition={{ duration: 1, delay: CLEANER_DELAY_SECONDS, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute bottom-4 left-3 z-30 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-[2px_2px_0_#0f172a] ring-2 ring-slate-900"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Image
                  src={CARD_DEFS.cleaner.icon}
                  alt=""
                  width={24}
                  height={24}
                  unoptimized
                  className="h-6 w-6 object-contain"
                />
                <span className="text-xs font-black text-slate-900">
                  {cleanerSwept ? '화면을 싹 치웠어요!' : `${CLEANER_DELAY_SECONDS}초 뒤 화면을 싹!`}
                </span>
              </motion.div>
            </>
          )}
        </div>
      </PuppyPanel>
    </StageCard>
  )
}

/** 규칙 1 — 퀴즈를 맞히면 바로 점수를 받습니다 */
function QuizScene() {
  const answered = useDelayedFlag(700)
  return (
    <StageCard id="puppy-quiz" className="w-full max-w-xl">
      <div className="font-bitbit mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-black/50 px-4 py-2 text-sm font-black text-white sm:text-base">
          맞히면 랜덤박스, 틀리면 바로 대소동
        </span>
        {answered && (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 16 }}
            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-[#17262a] shadow-lg sm:text-base"
          >
            +{CORRECT_ROUND_SCORE}점
          </motion.span>
        )}
      </div>
      <GlassQuizStep
        question="강아지가 좋아하는 간식은?"
        options={['뼈다귀', '지우개', '돌멩이', '연필']}
        correctIndex={0}
        answered={answered}
      />
    </StageCard>
  )
}

/** 규칙 2 — 랜덤박스 3개 중 하나를 골라 카드를 얻습니다 */
function BoxScene() {
  const opened = useDelayedFlag(1400)
  return (
    <StageCard id="puppy-box" className="w-full max-w-2xl">
      <PuppyPanel className="p-4">
        <div className="mb-3 text-center">
          <p className="text-lg font-black text-white sm:text-xl">랜덤박스 하나 고르기!</p>
          <p className="mt-1 text-sm font-black text-rose-300">
            {opened ? '상자를 여는 중...' : `${CARD_PICK_SECONDS}초 후 랜덤 자동 선택`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: CARD_CHOICE_COUNT }, (_, index) => {
            const picked = index === PICKED_BOX_INDEX
            const revealed = opened && picked
            return (
              <div key={index} className="relative min-h-[164px]">
                {/* 닫힌 상자 — 실제 게임의 랜덤박스와 같은 모양 */}
                <motion.div
                  animate={revealed ? { rotateY: 90, opacity: 0 } : { rotateY: 0, opacity: opened ? 0.55 : 1 }}
                  transition={{ duration: 0.32 }}
                  className={`absolute inset-0 rounded-[24px] border-4 border-slate-900 bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-200 p-3 text-center shadow-[5px_5px_0_#0f172a] ${
                    picked && !opened ? 'ring-4 ring-rose-400' : ''
                  }`}
                >
                  <Image
                    src={RANDOM_BOX}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="mx-auto mb-1 h-14 w-14 object-contain"
                  />
                  <div className="text-base font-black text-slate-900">랜덤박스</div>
                  <div className="mt-0.5 text-[11px] font-bold text-slate-600">열기 전까지 비밀!</div>
                  <div className="mt-1 text-2xl font-black text-rose-500">?</div>
                  {picked && !opened && <TapPointer />}
                </motion.div>

                {/* 열린 카드 */}
                {revealed && (
                  <motion.div
                    initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
                    animate={{ rotateY: 0, scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="absolute inset-0 rounded-[24px] border-4 border-emerald-500 bg-emerald-50 p-3 text-center shadow-[5px_5px_0_#0f172a]"
                  >
                    <Image
                      src={PICKED_CARD.icon}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                      className="mx-auto mb-1 h-14 w-14 object-contain"
                    />
                    <div className="text-lg font-black text-slate-900">{PICKED_CARD.label}</div>
                    <div className="mt-1 text-xs font-bold text-slate-600">{PICKED_CARD.description}</div>
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
      </PuppyPanel>
    </StageCard>
  )
}

/** 규칙 6 — 연속으로 맞힐수록 대소동 보상이 커집니다 */
function ComboScene() {
  const maxed = useDelayedFlag(1100)
  const litCount = maxed ? COMBO_BIG.streak : COMBO_SMALL.streak
  const multiplier = maxed ? COMBO_BIG.multiplier : COMBO_SMALL.multiplier

  return (
    <StageCard id="puppy-combo" className="w-full max-w-xl">
      <PuppyPanel className="p-5">
        <p className="text-center text-sm font-black text-white/80">연속으로 맞힌 문제</p>
        <div className="mt-3 flex items-center justify-center gap-2.5">
          {Array.from({ length: COMBO_BIG.streak }, (_, index) => {
            const lit = index < litCount
            return (
              <motion.span
                key={index}
                animate={{ scale: lit ? 1 : 0.72, opacity: lit ? 1 : 0.35 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: index * 0.06 }}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black sm:h-12 sm:w-12 ${
                  lit ? 'bg-amber-400 text-[#17262a] shadow-lg' : 'bg-white/20 text-white/70'
                }`}
              >
                {index + 1}
              </motion.span>
            )
          })}
        </div>

        <motion.div
          key={multiplier}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 340, damping: 16 }}
          className="mt-4 flex items-center justify-center gap-2"
        >
          <span className="rounded-full bg-rose-500 px-4 py-1.5 text-base font-black text-white shadow-lg">
            {litCount}콤보
          </span>
          <span className="rounded-full bg-amber-400 px-4 py-1.5 text-base font-black text-[#17262a] shadow-lg">
            보상 {multiplier}배
          </span>
        </motion.div>

        <p className="mt-4 text-center text-base font-black text-white sm:text-lg">
          {CORRECT_ROUND_BASE_REWARD}점 × {multiplier} ={' '}
          <span className="text-amber-300">{Math.round(CORRECT_ROUND_BASE_REWARD * multiplier)}점</span>
        </p>
        <p className="mt-1 text-center text-xs font-bold text-white/60">
          한 번이라도 틀리면 콤보는 0부터 다시 쌓아요
        </p>
      </PuppyPanel>
    </StageCard>
  )
}

/** 친구 한 명이 공격받는 모습 */
function TargetRow({
  card,
  medal,
  name,
  effect,
  myGain,
  delay,
}: {
  card: (typeof CARD_DEFS)[keyof typeof CARD_DEFS]
  medal: string
  name: string
  effect: React.ReactNode
  myGain: number
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 22 }}
      className="flex items-center gap-2.5 rounded-2xl bg-white/10 p-2.5 sm:gap-3 sm:p-3"
    >
      <div className="flex w-[92px] shrink-0 flex-col items-center gap-1 rounded-xl border-4 border-rose-400 bg-rose-50 px-1.5 py-2">
        <Image src={card.icon} alt="" width={36} height={36} unoptimized className="h-9 w-9 object-contain" />
        <span className="text-xs font-black text-slate-900">{card.label}</span>
      </div>

      <div className="flex flex-1 items-center gap-2">
        <motion.span
          className="text-lg text-white/70"
          animate={{ x: [0, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, delay }}
        >
          ➜
        </motion.span>
        <div className="min-w-0 flex-1 rounded-xl bg-black/40 px-3 py-2">
          <p className="truncate text-sm font-black text-white">
            {medal} {name}
          </p>
          <p className="mt-0.5 text-xs font-black text-rose-300">{effect}</p>
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 text-sm font-black text-[#17262a] shadow">
        나는 +{myGain}
      </span>
    </motion.div>
  )
}

/** 규칙 7 — 친구를 방해하는 공격 카드 */
function AttackScene() {
  return (
    <StageCard id="puppy-attack" className="w-full max-w-2xl">
      <PuppyPanel className="p-4">
        <p className="mb-3 text-center text-sm font-black text-amber-300">공격 카드는 친구에게 대소동을 보내요</p>
        <div className="space-y-2.5">
          <TargetRow
            card={CARD_DEFS.poop_bomb}
            medal="🥇"
            name="밥톨이"
            effect="똥이 더 빨리 떨어져요"
            myGain={POOP_BOMB_SCORE}
            delay={0.1}
          />
          <TargetRow
            card={CARD_DEFS.score_thief}
            medal="🎲"
            name="알밤이"
            effect={`점수 -${SCORE_THIEF_AMOUNT}`}
            myGain={SCORE_THIEF_AMOUNT}
            delay={0.35}
          />
        </div>
      </PuppyPanel>
    </StageCard>
  )
}

/** 규칙 8 — 전설 카드 황금 강아지 */
function LegendScene() {
  return (
    <StageCard id="puppy-legend" className="w-full max-w-xl">
      <PuppyPanel className="p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <motion.div
            initial={{ rotateY: 90, scale: 0.8, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            className="relative w-[172px] rounded-[24px] border-4 border-amber-500 bg-amber-50 p-4 text-center shadow-[5px_5px_0_#0f172a]"
          >
            <motion.span
              className="pointer-events-none absolute inset-0 rounded-[20px] ring-4 ring-amber-300"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <Image
              src={CARD_DEFS.golden_dog.icon}
              alt=""
              width={72}
              height={72}
              unoptimized
              className="mx-auto h-[72px] w-[72px] object-contain"
            />
            <div className="mt-2 text-xl font-black text-slate-900">{CARD_DEFS.golden_dog.label}</div>
            <div className="mt-1 text-xs font-bold text-slate-600">{CARD_DEFS.golden_dog.description}</div>
          </motion.div>

          {/* 무적이 된 강아지 — 똥이 그냥 지나갑니다 */}
          <div className="relative h-[168px] w-[172px] overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300/40 to-emerald-300/40">
            <div className="absolute inset-x-0 bottom-0 h-10 bg-emerald-400/40" />
            <motion.div
              className="absolute left-1/2 top-0 -ml-4 h-8 w-8"
              animate={{ y: [-32, 168], opacity: [1, 1, 0.25] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            >
              <Image src={POOP} alt="" fill unoptimized className="object-contain" sizes="32px" />
            </motion.div>
            <motion.div
              className="absolute bottom-3 left-1/2 -ml-9"
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            >
              <Image
                src={CARD_DEFS.golden_dog.icon}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="absolute -top-7 left-1/2 h-10 w-10 -translate-x-1/2 object-contain"
              />
              <Image src={MASCOT} alt={PLAYER_NAME} width={72} height={72} className="h-[72px] w-[72px] object-contain" />
            </motion.div>
            <span className="absolute bottom-2 right-2 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-[#17262a] shadow">
              무적!
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-sm font-black text-white/70">
          {CARD_CHOICE_COUNT}개 중 아주 가끔({Math.round(GOLDEN_DOG_CHANCE * 100)}%) 나오는 전설 카드예요
        </p>
      </PuppyPanel>
    </StageCard>
  )
}

/** 규칙 9 — 보너스 라운드까지 끝나면 점수로 순위를 정합니다 */
function RankScene() {
  return (
    <StageCard id="puppy-rank" className="w-full max-w-sm">
      <div className="mb-3 flex justify-center">
        <span className="font-bitbit rounded-full bg-sky-400 px-4 py-2 text-sm font-black text-[#17262a] shadow-lg">
          시간이 끝나면 보너스 대소동 {BONUS_ROUND_SECONDS}초!
        </span>
      </div>
      <MiniLeaderboard
        rows={[
          { name: PLAYER_NAME, value: AFTER_LEGEND, me: true },
          { name: '밥톨이', value: Math.round(AFTER_LEGEND * 0.74) },
          { name: '알밤이', value: Math.round(AFTER_LEGEND * 0.52) },
        ]}
        suffix="점"
      />
    </StageCard>
  )
}

export default function PuppyChaosTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/puppy-chaos.png"
      metric={(phase) => ({
        emoji: '⭐',
        value: SCORE_BY_PHASE[phase]?.value ?? BASE_SCORE,
        from: SCORE_BY_PHASE[phase]?.from,
        suffix: '점',
      })}
      /* 규칙 9장과 1:1 — lib/game/tutorials.ts 의 poop_dodge 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 2800, step: 1, caption: `퀴즈를 맞히면 바로 +${CORRECT_ROUND_SCORE}점` },
        { key: 'box', duration: 3200, step: 2, caption: `랜덤박스 ${CARD_CHOICE_COUNT}개 중 하나를 골라요` },
        { key: 'move', duration: 3400, step: 3, caption: `좌우로 움직여 ${CORRECT_ROUND_SECONDS}초를 버텨요` },
        {
          key: 'hit',
          duration: 3400,
          step: 4,
          caption: `똥은 -${POOP_HIT_PENALTY}점, 뼈다귀는 +${BONE_PICKUP_REWARD}점`,
        },
        {
          key: 'guard',
          duration: 3600,
          step: 5,
          caption: `우산은 한 번 막고, 청소기는 ${CLEANER_DELAY_SECONDS}초 뒤 싹!`,
        },
        {
          key: 'combo',
          duration: 3200,
          step: 6,
          caption: `${COMBO_SMALL.streak}연속 ${COMBO_SMALL.multiplier}배, ${COMBO_BIG.streak}연속 ${COMBO_BIG.multiplier}배`,
        },
        { key: 'attack', duration: 3400, step: 7, caption: '공격 카드로 친구를 방해할 수 있어요' },
        {
          key: 'legend',
          duration: 3400,
          step: 8,
          caption: `${withJosa(CARD_DEFS.golden_dog.label, '은/는')} +${GOLDEN_DOG_SCORE}점에 무적까지!`,
        },
        { key: 'rank', duration: 3000, step: 9, caption: '점수가 가장 많으면 1등' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene />
        if (phase === 'box') return <BoxScene />
        if (phase === 'move' || phase === 'hit' || phase === 'guard') return <DodgeStage mode={phase} />
        if (phase === 'combo') return <ComboScene />
        if (phase === 'attack') return <AttackScene />
        if (phase === 'legend') return <LegendScene />
        return <RankScene />
      }}
    </TutorialDemoFrame>
  )
}
