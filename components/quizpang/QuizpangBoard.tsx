'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef, type MutableRefObject } from 'react'
import {
  QUIZPANG,
  findAnyMove,
  isAdjacent,
  trySwap,
  type Cell,
  type LineDir,
  type QuizpangState,
  type Special,
  type Step,
} from '@/lib/game/quizpang'
import type { BoardEvent, BoardHandle, Targeting } from '@/hooks/useQuizpangGame'

/**
 * 퀴즈팡팡 보드 (캔버스).
 *
 * - 규칙 계산은 lib/game/quizpang.ts (trySwap·applyItem) 가 하고, 여기서는 그 결과(단계 목록)를 순서대로 재생한다:
 *   swap(바꾸기) → clear(팡 터짐·파티클·점수 글자) → fall(떨어지기·새 블록) → … → shuffle(섞기).
 * - 재생 중(busy)에는 조작을 받지 않는다. 끝나면 state.board 와 화면을 다시 맞춘다(안전망).
 * - 조작: 블록을 누르고 끌기(스와이프) 또는 두 번 누르기(이웃 블록). 마우스·터치 모두 pointer 이벤트 하나로 받는다.
 * - 아이템 자리 고르기(targeting): 누르는 동안 터질 범위를 미리 보여 주고, 떼면 onTarget. 줄 삭제는 끄는 방향이 가로·세로를 정한다.
 * - 그림은 public/character/*.webp (강아지 아바타) 를 쓰고, 없으면 색 사각형 + 🐶 로 대신한다.
 */

export type QuizpangBoardProps = {
  stateRef: MutableRefObject<QuizpangState | null>
  /** 조작을 받을지 (퍼즐 화면 + 방이 진행 중) */
  running: boolean
  targeting: Targeting | null
  onEvents: (events: BoardEvent[]) => void
  onBusy: (busy: boolean) => void
  onTarget: (cell: Cell, dirHint?: LineDir) => void
  /** 판을 세로로 어디에 둘지 — 폰 세로(stack)는 위 숫자판 바로 아래(top), 넓은 화면은 가운데(center) */
  align?: 'top' | 'center'
}

type Tween = { fx: number; fy: number; tx: number; ty: number; start: number; dur: number }
type Visual = {
  id: number
  kind: number
  special: Special
  x: number
  y: number
  scale: number
  alpha: number
  pop: number | null
  tween: Tween | null
  scaleTween: { from: number; to: number; start: number; dur: number } | null
  /** 스페셜로 변신한 순간 (반짝) */
  bornSpecial: number
}
type Particle = { x: number; y: number; vx: number; vy: number; start: number; dur: number; color: string; size: number; star: boolean; sprite: 'star' | 'paw' | null; spin: number }
/** 터질 때 뜨는 「팡!」 스티커 */
type Pang = { x: number; y: number; start: number; dur: number; size: number; tilt: number }
type FloatText = { x: number; y: number; text: string; sub: string | null; start: number; dur: number; color: string; big: boolean }
type Flash = { kind: 'row' | 'col' | 'ring' | 'bigring'; r: number; c: number; start: number; dur: number; color: string }
type Playing = { steps: Step[]; index: number; stepStart: number; stepDur: number; score: number; shuffleDone: boolean }
type Drag = { pointerId: number; cell: Cell; x0: number; y0: number; done: boolean; dirHint: LineDir | null }

const { ROWS, COLS, ANIM } = QUIZPANG
const MAX_PIXELS = 2_600_000
const HINT_AFTER_MS = 7000
const SPECIAL_COLORS: Record<Exclude<Special, 'none'>, string> = { cross: '#38bdf8', boom: '#f59e0b' }

/** 효과 그림 (public/quizpang/fx-*.webp). 없으면 도형으로 대신 그린다 */
const FX = {
  pang: '/quizpang/fx-pang.webp',
  badgeLine: '/quizpang/fx-badge-line.webp',
  badgeBoom: '/quizpang/fx-badge-boom.webp',
  star: '/quizpang/fx-star.webp',
  paw: '/quizpang/fx-paw.webp',
} as const

