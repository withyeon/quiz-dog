'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'
import QuizView from '@/components/QuizView'
import QuizSetName from '@/components/game/QuizSetName'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { getGameModeConfig, type GameModeId } from '@/lib/game/modes'

/**
 * 모든 게임 튜토리얼이 공유하는 "플레이 영상" 프레임.
 * 실제 게임 화면과 같은 재료로 그린다:
 *   - 헤더: 실제 게임 헤더(gold-quest-ink-panel + 제목 타일 + 문제집 이름 + 정보 칩)
 *   - 퀴즈: 실제 QuizView(variant="glass") 그대로
 *   - 순위: 실제 골드 순위판과 같은 크림색 패널
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
/** 마스코트 그림 — 무대 연출(캐릭터가 뛰는 장면 등)에 쓴다 */
export const PLAYER_IMAGE = '/assets/icons/mascot-pome-64.png'
/** 실제 게임의 순위판·참가자 목록에 나오는 것과 같은 로비 아바타 */
export const PLAYER_AVATAR = '/character/3.svg'
export const RIVALS = [
  { name: '냥냥이', avatar: '/character/1.svg' },
  { name: '뽀삐', avatar: '/character/6.svg' },
  { name: '알밤이', avatar: '/character/8.svg' },
] as const
/** 헤더에 띄우는 문제집 이름 — 실제 게임 헤더의 QuizSetName 자리 */
export const DEMO_SET_NAME = '우리 반 문제집'

/**
 * 장면이 뜬 뒤 한 박자 늦게 켜지는 스위치.
 * 장면은 넘어갈 때마다 새로 붙으므로, 붙는 순간부터 시간을 잰다.
 */
export function useDelayedFlag(delay = 1000): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setOn(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  return on
}

