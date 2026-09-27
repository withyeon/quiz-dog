'use client'

import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import ZombieIcon from '@/components/zombie/ZombieIcon'
import QuizSetName from '@/components/game/QuizSetName'
import { GAME_CONSTANTS as ZOMBIE } from '@/lib/game/zombie'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  DEMO_SET_NAME,
  PLAYER_NAME,
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 좀비를 피해라! — 실제 ZombieView 화면과 같은 재료로 그린다:
 *   검은 상단 바(타이머·역할·인원·체력) · 역할 공개 카드 · 행동 선택 카드(치료/방어막/스캔) · 플레이어 목록
 *   (lib/game/zombie.ts · components/ZombieView.tsx)
 * 장면 4개는 튜토리얼 규칙 4장과 1:1.
 */

const FONT = { fontFamily: "'DNFBitBitv2', sans-serif" } as const
const HIT = ZOMBIE.ZOMBIE_BASE_ATTACK
const HP_AFTER_HIT = 100 - HIT

/** 실제 화면 상단 바 (ZombieView 의 헤더와 같은 클래스) */
function ZombieHeader({ hp, shield }: { hp: number; shield: number }) {
  return (
    <div className="border-b-2 border-blue-500 bg-black/80 shadow-lg backdrop-blur-sm" style={FONT}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-white">
        <div className="flex shrink-0 items-center gap-2">
          <ZombieIcon name="timer" size={24} alt="" />
          <span className="text-2xl font-bold tabular-nums">09:55</span>
          <QuizSetName title={DEMO_SET_NAME} tone="dark" />
        </div>
        <div className="flex shrink-0 items-center whitespace-nowrap rounded-full border-2 border-blue-500 bg-blue-950/80 px-3 py-0.5">
          <ZombieIcon name="human" size={22} className="mr-1.5 inline-block align-middle" alt="인간" />
          <span className="text-base font-bold text-blue-400">인간</span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 font-bold text-green-400"><ZombieIcon name="human" size={18} alt="인간" />3</span>
          <span className="inline-flex items-center gap-1 font-bold text-red-400"><ZombieIcon name="zombie" size={18} alt="좀비" />1</span>
          <span className="inline-flex items-center gap-1 font-bold text-red-400">
            <Heart className="h-4 w-4" />{hp}
            {shield > 0 && (<><ZombieIcon name="shield" size={20} className="ml-2" alt="방어막" /><span className="text-cyan-400">{shield}</span></>)}
          </span>
        </div>
      </div>
    </div>
  )
}

/** 규칙 1 — 게임이 시작되면 내 역할이 나에게만 보인다 */
function RoleScene() {
  return (
    <StageCard id="zombie-role" className="w-full max-w-md">
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl"
        style={FONT}
      >
        <ZombieIcon name="human" size={96} className="mx-auto mb-3" alt="" />
        <div className="text-3xl font-black text-slate-900">당신은 인간입니다</div>
        <p className="mt-2 text-sm font-bold text-slate-500">누가 좀비인지는 아무도 몰라요. 스캔으로 찾아내세요.</p>
      </motion.div>
    </StageCard>
  )
}

/** 실제 행동 선택 카드 (ZombieView 의 actionSelect 와 같은 클래스) */
function ActionCard({ pointer, dimmed = false }: { pointer: boolean; dimmed?: boolean }) {
  const btn = 'flex h-20 flex-col items-center justify-center whitespace-nowrap rounded-md px-2 text-base font-bold text-white'
  return (
    <div className={`rounded-xl border-4 border-blue-500 bg-black/90 p-5 text-center ${dimmed ? 'opacity-60' : ''}`} style={FONT}>
      <h2 className="mb-4 text-2xl font-bold text-blue-400">정답! 행동을 선택하세요</h2>
      <div className="grid grid-cols-3 gap-3">
        <div className={`${btn} bg-gradient-to-br from-emerald-700 to-emerald-600`}><ZombieIcon name="heal" size={28} className="mb-1.5" alt="" />치료</div>
        <div className={`relative ${btn} bg-gradient-to-br from-cyan-700 to-cyan-600`}>
          <ZombieIcon name="shield" size={28} className="mb-1.5" alt="" />방어막
          {pointer && <TapPointer />}
        </div>
        <div className={`${btn} bg-gradient-to-br from-purple-700 to-purple-600`}><ZombieIcon name="scan" size={28} className="mb-1.5" alt="" />스캔</div>
      </div>
    </div>
  )
}

