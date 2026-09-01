'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, MousePointer2 } from 'lucide-react'

/**
 * 모든 게임 튜토리얼이 공유하는 "플레이 영상" 프레임.
 * 배경 + HUD(밤톨이/지표) + 무대(자동 전환) + 캡션/진행바 를 제공하고,
 * 게임별 고유 연출은 children 렌더 함수로 그려 넣는다.
 */

export type DemoPhase = { key: string; duration: number; step: number; caption: string }

/**
 * 선생님이 오른쪽 "핵심 규칙"을 넘기면 왼쪽 영상도 같은 순서로 따라간다.
 * 이 값이 없으면(미리보기 등) 예전처럼 시간에 맞춰 혼자 넘어간다.
 */
export type TutorialStepInfo = { stepIndex: number; stepCount: number }

const TutorialStepContext = createContext<TutorialStepInfo | null>(null)

export function TutorialStepProvider({ value, children }: { value: TutorialStepInfo; children: ReactNode }) {
  return <TutorialStepContext.Provider value={value}>{children}</TutorialStepContext.Provider>
}

/** 규칙 개수와 장면 개수가 달라도 첫 장과 마지막 장은 항상 맞아떨어지게 나눈다. */
function mapStepToPhase(stepIndex: number, stepCount: number, phaseCount: number): number {
  if (phaseCount <= 1) return 0
  if (stepCount <= 1) return Math.min(Math.max(stepIndex, 0), phaseCount - 1)
  const ratio = (phaseCount - 1) / (stepCount - 1)
  return Math.min(phaseCount - 1, Math.max(0, Math.round(stepIndex * ratio)))
}

/**
 * 지금 보여줄 장면 번호.
 * 선생님이 넘기는 중이면 규칙 순서에 맞춰 고정하고, 아니면 스스로 넘어간다.
 */
export function useDemoPhaseIndex(phases: { duration: number }[]): { phaseIndex: number; cycle: number } {
  const step = useContext(TutorialStepContext)
  const isControlled = step !== null
  const phaseCount = phases.length
  const phasesRef = useRef(phases)
  phasesRef.current = phases

  const [autoIndex, setAutoIndex] = useState(0)
  const [autoCycle, setAutoCycle] = useState(0)

  useEffect(() => {
    if (isControlled) return

    // phases 배열은 호출부에서 매번 새로 만들어지므로 의존성에 두면 타이머가 계속 초기화된다.
    const duration = phasesRef.current[autoIndex]?.duration ?? 2000
    const timer = setTimeout(() => {
      setAutoIndex((prev) => {
        const next = (prev + 1) % phaseCount
        if (next === 0) setAutoCycle((c) => c + 1)
        return next
      })
    }, duration)

    return () => clearTimeout(timer)
  }, [autoIndex, isControlled, phaseCount])

  if (isControlled) {
    const controlledIndex = mapStepToPhase(step.stepIndex, step.stepCount, phaseCount)
    return { phaseIndex: controlledIndex, cycle: controlledIndex }
  }

  return { phaseIndex: Math.min(autoIndex, Math.max(phaseCount - 1, 0)), cycle: autoCycle }
}

export const PLAYER_NAME = '밤톨이'
export const PLAYER_IMAGE = '/assets/icons/mascot-pome-64.png'

/** 손가락 탭 포인터 + 물결 효과 */
export function TapPointer() {
  return (
    <motion.div
      className="pointer-events-none absolute -bottom-3 -right-2 z-20"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 18 }}
    >
      <motion.span
        className="absolute inset-0 -m-3 rounded-full bg-sky-400/40"
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.8, repeat: Infinity }}
      />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-sky-400">
        <MousePointer2 className="h-5 w-5 text-sky-500" />
      </div>
    </motion.div>
  )
}

