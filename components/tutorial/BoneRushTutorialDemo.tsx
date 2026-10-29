'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import BoneRushArena from '@/components/bone-rush/BoneRushArena'
import BoneRushHudBar from '@/components/bone-rush/BoneRushHudBar'
import BoneRushCards from '@/components/bone-rush/BoneRushCards'
import {
  BONE_RUSH,
  admitCat,
  applyCard,
  createBoneRushState,
  type BoneRushState,
  type Card,
  type StepInput,
} from '@/lib/game/boneRush'
import type { BoneRushHud } from '@/hooks/useBoneRushGame'
import type { Database } from '@/types/database.types'
import { TutorialDemoFrame, GlassQuizStep, StageCard, useDelayedFlag, PLAYER_NAME, RIVALS } from '@/components/tutorial/TutorialDemoFrame'
import { MovingPointer, useElementPointer, useFrameFitZoom } from '@/components/tutorial/demoPointer'

/**
 * 뼈다귀 쟁탈전 — 실제 게임과 같은 재료로 그린다:
 *   마당 캔버스(BoneRushArena, 규칙 엔진 stepBoneRush 그대로) · 숫자판(BoneRushHudBar) · 카드(BoneRushCards) · 퀴즈(GlassQuizStep)
 * 퀴즈독은 대본 입력(inputRef)으로 움직인다 — 뼈다귀·상자 쪽으로 달리고, 고양이가 오면 반대로 도망친다.
 * 장면 4개는 튜토리얼 규칙 4장(lib/game/tutorials.ts 의 bone_rush)과 1:1.
 */

type Player = Database['public']['Tables']['players']['Row']

const YARD_W = 680
const YARD_H = 425

/** 대본 입력: 'collect' 뼈다귀·상자 쪽으로, 'flee' 고양이 반대쪽으로 */
function useScriptedDog(stateRef: React.MutableRefObject<BoneRushState>, mode: 'collect' | 'flee' | 'still') {
  const inputRef = useRef<StepInput>({ mx: 0, my: 0 })
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = stateRef.current
      const p = s.player
      let mx = 0
      let my = 0
      if (mode === 'flee') {
        const cat = s.cats.filter((c) => c.kind !== 'courier' && !c.blocked && c.phase !== 'leave').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]
        if (cat) {
          const dx = p.x - cat.x
          const dy = p.y - cat.y
          const d = Math.hypot(dx, dy) || 1
          mx = dx / d
          my = dy / d
          // 벽에 몰리지 않게 가운데 쪽으로 살짝
          mx += (s.yard.w / 2 - p.x) / s.yard.w
          my += (s.yard.h / 2 - p.y) / s.yard.h
        }
      } else if (mode === 'collect') {
        const chest = s.chest && s.chest.phase === 'wait' ? s.chest : null
        const target = chest ?? s.pickups.filter((item) => !item.pulled && item.value > 0).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]
        if (target) {
          const dx = target.x - p.x
          const dy = target.y - p.y
          const d = Math.hypot(dx, dy) || 1
          if (d > 6) {
            mx = dx / d
            my = dy / d
          }
        }
      }
      inputRef.current = { mx, my }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mode, stateRef])
  return inputRef
}

function readHud(s: BoneRushState): BoneRushHud {
  return {
    bones: s.bones,
    fences: s.fences,
    magnetMs: s.magnetMs,
    playMs: Math.floor(s.playMs / 1000) * 1000,
    cats: s.cats.filter((c) => c.kind !== 'courier' && c.phase !== 'leave').length,
    collected: s.stats.collected,
    looted: s.stats.looted,
  }
}

/** 마당에 뼈다귀를 미리 뿌려 둔다 */
function seedBones(s: BoneRushState, count: number) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + 0.4
    const r = 120 + (i % 3) * 70
    s.pickups.push({ id: s.nextId++, kind: i === 2 ? 'gold' : 'bone', x: s.yard.w / 2 + Math.cos(a) * r, y: s.yard.h / 2 + Math.sin(a) * r, vx: 0, vy: 0, value: i === 2 ? BONE_RUSH.GOLD_BONE_VALUE : 1, pulled: false, age: 1000 })
  }
}

type YardProps = {
  stateRef: React.MutableRefObject<BoneRushState>
  mode: 'collect' | 'flee' | 'still'
  running: boolean
  banner?: string | null
  bannerTone?: 'warn' | 'good'
}

