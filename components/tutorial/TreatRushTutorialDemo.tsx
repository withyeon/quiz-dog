'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import ItemGlyph from '@/components/ItemGlyph'
import QuizSetName from '@/components/game/QuizSetName'
import { ITEM_DEFS } from '@/lib/game/간식런'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import {
  TutorialDemoFrame,
  MiniLeaderboard,
  StageCard,
  TapPointer,
  DEMO_SET_NAME,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 간식런 — 실제 게임과 같은 재료로 그린다:
 *   하늘·스카이라인·나무(public/gansik-run/bg) · 강아지 달리기 4프레임 · 뼈다귀 · 아이템 박스 · 장애물 스프라이트
 *   HUD(뼈 점수·타이머) · 퀴즈 슬라이드업 시트("⚡ QUIZ TIME") · ITEM GET 컷인은 간식런Game.tsx 와 같은 스타일
 *   (lib/game/간식런.ts · components/간식런Game.tsx)
 * 장면 3개는 튜토리얼 규칙 3장과 1:1.
 */

const FONT = { fontFamily: "'DNFBitBitv2', sans-serif" } as const
const DOG_FRAMES = ['/gansik-run/dog.webp', '/gansik-run/dog-2.webp', '/gansik-run/dog-3.webp', '/gansik-run/dog-4.webp']
/** 실제 선택지 색 (간식런Game.tsx OPTION_COLORS) */
const OPTION_COLORS = [
  ['#ef4444', '#dc2626'],
  ['#3b82f6', '#2563eb'],
  ['#f59e0b', '#d97706'],
  ['#10b981', '#059669'],
]
const ITEM = ITEM_DEFS.booster

/** 강아지 달리기 — 실제 렌더러처럼 4프레임을 0.4초에 한 걸음으로 돌린다 */
function RunningDog({ size = 96, jumping = false }: { size?: number; jumping?: boolean }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % DOG_FRAMES.length), 100)
    return () => clearInterval(timer)
  }, [])
  return (
    <motion.div animate={jumping ? { y: [0, -70, 0] } : { y: 0 }} transition={{ duration: 0.9 }} className="relative" style={{ width: size, height: size }}>
      <Image src={jumping ? '/gansik-run/dog-jump.webp' : DOG_FRAMES[frame]} alt={PLAYER_NAME} fill className="object-contain drop-shadow-[0_10px_8px_rgba(0,0,0,0.5)]" sizes={`${size}px`} />
    </motion.div>
  )
}

/** 도로 위를 흘러 내려오는 물체 (뼈다귀·박스·장애물) */
function Rolling({ src, left, size, delay = 0, duration = 2.4, scaleEnd = 1.6 }: { src: string; left: string; size: number; delay?: number; duration?: number; scaleEnd?: number }) {
  return (
    <motion.div
      className="absolute"
      style={{ left, top: '38%', width: size, height: size, marginLeft: -size / 2 }}
      initial={{ y: 0, scale: 0.35, opacity: 0 }}
      animate={{ y: [0, 190], scale: [0.35, scaleEnd], opacity: [0, 1, 1] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeIn', times: [0, 0.15, 1] }}
    >
      <Image src={src} alt="" fill className="object-contain" sizes={`${size}px`} />
    </motion.div>
  )
}

/** 실제 HUD — 뼈 점수 · 문제집 · 타이머 (간식런Game.tsx 상단과 같은 스타일) */
function RunHud({ score, speed }: { score: number; speed?: boolean }) {
  return (
    <div className="absolute inset-x-0 top-0 z-10" style={FONT}>
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)' }}>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="white"><ellipse cx="8" cy="7" rx="3" ry="2" /><circle cx="3.5" cy="5.5" r="2" /><circle cx="3.5" cy="8.5" r="2" /><circle cx="12.5" cy="5.5" r="2" /><circle cx="12.5" cy="8.5" r="2" /></svg>
          </div>
          <span className="text-xl font-bold tabular-nums text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5), 0 0 10px rgba(245,158,11,0.3)' }}>{score.toLocaleString()}</span>
        </div>
        <QuizSetName title={DEMO_SET_NAME} tone="dark" />
        <div className="rounded-lg px-3 py-1 text-lg font-bold tabular-nums text-white" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          04:30
        </div>
      </div>
      {speed && (
        <div className="-mt-1 flex justify-center">
          <div className="animate-pulse rounded-full px-3 py-0.5 text-xs font-bold text-white" style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.8), rgba(239,68,68,0.8))', boxShadow: '0 0 12px rgba(249,115,22,0.4)' }}>
            ⚡ 2x SPEED
          </div>
        </div>
      )}
    </div>
  )
}

