'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import QuizSetName from '@/components/game/QuizSetName'
import { DEFAULT_SETTINGS, ENERGY, SUMMITS } from '@/lib/game/dontlookdown'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  StageCard,
  TapPointer,
  DEMO_SET_NAME,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'

/**
 * 점프점프 — 실제 게임과 같은 재료로 그린다:
 *   배경(public/dontlookdown/bg) · 발판 그림(platforms) · 파워업(powerup) · 가시(props) · 로비 아바타
 *   흰 HUD 상자(구역·높이·에너지)와 "퀴즈 풀기" 버튼은 DontLookDownGame.tsx 의 것과 같은 클래스
 *   (lib/game/dontlookdown.ts · components/DontLookDownGame.tsx)
 * 장면 4개는 튜토리얼 규칙 4장과 1:1.
 */

const GOAL = DEFAULT_SETTINGS.summitGoal
const ENERGY_LOW = 120
const ENERGY_AFTER_QUIZ = Math.min(ENERGY.MAX, ENERGY_LOW + 400)

type Platform = { x: number; y: number; w: number; img: string; spikes?: boolean }
/** 아래→위. 실제 맵처럼 발판마다 다른 그림(잔디 시작 발판 · 돌담 · 구름 · 체크포인트) */
const PLATFORMS: Platform[] = [
  { x: 26, y: 246, w: 120, img: '/dontlookdown/platforms/5.webp' },
  { x: 190, y: 196, w: 96, img: '/dontlookdown/platforms/3.webp' },
  { x: 330, y: 150, w: 90, img: '/dontlookdown/platforms/12.webp', spikes: true },
  { x: 118, y: 120, w: 100, img: '/dontlookdown/platforms/4.webp' },
  { x: 270, y: 66, w: 110, img: '/dontlookdown/platforms/11.webp' },
]
const AVATAR = 44

/** 실제 화면 왼쪽 위 HUD 상자 */
function ProgressBox({ height, summit }: { height: number; summit: number }) {
  const summitProgress = Math.round((summit / SUMMITS.length) * 100)
  const heightProgress = Math.min(100, (height / GOAL) * 100)
  return (
    <div className="absolute left-3 top-3 z-10 w-[176px] rounded-xl bg-white/95 px-3 py-2 shadow-lg">
      <QuizSetName title={DEMO_SET_NAME} className="mb-1.5 max-w-full" />
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">🏔️ 구역 {summit}/{SUMMITS.length}</span>
        <span className="text-[11px] text-gray-500">{summitProgress}%</span>
      </div>
      <div className="mb-2 h-2 w-full rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-300" style={{ width: `${summitProgress}%` }} />
      </div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">높이</span>
        <span className="text-[11px] text-gray-500">{height}m / {GOAL}m</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300" style={{ width: `${heightProgress}%` }} />
      </div>
    </div>
  )
}