export function CountUp({ from, to, duration = 1200 }: { from: number; to: number; duration?: number }) {
  const [value, setValue] = useState(from)
  useEffect(() => {
    let raf = 0
    let start: number | null = null
    const tick = (now: number) => {
      if (start === null) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [from, to, duration])
  return <>{value.toLocaleString()}</>
}

export type HudMetric = { icon?: string; emoji?: string; value: number; from?: number; suffix?: string }

type FrameProps = {
  backgroundSrc?: string
  backgroundClassName?: string
  metric?: (phase: string) => HudMetric | null
  phases: DemoPhase[]
  children: (ctx: { phase: string; cycle: number }) => ReactNode
}

export function TutorialDemoFrame({ backgroundSrc, backgroundClassName, metric, phases, children }: FrameProps) {
  const { phaseIndex: safePhaseIndex, cycle } = useDemoPhaseIndex(phases)
  const phase = phases[safePhaseIndex].key
  const m = metric?.(phase) ?? null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl">
      {/* 배경 */}
      {backgroundSrc ? (
        <Image
          src={backgroundSrc}
          alt=""
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 720px"
        />
      ) : (
        <div className={`absolute inset-0 ${backgroundClassName ?? 'bg-slate-800'}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1622]/55 via-[#0b1622]/25 to-[#0b1622]/70" />

      {/* HUD */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 sm:px-7">
        <div className="flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 shadow-lg ring-1 ring-white/50 backdrop-blur">
          <div className="relative h-7 w-7 overflow-hidden rounded-full bg-amber-100">
            <Image src={PLAYER_IMAGE} alt={PLAYER_NAME} fill className="object-contain" sizes="28px" />
          </div>
          <span className="text-sm font-black text-[#17262a]">{PLAYER_NAME}</span>
        </div>
        {m && (
          <motion.div
            key={`${m.value}-${cycle}`}
            initial={{ scale: m.from !== undefined && m.from !== m.value ? 1.25 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16 }}
            className="flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 shadow-lg ring-1 ring-white/60 backdrop-blur"
          >
            {m.icon ? (
              <Image src={m.icon} alt="" width={22} height={22} className="h-5 w-5 object-contain" />
            ) : m.emoji ? (
              <span className="text-base leading-none">{m.emoji}</span>
            ) : null}
            <span className="text-base font-black tabular-nums text-[#17262a]">
              {m.from !== undefined && m.from !== m.value ? <CountUp from={m.from} to={m.value} /> : m.value.toLocaleString()}
              {m.suffix && <span className="ml-0.5 text-xs text-slate-500">{m.suffix}</span>}
            </span>
          </motion.div>
        )}
      </div>

      {/* 무대 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-4 sm:px-8">
        <AnimatePresence mode="wait">{children({ phase, cycle })}</AnimatePresence>
      </div>

      {/* 캡션 / 진행 표시 */}
      <div className="relative z-10 px-5 pb-5 sm:px-7">
        <div className="flex items-center gap-1.5">
          {phases.map((p, i) => (
            <div
              key={p.key}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === safePhaseIndex ? 'bg-amber-400' : i < safePhaseIndex ? 'bg-amber-400/50' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-3 flex items-center justify-center gap-2.5 rounded-full bg-black/45 px-4 py-2.5 backdrop-blur"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-[#17262a]">
              {phases[safePhaseIndex].step}
            </span>
            <span className="text-sm font-black text-white sm:text-base">{phases[safePhaseIndex].caption}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** 모든 게임 공통: 리퀴드글래스 퀴즈 (2x2) — 실제 게임의 variant="glass" 와 동일한 스타일 */
export function GlassQuizStep({
  question,
  options,
  correctIndex,
  answered,
}: {
  question: string
  options: string[]
  correctIndex: number
  answered: boolean
}) {
  return (
    <motion.div
      key="quiz"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="lg-panel lg-ink-outline font-bitbit w-full max-w-xl p-5 sm:p-6"
    >
      <h3 className="lg-question-title text-center text-lg font-black leading-snug sm:text-xl">{question}</h3>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {options.map((option, index) => {
          const isAnswer = index === correctIndex
          const correctState = answered && isAnswer
          const dim = answered && !isAnswer
          return (
            <div
              key={option}
              className={`lg-option relative flex items-center justify-center px-4 py-4 text-base font-black text-white sm:text-lg ${
                correctState ? 'lg-option-correct' : dim ? 'lg-option-dim' : 'lg-option-idle'
              }`}
            >
              {option}
              {correctState && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                  className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                </motion.span>
              )}
              {correctState && <TapPointer />}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

/** 게임 공통: 미니 실시간 순위표 */
export function MiniLeaderboard({
  rows,
  suffix = '',
}: {
  rows: { name: string; value: number; me?: boolean }[]
  suffix?: string
}) {
  return (
    <motion.div
      key="score"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="lg-panel font-bitbit w-full max-w-sm p-5"
    >
      <p className="mb-4 text-center text-sm font-black text-white drop-shadow">실시간 순위</p>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className={`flex items-center justify-between rounded-full px-4 py-3 backdrop-blur ${
              row.me ? 'lg-option lg-option-correct' : 'bg-black/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg leading-none">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="text-base font-black text-white">{row.name}</span>
            </div>
            <span className="text-base font-black tabular-nums text-white">
              {row.value.toLocaleString()}
              {suffix}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

/** 무대 콘텐츠를 감싸는 공통 등장 모션 (게임별 액션 씬에서 사용) */
export function StageCard({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
