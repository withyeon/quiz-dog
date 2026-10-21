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
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 좀비를 피해라! — 실제 ZombieView 화면과 같은 재료로 그린다:
 *   검은 상단 바(타이머·역할·인원·체력·무전기 띠) · 역할 공개 카드 · 행동 선택 카드(수리/방어막/치료/스캔·백신) · 친구 고르기
 *   (lib/game/zombie.ts · components/ZombieView.tsx)
 * 장면 4개는 튜토리얼 규칙 4장과 1:1.
 */

const FONT = { fontFamily: "'DNFBitBitv2', sans-serif" } as const

/** 실제 화면 상단 바 (ZombieView 의 헤더 + 무전기 띠와 같은 클래스) */
function ZombieHeader({ radioPercent, shield, heli }: { radioPercent: number; shield: boolean; heli: boolean }) {
  return (
    <div className="border-b-2 border-blue-500 bg-black/80 shadow-lg backdrop-blur-sm" style={FONT}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-white">
        <div className="flex shrink-0 items-center gap-2">
          <ZombieIcon name="timer" size={24} alt="" />
          <span className="text-2xl font-bold tabular-nums">04:12</span>
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
            <Heart className="h-4 w-4" />100
            {shield && <ZombieIcon name="shield" size={20} className="ml-1" alt="방어막 있음" />}
          </span>
        </div>
      </div>
      <div className="border-t border-white/10 bg-black/60 px-3 py-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          {heli ? (
            <>
              <ZombieIcon name="heli" size={18} alt="" />
              <span className="text-amber-300">헬기 도착까지 00:15 · 끝까지 버텨요!</span>
            </>
          ) : (
            <>
              <ZombieIcon name="radio" size={18} alt="" />
              <span className="text-amber-200">구조 무전기</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" animate={{ width: `${radioPercent}%` }} transition={{ duration: 0.5 }} />
              </div>
              <span className="tabular-nums text-amber-200">{radioPercent}%</span>
            </>
          )}
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
        <p className="mt-2 text-sm font-bold text-slate-500">무전기를 고쳐 구조 헬기를 부르세요!</p>
      </motion.div>
    </StageCard>
  )
}

/** 실제 행동 선택 카드 (ZombieView 의 actionSelect 와 같은 클래스) */
function ActionCard() {
  const btn = 'flex h-20 flex-col items-center justify-center whitespace-nowrap rounded-md px-2 text-sm font-bold text-white'
  return (
    <div className="rounded-xl border-4 border-blue-500 bg-black/90 p-5 text-center" style={FONT}>
      <h2 className="mb-4 text-2xl font-bold text-blue-400">정답! 행동을 선택하세요</h2>
      <div className="grid grid-cols-4 gap-2">
        <div className={`relative ${btn} bg-gradient-to-br from-amber-600 to-amber-500`}>
          <ZombieIcon name="repair" size={26} className="mb-1.5" alt="" />수리 +{ZOMBIE.RADIO_REPAIR_AMOUNT}
          <TapPointer />
        </div>
        <div className={`${btn} bg-gradient-to-br from-cyan-700 to-cyan-600`}><ZombieIcon name="shield" size={26} className="mb-1.5" alt="" />방어막</div>
        <div className={`${btn} bg-gradient-to-br from-emerald-700 to-emerald-600`}><ZombieIcon name="heal" size={26} className="mb-1.5" alt="" />치료</div>
        <div className={`${btn} bg-gradient-to-br from-purple-700 to-purple-600`}><ZombieIcon name="scan" size={26} className="mb-1.5" alt="" />스캔·백신</div>
      </div>
    </div>
  )
}

/** 규칙 2 — 정답마다 무전기가 고쳐지고 행동을 하나 고른다 */
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
      <ActionCard />
    </StageCard>
  )
}

