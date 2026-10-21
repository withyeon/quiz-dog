'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import IsoGarden from '@/components/garden/IsoGarden'
import SeedBag from '@/components/garden/SeedBag'
import GardenShop from '@/components/garden/GardenShop'
import RewardCards from '@/components/garden/RewardCards'
import {
  CROP_BY_ID,
  GARDEN,
  UNLOCK_ORDER,
  advanceGarden,
  buyExpansion,
  buySeed,
  createGarden,
  harvestPlot,
  plantSeed,
  recordCrowShooed,
  type CropId,
  type GardenState,
  type Mutation,
  type RewardCard,
} from '@/lib/game/garden'
import type { ActiveCrow, HarvestFloat } from '@/hooks/useGardenGame'
import { TutorialDemoFrame, GlassQuizStep, StageCard, useDelayedFlag } from '@/components/tutorial/TutorialDemoFrame'
import { MovingPointer, useElementPointer, useFrameFitZoom } from '@/components/tutorial/demoPointer'

/**
 * 블록 텃밭 키우기 — 실제 게임과 같은 재료로 그린다:
 *   보상 카드(RewardCards) · 쿼터뷰 밭(IsoGarden) · 씨앗 가방(SeedBag) · 가게(GardenShop)
 * 밭 시계는 실제 훅(useGardenGame)처럼 rAF 로 흐르고, 심기·수확·가게는 lib/game/garden.ts 의 함수를 그대로 쓴다.
 * 장면 5개는 튜토리얼 규칙 5장(lib/game/tutorials.ts 의 garden)과 1:1.
 */

/** 다 자랄 때 변이가 랜덤으로 붙지 않게 고정 (변이 장면은 미리 정해 둔다) */
const NO_MUTATION = () => 0.99

type FieldSim = { garden: GardenState; floats: HarvestFloat[]; crow: ActiveCrow | null; seed: CropId | null; shooed: boolean }
type FieldStep = {
  at: number
  run: (sim: FieldSim) => FieldSim
  /** 이 동작 직전에 포인터가 가리킬 실제 버튼 */
  point: (box: HTMLElement) => Element | null | undefined
}

/** IsoGarden 은 칸마다 <div> 하나를 칸 번호 순서로 그린다 — 그 안의 첫 버튼이 칸, 둘째가 작물 */
const plotButton = (index: number, which: 'tile' | 'crop' = 'tile') => (box: HTMLElement) => {
  const cell = box.querySelector('[data-demo="field"]')?.firstElementChild?.children[index]
  const buttons = cell?.querySelectorAll('button')
  return which === 'crop' ? buttons?.[1] ?? buttons?.[0] : buttons?.[0]
}
/** 가게 한 줄(그림 + 값 버튼)에서 값 버튼 */
const shopBuyButton = (image: string) => (box: HTMLElement) =>
  box.querySelector(`[data-demo="shop"] img[src="${image}"]`)?.closest('div.flex')?.querySelector('button')

function selectSeed(at: number, cropId: CropId): FieldStep {
  return {
    at,
    point: (box) => box.querySelector(`[data-demo="seeds"] img[src="${CROP_BY_ID[cropId].image}"]`)?.closest('button'),
    run: (sim) => ({ ...sim, seed: cropId }),
  }
}

function plant(at: number, index: number): FieldStep {
  return {
    at,
    point: plotButton(index),
    run: (sim) => {
      const garden = sim.seed ? plantSeed(sim.garden, index, sim.seed) : null
      return garden ? { ...sim, garden, seed: garden.seeds[sim.seed!] ? sim.seed : null } : sim
    },
  }
}

function harvest(at: number, index: number): FieldStep {
  return {
    at,
    point: plotButton(index, 'crop'),
    run: (sim) => {
      const result = harvestPlot(sim.garden, index)
      if (!result) return sim
      return { ...sim, garden: result.state, floats: [...sim.floats, { ...result.harvest, id: at }] }
    },
  }
}

function shopSeed(at: number, cropId: CropId): FieldStep {
  return {
    at,
    point: shopBuyButton(CROP_BY_ID[cropId].image),
    run: (sim) => ({ ...sim, garden: buySeed(sim.garden, cropId) ?? sim.garden }),
  }
}

/** 다음에 열릴 칸(🔓 값 배지)을 눌러 밭 넓히기 */
function expand(at: number, plotIndex: number): FieldStep {
  return {
    at,
    point: plotButton(plotIndex),
    run: (sim) => ({ ...sim, garden: buyExpansion(sim.garden) ?? sim.garden }),
  }
}

function tapCrow(at: number): FieldStep {
  return {
    at,
    point: (box) => box.querySelector('[aria-label="까마귀 쫓기"]'),
    run: (sim) => {
      if (!sim.crow) return sim
      const tapsLeft = sim.crow.tapsLeft - 1
      if (tapsLeft > 0) return { ...sim, crow: { ...sim.crow, tapsLeft } }
      return { ...sim, crow: null, shooed: true, garden: recordCrowShooed(sim.garden, false) }
    },
  }
}

