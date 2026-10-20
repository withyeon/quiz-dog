'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StallScene from '@/components/bungeoppang/StallScene'
import Griddle from '@/components/bungeoppang/Griddle'
import BakeGauge from '@/components/bungeoppang/BakeGauge'
import BungeoDog, { type DogMood } from '@/components/bungeoppang/BungeoDog'
import BakeResultCard from '@/components/bungeoppang/BakeResultCard'
import NoticeModal from '@/components/bungeoppang/NoticeModal'
import { gradeToSprite, type BungeoSpriteState } from '@/components/bungeoppang/BungeoSprite'
import {
  BUNGEO,
  EMPTY_BUFFS,
  createEmptyStats,
  getBakeSetup,
  gradeAt,
  makeEventNotice,
  resolveBake,
  type BungeoStats,
} from '@/lib/game/bungeoppang'
import {
  TutorialDemoFrame,
  GlassQuizStep,
  MiniLeaderboard,
  StageCard,
  PLAYER_NAME,
  PLAYER_AVATAR,
  RIVALS,
  useDelayedFlag,
} from '@/components/tutorial/TutorialDemoFrame'
import { FitOverlay, MovingPointer, useElementPointer, useFrameFitZoom } from '@/components/tutorial/demoPointer'

/**
 * 붕어빵 굽굽! — 실제 게임과 같은 재료로 그린다:
 *   포장마차(StallScene) · 철판(Griddle) · 굽기 게이지(BakeGauge) · 퀴즈독(BungeoDog)
 *   뒤집은 뒤 결과 카드(BakeResultCard) · 랜덤 이벤트 알림(NoticeModal)
 * 게이지는 실제 훅처럼 rAF 로 차오르고, 점수·속 공개는 lib/game/bungeoppang.ts 의 resolveBake 를 그대로 쓴다.
 * 장면 7개는 튜토리얼 규칙 7장(lib/game/tutorials.ts 의 bungeoppang)과 1:1.
 */

const SETUP = getBakeSetup(EMPTY_BUFFS)
const PERFECT_ZONE = SETUP.zones.find((zone) => zone.id === 'perfect')!
/** 완벽 구간 한가운데에서 뒤집는다 */
const FLIP_AT = (PERFECT_ZONE.start + PERFECT_ZONE.end) / 2

/** resolveBake 가 첫 번째 rand 로 황금 여부, 두 번째로 속을 고른다 — 원하는 속이 나오게 고정 */
function fixedRand(values: number[]) {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}
const RAND_CHEESE = [0.5, 0.78] // 팥 50 · 슈크림 22 · 치즈 12 … 누적 72~84 구간
const RAND_REDBEAN = [0.5, 0.2]

const SCORE_BEFORE = 1240
const TRAY_BEFORE = 2

const CHEESE_OUTCOME = resolveBake({ ...createEmptyStats(), tray: TRAY_BEFORE }, FLIP_AT, SETUP, fixedRand(RAND_CHEESE))
const STREAK_STATS: BungeoStats = { ...createEmptyStats(), tray: 3, perfectStreak: BUNGEO.FIRE_MODE_STREAK - 1 }
const FIRE_OUTCOME = resolveBake(STREAK_STATS, FLIP_AT, SETUP, fixedRand(RAND_REDBEAN))
const SCORE_AFTER_CHEESE = SCORE_BEFORE + CHEESE_OUTCOME.points
const SCORE_AFTER_TRAY = SCORE_AFTER_CHEESE + 160 + BUNGEO.TRAY_BONUS
const SCORE_FINAL = 3180

/** 게이지가 0 → target 까지 실제 속도(BUNGEO.GAUGE_DURATION_MS)로 차오른다. startDelay 뒤 출발 */
function useGaugeRun(target: number, startDelay: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const elapsed = now - start - startDelay
      const next = Math.max(0, Math.min(target, (elapsed / SETUP.durationMs) * 100))
      setValue(next)
      if (next < target) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, startDelay])
  return value
}