/** 실제 마당 화면 — 캔버스 + 숫자판을 튜토리얼 프레임 크기에 맞춰 통째로 줄인다 */
function Yard({ stateRef, mode, running, banner, bannerTone = 'warn' }: YardProps) {
  const inputRef = useScriptedDog(stateRef, mode)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, YARD_W, 210, 1.3)
  const [hud, setHud] = useState<BoneRushHud>(() => readHud(stateRef.current))
  useEffect(() => {
    const timer = window.setInterval(() => setHud(readHud(stateRef.current)), 200)
    return () => window.clearInterval(timer)
  }, [stateRef])
  return (
    <div style={{ zoom, width: YARD_W }}>
      <div ref={contentRef} className="relative overflow-hidden rounded-2xl border-4 border-white/80 shadow-2xl font-bitbit" style={{ height: YARD_H }}>
        <BoneRushArena stateRef={stateRef} running={running} onEvents={() => undefined} inputRef={inputRef} />
        <BoneRushHudBar hud={hud} nickname={PLAYER_NAME} rank={2} total={4} />
        <AnimatePresence>
          {banner && (
            <div className="pointer-events-none absolute inset-x-0 top-[30%] z-[35] flex justify-center px-4">
              <motion.div
                key={banner}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                className={`rounded-2xl border-4 border-slate-900 px-5 py-3 text-center text-lg font-black shadow-[0_6px_0_#0f172a] break-keep ${bannerTone === 'good' ? 'bg-lime-300' : 'bg-yellow-300'} text-slate-900`}
              >
                {banner}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** 규칙 1 — 마당을 뛰어다니며 뼈다귀를 주우면 꼬리처럼 따라온다 */
function CollectScene() {
  const stateRef = useRef<BoneRushState>(null as unknown as BoneRushState)
  if (!stateRef.current) {
    const s = createBoneRushState(null, { w: 1000, h: 625 })
    s.bones = 4
    s.nextChestMs = 1e9
    s.nextWildMs = 1e9
    seedBones(s, 8)
    stateRef.current = s
  }
  return (
    <StageCard id="bone-collect" className="relative">
      <Yard stateRef={stateRef} mode="collect" running />
    </StageCard>
  )
}

/** 카드 무대 — 나타나는 순간 크기를 잰다(장면 안에서 늦게 붙어도 zoom 이 맞게). 폰은 좁은 폭으로 그린다 */
function CardsStage({ id, choosingTarget, targets, pointTo, pointKey, toast }: {
  id: string
  choosingTarget: boolean
  targets: Player[]
  pointTo: ((box: HTMLElement) => Element | null | undefined) | null
  pointKey: number
  toast?: string | null
}) {
  // 서버 HTML 과 같게 620 으로 시작하고, 붙은 뒤 폰이면 좁힌다 (hydration 오류 방지)
  const [baseWidth, setBaseWidth] = useState(620)
  useEffect(() => { if (window.innerWidth < 640) setBaseWidth(400) }, [])
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, baseWidth, 200, 1)
  const pointer = useElementPointer(boxRef, pointTo, pointKey)
  return (
    <StageCard id={id} className="relative">
      <div ref={boxRef} className="relative">
        <div style={{ zoom, width: baseWidth }}>
          <div ref={contentRef} data-demo="cards" className="font-bitbit">
            <BoneRushCards cards={DEMO_CARDS} fences={0} choosingTarget={choosingTarget} targets={targets} onPick={() => undefined} onSendCat={() => undefined} onCancelTarget={() => undefined} />
          </div>
        </div>
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute inset-x-0 top-full mx-auto mt-3 w-fit whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <MovingPointer pointer={pointer} />
      </div>
    </StageCard>
  )
}

/** 규칙 2 — 보물 상자 = 문제. 맞히면 카드 3장 중 하나 */
const DEMO_CARDS: Card[] = [{ kind: 'sack', bones: BONE_RUSH.SACK_BONES, gold: false }, { kind: 'cat' }, { kind: 'fence' }]

function ChestScene() {
  const stateRef = useRef<BoneRushState>(null as unknown as BoneRushState)
  if (!stateRef.current) {
    const s = createBoneRushState(null, { w: 1000, h: 625 })
    s.bones = 9
    s.nextWildMs = 1e9
    s.chest = { id: s.nextId++, x: 780, y: 300, age: 0, phase: 'wait', phaseMs: 0 }
    s.nextChestMs = 1e9
    stateRef.current = s
  }
  const quiz = useDelayedFlag(1500)
  const answered = useDelayedFlag(2700)
  const showCards = useDelayedFlag(4000)
  const picked = useDelayedFlag(5800)

  useEffect(() => {
    if (!picked) return
    const s = stateRef.current
    s.pendingQuiz = true
    applyCard(s, DEMO_CARDS[0])
  }, [picked])

  if (!quiz || picked) {
    return (
      <StageCard id="bone-chest-yard" className="relative">
        <Yard stateRef={stateRef} mode={picked ? 'still' : 'collect'} running banner={picked ? `🦴 뼈다귀 ${BONE_RUSH.SACK_BONES}개를 받았어요!` : null} bannerTone="good" />
      </StageCard>
    )
  }
  if (!showCards) {
    return (
      <div key="bone-quiz" className="w-full max-w-2xl">
        <GlassQuizStep question="뼈다귀 쟁탈전에서 보물 상자에 닿으면 어떻게 될까요?" options={['문제가 나와요', '뼈다귀가 사라져요', '고양이가 나와요', '게임이 끝나요']} correctIndex={0} answered={answered} zoom={0.8} />
      </div>
    )
  }
  return <CardsStage id="bone-cards" choosingTarget={false} targets={[]} pointTo={(box) => box.querySelectorAll('[data-demo="cards"] button')[0]} pointKey={1} />
}

/** 규칙 3 — 도둑 고양이 카드 → 친구 고르기 */
const TARGETS: Player[] = RIVALS.map((rival, i) => ({
  id: `rival-${i}`,
  room_code: 'DEMO',
  nickname: rival.name,
  avatar: rival.avatar,
  score: [31, 18, 12][i],
  gold: 0,
  is_online: true,
  is_kicked: false,
  created_at: '',
  updated_at: '',
}) as unknown as Player)

function CatScene() {
  const choosing = useDelayedFlag(1700)
  const sent = useDelayedFlag(3600)
  return (
    <CardsStage
      id="bone-cat"
      choosingTarget={choosing}
      targets={TARGETS}
      pointTo={sent ? null : choosing
        ? (box) => [...box.querySelectorAll('[data-demo="cards"] button')].find((b) => (b.textContent ?? '').includes(RIVALS[0].name))
        : (box) => box.querySelectorAll('[data-demo="cards"] button')[1]}
      pointKey={choosing ? 1 : 0}
      toast={sent ? `😼 ${RIVALS[0].name}의 마당으로 도둑 고양이가 달려갔어요!` : null}
    />
  )
}

/** 규칙 4 — 내 마당에 고양이가 오면 도망치고, 퀴즈독이 짖어 밀어낸다. 울타리는 고양이를 막는다 */
function DefendScene() {
  const stateRef = useRef<BoneRushState>(null as unknown as BoneRushState)
  if (!stateRef.current) {
    const s = createBoneRushState(null, { w: 1000, h: 625 })
    s.bones = 22
    s.nextChestMs = 1e9
    s.nextWildMs = 1e9
    s.player.x = 380
    s.player.y = 330
    // 꼬리가 바로 보이게 지나온 길을 만들어 둔다
    s.trail = Array.from({ length: 40 }, (_, i) => ({ x: 380 - (40 - i) * 10, y: 330 + Math.sin(i / 4) * 24, d: i * 10.5 }))
    admitCat(s, { catId: 'demo-cat-1', fromId: 'rival-0', fromName: RIVALS[0].name }, () => 0.3)
    stateRef.current = s
  }
  const fenced = useDelayedFlag(3600)
  const blocked = useDelayedFlag(4300)
  useEffect(() => {
    if (!fenced) return
    const s = stateRef.current
    s.fences = 1
    s.cats = s.cats.filter((c) => c.catId !== 'demo-cat-1')
  }, [fenced])
  useEffect(() => {
    if (!blocked) return
    admitCat(stateRef.current, { catId: 'demo-cat-2', fromId: 'rival-1', fromName: RIVALS[1].name }, () => 0.8)
  }, [blocked])
  const banner = useMemo(() => {
    if (blocked) return `🛡️ ${RIVALS[1].name}의 고양이를 울타리가 막았어요!`
    if (fenced) return '🛡️ 울타리를 세웠어요'
    return `😼 ${RIVALS[0].name}의 도둑 고양이! 도망쳐요!`
  }, [blocked, fenced])
  return (
    <StageCard id="bone-defend" className="relative">
      <Yard stateRef={stateRef} mode={fenced ? 'still' : 'flee'} running banner={banner} bannerTone={fenced ? 'good' : 'warn'} />
    </StageCard>
  )
}

export default function BoneRushTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="bone_rush"
      backgroundClassName="bg-[linear-gradient(180deg,#bbf7d0_0%,#86efac_60%,#4ade80_100%)]"
      chips={(phase) => [
        phase === 'collect'
          ? { label: '뼈다귀', value: 12, from: 4, suffix: '개', tone: 'amber' }
          : phase === 'chest'
            ? { label: '뼈다귀', value: 9 + BONE_RUSH.SACK_BONES, from: 9, suffix: '개', tone: 'amber' }
            : { label: '뼈다귀', value: phase === 'cat' ? 14 : 22, suffix: '개', tone: 'amber' },
        { label: '울타리', value: phase === 'defend' ? 1 : 0, suffix: `/${BONE_RUSH.FENCE_MAX}`, tone: 'sky' },
      ]}
      /* 규칙 4장과 1:1 — lib/game/tutorials.ts 의 bone_rush 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'collect', duration: 5600, step: 1, caption: '마당을 뛰어다니며 뼈다귀를 주워요 — 꼬리가 길수록 점수!' },
        { key: 'chest', duration: 8000, step: 2, caption: '보물 상자에 닿으면 문제! 맞히면 카드 3장 중 하나' },
        { key: 'cat', duration: 5600, step: 3, caption: '도둑 고양이를 친구 마당에 보내 뼈다귀를 훔쳐 와요' },
        { key: 'defend', duration: 7200, step: 4, caption: '고양이가 오면 도망쳐요! 퀴즈독이 짖고, 울타리가 막아요' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'collect') return <CollectScene key="collect" />
        if (phase === 'chest') return <ChestScene key="chest" />
        if (phase === 'cat') return <CatScene key="cat" />
        return <DefendScene key="defend" />
      }}
    </TutorialDemoFrame>
  )
}
