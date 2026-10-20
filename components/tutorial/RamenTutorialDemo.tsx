'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import KitchenScene from '@/components/ramen/KitchenScene'
import CustomerRow from '@/components/ramen/CustomerRow'
import RamenPot from '@/components/ramen/RamenPot'
import IngredientBar from '@/components/ramen/IngredientBar'
import RoundResultCard from '@/components/ramen/RoundResultCard'
import {
  RAMEN,
  addIngredient,
  createEmptyStats,
  createPot,
  evaluatePot,
  getPatienceMs,
  resolveRound,
  type Customer,
  type IngredientId,
  type Pot,
} from '@/lib/game/ramen'
import { TutorialDemoFrame, GlassQuizStep, StageCard, useDelayedFlag } from '@/components/tutorial/TutorialDemoFrame'
import { FitOverlay, MovingPointer, useElementPointer, useFrameFitZoom } from '@/components/tutorial/demoPointer'

/**
 * 퀴즈독의 라면가게 — 실제 게임과 같은 재료로 그린다:
 *   주방(KitchenScene) · 손님 줄(CustomerRow) · 냄비(RamenPot) · 재료 선반(IngredientBar) · 판 결과(RoundResultCard)
 * 냄비 시간은 실제처럼 rAF 로 흐르고, 재료 넣기·서빙 판정은 lib/game/ramen.ts 의 addIngredient·evaluatePot 를 그대로 쓴다.
 * 장면 5개는 튜토리얼 규칙 5장(lib/game/tutorials.ts 의 ramen)과 1:1.
 */

/** 장면마다 같은 손님이 나오도록 고정 (아바타는 public/character/N.webp) */
const CUSTOMERS: Customer[] = [
  { avatar: 5, name: '배고픈 손님', order: '라면 하나요!' },
  { avatar: 11, name: '단골 손님', order: '파랑 계란 꼭 넣어 주세요!' },
  { avatar: 17, name: '하교하는 학생', order: '빨리요, 배고파요!' },
]
const MONEY_START = 6600
const MONEY_AFTER_ONE = MONEY_START + 1000
/** 판정 문구를 고정 — 실제 게임의 랜덤 대사 중 첫 줄 */
const FIXED_RAND = () => 0

type Sim = { pots: Pot[]; selected: number }
type SimStep = {
  at: number
  run: (sim: Sim) => Sim
  /** 이 동작 직전에 포인터가 가리킬 실제 버튼 */
  point: (box: HTMLElement) => Element | null | undefined
}

const findIngredient = (label: string) => (box: HTMLElement) => box.querySelector(`img[alt="${label}"]`)?.closest('button')
const findPot = (index: number) => (box: HTMLElement) => box.querySelectorAll('[role="button"]')[index]
const findServe = (index: number) => (box: HTMLElement) => box.querySelectorAll('[role="button"]')[index]?.querySelector('button')

const LABEL: Record<IngredientId, string> = { noodle: '면', soup: '스프', water: '물', leek: '파', egg: '계란' }

function add(at: number, id: IngredientId): SimStep {
  return {
    at,
    point: findIngredient(LABEL[id]),
    run: (sim) => ({ ...sim, pots: sim.pots.map((pot) => (pot.index === sim.selected ? addIngredient(pot, id) : pot)) }),
  }
}

function select(at: number, index: number): SimStep {
  return { at, point: findPot(index), run: (sim) => ({ ...sim, selected: index }) }
}

/** 쟁반에 올리면 실제 게임처럼 선택이 아직 안 끝난 다음 냄비로 넘어간다 */
function serve(at: number, index: number): SimStep {
  return {
    at,
    point: findServe(index),
    run: (sim) => {
      const pots = sim.pots.map((pot) => (pot.index === index ? { ...pot, result: evaluatePot(pot, FIXED_RAND) } : pot))
      const next = pots.find((pot) => !pot.result && pot.index > index) ?? pots.find((pot) => !pot.result)
      return { pots, selected: next ? next.index : sim.selected }
    },
  }
}

function potWith(index: number, parts: Partial<Pot>): Pot {
  return { ...createPot(index), ...parts }
}

/**
 * 냄비 시간 흐르기 + 대본대로 재료 넣기. 물이 든 냄비는 실제 훅(useRamenGame)처럼 프레임 시간만큼 cookMs 가 늘어난다.
 * 대본 동작은 ref 로 한 번씩만 적용한다 (StrictMode 에서 updater 가 두 번 돌아도 두 번 넣지 않게).
 */