/** 실제 화면 오른쪽 위 에너지 상자 */
function EnergyBox({ energy, highlight }: { energy: number; highlight?: boolean }) {
  return (
    <motion.div
      animate={highlight ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`absolute right-3 top-3 z-10 w-[170px] rounded-xl bg-white/95 px-3 py-2 shadow-lg ${highlight ? 'ring-2 ring-amber-400' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">에너지</span>
        <span className="text-[11px] text-gray-500">{energy}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200">
        <motion.div
          className="h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
          animate={{ width: `${Math.min(100, (energy / ENERGY.MAX) * 100)}%` }}
          transition={{ duration: 0.8 }}
        />
      </div>
      <div className="mt-2 text-[11px] font-semibold text-gray-600">파워업</div>
      <div className="mt-1 flex gap-1">
        {['energy', 'rocket', 'shield'].map((p) => (
          <Image key={p} src={`/dontlookdown/powerup/${p}.webp`} alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain opacity-80" />
        ))}
      </div>
    </motion.div>
  )
}

/** 발판·가시·아바타가 있는 무대 (실제 캔버스가 그리는 것과 같은 그림들) */
function Stage({ avatarIndex, energyEmpty, children }: { avatarIndex: number; energyEmpty?: boolean; children?: React.ReactNode }) {
  const p = PLATFORMS[avatarIndex]
  return (
    <div className="relative h-[292px] w-full max-w-[460px] overflow-hidden rounded-2xl border-2 border-white/30 bg-gradient-to-b from-[#bfe4ff] to-[#e6f3ff] shadow-2xl">
      {/* 실제 캔버스 배경: 아래쪽 산 + 양옆 절벽 + 왼쪽 높이 눈금 */}
      <div className="absolute inset-x-0 bottom-0 h-[38%]">
        <Image src="/dontlookdown/bg/mountains.webp" alt="" fill className="object-cover object-bottom" sizes="460px" />
      </div>
      <div className="absolute -left-4 top-0 h-full w-[64px]">
        <Image src="/dontlookdown/bg/cliff.webp" alt="" fill className="object-cover object-right" sizes="64px" />
      </div>
      <div className="absolute -right-4 top-0 h-full w-[64px] -scale-x-100">
        <Image src="/dontlookdown/bg/cliff.webp" alt="" fill className="object-cover object-right" sizes="64px" />
      </div>
      {[10, 20, 30, 40].map((m, i) => (
        <span key={m} className="absolute left-11 text-[10px] font-black text-slate-500" style={{ top: 236 - i * 52 }}>{m}m</span>
      ))}
      {/* 발판을 잇는 로프 (실제 맵의 이동 경로 표시) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 460 292" fill="none">
        <polyline
          points={PLATFORMS.map((pl) => `${pl.x + pl.w / 2},${pl.y}`).join(' ')}
          stroke="#c9a15a"
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-black/60 px-3 py-0.5 text-sm font-bold tabular-nums text-white">4:43</div>
      {PLATFORMS.map((pl, i) => (
        <div key={i} className="absolute" style={{ left: pl.x, top: pl.y, width: pl.w }}>
          {pl.spikes && (
            <Image src="/dontlookdown/props/spikes.webp" alt="" width={pl.w} height={22} className="absolute -top-[18px] left-0 h-[20px] w-full object-cover object-bottom" />
          )}
          <Image src={pl.img} alt="" width={pl.w} height={30} className="h-[30px] w-full object-contain object-top" />
        </div>
      ))}
      {/* 정상 깃발 */}
      <span className="absolute text-2xl" style={{ left: PLATFORMS[4].x + PLATFORMS[4].w - 22, top: PLATFORMS[4].y - 30 }}>🚩</span>
      {/* 에너지 파워업 */}
      <motion.div className="absolute" style={{ left: PLATFORMS[3].x + 34, top: PLATFORMS[3].y - 40 }} animate={{ y: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
        <Image src="/dontlookdown/powerup/energy.webp" alt="" width={28} height={28} className="h-7 w-7 object-contain drop-shadow" />
      </motion.div>
      {/* 아바타 — 실제 캔버스는 로비 아바타 그림을 그대로 그린다 */}
      <motion.div
        className="absolute"
        animate={{ left: p.x + p.w / 2 - AVATAR / 2, top: p.y - AVATAR }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <motion.div animate={energyEmpty ? { rotate: [0, -6, 6, 0] } : { y: [0, -3, 0] }} transition={{ duration: energyEmpty ? 0.5 : 0.9, repeat: Infinity }}>
          <Image src={PLAYER_AVATAR} alt={PLAYER_NAME} width={AVATAR} height={AVATAR} className="drop-shadow-lg" />
        </motion.div>
        <div className="mt-0.5 rounded-full bg-black/60 px-1.5 text-center text-[10px] font-black text-white">{PLAYER_NAME}</div>
      </motion.div>
      {children}
    </div>
  )
}

/** 규칙 1 — 움직이려면 에너지가 필요해요 */
function EnergyScene() {
  return (
    <StageCard id="dld-energy" className="relative w-full max-w-[460px]">
      <Stage avatarIndex={0} energyEmpty>
        <ProgressBox height={12} summit={1} />
        <EnergyBox energy={ENERGY_LOW} highlight />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-xl bg-black/70 px-4 py-2 text-sm font-black text-white"
        >
          에너지가 없으면 점프도 이동도 못 해요
        </motion.div>
      </Stage>
    </StageCard>
  )
}

/** 규칙 2 — 에너지는 문제로 채웁니다 (실제처럼 "퀴즈 풀기" 버튼을 눌러 퀴즈가 뜬다) */
function QuizScene() {
  const opened = useDelayedFlag(900)
  const answered = useDelayedFlag(2000)
  const filled = useDelayedFlag(3000)
  return (
    <StageCard id="dld-quiz" className="relative w-full max-w-[460px]">
      <Stage avatarIndex={0}>
        <ProgressBox height={12} summit={1} />
        <EnergyBox energy={filled ? ENERGY_AFTER_QUIZ : ENERGY_LOW} highlight={filled} />
        {!opened && (
          <div className="absolute bottom-3 left-3 rounded-xl bg-sky-500 px-5 py-2.5 font-bold text-white shadow-lg">
            퀴즈 풀기
            <TapPointer />
          </div>
        )}
        {filled && (
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute right-3 top-24 rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-lg">
            정답! +에너지
          </motion.div>
        )}
      </Stage>
      {opened && !filled && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-2">
          <div style={{ zoom: 0.62 }}>
            <GlassQuizStep question="위로 뛰어오르는 동작은?" options={['점프', '수면', '식사', '독서']} correctIndex={0} answered={answered} />
          </div>
        </div>
      )}
    </StageCard>
  )
}

/** 규칙 3 — 조작과 발판: 좌우로 움직이고 점프, 가시는 피하고 구름은 사라진다 */
function JumpScene() {
  const step1 = useDelayedFlag(700)
  const step2 = useDelayedFlag(1900)
  const idx = step2 ? 3 : step1 ? 1 : 0
  return (
    <StageCard id="dld-jump" className="relative w-full max-w-[460px]">
      <Stage avatarIndex={idx}>
        <ProgressBox height={idx === 3 ? 58 : idx === 1 ? 30 : 12} summit={1} />
        <EnergyBox energy={ENERGY_AFTER_QUIZ - idx * 60} />
        <div className="absolute bottom-3 right-3 hidden rounded-xl bg-black/70 px-3 py-2 text-xs text-white sm:block">
          <div>← → 이동 · 스페이스 점프</div>
          <div className="mt-0.5 text-rose-300">가시 발판은 밟으면 떨어져요</div>
        </div>
      </Stage>
    </StageCard>
  )
}

/** 규칙 4 — 승리 기준: 정상에 먼저 닿거나, 시간이 끝났을 때 가장 높이 올라간 사람 */
function SummitScene() {
  const arrived = useDelayedFlag(800)
  return (
    <StageCard id="dld-summit" className="relative w-full max-w-[460px]">
      <Stage avatarIndex={arrived ? 4 : 3}>
        <ProgressBox height={arrived ? GOAL : 58} summit={arrived ? SUMMITS.length : 1} />
        <div className="absolute bottom-3 left-1/2 w-[240px] -translate-x-1/2 rounded-xl bg-white/95 px-3 py-1.5 shadow-lg">
          <div className="mb-1 text-center text-[11px] font-bold text-gray-600">순위</div>
          <div className="space-y-0.5 text-xs">
            {[
              { n: `${PLAYER_NAME} (나)`, m: arrived ? GOAL : 58, me: true },
              { n: RIVALS[0].name, m: 210 },
              { n: RIVALS[1].name, m: 140 },
            ]
              .sort((a, b) => b.m - a.m)
              .map((r, i) => (
                <div key={r.n} className={`flex items-center justify-between ${r.me ? 'font-bold text-blue-600' : ''}`}>
                  <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} {r.n}</span>
                  <span>{r.m}m</span>
                </div>
              ))}
          </div>
        </div>
        {arrived && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            className="absolute inset-x-0 top-[36%] mx-auto w-fit rounded-2xl bg-amber-400 px-6 py-3 text-center text-xl font-black text-slate-900 shadow-2xl"
          >
            🏔️ 정상 도착! 1등
          </motion.div>
        )}
      </Stage>
    </StageCard>
  )
}

export default function DontLookDownTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="dontlookdown"
      backgroundSrc="/dontlookdown/bg/mountains.webp"
      chips={(phase) => [
        { label: '높이', value: phase === 'summit' ? GOAL : phase === 'jump' ? 58 : 12, suffix: 'm', emoji: '⛰️' },
        { label: '에너지', value: phase === 'energy' ? ENERGY_LOW : ENERGY_AFTER_QUIZ, emoji: '⚡', tone: phase === 'energy' ? 'rose' : 'amber' },
      ]}
      /* 규칙 4장과 1:1 — lib/game/tutorials.ts 의 dontlookdown 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'energy', duration: 3000, step: 1, caption: '움직이려면 에너지가 필요해요' },
        { key: 'quiz', duration: 4200, step: 2, caption: '퀴즈를 맞히면 에너지가 차요' },
        { key: 'jump', duration: 3600, step: 3, caption: '좌우로 움직이고 점프 — 가시는 피해요' },
        { key: 'summit', duration: 3200, step: 4, caption: `정상(${GOAL}m)에 먼저 닿으면 1등!` },
      ]}
    >
      {({ phase }) => {
        if (phase === 'energy') return <EnergyScene key="energy" />
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'jump') return <JumpScene key="jump" />
        return <SummitScene key="summit" />
      }}
    </TutorialDemoFrame>
  )
}
