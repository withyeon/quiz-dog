'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import QuizpangBoard from '@/components/quizpang/QuizpangBoard'
import ItemCardPicker from '@/components/quizpang/ItemCardPicker'
import type { BoardEvent, BoardHandle } from '@/hooks/useQuizpangGame'
import {
  QUIZPANG,
  applyItem,
  chainCheer,
  createQuizpangState,
  findAnyMove,
  trySwap,
  type Cell,
  type ItemCard,
  type QuizpangState,
} from '@/lib/game/quizpang'
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
import { MovingPointer, useElementPointer, useFrameFitZoom } from '@/components/tutorial/demoPointer'

/**
 * 퀴즈팡팡 — 실제 게임과 같은 재료로 그린다:
 *   보드(QuizpangBoard, 진짜 규칙 trySwap·applyItem 으로 움직인다) · 퀴즈(GlassQuizStep) · 아이템 카드(ItemCardPicker)
 * 장면 3개는 튜토리얼 규칙 3장(lib/game/tutorials.ts 의 quizpang)과 1:1 — 1 맞추기 · 2 문제→카드 · 3 아이템→순위(장면 안에서 차례로 돈다).
 */

const DEMO_SEED = 20261029
const SCORE_START = 0
const SCORE_AFTER_MATCH = 240
const SCORE_AFTER_ITEM = 760
const SCORE_FINAL = 2480
const DEMO_CARDS: ItemCard[] = [{ item: 'line' }, { item: 'bomb' }, { item: 'double' }]