function usePotSim(initial: Sim, steps: SimStep[]) {
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
      sim = { ...sim, pots: sim.pots.map((pot) => (pot.water && !pot.result ? { ...pot, cookMs: pot.cookMs + dt } : pot)) }
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
  return { ...state.sim, elapsed: state.elapsed, pointing, pointKey: pointing ? state.applied : -1 }
}

type KitchenProps = { id: string; customers: Customer[]; initial: Sim; steps: SimStep[]; patienceStartMs?: number; loopMs: number }

/**
 * 선생님이 규칙 한 장에 오래 머물러도 냄비가 타 버리지 않게, 대본이 끝나면 처음부터 다시 돈다.
 */
function Kitchen({ loopMs, ...props }: KitchenProps) {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setEpoch((value) => value + 1), loopMs)
    return () => clearInterval(timer)
  }, [loopMs])
  return (
    <StageCard id={props.id} className="relative">
      <KitchenRun key={epoch} {...props} />
    </StageCard>
  )
}

/** 주방 한 판 — 실제 게임 화면(app/ramen/page.tsx 의 주방 뷰)과 같은 배치 */
function KitchenRun({ customers, initial, steps, patienceStartMs }: Omit<KitchenProps, 'loopMs'>) {
  const boxRef = useRef<HTMLDivElement>(null)
  const { pots, selected, elapsed, pointing, pointKey } = usePotSim(initial, steps)
  const pointer = useElementPointer(boxRef, pointing ? pointing.point : null, pointKey)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 600)
  const patienceTotalMs = getPatienceMs(customers.length)
  const patienceLeftMs = Math.max(0, (patienceStartMs ?? patienceTotalMs) - elapsed)
  const selectedPot = pots.find((pot) => pot.index === selected) ?? null

  return (
    <div ref={boxRef} className="relative">
      <div style={{ zoom, width: 600 }}>
        <div ref={contentRef}>
          <KitchenScene>
            <CustomerRow customers={customers} pots={pots} patienceTotalMs={patienceTotalMs} patienceLeftMs={patienceLeftMs} />
            <div className={`mt-6 grid gap-3 sm:gap-4 ${pots.length === 1 ? 'mx-auto max-w-[220px] grid-cols-1' : pots.length === 2 ? 'mx-auto max-w-md grid-cols-2' : 'grid-cols-3'}`}>
              {pots.map((pot) => (
                <RamenPot
                  key={pot.index}
                  pot={pot}
                  selected={selected === pot.index && !pot.result}
                  onSelect={() => undefined}
                  onServe={() => undefined}
                  compact
                />
              ))}
            </div>
            <div className="mt-4">
              <IngredientBar pot={selectedPot && !selectedPot.result ? selectedPot : null} onAdd={() => undefined} />
            </div>
          </KitchenScene>
        </div>
      </div>
      <MovingPointer pointer={pointer} />
    </div>
  )
}