/** 실제 굽기 뷰(app/bungeoppang/page.tsx)와 같은 배치. 무대는 480px 폭으로 그려 프레임에 맞게 줄인다 */
function BakeStage({
  mood,
  filled,
  cooking,
  gauge,
  running,
  buttonLabel,
  children,
}: {
  mood: DogMood
  filled: number
  cooking: BungeoSpriteState | null
  gauge: number
  running: boolean
  buttonLabel: string
  children?: ReactNode
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 480)
  return (
    <div style={{ zoom, width: 480 }}>
      <div ref={contentRef}>
        <StallScene>
          <div className="mb-2 flex items-end justify-between">
            <BungeoDog mood={mood} size={80} />
            <div className="text-right text-amber-100">
              <div className="text-xs font-bold opacity-80">이번 판</div>
              <div className="text-2xl font-black">{Math.min(filled, BUNGEO.TRAY_SIZE)} / {BUNGEO.TRAY_SIZE}</div>
            </div>
          </div>
          <Griddle filled={filled} cooking={cooking} size="lg" flames={running ? 'high' : 'low'} />
          <div className="mx-auto mt-5 max-w-md">
            <BakeGauge zones={SETUP.zones} value={gauge} running={running} />
          </div>
          <div className="mx-auto mt-5 max-w-md">
            <div
              className={`w-full rounded-2xl border-4 border-[#1f1a17] py-5 text-center text-3xl font-black text-white shadow-[0_8px_0_#7c2d12] ${
                running ? 'bg-orange-500 bungeo-pulse' : 'bg-amber-500'
              }`}
            >
              {buttonLabel}
            </div>
            <p className="mt-2 text-center text-xs font-bold text-amber-100/80">스페이스바나 엔터로도 뒤집을 수 있어요</p>
          </div>
          {children}
        </StallScene>
      </div>
    </div>
  )
}

const findFlipButton = (box: HTMLElement) => [...box.querySelectorAll('div')].find((el) => (el.textContent ?? '').trim() === '🔄 뒤집기!')

/** 규칙 1 — 퀴즈를 맞히면 굽기 찬스. 무대 높이에 맞춰 줄인다 */
function QuizScene() {
  const answered = useDelayedFlag(1400)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 560)
  return (
    <div key="bungeo-quiz" style={{ zoom, width: 560 }}>
      <div ref={contentRef} className="flex justify-center">
        <GlassQuizStep question="붕어빵 속에 가장 많이 들어가는 기본 재료는?" options={['팥', '김치', '감자', '참치']} correctIndex={0} answered={answered} zoom={0.8} />
      </div>
    </div>
  )
}

/** 규칙 2 — 게이지가 완벽 구간일 때 「뒤집기!」. 선생님이 이 장에 머물면 굽기를 처음부터 다시 보여 준다 */
function FlipScene() {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setEpoch((value) => value + 1), 4600)
    return () => clearInterval(timer)
  }, [])
  return (
    <StageCard id="bungeo-flip" className="relative">
      <FlipRun key={epoch} />
    </StageCard>
  )
}

function FlipRun() {
  const boxRef = useRef<HTMLDivElement>(null)
  const gauge = useGaugeRun(FLIP_AT, 900)
  const flipped = gauge >= FLIP_AT
  const pointer = useElementPointer(boxRef, gauge > FLIP_AT - 22 ? findFlipButton : null, gauge > FLIP_AT - 22 ? 1 : 0)
  const grade = gradeAt(gauge, SETUP.zones)
  const cooking: BungeoSpriteState = gauge < 6 ? 'dough' : gradeToSprite(grade.id)
  return (
    <div ref={boxRef} className="relative">
      <BakeStage
        mood={flipped ? 'happy' : 'idle'}
        filled={TRAY_BEFORE}
        cooking={cooking}
        gauge={gauge}
        running={!flipped}
        buttonLabel={flipped ? '구웠어요!' : '🔄 뒤집기!'}
      />
      <MovingPointer pointer={flipped ? null : pointer} />
    </div>
  )
}

/** 결과 카드는 fixed 오버레이라 프레임(translateZ) 안에 갇힌다. 카드가 세로로 길어 프레임 높이에 맞춰 줄인다 */
function CardOverlay({ children }: { children: ReactNode }) {
  return <FitOverlay naturalHeight={780}>{children}</FitOverlay>
}

/** 규칙 3 — 구우면 속이 랜덤 공개 (치즈 ×1.5) */
function FillingScene() {
  return (
    <StageCard id="bungeo-filling" className="relative">
      <CardOverlay>
        <BakeResultCard outcome={CHEESE_OUTCOME} onClose={() => undefined} />
      </CardOverlay>
    </StageCard>
  )
}

