'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import {
  CHEST_COUNT,
  GOLD_LOSS_RATE,
  GOLD_MULTIPLIER,
  GOLD_STEAL_RATE,
  MAX_GOLD_STACK,
  SHIELD_STREAK,
  toPercent,
} from '@/lib/game/goldQuest'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  PLAYER_NAME,
  type HudMetric,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 해적왕의 보물찾기 — 자동 재생되는 "플레이 영상" 데모.
 * 실제 게임 흐름 그대로 재현합니다.
 *   (lib/game/goldQuest.ts · components/ChestView.tsx · app/game/page.tsx)
 * 장면 7개는 튜토리얼 규칙 7장과 1:1로 맞춰 두었습니다.
 * 선생님이 규칙을 넘기면 같은 번호의 장면이 뜹니다.
 * 화면에 나오는 숫자는 전부 상수에서 계산하므로 밸런스가 바뀌면 데모도 따라 바뀝니다.
 */

/** 데모에서 쓰는 시작 골드 — 실제 게임처럼 얻고 잃으며 오르내립니다. */
const START_GOLD = 120
/** 골드를 빼앗을 상대(냥냥이)가 들고 있는 골드 */
const RIVAL_GOLD = 200

const CROWN_GOLD = MAX_GOLD_STACK
const GOLD_AFTER_CROWN = START_GOLD + CROWN_GOLD
const DRAGON_LOSS = Math.floor(GOLD_AFTER_CROWN * GOLD_LOSS_RATE.DRAGON)
const GOLD_AFTER_DRAGON = GOLD_AFTER_CROWN - DRAGON_LOSS
const STEAL_GAIN = Math.floor(RIVAL_GOLD * GOLD_STEAL_RATE.WIZARD)
const GOLD_AFTER_STEAL = GOLD_AFTER_DRAGON + STEAL_GAIN

/** 골드는 왕관(+) → 드래곤(-) → 마법사(+) 순으로 오르내립니다. 실제 게임과 같은 흐름입니다. */
const GOLD_BY_PHASE: Record<string, { value: number; from?: number }> = {
  quiz: { value: START_GOLD },
  chest: { value: START_GOLD },
  gold: { value: GOLD_AFTER_CROWN, from: START_GOLD },
  trap: { value: GOLD_AFTER_DRAGON, from: GOLD_AFTER_CROWN },
  steal: { value: GOLD_AFTER_STEAL, from: GOLD_AFTER_DRAGON },
  shield: { value: GOLD_AFTER_STEAL },
  rank: { value: GOLD_AFTER_STEAL },
}

const CHEST_INDEXES = Array.from({ length: CHEST_COUNT }, (_, i) => i)
/** 손가락은 늘 가운데 상자를 누릅니다. */
const PICKED_CHEST_INDEX = Math.floor(CHEST_COUNT / 2)

const RIVAL_AVATAR = '/assets/icons/mascot_sigol-64.png'

/**
 * 장면이 뜬 뒤 한 박자 늦게 켜지는 스위치.
 * 장면은 넘어갈 때마다 새로 붙으므로, 붙는 순간부터 시간을 잰다.
 */
function useDelayedFlag(delay = 1000): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setOn(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  return on
}