const imageCache = new Map<string, HTMLImageElement>()
function loadImages() {
  if (typeof window === 'undefined') return
  for (const src of [...QUIZPANG.DOG_IMAGES, ...Object.values(FX)]) {
    if (imageCache.has(src)) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    imageCache.set(src, img)
  }
}
function loadedImage(src: string | undefined): HTMLImageElement | null {
  const img = src ? imageCache.get(src) : undefined
  return img && img.complete && img.naturalWidth > 0 ? img : null
}
function dogImage(kind: number): HTMLImageElement | null {
  return loadedImage(QUIZPANG.DOG_IMAGES[kind])
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const easeOutBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
const clamp01 = (t: number) => Math.max(0, Math.min(1, t))

const QuizpangBoard = forwardRef<BoardHandle, QuizpangBoardProps>(function QuizpangBoard(
  { stateRef, running, targeting, onEvents, onBusy, onTarget, align = 'center' },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runningRef = useRef(running)
  const targetingRef = useRef(targeting)
  const onEventsRef = useRef(onEvents)
  const onBusyRef = useRef(onBusy)
  const onTargetRef = useRef(onTarget)

  // 화면 상태 (렌더와 무관하게 ref 로만 다룬다)
  const visualsRef = useRef<Map<number, Visual>>(new Map())
  const gridRef = useRef<(number | null)[][]>([])
  const playingRef = useRef<Playing | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const textsRef = useRef<FloatText[]>([])
  const pangsRef = useRef<Pang[]>([])
  const flashesRef = useRef<Flash[]>([])
  const selectedRef = useRef<Cell | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const hoverRef = useRef<Cell | null>(null)
  const hintRef = useRef<[Cell, Cell] | null>(null)
  const idleSinceRef = useRef(0)
  const shakeRef = useRef<{ start: number; power: number } | null>(null)
  const geomRef = useRef({ size: 1, pad: 0, cell: 1, ox: 0, oy: 0 })
  const alignRef = useRef(align)
  const pendingEventsRef = useRef<BoardEvent[]>([])
  const reconciledForRef = useRef<QuizpangState | null>(null)

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { targetingRef.current = targeting }, [targeting])
  useEffect(() => { onEventsRef.current = onEvents }, [onEvents])
  useEffect(() => { onBusyRef.current = onBusy }, [onBusy])
  useEffect(() => { onTargetRef.current = onTarget }, [onTarget])
  useEffect(() => { alignRef.current = align }, [align])

  // 멈추면 누르고 있던 손가락·선택을 놓는다 (문제 창이 덮으면 pointerup 을 못 받는다)
  useEffect(() => {
    if (running) return
    dragRef.current = null
    selectedRef.current = null
  }, [running])
  useEffect(() => {
    if (!targeting) hoverRef.current = null
  }, [targeting])

  // ─── 보드(state.board) ↔ 화면 블록 맞추기 ───
  const reconcile = (now: number, popIn = false) => {
    const state = stateRef.current
    if (!state) return
    const visuals = new Map<number, Visual>()
    const grid: (number | null)[][] = []
    for (let r = 0; r < ROWS; r += 1) {
      const row: (number | null)[] = []
      for (let c = 0; c < COLS; c += 1) {
        const block = state.board[r][c]
        if (!block) { row.push(null); continue }
        const old = visualsRef.current.get(block.id)
        visuals.set(block.id, {
          id: block.id,
          kind: block.kind,
          special: block.special,
          x: c,
          y: r,
          scale: popIn ? 0 : 1,
          alpha: 1,
          pop: null,
          tween: null,
          scaleTween: popIn ? { from: 0, to: 1, start: now + (r * COLS + c) * 4, dur: ANIM.SHUFFLE_MS * 0.6 } : null,
          bornSpecial: old?.bornSpecial ?? 0,
        })
        row.push(block.id)
      }
      grid.push(row)
    }
    visualsRef.current = visuals
    gridRef.current = grid
    reconciledForRef.current = state
    hintRef.current = null
    idleSinceRef.current = now
  }

  const emit = (event: BoardEvent) => { pendingEventsRef.current.push(event) }

  // ─── 단계 재생 ───
  const beginStep = (playing: Playing, now: number) => {
    const step = playing.steps[playing.index]
    const visuals = visualsRef.current
    const grid = gridRef.current
    const { cell: cellSize, pad } = geomRef.current
    const center = (r: number, c: number) => ({ x: pad + (c + 0.5) * cellSize, y: pad + (r + 0.5) * cellSize })
    playing.stepStart = now

    if (step.type === 'swap') {
      const idA = grid[step.a.r][step.a.c]
      const idB = grid[step.b.r][step.b.c]
      const va = idA !== null ? visuals.get(idA) : null
      const vb = idB !== null ? visuals.get(idB) : null
      if (va) va.tween = { fx: va.x, fy: va.y, tx: step.b.c, ty: step.b.r, start: now, dur: ANIM.SWAP_MS }
      if (vb) vb.tween = { fx: vb.x, fy: vb.y, tx: step.a.c, ty: step.a.r, start: now, dur: ANIM.SWAP_MS }
      grid[step.a.r][step.a.c] = idB
      grid[step.b.r][step.b.c] = idA
      if (step.back) {
        emit({ type: 'invalid' })
        shakeRef.current = { start: now, power: 3 }
      }
      playing.stepDur = ANIM.SWAP_MS
      return
    }

    if (step.type === 'clear') {
      let sx = 0
      let sy = 0
      for (const cell of step.cells) {
        const id = grid[cell.r][cell.c]
        const visual = id !== null ? visuals.get(id) : null
        if (visual) visual.pop = now
        grid[cell.r][cell.c] = null
        const point = center(cell.r, cell.c)
        sx += point.x
        sy += point.y
        spawnParticles(particlesRef.current, point.x, point.y, QUIZPANG.DOG_COLORS[cell.kind] ?? '#fbbf24', cellSize, now, step.chain)
      }
      for (const created of step.created) {
        const visual = visuals.get(created.id)
        if (visual) {
          visual.special = created.special
          visual.bornSpecial = now
          visual.scaleTween = { from: 1.4, to: 1, start: now, dur: ANIM.POP_MS * 1.6 }
        }
        const point = center(created.cell.r, created.cell.c)
        flashesRef.current.push({ kind: 'ring', r: created.cell.r, c: created.cell.c, start: now, dur: 420, color: SPECIAL_COLORS[created.special as Exclude<Special, 'none'>] ?? '#fff' })
        spawnParticles(particlesRef.current, point.x, point.y, '#fde047', cellSize, now, 3, true)
      }
      for (const trig of step.triggered) {
        if (trig.special === 'cross') {
          flashesRef.current.push({ kind: 'row', r: trig.cell.r, c: trig.cell.c, start: now, dur: 380, color: '#7dd3fc' })
          flashesRef.current.push({ kind: 'col', r: trig.cell.r, c: trig.cell.c, start: now, dur: 380, color: '#7dd3fc' })
        } else {
          flashesRef.current.push({ kind: 'bigring', r: trig.cell.r, c: trig.cell.c, start: now, dur: 480, color: '#fbbf24' })
        }
      }
      if (step.cells.length > 0) {
        const n = step.cells.length
        const big = step.chain >= 2 || n >= 5 || step.triggered.length > 0
        pangsRef.current.push({
          x: sx / n, y: sy / n - cellSize * 0.55, start: now, dur: big ? 620 : 480,
          size: cellSize * (big ? 2.1 : 1.45) * (1 + Math.min(0.5, step.triggered.length * 0.25)),
          tilt: (Math.random() - 0.5) * 0.5,
        })
        if (pangsRef.current.length > 8) pangsRef.current.splice(0, pangsRef.current.length - 8)
        const chainMult = step.chain > 1 ? `×${(1 + (step.chain - 1) * QUIZPANG.CHAIN_STEP).toFixed(1).replace(/\.0$/, '')}` : null
        const double = stateRef.current && stateRef.current.doubleMsLeft > 0 ? '2배!' : null
        textsRef.current.push({
          x: sx / n, y: sy / n + cellSize * 0.75, text: `+${step.score.toLocaleString()}`,
          sub: [chainMult, double].filter(Boolean).join(' ') || null,
          start: now, dur: 900, color: step.chain >= 3 ? '#f43f5e' : double ? '#f59e0b' : '#0f172a', big: step.chain >= 3 || step.score >= 300,
        })
      }
      const power = Math.min(10, 1.5 + step.triggered.length * 3 + (step.chain - 1) * 1.2 + step.cells.length * 0.15)
      if (power > 3) shakeRef.current = { start: now, power }
      emit({ type: 'clear', chain: step.chain, score: step.score, count: step.cells.length, specials: step.created.length, triggered: step.triggered.length, source: step.source })
      playing.score += step.score
      playing.stepDur = ANIM.POP_MS
      return
    }

    if (step.type === 'fall') {
      // 터진 블록 치우기
      for (const [id, visual] of visuals) if (visual.pop !== null) visuals.delete(id)
      let longest: number = ANIM.FALL_MIN_MS
      for (const move of step.moves) grid[move.from.r][move.from.c] = null
      for (const move of step.moves) {
        const visual = visuals.get(move.id)
        const dist = Math.abs(move.to.r - move.from.r)
        const dur = Math.max(ANIM.FALL_MIN_MS, dist * ANIM.FALL_MS_PER_CELL)
        longest = Math.max(longest, dur)
        if (visual) visual.tween = { fx: visual.x, fy: visual.y, tx: move.to.c, ty: move.to.r, start: now, dur }
        grid[move.to.r][move.to.c] = move.id
      }
      for (const spawn of step.spawns) {
        const fromY = spawn.fromRow - 1
        const dist = spawn.to.r - fromY
        const dur = Math.max(ANIM.FALL_MIN_MS, dist * ANIM.FALL_MS_PER_CELL)
        longest = Math.max(longest, dur)
        visuals.set(spawn.block.id, {
          id: spawn.block.id, kind: spawn.block.kind, special: spawn.block.special,
          x: spawn.to.c, y: fromY, scale: 1, alpha: 1, pop: null, scaleTween: null, bornSpecial: 0,
          tween: { fx: spawn.to.c, fy: fromY, tx: spawn.to.c, ty: spawn.to.r, start: now, dur },
        })
        grid[spawn.to.r][spawn.to.c] = spawn.block.id
      }
      playing.stepDur = longest + 40
      return
    }

    // shuffle: 작아졌다가 새 자리에서 다시 커진다
    for (const visual of visuals.values()) visual.scaleTween = { from: visual.scale, to: 0, start: now, dur: ANIM.SHUFFLE_MS * 0.4 }
    playing.shuffleDone = false
    emit({ type: 'shuffle' })
    playing.stepDur = ANIM.SHUFFLE_MS
  }

  const finishPlaying = (now: number) => {
    playingRef.current = null
    reconcile(now)
    onBusyRef.current(false)
    emit({ type: 'done', score: 0 })
  }

  const startPlaying = (steps: Step[], now: number) => {
    if (steps.length === 0) return
    selectedRef.current = null
    hintRef.current = null
    onBusyRef.current(true)
    const playing: Playing = { steps, index: 0, stepStart: now, stepDur: 0, score: 0, shuffleDone: true }
    playingRef.current = playing
    beginStep(playing, now)
  }

  useImperativeHandle(ref, () => ({
    play: (steps: Step[]) => {
      const now = performance.now()
      if (playingRef.current) {
        // 재생 중에 또 오면(원래는 훅이 막는다) 지금 것을 끝내고 새로 시작한다
        playingRef.current = null
        reconcile(now)
      }
      startPlaying(steps, now)
    },
  }))

  // ─── 조작 ───
  const doSwap = (a: Cell, b: Cell) => {
    const state = stateRef.current
    if (!state || playingRef.current) return
    const result = trySwap(state, a, b)
    startPlaying(result.steps, performance.now())
  }

  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { pad, cell, ox, oy } = geomRef.current
    const x = clientX - rect.left - ox - pad
    const y = clientY - rect.top - oy - pad
    const c = Math.floor(x / cell)
    const r = Math.floor(y / cell)
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null
    return { r, c }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!runningRef.current || dragRef.current) return
    const cell = cellAt(event.clientX, event.clientY)
    if (!cell) return
    idleSinceRef.current = performance.now()
    hintRef.current = null
    if (targetingRef.current) {
      hoverRef.current = cell
      dragRef.current = { pointerId: event.pointerId, cell, x0: event.clientX, y0: event.clientY, done: false, dirHint: null }
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (playingRef.current) return
    dragRef.current = { pointerId: event.pointerId, cell, x0: event.clientX, y0: event.clientY, done: false, dirHint: null }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (targetingRef.current) {
      const cell = cellAt(event.clientX, event.clientY)
      if (cell) hoverRef.current = cell
      if (drag && drag.pointerId === event.pointerId) {
        const dx = event.clientX - drag.x0
        const dy = event.clientY - drag.y0
        if (Math.max(Math.abs(dx), Math.abs(dy)) > geomRef.current.cell * 0.35) drag.dirHint = Math.abs(dx) >= Math.abs(dy) ? 'row' : 'col'
      }
      return
    }
    if (!drag || drag.pointerId !== event.pointerId || drag.done) return
    const dx = event.clientX - drag.x0
    const dy = event.clientY - drag.y0
    const threshold = geomRef.current.cell * 0.3
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return
    drag.done = true
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    const target: Cell = horizontal
      ? { r: drag.cell.r, c: drag.cell.c + (dx > 0 ? 1 : -1) }
      : { r: drag.cell.r + (dy > 0 ? 1 : -1), c: drag.cell.c }
    selectedRef.current = null
    if (target.r < 0 || target.r >= ROWS || target.c < 0 || target.c >= COLS) return
    doSwap(drag.cell, target)
  }

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (targetingRef.current) {
      const cell = cellAt(event.clientX, event.clientY) ?? hoverRef.current ?? drag.cell
      onTargetRef.current(cell, drag.dirHint ?? undefined)
      return
    }
    if (drag.done || !runningRef.current || playingRef.current) return
    const cell = cellAt(event.clientX, event.clientY) ?? drag.cell
    const selected = selectedRef.current
    if (selected && selected.r === cell.r && selected.c === cell.c) {
      selectedRef.current = null
      return
    }
    if (selected && isAdjacent(selected, cell)) {
      selectedRef.current = null
      doSwap(selected, cell)
      return
    }
    selectedRef.current = cell
  }

  const onPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  // ─── 그리기 루프 ───
  useEffect(() => {
    loadImages()
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let cssW = 1
    let cssH = 1
    let dpr = 1
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      cssW = Math.max(1, rect.width)
      cssH = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (cssW * cssH)), 2)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const size = Math.min(cssW, cssH)
      const pad = size * 0.025
      geomRef.current = { size, pad, cell: (size - pad * 2) / COLS, ox: (cssW - size) / 2, oy: alignRef.current === 'top' ? 0 : (cssH - size) / 2 }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const state = stateRef.current
      if (state && reconciledForRef.current !== state) reconcile(now, true)

      // 단계 진행
      const playing = playingRef.current
      if (playing) {
        const step = playing.steps[playing.index]
        if (step.type === 'shuffle' && !playing.shuffleDone && now - playing.stepStart >= ANIM.SHUFFLE_MS * 0.4) {
          playing.shuffleDone = true
          reconcile(now, true)
        }
        if (now - playing.stepStart >= playing.stepDur) {
          playing.index += 1
          if (playing.index >= playing.steps.length) finishPlaying(now)
          else beginStep(playing, now)
        }
      } else if (
        state && runningRef.current && !targetingRef.current && !hintRef.current
        && now - idleSinceRef.current > HINT_AFTER_MS
      ) {
        hintRef.current = findAnyMove(state.board)
        if (!hintRef.current) idleSinceRef.current = now
      }

      // 트윈 적용
      for (const visual of visualsRef.current.values()) {
        if (visual.tween) {
          const t = clamp01((now - visual.tween.start) / visual.tween.dur)
          const e = easeOutCubic(t)
          visual.x = visual.tween.fx + (visual.tween.tx - visual.tween.fx) * e
          visual.y = visual.tween.fy + (visual.tween.ty - visual.tween.fy) * e
          if (t >= 1) visual.tween = null
        }
        if (visual.scaleTween) {
          const t = clamp01((now - visual.scaleTween.start) / visual.scaleTween.dur)
          visual.scale = visual.scaleTween.from + (visual.scaleTween.to - visual.scaleTween.from) * (visual.scaleTween.to > visual.scaleTween.from ? easeOutBack(t) : easeOutCubic(t))
          if (t >= 1) { visual.scale = visual.scaleTween.to; visual.scaleTween = null }
        }
      }

      draw(ctx, dpr, cssW, cssH, now, {
        state,
        geom: geomRef.current,
        visuals: visualsRef.current,
        particles: particlesRef.current,
        texts: textsRef.current,
        pangs: pangsRef.current,
        flashes: flashesRef.current,
        selected: selectedRef.current,
        hint: hintRef.current,
        targeting: targetingRef.current,
        hover: hoverRef.current,
        dragDir: dragRef.current?.dirHint ?? null,
        shake: shakeRef.current,
        running: runningRef.current,
      })

      particlesRef.current = particlesRef.current.filter((p) => now - p.start < p.dur)
      textsRef.current = textsRef.current.filter((t) => now - t.start < t.dur)
      pangsRef.current = pangsRef.current.filter((p) => now - p.start < p.dur)
      flashesRef.current = flashesRef.current.filter((f) => now - f.start < f.dur)
      if (shakeRef.current && now - shakeRef.current.start > 320) shakeRef.current = null

      if (pendingEventsRef.current.length > 0) {
        const events = pendingEventsRef.current
        pendingEventsRef.current = []
        onEventsRef.current(events)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateRef])

  return (
    <div ref={wrapRef} className="relative h-full w-full min-w-0">
      <canvas
        ref={canvasRef}
        className="absolute left-0 top-0 block touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  )
})