/** 밤길 도로 무대 — 하늘·스카이라인·나무는 실제 배경 그림, 도로는 실제처럼 원근 사다리꼴 */
function Road({ children, hud }: { children?: React.ReactNode; hud: React.ReactNode }) {
  return (
    <div className="relative h-[292px] w-full max-w-[520px] overflow-hidden rounded-2xl border-2 border-white/20 bg-[#0b1226] shadow-2xl">
      <Image src="/gansik-run/bg/sky.webp" alt="" fill className="object-cover object-top" sizes="520px" />
      <div className="absolute inset-x-0 top-[22%] h-[18%]">
        <Image src="/gansik-run/bg/skyline.webp" alt="" fill className="object-cover object-bottom" sizes="520px" />
      </div>
      {/* 풀밭 + 도로 */}
      <div className="absolute inset-x-0 bottom-0 top-[38%] bg-[#1d4a2a]" />
      <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'linear-gradient(180deg, #1c1c22, #2b2b33)', clipPath: 'polygon(44% 0, 56% 0, 96% 100%, 4% 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'repeating-linear-gradient(180deg, #facc15 0 10px, transparent 10px 22px)', clipPath: 'polygon(44% 0, 44.6% 0, 5.2% 100%, 4% 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'repeating-linear-gradient(180deg, #facc15 0 10px, transparent 10px 22px)', clipPath: 'polygon(55.4% 0, 56% 0, 96% 100%, 94.8% 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.7) 0 14px, transparent 14px 30px)', clipPath: 'polygon(47.8% 0, 48.2% 0, 34.6% 100%, 33.4% 100%)' }} />
      <div className="absolute inset-x-0 bottom-0 top-[38%]" style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.7) 0 14px, transparent 14px 30px)', clipPath: 'polygon(51.8% 0, 52.2% 0, 66.6% 100%, 65.4% 100%)' }} />
      {/* 나무 */}
      {[
        { left: '6%', top: '46%', size: 54 }, { left: '14%', top: '60%', size: 74 }, { left: '2%', top: '72%', size: 92 },
        { left: '88%', top: '46%', size: 54 }, { left: '82%', top: '60%', size: 74 }, { left: '92%', top: '72%', size: 92 },
      ].map((t, i) => (
        <Image key={i} src={i % 2 ? '/gansik-run/bg/tree-2.webp' : '/gansik-run/bg/tree.webp'} alt="" width={t.size} height={t.size} className="absolute object-contain" style={{ left: t.left, top: t.top, width: t.size, height: t.size, marginLeft: -t.size / 2 }} />
      ))}
      <Image src="/gansik-run/bg/prop.webp" alt="" width={52} height={72} className="absolute right-[6%] top-[52%] h-[72px] w-[52px] object-contain" />
      {hud}
      {children}
    </div>
  )
}

/** 규칙 1 — 목표: 뼈다귀를 먹고 장애물을 피하며 오래 달린다 */
function RunScene() {
  return (
    <StageCard id="treat-run" className="relative w-full max-w-[520px]">
      <Road hud={<RunHud score={118} />}>
        <Rolling src="/gansik-run/bone.webp" left="50%" size={30} />
        <Rolling src="/gansik-run/bone.webp" left="50%" size={30} delay={0.8} />
        <Rolling src="/gansik-run/bone.webp" left="36%" size={30} delay={1.6} />
        <Rolling src="/gansik-run/obstacle.webp" left="64%" size={54} delay={0.4} duration={3} scaleEnd={1.5} />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><RunningDog /></div>
        <div className="absolute left-1/2 top-[15%] -translate-x-1/2 rounded-full bg-orange-500/90 px-3 py-0.5 text-xs font-bold text-white" style={FONT}>🔥 21 COMBO</div>
        <div className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-bold text-white" style={FONT}>← → 차선 · ↑ 점프 · ↓ 슬라이드</div>
      </Road>
    </StageCard>
  )
}