/** 규칙 4 — 6칸 다 채우면 한 판 완성 +300 */
function TrayScene() {
  const done = useDelayedFlag(1300)
  return (
    <StageCard id="bungeo-tray" className="relative">
      <div className="relative">
        <BakeStage
          mood={done ? 'happy' : 'idle'}
          filled={done ? BUNGEO.TRAY_SIZE : BUNGEO.TRAY_SIZE - 1}
          cooking={done ? null : 'baked'}
          gauge={FLIP_AT}
          running={false}
          buttonLabel="구웠어요!"
        >
          <AnimatePresence>
            {done && (
              <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                  className="rounded-2xl border-4 border-emerald-300 bg-emerald-50 px-5 py-3 text-2xl font-black text-emerald-700 shadow-2xl"
                >
                  🍳 한 판 완성! +{BUNGEO.TRAY_BONUS}
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </BakeStage>
      </div>
    </StageCard>
  )
}

/** 규칙 5 — 완벽 3연속이면 불맛 모드 */
function FireScene() {
  return (
    <StageCard id="bungeo-fire" className="relative">
      <CardOverlay>
        <BakeResultCard outcome={FIRE_OUTCOME} onClose={() => undefined} />
      </CardOverlay>
    </StageCard>
  )
}

/** 규칙 6 — 랜덤 이벤트·아이템 (실제 NoticeModal) */
const BUTTER_NOTICE = makeEventNotice('butter_time')
function EventScene() {
  return (
    <StageCard id="bungeo-event" className="relative">
      <FitOverlay naturalHeight={480}>
        <NoticeModal notice={BUTTER_NOTICE} onClose={() => undefined} />
      </FitOverlay>
    </StageCard>
  )
}

/** 규칙 7 — 점수가 가장 높으면 오늘의 붕어빵 장인 */
function RankScene() {
  return (
    <MiniLeaderboard
      key="bungeo-rank"
      title="오늘의 붕어빵 장인 👑"
      suffix="점"
      rows={[
        { name: PLAYER_NAME, value: SCORE_FINAL, me: true, avatar: PLAYER_AVATAR },
        { name: RIVALS[0].name, value: 2760, avatar: RIVALS[0].avatar },
        { name: RIVALS[1].name, value: 2410, avatar: RIVALS[1].avatar },
      ]}
    />
  )
}

export default function BungeoppangTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="bungeoppang"
      backgroundClassName="bg-[linear-gradient(180deg,#0f172a_0%,#1e1b4b_60%,#312e81_100%)]"
      chips={(phase) => {
        const score =
          phase === 'filling' ? { value: SCORE_AFTER_CHEESE, from: SCORE_BEFORE }
            : phase === 'tray' ? { value: SCORE_AFTER_TRAY, from: SCORE_AFTER_CHEESE }
              : phase === 'fire' ? { value: SCORE_AFTER_TRAY + FIRE_OUTCOME.points, from: SCORE_AFTER_TRAY }
                : phase === 'event' ? { value: SCORE_AFTER_TRAY + FIRE_OUTCOME.points }
                  : phase === 'rank' ? { value: SCORE_FINAL }
                    : { value: SCORE_BEFORE }
        return [{ label: '점수', ...score, suffix: '점', tone: 'amber' as const }]
      }}
      /* 규칙 7장과 1:1 — lib/game/tutorials.ts 의 bungeoppang 슬라이드 순서와 같습니다 */
      phases={[
        { key: 'quiz', duration: 3800, step: 1, caption: '퀴즈를 맞히면 붕어빵 굽기 찬스!' },
        { key: 'flip', duration: 4600, step: 2, caption: '게이지가 ✨완벽✨ 구간일 때 「뒤집기!」' },
        { key: 'filling', duration: 4200, step: 3, caption: '속은 랜덤 — 치즈면 점수 ×1.5!' },
        { key: 'tray', duration: 3600, step: 4, caption: `철판 ${BUNGEO.TRAY_SIZE}칸을 다 채우면 +${BUNGEO.TRAY_BONUS}점` },
        { key: 'fire', duration: 4200, step: 5, caption: `완벽 ${BUNGEO.FIRE_MODE_STREAK}연속이면 불맛 모드 — 다음 붕어빵 ${BUNGEO.FIRE_MODE_MULTIPLIER}배` },
        { key: 'event', duration: 3600, step: 6, caption: '가끔 랜덤 이벤트와 아이템이 찾아와요' },
        { key: 'rank', duration: 3200, step: 7, caption: '점수가 가장 높으면 오늘의 붕어빵 장인!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'quiz') return <QuizScene key="quiz" />
        if (phase === 'flip') return <FlipScene key="flip" />
        if (phase === 'filling') return <FillingScene key="filling" />
        if (phase === 'tray') return <TrayScene key="tray" />
        if (phase === 'fire') return <FireScene key="fire" />
        if (phase === 'event') return <EventScene key="event" />
        return <RankScene />
      }}
    </TutorialDemoFrame>
  )
}