export default QuizpangBoard

// ─── 파티클 ───
function spawnParticles(list: Particle[], x: number, y: number, color: string, cell: number, now: number, chain: number, stars = false) {
  const count = stars ? 10 : Math.min(14, 6 + chain * 2)
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2
    const speed = cell * (0.9 + Math.random() * 1.6) * (stars ? 1.2 : 1)
    list.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - cell * 0.8,
      start: now,
      dur: 420 + Math.random() * 320,
      color: stars ? (Math.random() < 0.5 ? '#fde047' : '#ffffff') : color,
      size: cell * (stars ? 0.12 : 0.08 + Math.random() * 0.1),
      star: stars || Math.random() < 0.25,
      // 일부는 그림 파티클(반짝이 별·발바닥) — 그림이 없으면 도형으로
      sprite: stars ? 'star' : Math.random() < 0.18 ? 'star' : Math.random() < 0.12 ? 'paw' : null,
      spin: (Math.random() - 0.5) * 8,
    })
  }
  if (list.length > 900) list.splice(0, list.length - 900)
}

// ─── 그리기 ───
type DrawInput = {
  state: QuizpangState | null
  geom: { size: number; pad: number; cell: number; ox: number; oy: number }
  visuals: Map<number, Visual>
  particles: Particle[]
  texts: FloatText[]
  pangs: Pang[]
  flashes: Flash[]
  selected: Cell | null
  hint: [Cell, Cell] | null
  targeting: Targeting | null
  hover: Cell | null
  dragDir: LineDir | null
  shake: { start: number; power: number } | null
  running: boolean
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function draw(ctx: CanvasRenderingContext2D, dpr: number, cssW: number, cssH: number, now: number, input: DrawInput) {
  const { geom, visuals, particles, texts, pangs, flashes, selected, hint, targeting, hover, dragDir, shake, state, running } = input
  const { size, pad, cell, ox, oy } = geom
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  let shakeX = 0
  let shakeY = 0
  if (shake) {
    const t = clamp01((now - shake.start) / 320)
    const amp = shake.power * (1 - t)
    shakeX = Math.sin(now * 0.09) * amp
    shakeY = Math.cos(now * 0.11) * amp
  }
  ctx.save()
  ctx.translate(ox + shakeX, oy + shakeY)

  // 판
  const doubleOn = state ? state.doubleMsLeft > 0 : false
  ctx.save()
  ctx.shadowColor = 'rgba(15,23,42,0.25)'
  ctx.shadowBlur = size * 0.02
  ctx.shadowOffsetY = size * 0.01
  roundRect(ctx, 0, 0, size, size, size * 0.04)
  ctx.fillStyle = doubleOn ? '#fff4d6' : '#fff8f0'
  ctx.fill()
  ctx.restore()
  roundRect(ctx, 0, 0, size, size, size * 0.04)
  ctx.lineWidth = Math.max(2, size * 0.008)
  ctx.strokeStyle = doubleOn ? `rgba(245,158,11,${0.6 + 0.4 * Math.sin(now * 0.01)})` : '#0f172a'
  ctx.stroke()

  // 칸
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#f6e9d8' : '#fdf3e6'
      roundRect(ctx, pad + c * cell + cell * 0.04, pad + r * cell + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.18)
      ctx.fill()
    }
  }

  // 아이템 범위 미리보기
  if (targeting && hover) {
    const dir = dragDir ?? targeting.dir
    const cells: Cell[] = []
    if (targeting.item === 'bomb') {
      const radius = QUIZPANG.ITEMS.bomb.radius
      for (let r = hover.r - radius; r <= hover.r + radius; r += 1) for (let c = hover.c - radius; c <= hover.c + radius; c += 1) if (r >= 0 && r < ROWS && c >= 0 && c < COLS) cells.push({ r, c })
    } else if (dir === 'row') {
      for (let c = 0; c < COLS; c += 1) cells.push({ r: hover.r, c })
    } else {
      for (let r = 0; r < ROWS; r += 1) cells.push({ r, c: hover.c })
    }
    const pulse = 0.25 + 0.12 * Math.sin(now * 0.012)
    for (const target of cells) {
      ctx.fillStyle = `rgba(244,63,94,${pulse})`
      roundRect(ctx, pad + target.c * cell + cell * 0.04, pad + target.r * cell + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.18)
      ctx.fill()
    }
  }

  // 힌트 자리
  if (hint && running) {
    const glow = 0.35 + 0.25 * Math.sin(now * 0.008)
    for (const target of hint) {
      ctx.fillStyle = `rgba(250,204,21,${glow})`
      roundRect(ctx, pad + target.c * cell, pad + target.r * cell, cell, cell, cell * 0.2)
      ctx.fill()
    }
  }

  // 선택 테두리
  if (selected) {
    ctx.lineWidth = Math.max(3, cell * 0.07)
    ctx.strokeStyle = '#facc15'
    roundRect(ctx, pad + selected.c * cell + cell * 0.03, pad + selected.r * cell + cell * 0.03, cell * 0.94, cell * 0.94, cell * 0.2)
    ctx.stroke()
  }

  // 블록 (판 안쪽만)
  ctx.save()
  roundRect(ctx, pad * 0.5, pad * 0.5, size - pad, size - pad, size * 0.03)
  ctx.clip()
  const ordered = [...visuals.values()].sort((a, b) => (a.pop === null ? 0 : 1) - (b.pop === null ? 0 : 1))
  for (const visual of ordered) {
    let scale = visual.scale
    let alpha = visual.alpha
    let bob = 0
    let wobble = 0
    if (visual.pop !== null) {
      const t = clamp01((now - visual.pop) / ANIM.POP_MS)
      scale *= 1 + 0.4 * Math.sin(t * Math.PI)
      alpha *= 1 - t * t
    }
    if (selected && !visual.tween && Math.round(visual.x) === selected.c && Math.round(visual.y) === selected.r) {
      scale *= 1.1
      bob = Math.sin(now * 0.012) * cell * 0.04
    }
    if (hint && running && hint.some((h) => h.c === Math.round(visual.x) && h.r === Math.round(visual.y))) {
      wobble = Math.sin(now * 0.02) * cell * 0.05
    }
    if (scale <= 0.01 || alpha <= 0.01) continue
    const cx = pad + (visual.x + 0.5) * cell + wobble
    const cy = pad + (visual.y + 0.5) * cell + bob
    const drawSize = cell * 0.9 * scale
    ctx.save()
    ctx.globalAlpha = alpha
    const img = dogImage(visual.kind)
    if (img) {
      ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize)
    } else {
      roundRect(ctx, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize, drawSize * 0.22)
      ctx.fillStyle = QUIZPANG.DOG_COLORS[visual.kind] ?? '#fbbf24'
      ctx.fill()
      ctx.fillStyle = '#0f172a'
      ctx.font = `${Math.round(drawSize * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🐶', cx, cy + drawSize * 0.04)
    }
    if (visual.special !== 'none') {
      const color = SPECIAL_COLORS[visual.special]
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.01 + visual.id)
      ctx.save()
      ctx.shadowColor = color
      ctx.shadowBlur = drawSize * 0.35 * pulse
      ctx.lineWidth = Math.max(2, drawSize * 0.07)
      ctx.strokeStyle = color
      roundRect(ctx, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize, drawSize * 0.22)
      ctx.stroke()
      ctx.restore()
      const badge = drawSize * 0.19
      const bx = cx + drawSize / 2 - badge * 0.85
      const by = cy - drawSize / 2 + badge * 0.85
      ctx.fillStyle = color
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = Math.max(1.5, badge * 0.12)
      const badgeImg = loadedImage(visual.special === 'boom' ? FX.badgeBoom : FX.badgeLine)
      if (badgeImg) {
        const d = drawSize * 0.5 * (1 + 0.08 * Math.sin(now * 0.012 + visual.id))
        ctx.drawImage(badgeImg, cx + drawSize / 2 - d * 0.78, cy - drawSize / 2 - d * 0.22, d, d)
      } else if (visual.special === 'boom') {
        drawStar(ctx, bx, by, badge)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(bx, by, badge * 0.9, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        const arm = badge * 0.55
        ctx.fillRect(bx - arm, by - badge * 0.14, arm * 2, badge * 0.28)
        ctx.fillRect(bx - badge * 0.14, by - arm, badge * 0.28, arm * 2)
      }
    }
    ctx.restore()
  }
  ctx.restore()

  // 번쩍 효과
  for (const flash of flashes) {
    const t = clamp01((now - flash.start) / flash.dur)
    ctx.save()
    ctx.globalAlpha = (1 - t) * 0.85
    if (flash.kind === 'row' || flash.kind === 'col') {
      const grow = 0.4 + 0.6 * easeOutCubic(t)
      ctx.fillStyle = flash.color
      if (flash.kind === 'row') ctx.fillRect(pad, pad + (flash.r + 0.5) * cell - cell * 0.45 * grow, size - pad * 2, cell * 0.9 * grow)
      else ctx.fillRect(pad + (flash.c + 0.5) * cell - cell * 0.45 * grow, pad, cell * 0.9 * grow, size - pad * 2)
    } else {
      const maxR = flash.kind === 'bigring' ? cell * 2.9 : cell * 1.1
      ctx.strokeStyle = flash.color
      ctx.lineWidth = Math.max(3, cell * (flash.kind === 'bigring' ? 0.22 : 0.12) * (1 - t))
      ctx.beginPath()
      ctx.arc(pad + (flash.c + 0.5) * cell, pad + (flash.r + 0.5) * cell, maxR * easeOutCubic(t), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 파티클
  for (const p of particles) {
    const t = clamp01((now - p.start) / p.dur)
    const seconds = (now - p.start) / 1000
    const x = p.x + p.vx * seconds
    const y = p.y + p.vy * seconds + cell * 4.5 * seconds * seconds
    ctx.save()
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = p.color
    const r = p.size * (1 - t * 0.5)
    const spriteImg = p.sprite ? loadedImage(p.sprite === 'star' ? FX.star : FX.paw) : null
    if (spriteImg) {
      const d = r * (p.sprite === 'star' ? 3.4 : 3)
      ctx.translate(x, y)
      ctx.rotate(p.spin * seconds)
      ctx.drawImage(spriteImg, -d / 2, -d / 2, d, d)
    } else if (p.star) {
      drawStar(ctx, x, y, r * 1.3)
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // 「팡!」 스티커 — 톡 커졌다가 살짝 줄며 사라진다
  const pangImg = loadedImage(FX.pang)
  for (const pang of pangs) {
    const t = clamp01((now - pang.start) / pang.dur)
    const grow = t < 0.35 ? easeOutBack(t / 0.35) : 1 - (t - 0.35) * 0.15
    const d = pang.size * Math.max(0.05, grow)
    ctx.save()
    ctx.globalAlpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35
    ctx.translate(pang.x, pang.y)
    ctx.rotate(pang.tilt)
    if (pangImg) {
      ctx.drawImage(pangImg, -d / 2, -d / 2, d, d)
    } else {
      ctx.fillStyle = '#fde047'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = Math.max(2, d * 0.04)
      drawStar(ctx, 0, 0, d * 0.45)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ec4899'
      ctx.font = `900 ${Math.round(d * 0.26)}px "DNFBitBitv2",sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('팡!', 0, d * 0.02)
    }
    ctx.restore()
  }

  // 점수 글자
  for (const text of texts) {
    const t = clamp01((now - text.start) / text.dur)
    // 「팡!」 스티커(위쪽)와 겹치지 않게 아래에서 조금만 떠오른다
    const y = text.y - cell * 0.45 * easeOutCubic(t)
    const scale = text.big ? 1.35 : 1
    ctx.save()
    ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `900 ${Math.round(cell * 0.46 * scale)}px "DNFBitBitv2",sans-serif`
    ctx.lineWidth = Math.max(3, cell * 0.09)
    ctx.strokeStyle = '#ffffff'
    ctx.strokeText(text.text, text.x, y)
    ctx.fillStyle = text.color
    ctx.fillText(text.text, text.x, y)
    if (text.sub) {
      ctx.font = `900 ${Math.round(cell * 0.3 * scale)}px "DNFBitBitv2",sans-serif`
      ctx.lineWidth = Math.max(2, cell * 0.07)
      ctx.strokeText(text.sub, text.x, y + cell * 0.38 * scale)
      ctx.fillStyle = '#f59e0b'
      ctx.fillText(text.sub, text.x, y + cell * 0.38 * scale)
    }
    ctx.restore()
  }

  ctx.restore()
}