const useLayoutEffectSafe = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** 무대(프레임 높이 − 헤더·캡션 몫)에 들어가는 정사각형 보드 한 변(px) */
function useStageSquare(ref: RefObject<HTMLElement | null>, reserved = 190): number {
  const [size, setSize] = useState(280)
  useLayoutEffectSafe(() => {
    const frame = ref.current?.closest('[data-tutorial-frame]')
    if (!(frame instanceof HTMLElement)) return
    const measure = () => {
      const next = Math.max(200, Math.min(frame.clientWidth - 32, frame.clientHeight - reserved))
      setSize((prev) => (Math.abs(prev - next) < 1 ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [ref, reserved])
  return size
}

/** 보드 안 칸의 가운데 (포인터 좌표, 보드 래퍼 기준 px) */
function cellPoint(size: number, cell: Cell) {
  const pad = size * 0.025
  const unit = (size - pad * 2) / QUIZPANG.COLS
  return { left: pad + (cell.c + 0.5) * unit - 12, top: pad + (cell.r + 0.5) * unit - 12 }
}

/**
 * 데모 보드: 진짜 보드 컴포넌트에 진짜 상태를 물려 준다. 조작은 받지 않고(running=false) 스크립트가 play 로 움직인다.
 * mode='swap'  — 2.9초마다 가능한 수 하나를 포인터가 끌어서 바꾼다.
 * mode='bomb'  — 포인터가 한가운데로 가서 멍멍 폭탄을 터뜨린다 (한 번).
 */
function DemoBoard({ mode }: { mode: 'swap' | 'bomb' }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const size = useStageSquare(wrapRef)
  const stateRef = useRef<QuizpangState | null>(null)
  if (!stateRef.current) stateRef.current = createQuizpangState(DEMO_SEED)
  const boardRef = useRef<BoardHandle | null>(null)
  const [pointer, setPointer] = useState<{ left: number; top: number } | null>(null)
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null)
  const bannerId = useRef(0)
  const sizeRef = useRef(size)
  useEffect(() => { sizeRef.current = size }, [size])

  const showBanner = (text: string) => {
    bannerId.current += 1
    const id = bannerId.current
    setBanner({ id, text })
    window.setTimeout(() => setBanner((current) => (current?.id === id ? null : current)), 1300)
  }

  useEffect(() => {
    const timers: number[] = []
    const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)) }
    if (mode === 'bomb') {
      const target: Cell = { r: 3, c: 4 }
      later(() => setPointer(cellPoint(sizeRef.current, target)), 400)
      later(() => {
        const state = stateRef.current
        if (!state) return
        const result = applyItem(state, 'bomb', { cell: target })
        showBanner('💣 멍멍 폭탄!')
        boardRef.current?.play(result.steps)
        setPointer(null)
      }, 1700)
      return () => timers.forEach((id) => window.clearTimeout(id))
    }
    const runSwap = () => {
      const state = stateRef.current
      if (!state) return
      const move = findAnyMove(state.board)
      if (!move) return
      setPointer(cellPoint(sizeRef.current, move[0]))
      later(() => setPointer(cellPoint(sizeRef.current, move[1])), 650)
      later(() => {
        const result = trySwap(state, move[0], move[1])
        boardRef.current?.play(result.steps)
        setPointer(null)
      }, 1000)
    }
    later(runSwap, 300)
    const interval = window.setInterval(runSwap, 2900)
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      window.clearInterval(interval)
    }
  }, [mode])

  const onEvents = (events: BoardEvent[]) => {
    for (const event of events) {
      if (event.type !== 'clear') continue
      const cheer = chainCheer(event.chain)
      if (cheer) showBanner(cheer)
      else if (event.triggered > 0) showBanner('펑! 💥')
    }
  }

  return (
    <div ref={wrapRef} className="relative" style={{ width: size, height: size }}>
      <QuizpangBoard ref={boardRef} stateRef={stateRef} running={false} targeting={null} onEvents={onEvents} onBusy={() => undefined} onTarget={() => undefined} />
      <MovingPointer pointer={pointer} />
      <div className="pointer-events-none absolute inset-x-0 top-[34%] z-30 flex justify-center">
        <AnimatePresence>
          {banner && (
            <motion.div
              key={banner.id}
              initial={{ opacity: 0, scale: 0.5, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.2, y: -16 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              className="rounded-2xl border-4 border-slate-900 bg-yellow-300 px-4 py-2 font-bitbit text-lg font-black text-slate-900 shadow-[0_5px_0_#0f172a] sm:text-2xl"
            >
              {banner.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** 규칙 1 — 같은 강아지 3마리를 모으면 팡! */
function MatchScene() {
  return (
    <StageCard id="qp-match" className="relative">
      <DemoBoard mode="swap" />
    </StageCard>
  )
}

/** 규칙 2 — 30초마다 문제 */
function QuizScene() {
  const answered = useDelayedFlag(1400)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 560)
  return (
    <div key="qp-quiz" style={{ zoom, width: 560 }}>
      <div ref={contentRef} className="flex justify-center rounded-3xl bg-slate-950/75 p-4">
        <GlassQuizStep question="다음 중 포유류는 무엇일까요?" options={['강아지', '참새', '개구리', '붕어']} correctIndex={0} answered={answered} zoom={0.8} />
      </div>
    </div>
  )
}

const findBombCard = (box: HTMLElement) => [...box.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes('멍멍 폭탄'))

/** 규칙 2 — 정답이면 아이템 카드 3장 중 하나 */
function CardsScene() {
  const boxRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoom = useFrameFitZoom(contentRef, 760, 190, 0.9)
  const picking = useDelayedFlag(1500)
  const pointer = useElementPointer(boxRef, picking ? findBombCard : null, picking ? 1 : 0)
  return (
    <StageCard id="qp-cards" className="relative">
      <div ref={boxRef} className="relative">
        <div style={{ zoom, width: 760 }}>
          <div ref={contentRef} className="rounded-3xl bg-slate-950/75 p-5">
            <ItemCardPicker cards={DEMO_CARDS} onPick={() => undefined} />
          </div>
        </div>
        <MovingPointer pointer={pointer} />
      </div>
    </StageCard>
  )
}

/** 규칙 3 — 보관한 아이템을 원할 때 쓴다 (멍멍 폭탄) */
function ItemScene() {
  return (
    <StageCard id="qp-item" className="relative">
      <DemoBoard mode="bomb" />
    </StageCard>
  )
}

/** 규칙 3 — 점수가 가장 높으면 팡팡 챔피언 */
function RankScene() {
  return (
    <MiniLeaderboard
      key="qp-rank"
      title="오늘의 팡팡 챔피언 👑"
      suffix="점"
      rows={[
        { name: PLAYER_NAME, value: SCORE_FINAL, me: true, avatar: PLAYER_AVATAR },
        { name: RIVALS[0].name, value: 2150, avatar: RIVALS[0].avatar },
        { name: RIVALS[1].name, value: 1830, avatar: RIVALS[1].avatar },
      ]}
    />
  )
}

/** 한 장면 안에서 여러 컷을 차례로 돌린다 (선생님이 규칙에 머물러 있어도 계속 움직이게) */
function useCutCycle(durations: number[]): number {
  const [cut, setCut] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setCut((value) => (value + 1) % durations.length), durations[cut])
    return () => window.clearTimeout(timer)
  }, [cut, durations])
  return cut
}

const QUIZ_CARDS_CUTS = [3400, 3800]
const ITEM_RANK_CUTS = [4200, 3200]

/** 규칙 2 — 문제 → 정답이면 카드 */
function QuizCardsScene() {
  const cut = useCutCycle(QUIZ_CARDS_CUTS)
  return cut === 0 ? <QuizScene key="qp-quiz-cut" /> : <CardsScene key="qp-cards-cut" />
}

/** 규칙 3 — 아이템 쓰기 → 순위 */
function ItemRankScene() {
  const cut = useCutCycle(ITEM_RANK_CUTS)
  return cut === 0 ? <ItemScene key="qp-item-cut" /> : <RankScene key="qp-rank-cut" />
}

export default function QuizpangTutorialDemo() {
  return (
    <TutorialDemoFrame
      mode="quizpang"
      backgroundClassName="bg-[radial-gradient(circle_at_20%_10%,#fbcfe8_0,#bfdbfe_45%,#fde68a_100%)]"
      chips={(phase) => {
        const score =
          phase === 'match' ? { value: SCORE_AFTER_MATCH, from: SCORE_START }
            : phase === 'quizcards' ? { value: SCORE_AFTER_MATCH }
              : { value: SCORE_AFTER_ITEM, from: SCORE_AFTER_MATCH }
        return [{ label: '점수', ...score, suffix: '점', tone: 'amber' as const }]
      }}
      /* 규칙 3장(lib/game/tutorials.ts 의 quizpang)과 1:1 — 선생님이 규칙을 넘기면 장면 하나씩 따라간다 */
      phases={[
        { key: 'match', duration: 5800, step: 1, caption: '강아지를 끌어서 같은 강아지 3마리를 모으면 팡!' },
        { key: 'quizcards', duration: 7200, step: 2, caption: `${QUIZPANG.QUESTION_INTERVAL_MS / 1000}초마다 문제! 맞히면 아이템 카드 ${QUIZPANG.CHOICES}장 중 하나` },
        { key: 'itemrank', duration: 7400, step: 3, caption: '아이템은 원할 때 써요. 점수가 가장 높으면 팡팡 챔피언!' },
      ]}
    >
      {({ phase }) => {
        if (phase === 'match') return <MatchScene key="match" />
        if (phase === 'quizcards') return <QuizCardsScene key="quizcards" />
        return <ItemRankScene key="itemrank" />
      }}
    </TutorialDemoFrame>
  )
}