/** 실제 퀴즈 슬라이드업 시트 (간식런Game.tsx 와 같은 스타일) */
function QuizSheet({ answered }: { answered: boolean }) {
  const options = ['뼈다귀', '돌멩이']
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute inset-x-0 bottom-0 z-40"
      style={{
        background: 'linear-gradient(180deg, rgba(15,15,30,0.95) 0%, rgba(20,10,40,0.98) 100%)',
        backdropFilter: 'blur(16px)',
        borderTop: '3px solid rgba(139,92,246,0.6)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 32px rgba(139,92,246,0.3)',
      }}
    >
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold" style={{ background: 'linear-gradient(90deg, #a78bfa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>⚡ QUIZ TIME</span>
          <div className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>10초</div>
        </div>
        <h3 className="mb-3 text-base font-bold leading-snug text-white">강아지가 좋아하는 간식은?</h3>
        <div className="grid grid-cols-2 gap-2">
          {options.map((opt, i) => {
            const colors = OPTION_COLORS[i]
            const picked = answered && i === 0
            return (
              <div
                key={opt}
                className={`relative rounded-xl px-3 py-2.5 text-left font-semibold text-white ${answered && !picked ? 'opacity-40' : ''}`}
                style={{ background: `linear-gradient(135deg, ${colors[0]}dd, ${colors[1]}dd)`, border: `2px solid ${picked ? '#fff' : colors[0] + '66'}`, boxShadow: `0 4px 12px ${colors[0]}33` }}
              >
                <span className="mr-2 font-bold opacity-70">{getOptionLabel(i)}</span>
                {opt}
                {picked && <TapPointer />}
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

/** 실제 ITEM GET 컷인 */
function ItemCutIn() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-none absolute inset-0 z-[55] flex items-center justify-center" style={FONT}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, rgba(251,191,36,0.24), rgba(0,0,0,0) 42%)' }} />
      <div className="relative flex items-center gap-4 px-6 py-3" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.92), rgba(49,46,129,0.9))', border: '2px solid rgba(251,191,36,0.78)', boxShadow: '0 0 34px rgba(251,191,36,0.42), 0 18px 55px rgba(0,0,0,0.42)', transform: 'skew(-7deg)' }}>
        <div style={{ transform: 'skew(7deg)' }}><ItemGlyph item={ITEM} size={44} /></div>
        <div style={{ transform: 'skew(7deg)' }}>
          <div className="text-xs font-black tracking-[0.22em] text-amber-200">ITEM GET</div>
          <div className="text-2xl font-black leading-none text-white">{ITEM.name}</div>
        </div>
      </div>
    </motion.div>
  )
}

/** 규칙 2 — 플레이 방식: 달리는 중 퀴즈가 올라오고, 맞히면 박스에서 아이템 */
function QuizScene() {
  const answered = useDelayedFlag(1500)
  const gotItem = useDelayedFlag(2900)
  return (
    <StageCard id="treat-quiz" className="relative w-full max-w-[520px]">
      <Road hud={<RunHud score={181} speed={gotItem} />}>
        {gotItem ? (
          <Rolling src="/gansik-run/bone.webp" left="50%" size={30} duration={1.4} />
        ) : (
          <Rolling src="/gansik-run/box.webp" left="50%" size={46} duration={2.8} scaleEnd={1.7} />
        )}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2"><RunningDog jumping={gotItem} /></div>
        {!gotItem && <QuizSheet answered={answered} />}
        {gotItem && <ItemCutIn />}
      </Road>
    </StageCard>
  )
}

/** 규칙 3 — 승리 기준: 시간이 끝났을 때 점수가 가장 높은 사람 */
function RankScene() {
  return (
    <MiniLeaderboard
      key="treat-rank"
      title="최종 순위"
      suffix="점"
      rows={[
        { name: PLAYER_NAME, value: 1480, me: true, avatar: PLAYER_AVATAR },
        { name: RIVALS[0].name, value: 1210, avatar: RIVALS[0].avatar },
        { name: RIVALS[1].name, value: 860, avatar: RIVALS[1].avatar },
      ]}
    />
  )
}

export default function TreatRushTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="treat_rush"
      backgroundSrc="/gansik-run/bg/sky.webp"
      chips={(phase) => [
        { label: '점수', value: phase === 'rank' ? 1480 : phase === 'quiz' ? 181 : 118, from: phase === 'quiz' ? 118 : undefined, emoji: '🦴', tone: 'amber' },
        { label: '남은 시간', value: '04:30', emoji: '⏱️' },
      ]}
      /* 규칙 3장과 1:1 — lib/game/tutorials.ts 의 treat_rush 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'run', duration: 3600, step: 1, caption: '뼈다귀를 먹고 장애물을 피하며 달려요' },
        { key: 'quiz', duration: 4600, step: 2, caption: '달리다 퀴즈가 올라와요 — 맞히면 박스에서 아이템!' },
        { key: 'rank', duration: 3000, step: 3, caption: '시간이 끝났을 때 점수가 가장 높으면 1등!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'run') return <RunScene key="run" />
        if (phase === 'quiz') return <QuizScene key="quiz" />
        return <RankScene />
      }}
    </TutorialDemoFrame>
  )
}