/**
 * 밭 시계 흐르기 + 대본대로 누르기. 실제 훅처럼 프레임 시간만큼 advanceGarden 을 부른다.
 * 대본 동작은 한 번씩만 적용한다 (StrictMode 에서 updater 가 두 번 돌아도 두 번 누르지 않게).
 */
function useFieldSim(initial: FieldSim, steps: FieldStep[], raining: boolean) {
  const [state, setState] = useState({ sim: initial, elapsed: 0, applied: 0 })
  const stepsRef = useRef(steps)
  stepsRef.current = steps

  useEffect(() => {
    let raf = 0
    let start: number | null = null
    let last = 0
    let sim = initial
    let applied = 0
    const tick = (now: number) => {
      if (start === null) {
        start = now
        last = now
      }
      const dt = Math.min(100, now - last)
      last = now
      const elapsed = now - start
      sim = {
        ...sim,
        garden: advanceGarden(sim.garden, dt, raining, NO_MUTATION).state,
        crow: sim.crow ? { ...sim.crow, leftMs: Math.max(0, sim.crow.leftMs - dt) } : null,
      }
      const list = stepsRef.current
      while (applied < list.length && list[applied].at <= elapsed) {
        sim = list[applied].run(sim)
        applied += 1
      }
      setState({ sim, elapsed, applied })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // 장면마다 새로 붙으므로 처음 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const next = steps[state.applied]
  // 다음 동작 0.75초 전부터 그 버튼 위로 포인터가 간다
  const pointing = next && state.elapsed >= next.at - 750 ? next : null
  return { ...state.sim, pointing, pointKey: pointing ? state.applied : -1 }
}

type FieldProps = {
  id: string
  initial: FieldSim
  steps: FieldStep[]
  loopMs: number
  raining?: boolean
  side?: 'seeds' | 'shop'
}

/** 선생님이 규칙 한 장에 오래 머물러도 대본이 끝나면 처음부터 다시 돈다 */
function Field({ loopMs, ...props }: FieldProps) {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setEpoch((value) => value + 1), loopMs)
    return () => clearInterval(timer)
  }, [loopMs])
  return (
    <StageCard id={props.id} className="relative">
      <FieldRun key={epoch} {...props} />
    </StageCard>
  )
}

/** 밭 한 판 — 실제 밭 화면(components/garden/GardenScreen.tsx)과 같은 배치 */
function FieldRun({ initial, steps, raining = false, side = 'seeds' }: Omit<FieldProps, 'id' | 'loopMs'>) {
  const boxRef = useRef<HTMLDivElement>(null)
  const { garden, floats, crow, seed, shooed, pointing, pointKey } = useFieldSim(initial, steps, raining)
  const pointer = useElementPointer(boxRef, pointing ? pointing.point : null, pointKey)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 680)

  return (
    <div ref={boxRef} className="relative">
      <div style={{ zoom, width: 680 }}>
        <div ref={contentRef} className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-3">
          <section className="relative overflow-hidden rounded-2xl border-4 border-white/80 bg-gradient-to-b from-sky-300 via-sky-200 to-lime-200 p-3 shadow-2xl">
            {raining && (
              <div className="relative z-[150] mb-1 rounded-xl bg-sky-700/85 px-3 py-1.5 text-center text-sm font-black text-white">
                🌧️ 비가 와요! 쑥쑥 자라고, 다 자란 작물이 💧촉촉해질 수도 있어요
              </div>
            )}
            <div className="relative mx-auto max-w-[340px]">
              <div data-demo="field">
                <IsoGarden garden={garden} raining={raining} activeCrow={crow} floats={floats} onTapPlot={() => undefined} onTapCrow={() => undefined} onExpand={() => undefined} />
              </div>
              <Image unoptimized width={256} height={256} src="/garden/farmer.webp" alt="" className="pointer-events-none absolute bottom-0 left-0 h-auto w-[17%] max-w-[110px] drop-shadow-lg" />
            </div>
            {crow && (
              <div className="relative z-[150] mt-1 rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-black text-white shadow-lg ramen-blink">
                🐦 {crow.fromName}의 까마귀다! 까마귀를 {GARDEN.CROW_SHOO_TAPS}번 톡톡 눌러 쫓아요
              </div>
            )}
            {shooed && (
              <div className="relative z-[150] mt-1 rounded-xl bg-lime-500 px-3 py-2 text-center text-sm font-black text-white shadow-lg">
                까마귀를 쫓았어요! 작물이 무사해요 🌱
              </div>
            )}
          </section>
          {side === 'seeds' ? (
            <div data-demo="seeds">
              <SeedBag seeds={garden.seeds} selected={seed} onSelect={() => undefined} />
            </div>
          ) : (
            <div data-demo="shop">
              <GardenShop garden={garden} onBuySeed={() => undefined} onExpand={() => undefined} onSprinkler={() => undefined} onScarecrow={() => undefined} />
            </div>
          )}
        </div>
      </div>
      <MovingPointer pointer={pointer} />
    </div>
  )
}