/** 손가락 탭 포인터 + 물결 효과 */
export function TapPointer({ className = '-bottom-3 -right-2' }: { className?: string }) {
  return (
    <motion.div
      className={`pointer-events-none absolute z-20 ${className}`}
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

export type HudMetric = { icon?: string; emoji?: string; value: number; from?: number; suffix?: string; label?: string }

/** 실제 게임 헤더의 정보 칩 하나 (참가자 · 골드 · 방어권 …) */
export type HudChip = {
  label: string
  value: string | number
  /** 숫자가 오르는 연출: 이 값에서 value 까지 세어 올라간다 */
  from?: number
  suffix?: string
  icon?: string
  emoji?: string
  /** 실제 게임처럼 칩마다 색을 다르게 (기본은 반투명 흰색) */
  tone?: 'default' | 'amber' | 'emerald' | 'rose' | 'sky'
}

const CHIP_TONE: Record<NonNullable<HudChip['tone']>, string> = {
  default: 'gold-quest-glass-chip text-[#17262a]',
  amber: 'border border-amber-200/70 bg-amber-100/45 text-amber-800 backdrop-blur-sm',
  emerald: 'border border-emerald-200/70 bg-emerald-100/45 text-emerald-800 backdrop-blur-sm',
  rose: 'border border-rose-200/70 bg-rose-100/45 text-rose-800 backdrop-blur-sm',
  sky: 'border border-sky-200/70 bg-sky-100/45 text-sky-800 backdrop-blur-sm',
}

function ChipValue({ chip, cycle }: { chip: HudChip; cycle: number }) {
  const rising = typeof chip.value === 'number' && chip.from !== undefined && chip.from !== chip.value
  return (
    <motion.div
      key={`${chip.value}-${cycle}`}
      initial={{ scale: rising ? 1.2 : 1 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      className="truncate text-base font-black tabular-nums leading-tight sm:text-lg"
    >
      {rising ? <CountUp from={chip.from!} to={chip.value as number} /> : typeof chip.value === 'number' ? chip.value.toLocaleString() : chip.value}
      {chip.suffix && <span className="ml-0.5 text-xs font-bold opacity-70">{chip.suffix}</span>}
    </motion.div>
  )
}

/**
 * 실제 게임 헤더와 같은 구조 — app/game/page.tsx 의 <header> 와 같은 클래스(gold-quest-ink-panel · gold-quest-glass-chip)를 쓴다.
 * 눈싸움·인형뽑기·타워 등 다른 게임 헤더도 같은 뼈대(제목 타일 + 제목 + 문제집 이름 + 칩)라 공용으로 쓴다.
 */
export function GameHeader({ mode, chips, cycle = 0 }: { mode: GameModeId; chips: HudChip[]; cycle?: number }) {
  const cfg = getGameModeConfig(mode)
  return (
    <div className="gold-quest-ink-panel p-2.5 text-[#17262a] sm:p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] backdrop-blur-sm sm:h-11 sm:w-11">
            {cfg.image ? (
              <Image src={cfg.image} alt="" fill className="object-contain p-1" sizes="44px" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xl">{cfg.emoji}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="gold-quest-title truncate text-base font-black leading-none sm:text-xl">{cfg.label}</h3>
            <QuizSetName title={DEMO_SET_NAME} className="mt-1" />
          </div>
        </div>
        <div className="flex flex-shrink-0 items-stretch gap-1.5 sm:gap-2">
          {chips.map((chip) => (
            <div key={chip.label} className={`min-w-0 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 ${CHIP_TONE[chip.tone ?? 'default']}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 sm:text-xs">
                {chip.icon ? (
                  <Image src={chip.icon} alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
                ) : chip.emoji ? (
                  <span className="text-xs leading-none">{chip.emoji}</span>
                ) : null}
                {chip.label}
              </div>
              <ChipValue chip={chip} cycle={cycle} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

type FrameProps = {
  backgroundSrc?: string
  backgroundClassName?: string
  /** 실제 게임 헤더로 그리는 게임. 지정하면 metric 대신 chips 를 쓴다 */
  mode?: GameModeId
  /** 장면별 헤더 정보 칩 (참가자 칩은 자동으로 맨 앞에 붙는다) */
  chips?: (phase: string) => HudChip[]
  /** 헤더 아래에 뜨는 알림 띠 (예: "4연속 정답 - 방어권 획득!") */
  notice?: (phase: string) => ReactNode
  /** 게임 고유 헤더(좀비·마피아처럼 검은 바 등). 주면 mode/chips 헤더 대신 그린다 */
  header?: (ctx: { phase: string; cycle: number }) => ReactNode
  /** 옛 방식 HUD (mode 가 없을 때만) */
  metric?: (phase: string) => HudMetric | null
  /** 배경을 어둡게 눌러 글씨를 살린다 — 실제 화면이 어두운 게임에서만 */
  dim?: boolean
  phases: DemoPhase[]
  children: (ctx: { phase: string; cycle: number }) => ReactNode
}

export function TutorialDemoFrame({ backgroundSrc, backgroundClassName, mode, chips, notice, header, metric, dim = false, phases, children }: FrameProps) {
  const { phaseIndex: safePhaseIndex, cycle } = useDemoPhaseIndex(phases)
  const phase = phases[safePhaseIndex].key
  const m = metric?.(phase) ?? null
  const chipList: HudChip[] | null = mode
    ? [{ label: '참가자', value: PLAYER_NAME }, ...(chips?.(phase) ?? (m ? [{ label: m.label ?? m.suffix ?? '점수', value: m.value, from: m.from, icon: m.icon, emoji: m.emoji, suffix: m.label ? m.suffix : undefined }] : []))]
    : null
  const noticeNode = notice?.(phase) ?? null

  return (
    // translateZ: 실제 게임 컴포넌트가 띄우는 fixed 팝업(상자 보상·방어권 질문)이 화면 전체가 아니라 이 프레임 안에 갇히게 한다.
    <div data-tutorial-frame className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl" style={{ transform: 'translateZ(0)' }}>
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
      {dim && <div className="absolute inset-0 bg-gradient-to-b from-[#0b1622]/55 via-[#0b1622]/25 to-[#0b1622]/70" />}

      {/* 헤더 */}
      {header ? (
        <div className="relative z-10">{header({ phase, cycle })}</div>
      ) : chipList && mode ? (
        <div className="relative z-10 px-3 pt-3 sm:px-4 sm:pt-4">
          <GameHeader mode={mode} chips={chipList} cycle={cycle} />
          <AnimatePresence>
            {noticeNode && (
              <motion.div
                key={String(phase)}
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                className="mt-2"
              >
                {noticeNode}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
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
              className="flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 shadow-lg ring-1 ring-white/60"
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
      )}

      {/* 무대 */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-3 py-3 sm:px-5">
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

/**
 * 모든 게임 공통 퀴즈 — 실제 게임이 쓰는 QuizView(variant="glass") 를 그대로 띄운다.
 * answered 가 켜지면 정답 버튼을 눌러 실제와 똑같은 정답 연출이 나온다.
 * 정답 전에 오래 머물면(선생님이 1번 규칙에서 설명 중) 타이머가 끝나 오답 처리되지 않도록 20초마다 새로 그린다.
 */
export function GlassQuizStep({
  question,
  options,
  correctIndex,
  answered,
  type = 'CHOICE',
  zoom = 0.8,
}: {
  question: string
  options: string[]
  correctIndex: number
  answered: boolean
  type?: 'CHOICE' | 'OX'
  /** 무대가 낮은 게임(하단 로그 바가 있는 마피아 등)은 더 줄인다 */
  zoom?: number
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [epoch, setEpoch] = useState(0)
  const [pointer, setPointer] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (answered) return
    setPointer(null)
    const timer = setInterval(() => setEpoch((e) => e + 1), 20000)
    return () => clearInterval(timer)
  }, [answered])

  useEffect(() => {
    if (!answered) return
    const box = boxRef.current
    if (!box) return
    const answer = options[correctIndex]
    const button = [...box.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim().endsWith(answer))
    if (!button) return
    const timer = setTimeout(() => {
      button.click()
      const boxRect = box.getBoundingClientRect()
      const rect = button.getBoundingClientRect()
      // 조상에 zoom 이 걸려 있으면 화면 px 과 이 상자의 px 이 다르다 — 비율로 되돌려야 포인터가 제자리에 온다
      const scale = box.offsetWidth > 0 ? boxRect.width / box.offsetWidth : 1
      setPointer({ left: (rect.right - boxRect.left) / scale - 44, top: (rect.bottom - boxRect.top) / scale - 22 })
    }, 250)
    return () => clearTimeout(timer)
  }, [answered, epoch, options, correctIndex])

  const demoQuestion = useMemo(
    () => ({ id: `tutorial-${epoch}`, type, question_text: question, options, answer: options[correctIndex] }),
    [epoch, type, question, options, correctIndex],
  )

  return (
    <motion.div
      key="quiz"
      ref={boxRef}
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="relative w-full max-w-2xl"
    >
      {/* 실제 화면보다 무대가 작으니 zoom 으로 줄인다 (transform 과 달리 레이아웃도 같이 줄어 잘리지 않는다) */}
      <div style={{ zoom }}>
        <QuizView key={demoQuestion.id} question={demoQuestion} onAnswer={() => true} timeLimit={30} variant="glass" />
      </div>
      {pointer && (
        <div className="pointer-events-none absolute" style={{ left: pointer.left, top: pointer.top }}>
          <TapPointer className="left-0 top-0" />
        </div>
      )}
    </motion.div>
  )
}

/** 게임 공통: 실시간 순위 — 실제 골드 순위판(app/game/page.tsx)과 같은 크림색 패널·순위 타일·아바타 */
export function MiniLeaderboard({
  rows,
  suffix = '',
  title = '실시간 순위',
}: {
  rows: { name: string; value: number; me?: boolean; avatar?: string }[]
  suffix?: string
  title?: string
}) {
  const leader = Math.max(1, ...rows.map((r) => r.value))
  return (
    <motion.div
      key="score"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="gold-quest-panel w-full max-w-md p-4 text-[#17262a] sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="gold-quest-title flex items-center gap-2 text-lg font-black">
          <span>🏆</span>
          {title}
        </h4>
        <span className="text-xs font-bold text-slate-500">{rows.length}명 참가</span>
      </div>
      <div className="grid gap-2">
        {rows.map((row, i) => {
          const isTop = i === 0
          const fill = Math.max(6, Math.round((row.value / leader) * 100))
          return (
            <motion.div
              key={row.name}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.12 }}
              className={`relative overflow-hidden rounded-lg border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-sm ${
                row.me ? 'border-amber-300/70 bg-amber-100/45' : isTop ? 'border-red-200/70 bg-red-100/40' : 'gold-quest-glass-chip'
              }`}
            >
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-200/40 to-transparent" style={{ width: `${fill}%` }} />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                    isTop ? 'bg-red-500 text-white' : 'border border-white/50 bg-white/35 text-slate-700 backdrop-blur-sm'
                  }`}>
                    {i + 1}
                  </div>
                  <PlayerAvatarDisplay
                    avatar={row.avatar ?? (row.me ? PLAYER_AVATAR : RIVALS[i % RIVALS.length].avatar)}
                    nickname={row.name}
                    fallback="P"
                    className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-white/55 bg-white/35 text-xl backdrop-blur-sm"
                    sizes="36px"
                  />
                  <span className="truncate text-base font-black">{row.name}</span>
                  {row.me && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-[#163238]">나</span>}
                </div>
                <span className="text-base font-black tabular-nums text-amber-700">
                  {row.value.toLocaleString()}
                  {suffix && <span className="ml-0.5 text-xs font-bold text-slate-500">{suffix}</span>}
                </span>
              </div>
            </motion.div>
          )
        })}
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