/** 게임 공통 유리 패널 */
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`font-bitbit rounded-3xl border border-white/25 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  )
}

/** 큰 결과 뱃지 */
function ResultBadge({ text }: { text: string }) {
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

/** 규칙 1 — 정답을 골라야 상자가 열립니다 */
function QuizScene() {
  const answered = useDelayedFlag(1100)
  return (
    <GlassQuizStep
      question="보물이 묻힌 곳을 알려주는 종이는?"
      options={['보물 지도', '일기장', '달력', '시간표']}
      correctIndex={0}
      answered={answered}
    />
  )
}

/** 규칙 2·3 — 상자를 고르고, 열어서 골드를 받는 무대 */
function ChestScene({ opened }: { opened: boolean }) {
  return (
    <StageCard id="gold-quest-chest" className="w-full max-w-2xl">
      <Panel>
        <p className="mb-4 text-center text-base font-black text-amber-300 sm:text-lg">
          {opened ? '황금 왕관을 찾았어요!' : `상자 ${CHEST_COUNT}개 중 하나를 골라요`}
        </p>
        <div
          className="grid gap-3 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${CHEST_COUNT}, minmax(0, 1fr))` }}
        >
          {CHEST_INDEXES.map((index) => {
            const isPicked = index === PICKED_CHEST_INDEX
            const isOpen = opened && isPicked
            return (
              <motion.div
                key={index}
                animate={isOpen ? { y: [0, -12, 0] } : { y: 0 }}
                transition={{ duration: 0.6 }}
                className={`relative flex min-h-[150px] flex-col items-center justify-center rounded-2xl border-2 p-3 sm:min-h-[180px] ${
                  isOpen
                    ? 'border-amber-400 bg-amber-50/95'
                    : opened
                      ? 'border-white/25 bg-white/20 opacity-50'
                      : 'border-amber-200/60 bg-white/85'
                }`}
              >
                <Image
                  src={isOpen ? '/gold-quest/golden-crown.svg' : '/gold-quest/quest.svg'}
                  alt=""
                  width={110}
                  height={110}
                  className="h-20 w-20 drop-shadow-lg sm:h-24 sm:w-24"
                />
                {isOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-center"
                  >
                    <div className="text-sm font-black text-amber-700">황금 왕관</div>
                    <div className="text-lg font-black text-emerald-600">+{CROWN_GOLD} G</div>
                  </motion.div>
                ) : (
                  <div className="mt-2 text-sm font-black text-slate-500">{index + 1}번 상자</div>
                )}
                {!opened && isPicked && <TapPointer />}
              </motion.div>
            )
          })}
        </div>
      </Panel>

      {/* 상자에는 골드를 몇 배로 불려주는 아이템도 들어 있습니다 */}
      {opened && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="font-bitbit mt-4 flex flex-wrap items-center justify-center gap-2"
        >
          {[
            { image: '/gold-quest/unicorn.svg', label: `유니콘 ${GOLD_MULTIPLIER.UNICORN}배` },
            { image: '/gold-quest/jester.svg', label: `광대 ${GOLD_MULTIPLIER.JESTER}배` },
          ].map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-2 rounded-full bg-black/50 px-3.5 py-1.5 text-sm font-black text-white backdrop-blur"
            >
              <Image src={item.image} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
              {item.label}
            </span>
          ))}
        </motion.div>
      )}
    </StageCard>
  )
}

/** 규칙 4 — 드래곤 함정이 골드를 가져갑니다 */
function TrapScene() {
  return (
    <StageCard id="gold-quest-trap" className="w-full max-w-xl">
      <Panel className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 15 }}
          className="relative h-32 w-32 sm:h-40 sm:w-40"
        >
          <Image src="/gold-quest/dragon.svg" alt="" fill className="object-contain drop-shadow-xl" sizes="160px" />
        </motion.div>
        <p className="mt-3 text-base font-black text-white sm:text-lg">드래곤에게 습격당했다</p>
        <motion.span
          animate={{ opacity: [0, 1, 1], y: [0, -12, -18] }}
          transition={{ duration: 1.1, delay: 0.4, times: [0, 0.5, 1] }}
          className="mt-2 rounded-full bg-rose-500 px-4 py-1.5 text-base font-black text-white shadow-lg"
        >
          -{DRAGON_LOSS} 골드 (가진 골드의 {toPercent(GOLD_LOSS_RATE.DRAGON)}%)
        </motion.span>
      </Panel>
    </StageCard>
  )
}

/** 규칙 5 — 마법사를 찾으면 친구 골드를 가져옵니다 */
function StealScene() {
  const taken = useDelayedFlag(1400)
  const rivals = [
    { name: '냥냥이', gold: RIVAL_GOLD, target: true },
    { name: '뽀삐', gold: 90, target: false },
  ]

  return (
    <StageCard id="gold-quest-steal" className="w-full max-w-xl">
      <Panel>
        <div className="mb-4 flex items-center justify-center gap-3">
          <Image src="/gold-quest/wizard.svg" alt="" width={56} height={56} className="h-12 w-12 object-contain" />
          <p className="text-base font-black text-amber-300 sm:text-lg">
            골드 {toPercent(GOLD_STEAL_RATE.WIZARD)}%를 가져올 친구를 골라요
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rivals.map((rival) => (
            <motion.div
              key={rival.name}
              animate={taken && rival.target ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5 }}
              className={`relative flex flex-col items-center gap-2 rounded-2xl p-4 ${
                taken && rival.target
                  ? 'bg-white/90 ring-2 ring-amber-300'
                  : taken
                    ? 'bg-white/20 opacity-50'
                    : 'bg-white/85'
              }`}
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-amber-100">
                <Image src={RIVAL_AVATAR} alt={rival.name} fill className="object-contain p-1" sizes="56px" />
              </div>
              <span className="text-base font-black text-[#17262a]">{rival.name}</span>
              <span className="text-sm font-black tabular-nums text-amber-600">
                {(taken && rival.target ? rival.gold - STEAL_GAIN : rival.gold).toLocaleString()} G
              </span>
              {!taken && rival.target && <TapPointer />}
            </motion.div>
          ))}
        </div>
      </Panel>
      {taken && <ResultBadge text={`냥냥이 골드 ${STEAL_GAIN}을 가져왔어요`} />}
    </StageCard>
  )
}