/** 밭 상태 만들기: [칸, 작물, 진행도(0~1), 다 자랐을 때 변이] */
function gardenWith(options: {
  clockMs?: number
  coins?: number
  earned?: number
  unlock?: number[]
  crops?: Array<[number, CropId, number, Mutation | null]>
  seeds?: GardenState['seeds']
  shop?: GardenState['shop']
  scarecrows?: number
}): GardenState {
  const garden = createGarden()
  const clockMs = options.clockMs ?? 200000
  garden.clockMs = clockMs
  garden.coins = options.coins ?? garden.coins
  garden.earned = options.earned ?? garden.earned
  garden.seeds = options.seeds ?? garden.seeds
  garden.shop = options.shop ?? garden.shop
  garden.scarecrows = options.scarecrows ?? 0
  const unlock = new Set(options.unlock ?? [])
  garden.plots = garden.plots.map((plot, index) => ({ ...plot, unlocked: plot.unlocked || unlock.has(index) }))
  for (const [index, cropId, progress, mutation] of options.crops ?? []) {
    const def = CROP_BY_ID[cropId]
    garden.plots[index] = {
      unlocked: true,
      crop: { cropId, startedAt: clockMs - def.growMs * progress, needMs: def.growMs, harvestsLeft: def.harvests, mutation: progress >= 1 ? mutation ?? 'none' : null },
    }
  }
  return garden
}

const sim = (garden: GardenState, extra: Partial<FieldSim> = {}): FieldSim => ({ garden, floats: [], crow: null, seed: null, shooed: false, ...extra })

/** 규칙 1 — 퀴즈를 맞히면 무료 카드 3장 중 하나 */
const REWARD_CARDS: RewardCard[] = [
  { kind: 'seed', cropId: 'carrot', count: 2 },
  { kind: 'seed', cropId: 'blueberry', count: 1 },
  { kind: 'seed', cropId: 'watermelon', count: 1 },
]

function QuizScene() {
  const answered = useDelayedFlag(1400)
  const showCards = useDelayedFlag(2800)
  const picked = useDelayedFlag(4600)
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 620)
  const pointer = useElementPointer(
    boxRef,
    showCards ? (box) => box.querySelectorAll('[data-demo="cards"] button')[2] : null,
    showCards ? 1 : 0,
  )

  if (!showCards) {
    return (
      <div key="garden-quiz" style={{ zoom: 0.95 }} className="w-full max-w-2xl">
        <GlassQuizStep question="블록 텃밭에서 다 자란 작물을 누르면 어떻게 될까요?" options={['수확해서 코인이 돼요', '다시 씨앗이 돼요', '친구 밭으로 가요', '사라져요']} correctIndex={0} answered={answered} zoom={0.8} />
      </div>
    )
  }

  return (
    <StageCard id="garden-cards" className="relative">
      <div ref={boxRef} className="relative">
        <div style={{ zoom, width: 620 }}>
          <div ref={contentRef} data-demo="cards">
            <RewardCards cards={REWARD_CARDS} choosingCrowTarget={false} targets={[]} onPick={() => undefined} onSendCrow={() => undefined} onCancelCrow={() => undefined} />
          </div>
        </div>
        <AnimatePresence>
          {picked && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute inset-x-0 top-full mx-auto mt-3 w-fit whitespace-nowrap rounded-full bg-lime-500 px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              🍉 수박 씨앗을 받았어요! 밭으로 가요
            </motion.div>
          )}
        </AnimatePresence>
        {!picked && <MovingPointer pointer={pointer} />}
      </div>
    </StageCard>
  )
}

/** 규칙 2 — 씨앗을 고르고 빈 칸에 심기, 다 자란 작물은 눌러서 수확 */
function PlantScene() {
  const carrot = CROP_BY_ID.carrot
  const initial = sim(
    gardenWith({
      crops: [[5, 'carrot', 1 - 1500 / carrot.growMs, null], [10, 'strawberry', 0.45, null]],
      seeds: { carrot: 1, watermelon: 1 },
      coins: GARDEN.START_COINS,
    }),
  )
  return (
    <Field
      id="garden-plant"
      initial={initial}
      steps={[selectSeed(900, 'watermelon'), plant(1700, 6), harvest(2800, 5), selectSeed(3700, 'carrot'), plant(4500, 9)]}
      loopMs={6600}
    />
  )
}