/** 규칙 2 — 문제를 맞혀야 행동할 수 있어요 */
function QuizScene() {
  const answered = useDelayedFlag(1100)
  const chosen = useDelayedFlag(2600)
  if (!chosen) {
    return (
      <GlassQuizStep
        question="밤에 무덤에서 나온다는 것은?"
        options={['좀비', '나비', '햇님', '무지개']}
        correctIndex={0}
        answered={answered}
      />
    )
  }
  return (
    <StageCard id="zombie-action" className="w-full max-w-xl">
      <ActionCard pointer />
    </StageCard>
  )
}

/** 규칙 3 — 체력은 좀비 공격으로만 줄어요 (오답은 체력을 깎지 않는다) */
function AttackedScene() {
  const hit = useDelayedFlag(900)
  return (
    <StageCard id="zombie-attacked" className="relative w-full max-w-xl">
      <ActionCard pointer={false} dimmed={hit} />
      <motion.div
        className="pointer-events-none absolute -left-2 top-1/2 -translate-y-1/2"
        animate={hit ? { x: [0, 120, 90], opacity: [0, 1, 0.9] } : { x: -40, opacity: 0 }}
        transition={{ duration: 0.7 }}
      >
        <ZombieIcon name="zombie" size={88} alt="좀비" />
      </motion.div>
      {hit && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 0.5 }}
          className="pointer-events-none absolute inset-x-0 top-[62%] mx-auto w-fit rounded-xl border-2 border-red-500 bg-red-950/95 px-5 py-3 text-center text-lg font-black text-red-200 shadow-2xl"
          style={FONT}
        >
          🩸 공격당했습니다! 체력 -{HIT} (HP {HP_AFTER_HIT})
        </motion.div>
      )}
    </StageCard>
  )
}

/** 규칙 4 — 시간이 끝났을 때 인간이 남아 있으면 인간 승리, 순위는 생존·행동으로 */
function RankScene() {
  const rows = [
    { name: `${PLAYER_NAME} (나)`, role: '인간', hp: HP_AFTER_HIT, me: true },
    { name: RIVALS[0].name, role: '정체불명', hp: null },
    { name: RIVALS[1].name, role: '정체불명', hp: null },
    { name: RIVALS[2].name, role: '좀비 · 스캔 완료', hp: null },
  ]
  return (
    <StageCard id="zombie-rank" className="relative w-full max-w-md">
      <div className="rounded-xl border-2 border-blue-500 bg-black/80 p-4" style={FONT}>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-blue-300">
          <ZombieIcon name="player" size={22} alt="" /> 플레이어 (3 인간 / 1 좀비)
        </h3>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.name} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${r.me ? 'border-blue-400 bg-blue-950/60' : 'border-slate-700 bg-slate-900/70'}`}>
              <div>
                <div className="text-sm font-bold text-white">{r.name}</div>
                <div className={`text-xs ${r.role.includes('좀비') ? 'text-red-300' : r.me ? 'text-blue-300' : 'text-slate-400'}`}>{r.role}</div>
              </div>
              <div className="text-sm font-bold text-slate-300">{r.hp === null ? '???' : `HP ${r.hp}`}</div>
            </div>
          ))}
        </div>
      </div>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.8 }}
        className="pointer-events-none absolute inset-x-0 -bottom-4 mx-auto w-fit rounded-full bg-blue-500 px-5 py-2 text-base font-black text-white shadow-xl"
        style={FONT}
      >
        인간 승리! 끝까지 살아남았어요
      </motion.div>
    </StageCard>
  )
}

export default function ZombieTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/zombie/background.png"
      dim
      header={({ phase }) => <ZombieHeader hp={phase === 'attacked' || phase === 'rank' ? HP_AFTER_HIT : 100} shield={phase === 'rank' ? 1 : 0} />}
      /* 규칙 4장과 1:1 — lib/game/tutorials.ts 의 zombie 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'role', duration: 2800, step: 1, caption: '시작하면 내 역할이 나에게만 보여요' },
        { key: 'quiz', duration: 4200, step: 2, caption: '정답이어야 치료·방어막·스캔 중 하나를 골라요' },
        { key: 'attacked', duration: 3200, step: 3, caption: `좀비에게 공격당하면 체력 -${HIT} — 틀려도 체력은 안 깎여요` },
        { key: 'rank', duration: 3200, step: 4, caption: '시간이 끝날 때 인간이 남아 있으면 인간 승리' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'role') return <RoleScene key="role" />
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'attacked') return <AttackedScene key="attacked" />
        return <RankScene key="rank" />
      }}
    </TutorialDemoFrame>
  )
}