/** 규칙 6 — 연속 정답으로 받은 방어권이 함정과 도둑을 막아줍니다 */
function ShieldScene() {
  const blocked = useDelayedFlag(1400)

  return (
    <StageCard id="gold-quest-shield" className="w-full max-w-xl">
      <Panel className="flex flex-col items-center">
        {/* 실제 화면의 연속 정답 표시와 같은 뜻 */}
        <div className="mb-4 flex items-center gap-2.5 rounded-full bg-black/50 px-4 py-2 backdrop-blur">
          <span className="text-sm font-black text-white sm:text-base">연속 정답 {SHIELD_STREAK}</span>
          <span className="flex items-center gap-1.5">
            {Array.from({ length: SHIELD_STREAK }, (_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.15, type: 'spring', stiffness: 400, damping: 18 }}
                className="h-3 w-3 rounded-full bg-amber-400"
              />
            ))}
          </span>
        </div>

        <div className="flex items-center justify-center gap-4">
          <motion.div
            className="relative h-16 w-16"
            animate={blocked ? { x: [0, 20, 10], opacity: [1, 1, 0.35] } : { x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <Image src="/gold-quest/slime.svg" alt="" fill className="object-contain" sizes="64px" />
          </motion.div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.5 }}
            className="relative h-28 w-28 sm:h-32 sm:w-32"
          >
            <Image src="/gold-quest/shield.svg" alt="" fill className="object-contain drop-shadow-xl" sizes="128px" />
          </motion.div>
          <motion.div
            className="relative h-16 w-16"
            animate={blocked ? { x: [0, -20, -10], opacity: [1, 1, 0.35] } : { x: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <Image src="/gold-quest/elf.svg" alt="" fill className="object-contain" sizes="64px" />
          </motion.div>
        </div>
      </Panel>
      {blocked && <ResultBadge text="방어권으로 막았어요! 골드 그대로" />}
    </StageCard>
  )
}

export default function GoldQuestTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/background/gold-quest.png"
      metric={(phase): HudMetric => ({
        icon: '/gold-quest/gold-stack.svg',
        value: GOLD_BY_PHASE[phase]?.value ?? START_GOLD,
        from: GOLD_BY_PHASE[phase]?.from,
        suffix: 'G',
      })}
      /* 규칙 7장과 1:1 — lib/game/tutorials.ts 의 gold_quest 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 2800, step: 1, caption: '퀴즈를 맞혀야 상자를 열 수 있어요' },
        { key: 'chest', duration: 2400, step: 2, caption: `상자 ${CHEST_COUNT}개 중 하나를 골라요` },
        { key: 'gold', duration: 3000, step: 3, caption: `황금 왕관을 찾았어요! +${CROWN_GOLD}골드` },
        { key: 'trap', duration: 2800, step: 4, caption: `드래곤은 골드를 ${toPercent(GOLD_LOSS_RATE.DRAGON)}% 가져가요` },
        { key: 'steal', duration: 3200, step: 5, caption: `마법사로 친구 골드 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%를 가져와요` },
        { key: 'shield', duration: 3200, step: 6, caption: `${SHIELD_STREAK}연속 정답이면 방어권으로 막아요` },
        { key: 'rank', duration: 3000, step: 7, caption: '골드가 가장 많으면 1등!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene />
        if (phase === 'chest') return <ChestScene opened={false} />
        if (phase === 'gold') return <ChestScene opened />
        if (phase === 'trap') return <TrapScene />
        if (phase === 'steal') return <StealScene />
        if (phase === 'shield') return <ShieldScene />

        return (
          <MiniLeaderboard
            suffix=" G"
            rows={[
              { name: PLAYER_NAME, value: GOLD_AFTER_STEAL, me: true },
              { name: '냥냥이', value: RIVAL_GOLD - STEAL_GAIN },
              { name: '뽀삐', value: 90 },
            ]}
          />
        )
      }}
    </TutorialDemoFrame>
  )
}