/** 규칙 3 — 번 돈으로 씨앗을 사고 밭을 넓힌다 */
function ShopScene() {
  const initial = sim(
    gardenWith({
      coins: 320,
      earned: 900,
      crops: [[5, 'strawberry', 0.7, null], [6, 'carrot', 0.3, null], [9, 'tomato', 0.55, null], [10, 'blueberry', 0.2, null]],
      seeds: {},
      shop: { carrot: 3, strawberry: 2, tomato: 1, watermelon: 1 },
    }),
  )
  return (
    <Field
      id="garden-shop"
      side="shop"
      initial={initial}
      steps={[shopSeed(1200, 'watermelon'), expand(2600, UNLOCK_ORDER[GARDEN.START_UNLOCKED])]}
      loopMs={5200}
    />
  )
}

/** 규칙 4 — 황금·무지개·촉촉 작물은 몇 배로 팔린다 (비 오는 밭) */
function MutationScene() {
  const initial = sim(
    gardenWith({
      coins: 600,
      earned: 900,
      unlock: [1, 2, 4, 8],
      crops: [
        [6, 'pumpkin', 1, 'rainbow'],
        [5, 'strawberry', 1, 'gold'],
        [9, 'watermelon', 1, 'wet'],
        [10, 'carrot', 1, 'none'],
        [1, 'corn', 0.5, null],
        [2, 'tomato', 0.8, null],
        [8, 'blueberry', 0.3, null],
      ],
      seeds: { carrot: 2 },
    }),
  )
  return <Field id="garden-mutation" raining initial={initial} steps={[harvest(1000, 6), harvest(2000, 5), harvest(3000, 9)]} loopMs={5200} />
}

/** 규칙 5 — 친구가 보낸 까마귀는 3번 톡톡 눌러 쫓는다 */
function CrowScene() {
  const initial = sim(
    gardenWith({
      coins: 450,
      earned: 6800,
      unlock: [1, 2],
      crops: [[6, 'watermelon', 0.85, null], [5, 'strawberry', 0.6, null], [9, 'carrot', 0.4, null], [10, 'tomato', 0.7, null], [1, 'corn', 0.3, null]],
      seeds: { carrot: 1 },
    }),
    { crow: { crowId: 'demo', fromName: '냥냥이', plotIndex: 6, tapsLeft: GARDEN.CROW_SHOO_TAPS, leftMs: GARDEN.CROW_PECK_MS } },
  )
  return <Field id="garden-crow" initial={initial} steps={[tapCrow(1300), tapCrow(1800), tapCrow(2300)]} loopMs={5200} />
}

const EARNED_AFTER_PLANT = CROP_BY_ID.carrot.value
const EARNED_AFTER_MUTATION =
  900 +
  CROP_BY_ID.pumpkin.value * GARDEN.RAINBOW_MULT +
  CROP_BY_ID.strawberry.value * GARDEN.GOLD_MULT +
  CROP_BY_ID.watermelon.value * GARDEN.WET_MULT

export default function GardenTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="garden"
      backgroundClassName="bg-[linear-gradient(180deg,#7dd3fc_0%,#bae6fd_45%,#bbf7d0_75%,#86efac_100%)]"
      chips={(phase) => [
        phase === 'plant'
          ? { label: '번 돈', value: EARNED_AFTER_PLANT, from: 0, suffix: '코인', tone: 'emerald' }
          : phase === 'mutation'
            ? { label: '번 돈', value: EARNED_AFTER_MUTATION, from: 900, suffix: '코인', tone: 'emerald' }
            : { label: '번 돈', value: phase === 'quiz' ? 0 : phase === 'shop' ? 900 : EARNED_AFTER_MUTATION, suffix: '코인', tone: 'emerald' },
      ]}
      /* 규칙 5장과 1:1 — lib/game/tutorials.ts 의 garden 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 6200, step: 1, caption: '정답이면 무료 씨앗 카드 3장 중 하나!' },
        { key: 'plant', duration: 6400, step: 2, caption: '씨앗을 고르고 빈 칸에 심기, 다 자라면 눌러서 수확' },
        { key: 'shop', duration: 5000, step: 3, caption: '번 돈으로 씨앗을 사고 밭을 넓혀요' },
        { key: 'mutation', duration: 5000, step: 4, caption: '🌈무지개 ×10 · ✨황금 ×3 · 💧촉촉 ×2!' },
        { key: 'crow', duration: 5000, step: 5, caption: '친구 까마귀는 3번 톡톡! 번 돈이 가장 많으면 1등' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'plant') return <PlantScene key="plant" />
        if (phase === 'shop') return <ShopScene key="shop" />
        if (phase === 'mutation') return <MutationScene key="mutation" />
        return <CrowScene key="crow" />
      }}
    </TutorialDemoFrame>
  )
}