/** 규칙 1 — 퀴즈를 맞히면 손님이 온다. 퀴즈+알림 띠를 통째로 무대 높이에 맞춰 줄인다 */
function QuizScene() {
  const answered = useDelayedFlag(1400)
  const arrived = useDelayedFlag(2600)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 560)
  return (
    <div key="ramen-quiz" style={{ zoom, width: 560 }}>
      <div ref={contentRef} className="flex flex-col items-center gap-3">
        <GlassQuizStep question="라면가게에서 넣는 순간 타이머가 시작되는 재료는?" options={['물', '계란', '파', '스프']} correctIndex={0} answered={answered} zoom={0.8} />
        {/* 자리를 미리 잡아 두어 띠가 나와도 높이가 바뀌지 않게 한다 */}
        <div className="flex h-14 items-center">
          <AnimatePresence>
            {arrived && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-center"
              >
                <span className="text-xl font-extrabold text-violet-700">🔔 손님 2명이 왔어요!</span>
                <span className="ml-2 text-sm font-bold text-violet-600">냄비 2개를 동시에 끓여요</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** 규칙 2 — 면·스프는 아무 때나, 물을 붓는 순간 타이머 시작 */
function BasicsScene() {
  return (
    <Kitchen
      id="ramen-basics"
      customers={CUSTOMERS.slice(0, 1)}
      initial={{ pots: [createPot(0)], selected: 0 }}
      steps={[add(1000, 'noodle'), add(1800, 'soup'), add(2600, 'water')]}
      loopMs={6000}
    />
  )
}

/** 규칙 3 — 끓을 때 파·계란 → 바로 쟁반 = 1,000원 */
function BoilScene() {
  return (
    <Kitchen
      id="ramen-boil"
      customers={CUSTOMERS.slice(0, 1)}
      initial={{ pots: [potWith(0, { noodle: true, soup: true, water: true, cookMs: RAMEN.HEAT_MS - 1100 })], selected: 0 }}
      steps={[add(1700, 'leek'), add(2300, 'egg'), serve(3000, 0)]}
      patienceStartMs={getPatienceMs(1) - 8000}
      loopMs={5600}
    />
  )
}

/** 규칙 4 — 냄비 여러 개를 동시에: 끓는 냄비부터 내보내고, 기다리는 동안 다른 냄비에 물을 붓는다 */
function MultiScene() {
  return (
    <Kitchen
      id="ramen-multi"
      customers={CUSTOMERS}
      initial={{
        pots: [
          potWith(0, { noodle: true, soup: true, water: true, cookMs: RAMEN.HEAT_MS - 400 }),
          potWith(1, { noodle: true, soup: true, water: true, cookMs: 900 }),
          potWith(2, { noodle: true, soup: true }),
        ],
        selected: 0,
      }}
      steps={[
        add(900, 'leek'), add(1400, 'egg'), serve(1900, 0),
        select(2700, 2), add(3300, 'water'),
        select(4000, 1), add(4500, 'leek'), add(5000, 'egg'), serve(5600, 1),
      ]}
      patienceStartMs={getPatienceMs(3) - 6000}
      loopMs={7400}
    />
  )
}

/** 규칙 5 — 판 결과: 세 냄비 완벽 + 10,000원 달성 (실제 RoundResultCard · resolveRound) */
const PERFECT_POT = potWith(0, { noodle: true, soup: true, water: true, leek: 'boiling', egg: 'boiling', cookMs: RAMEN.HEAT_MS + 500 })
const FINAL_OUTCOME = resolveRound(
  createEmptyStats(),
  CUSTOMERS,
  CUSTOMERS.map(() => evaluatePot(PERFECT_POT, FIXED_RAND)),
  MONEY_AFTER_ONE,
)

function ResultScene() {
  return (
    <StageCard id="ramen-result" className="relative">
      {/* RoundResultCard 는 fixed 오버레이라 프레임(translateZ) 안에 갇힌다 — 카드는 세로로 길어 프레임 높이에 맞춰 줄인다 */}
      <FitOverlay naturalHeight={720}>
        <RoundResultCard outcome={FINAL_OUTCOME} onClose={() => undefined} />
      </FitOverlay>
    </StageCard>
  )
}

export default function RamenTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="ramen"
      backgroundClassName="bg-[linear-gradient(180deg,#3b2a1a_0%,#2a1a10_100%)]"
      chips={(phase) => [
        phase === 'boil'
          ? { label: '매출', value: MONEY_AFTER_ONE, from: MONEY_START, suffix: '원', tone: 'amber' }
          : phase === 'result'
            ? { label: '매출', value: MONEY_AFTER_ONE + FINAL_OUTCOME.money, from: MONEY_AFTER_ONE, suffix: '원', tone: 'amber' }
            : { label: '매출', value: phase === 'multi' ? MONEY_AFTER_ONE : MONEY_START, suffix: '원', tone: 'amber' },
      ]}
      /* 규칙 5장과 1:1 — lib/game/tutorials.ts 의 ramen 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 4400, step: 1, caption: '퀴즈를 맞히면 손님이 와요 — 손님 수만큼 냄비!' },
        { key: 'basics', duration: 5600, step: 2, caption: '면·스프 먼저, 물을 부으면 타이머 시작' },
        { key: 'boil', duration: 5200, step: 3, caption: '「끓는다!」 때 파·계란 → 바로 쟁반에 = 1,000원' },
        { key: 'multi', duration: 7000, step: 4, caption: '끓는 동안 다른 냄비도 준비해요' },
        { key: 'result', duration: 4600, step: 5, caption: '번 돈이 가장 많으면 1등! 10,000원마다 축하' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'basics') return <BasicsScene key="basics" />
        if (phase === 'boil') return <BoilScene key="boil" />
        if (phase === 'multi') return <MultiScene key="multi" />
        return <ResultScene key="result" />
      }}
    </TutorialDemoFrame>
  )
}