/** 규칙 3 — 스캔으로 감염된 친구를 찾고 백신으로 구한다 (ZombieView 의 FriendRow 와 같은 모양) */
function VaccineScene() {
  const shot = useDelayedFlag(1400)
  const rows = [
    { name: RIVALS[0].name, label: '스캔 완료 · 인간', tone: 'text-blue-300', target: false },
    { name: RIVALS[2].name, label: `감염된 친구 · 백신 ${shot ? 2 : 1}/${ZOMBIE.VACCINE_DOSES}`, tone: 'text-red-300', target: true },
    { name: RIVALS[1].name, label: '정체불명', tone: 'text-gray-400', target: false },
  ]
  return (
    <StageCard id="zombie-vaccine" className="relative w-full max-w-md">
      <div className="space-y-2 rounded-xl border-4 border-blue-500 bg-black/90 p-4" style={FONT}>
        <h2 className="mb-1 text-center text-2xl font-bold text-blue-400">친구 고르기</h2>
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2">
            <ZombieIcon name="player" size={24} className="shrink-0" alt="" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{row.name}</div>
              <div className={`text-xs ${row.tone}`}>{row.label}</div>
            </div>
            <div className="rounded-md bg-purple-700 px-2 py-1.5 text-xs font-bold text-white opacity-40">스캔</div>
            <div className={`relative inline-flex items-center rounded-md bg-cyan-700 px-2 py-1.5 text-xs font-bold text-white ${row.target ? '' : 'opacity-40'}`}>
              <ZombieIcon name="vaccine" size={14} className="mr-1" alt="" />백신
              {row.target && !shot && <TapPointer />}
            </div>
          </div>
        ))}
      </div>
      {shot && (
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 360, damping: 16 }}
          className="pointer-events-none absolute inset-x-0 -bottom-5 mx-auto w-fit rounded-full bg-cyan-600 px-5 py-2 text-base font-black text-white shadow-xl"
          style={FONT}
        >
          💉 백신 명중! 한 발만 더 맞으면 돌아와요
        </motion.div>
      )}
    </StageCard>
  )
}

/** 규칙 4 — 무전기를 다 고치면 헬기가 오고, 그때 인간이 남아 있으면 인간 승리 */
function RescueScene() {
  return (
    <StageCard id="zombie-rescue" className="relative w-full max-w-md">
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="rounded-2xl border-4 border-amber-400 bg-black/85 px-8 py-6 text-center shadow-2xl"
        style={FONT}
      >
        <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="flex justify-center">
          <ZombieIcon name="heli" size={110} alt="" />
        </motion.div>
        <div className="mt-3 text-3xl font-black text-amber-300">구조 헬기 호출!</div>
        <p className="mt-2 text-sm font-bold text-gray-200">헬기가 올 때까지 살아남으면 구조 성공</p>
      </motion.div>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 1.2 }}
        className="pointer-events-none absolute inset-x-0 -bottom-4 mx-auto w-fit rounded-full bg-blue-500 px-5 py-2 text-base font-black text-white shadow-xl"
        style={FONT}
      >
        인간 승리! 3명 구조 성공
      </motion.div>
    </StageCard>
  )
}

export default function ZombieTutorialDemo() {
  return (
    <TutorialDemoFrame
      backgroundSrc="/zombie/background.png"
      dim
      header={({ phase }) => (
        <ZombieHeader
          radioPercent={phase === 'role' ? 0 : phase === 'quiz' ? 42 : 78}
          shield={phase === 'vaccine' || phase === 'rescue'}
          heli={phase === 'rescue'}
        />
      )}
      /* 규칙 4장과 1:1 — lib/game/tutorials.ts 의 zombie 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'role', duration: 2800, step: 1, caption: '시작하면 내 역할이 나에게만 보여요' },
        { key: 'quiz', duration: 4200, step: 2, caption: '정답마다 무전기가 고쳐지고, 수리·방어막·치료·스캔 중 하나를 골라요' },
        { key: 'vaccine', duration: 3600, step: 3, caption: `감염된 친구는 백신 ${ZOMBIE.VACCINE_DOSES}발이면 인간으로 돌아와요` },
        { key: 'rescue', duration: 3200, step: 4, caption: '무전기를 다 고쳐 헬기가 오면 인간 승리' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'role') return <RoleScene key="role" />
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'vaccine') return <VaccineScene key="vaccine" />
        return <RescueScene key="rescue" />
      }}
    </TutorialDemoFrame>
  )
}
