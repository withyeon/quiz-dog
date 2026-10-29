'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  BONE_RUSH,
  resizeYard,
  stepBoneRush,
  tailPositions,
  yardForScreen,
  type BoneRushState,
  type Cat,
  type StepEvent,
  type StepInput,
} from '@/lib/game/boneRush'

/**
 * 뼈다귀 쟁탈전 마당 화면 (캔버스).
 *
 * - 마당이 화면 전체다. 기기마다 비율은 달라도 넓이는 같다(yardForScreen). 크기가 바뀌면 resizeYard 로 안의 것들을 옮긴다.
 * - 고정 60Hz 스텝으로 lib/game/boneRush.ts 의 stepBoneRush 를 부른다(서바이벌과 같은 방식). 한 프레임에 최대 5스텝.
 * - running 이 false 면(문제 푸는 중·카드 고르는 중·선생님 멈춤) 멈춘 화면을 그대로 그린다.
 * - 조작: 방향키/WASD, 또는 화면 아무 데나 누르고 끌기(가상 조이스틱). 마우스로도 된다.
 * - 그림은 public/bone-rush/*.webp(+서바이벌 뼈다귀·자석)를 쓰고, 없으면 도형·이모지로 대신 그린다.
 */

export type BoneRushArenaProps = {
  stateRef: MutableRefObject<BoneRushState>
  running: boolean
  onEvents: (events: StepEvent[]) => void
  /** 대본 입력 (튜토리얼 데모). 주면 키보드·조이스틱 대신 이 값으로 움직인다 */
  inputRef?: MutableRefObject<StepInput>
}

const SPRITES = {
  hero: '/bone-rush/hero.webp',
  bone: '/survivor/skill-bone.webp',
  gold: '/bone-rush/goldbone.webp',
  chest: '/bone-rush/chest.webp',
  cat: '/bone-rush/cat.webp',
  wildcat: '/bone-rush/wildcat.webp',
  fence: '/bone-rush/fence.webp',
  sack: '/bone-rush/sack.webp',
} as const
type SpriteKey = keyof typeof SPRITES

const FALLBACK_EMOJI: Record<SpriteKey, string> = {
  hero: '🐶', bone: '🦴', gold: '🦴', chest: '🎁', cat: '🐈‍⬛', wildcat: '🐈', fence: '🪵', sack: '👜',
}

const imageCache = new Map<string, HTMLImageElement>()
function loadSprites() {
  if (typeof window === 'undefined') return
  for (const src of Object.values(SPRITES)) {
    if (imageCache.has(src)) continue
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    imageCache.set(src, img)
  }
}
function sprite(key: SpriteKey): HTMLImageElement | null {
  const img = imageCache.get(SPRITES[key])
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

const MAX_PIXELS = 2_600_000
const JOYSTICK_RADIUS = 56

/** 잔디 무늬 한 장 (세계 단위 160×160) */
function makeGrassPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 160
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const g = tile.getContext('2d')
  if (!g) return null
  g.fillStyle = '#8fd27f'
  g.fillRect(0, 0, size, size)
  let seed = 11
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 28; i += 1) {
    g.fillStyle = rand() < 0.5 ? '#7fc671' : '#9bdb8c'
    g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 4, 8)
  }
  for (let i = 0; i < 3; i += 1) {
    const x = Math.floor(rand() * (size - 8))
    const y = Math.floor(rand() * (size - 8))
    g.fillStyle = ['#fde68a', '#fbcfe8', '#ffffff'][i % 3]
    g.fillRect(x + 2, y, 4, 4)
    g.fillRect(x, y + 2, 8, 4)
    g.fillRect(x + 2, y + 6, 4, 2)
    g.fillStyle = '#f59e0b'
    g.fillRect(x + 3, y + 3, 2, 2)
  }
  return ctx.createPattern(tile, 'repeat')
}

export default function BoneRushArena({ stateRef, running, onEvents, inputRef }: BoneRushArenaProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runningRef = useRef(running)
  const onEventsRef = useRef(onEvents)
  const keysRef = useRef<Set<string>>(new Set())
  const stickRef = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null)

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { onEventsRef.current = onEvents }, [onEvents])

  useEffect(() => {
    if (running) return
    keysRef.current.clear()
    stickRef.current = null
  }, [running])

  // ─── 키보드 ───
  useEffect(() => {
    const KEY_DIR: Record<string, string> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    }
    const down = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.code]
      if (!dir || !runningRef.current) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      keysRef.current.add(dir)
      event.preventDefault()
    }
    const up = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.code]
      if (dir) keysRef.current.delete(dir)
    }
    const blur = () => keysRef.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // ─── 그리기·스텝 루프 ───
  useEffect(() => {
    loadSprites()
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const grass = makeGrassPattern(ctx)

    let cssW = 1
    let cssH = 1
    let dpr = 1
    const resize = () => {
      // getBoundingClientRect 는 조상 zoom(튜토리얼 데모)이 걸린 크기를 준다 — 캔버스 CSS 크기는 zoom 전 값이어야 한다
      cssW = Math.max(1, wrap.clientWidth)
      cssH = Math.max(1, wrap.clientHeight)
      dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (cssW * cssH)), 2)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const yard = yardForScreen(cssW, cssH)
      resizeYard(stateRef.current, yard.w, yard.h)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(wrap)

    let raf = 0
    let last = performance.now()
    let acc = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const elapsed = Math.min(250, now - last)
      last = now
      const state = stateRef.current
      const yard = yardForScreen(cssW, cssH)
      if (Math.abs(state.yard.w - yard.w) > 0.5 || Math.abs(state.yard.h - yard.h) > 0.5) resizeYard(state, yard.w, yard.h)

      if (runningRef.current) {
        acc += elapsed
        const input = inputRef?.current ?? readInput(keysRef.current, stickRef.current)
        const events: StepEvent[] = []
        let steps = 0
        while (acc >= BONE_RUSH.STEP_MS && steps < 5) {
          acc -= BONE_RUSH.STEP_MS
          steps += 1
          events.push(...stepBoneRush(state, BONE_RUSH.STEP_MS, input))
          if (state.pendingQuiz) {
            acc = 0
            break
          }
        }
        if (steps === 5) acc = 0
        if (events.length > 0) onEventsRef.current(events)
      } else {
        acc = 0
      }

      draw(ctx, state, yard.scale, dpr, cssW, cssH, now, grass, stickRef.current, runningRef.current)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [inputRef, stateRef])

  // ─── 가상 조이스틱 ───
  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!runningRef.current || stickRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    stickRef.current = { id: event.pointerId, ox: x, oy: y, x, y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const stick = stickRef.current
    if (!stick || stick.id !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    stick.x = event.clientX - rect.left
    stick.y = event.clientY - rect.top
  }
  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (stickRef.current?.id === event.pointerId) stickRef.current = null
  }

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#8fd27f]">
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(event) => event.preventDefault()}
      />
    </div>
  )
}

function readInput(keys: Set<string>, stick: { ox: number; oy: number; x: number; y: number } | null) {
  let mx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0)
  let my = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0)
  if (stick) {
    const dx = stick.x - stick.ox
    const dy = stick.y - stick.oy
    const d = Math.hypot(dx, dy)
    if (d > 6) {
      const k = Math.min(1, d / JOYSTICK_RADIUS) / d
      mx += dx * k
      my += dy * k
    }
  }
  return { mx, my }
}

function drawSprite(ctx: CanvasRenderingContext2D, key: SpriteKey, x: number, y: number, size: number, options: { flip?: boolean; rotate?: number; alpha?: number } = {}) {
  const img = sprite(key)
  ctx.save()
  ctx.translate(x, y)
  if (options.rotate) ctx.rotate(options.rotate)
  if (options.flip) ctx.scale(-1, 1)
  if (options.alpha !== undefined) ctx.globalAlpha *= options.alpha
  if (img) {
    const ratio = img.naturalWidth / img.naturalHeight
    const w = ratio >= 1 ? size : size * ratio
    const h = ratio >= 1 ? size / ratio : size
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
  } else if (key === 'bone' || key === 'gold') {
    // 그림이 없으면 뼈다귀 모양을 직접 그린다
    ctx.fillStyle = key === 'gold' ? '#fbbf24' : '#fffaf0'
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    const l = size * 0.42
    const r = size * 0.16
    ctx.beginPath()
    ctx.roundRect(-l, -r * 0.55, l * 2, r * 1.1, r * 0.5)
    ctx.fill()
    ctx.stroke()
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath()
        ctx.arc(sx * l, sy * r * 0.55, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  } else if (key === 'fence') {
    ctx.fillStyle = '#b45309'
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 2
    for (const dx of [-size * 0.35, 0, size * 0.35]) {
      ctx.beginPath()
      ctx.roundRect(dx - size * 0.08, -size * 0.45, size * 0.16, size * 0.9, 3)
      ctx.fill()
      ctx.stroke()
    }
    for (const dy of [-size * 0.18, size * 0.14]) {
      ctx.beginPath()
      ctx.roundRect(-size * 0.48, dy - size * 0.06, size * 0.96, size * 0.12, 3)
      ctx.fill()
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = '#000000'
    ctx.font = `${Math.round(size * 0.82)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(FALLBACK_EMOJI[key], 0, size * 0.04)
  }
  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg = '#ffffff', size = 13) {
  ctx.font = `900 ${size}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + 14
  const h = size + 8
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.fillText(text, x, y + 1)
}

function drawCat(ctx: CanvasRenderingContext2D, cat: Cat, t: number, yardW: number) {
  const size = 52
  const bob = cat.phase === 'stun' ? 0 : Math.abs(Math.sin(t * 12 + cat.id)) * -4
  ctx.save()
  ctx.translate(cat.x, cat.y + bob)
  if (cat.flashMs > 0) ctx.filter = 'brightness(1.8)'
  if (cat.phase === 'stun') ctx.rotate(Math.sin(t * 20) * 0.08)
  drawSprite(ctx, cat.kind === 'wild' ? 'wildcat' : 'cat', 0, 0, size, { flip: cat.fx < 0 })
  ctx.restore()
  if (cat.phase === 'stun') {
    ctx.fillStyle = '#fde047'
    ctx.font = '900 18px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('💫', cat.x, cat.y - 36)
  }
  // 이름표·물고 있는 뼈다귀
  const tag = cat.kind === 'wild' ? '들고양이' : cat.kind === 'courier' ? `${cat.fromName}의 뼈다귀 ${cat.carried}개` : cat.carried > 0 ? `${cat.fromName} 🦴${cat.carried}` : cat.fromName
  const labelX = Math.max(70, Math.min(yardW - 70, cat.x))
  drawLabel(ctx, tag, labelX, Math.max(14, cat.y - 42), cat.kind === 'wild' ? 'rgba(234,88,12,0.9)' : cat.kind === 'courier' ? 'rgba(22,163,74,0.9)' : 'rgba(15,23,42,0.85)')
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: BoneRushState,
  scale: number,
  dpr: number,
  cssW: number,
  cssH: number,
  now: number,
  grass: CanvasPattern | null,
  stick: { ox: number; oy: number; x: number; y: number } | null,
  running: boolean,
) {
  const p = state.player
  const { w, h } = state.yard
  const k = scale * dpr
  const t = now / 1000
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.fillStyle = grass ?? '#8fd27f'
  ctx.fillRect(0, 0, w, h)

  // 마당 테두리 (울타리가 있으면 갈색 울타리, 없으면 흙길)
  const fenced = state.fences > 0
  ctx.strokeStyle = fenced ? '#b45309' : 'rgba(120,80,40,0.35)'
  ctx.lineWidth = fenced ? 10 : 6
  ctx.strokeRect(5, 5, w - 10, h - 10)
  if (fenced) {
    ctx.fillStyle = '#92400e'
    const stepX = 70
    for (let x = 20; x < w - 10; x += stepX) {
      ctx.fillRect(x, 0, 8, 16)
      ctx.fillRect(x, h - 16, 8, 16)
    }
    for (let y = 20; y < h - 10; y += stepX) {
      ctx.fillRect(0, y, 16, 8)
      ctx.fillRect(w - 16, y, 16, 8)
    }
  }

  // 땅에 있는 뼈다귀
  for (const item of state.pickups) {
    const bob = item.pulled ? 0 : Math.sin(t * 4 + item.id) * 2
    if (item.value === 0 && item.age > 500) continue
    drawSprite(ctx, item.kind === 'gold' ? 'gold' : 'bone', item.x, item.y + bob, item.kind === 'gold' ? 34 : 26, { rotate: item.pulled ? item.age / 60 : (item.id % 7) * 0.4 })
  }

  // 보물 상자
  const chest = state.chest
  if (chest) {
    const bob = Math.sin(t * 3 + chest.id) * 2
    if (chest.phase !== 'locked') {
      ctx.save()
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5)
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.arc(chest.x, chest.y, 42, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    drawSprite(ctx, 'chest', chest.x, chest.y + bob, 62, { alpha: chest.phase === 'locked' ? 0.6 : 1 })
    if (chest.phase === 'locked') drawLabel(ctx, '🔒 잠겼어요', chest.x, chest.y - 44, 'rgba(15,23,42,0.85)')
    else if (chest.age < 2600) drawLabel(ctx, '📦 문제 상자!', chest.x, chest.y - 44, 'rgba(2,132,199,0.9)')
  }

  // 꼬리 뼈다귀 (멀수록 먼저 그려서 가까운 게 위로)
  const tail = tailPositions(state)
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const pos = tail[i]
    const wob = Math.sin(t * 6 + i * 0.7) * 2
    drawSprite(ctx, 'bone', pos.x, pos.y + wob, 24, { rotate: Math.sin(t * 2 + i) * 0.3 })
  }

  // 그림자
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)'
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 24, 20, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  for (const cat of state.cats) {
    ctx.beginPath()
    ctx.ellipse(cat.x, cat.y + 20, 18, 6, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 퀴즈독
  const heroBob = running && p.moving ? Math.abs(Math.sin(t * 11)) * -4 : 0
  drawSprite(ctx, 'hero', p.x, p.y + heroBob, 66, { flip: p.fx < 0 })
  if (state.magnetMs > 0) {
    ctx.save()
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(t * 6)
    ctx.strokeStyle = '#0ea5e9'
    ctx.lineWidth = 4
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.arc(p.x, p.y, BONE_RUSH.MAGNET_RADIUS, t * 0.6, t * 0.6 + Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
  if (state.bones > BONE_RUSH.TAIL_MAX) drawLabel(ctx, `🦴 ${state.bones}`, p.x, p.y - 44, 'rgba(15,23,42,0.85)', '#fde68a')

  // 고양이
  for (const cat of state.cats) drawCat(ctx, cat, t, w)

  // 효과
  for (const effect of state.effects) {
    const e = effect.age / effect.life
    ctx.save()
    if (effect.kind === 'bark') {
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = '#fb923c'
      ctx.lineWidth = 8 * (1 - e) + 2
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * (0.3 + 0.7 * e), 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 4
      ctx.strokeText('멍!', effect.x, effect.y - 50 - e * 20)
      ctx.fillText('멍!', effect.x, effect.y - 50 - e * 20)
    } else if (effect.kind === 'ring') {
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 8 * (1 - e) + 2
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * e + 20, 0, Math.PI * 2)
      ctx.stroke()
    } else if (effect.kind === 'poof') {
      ctx.globalAlpha = 0.8 * (1 - e)
      ctx.fillStyle = '#fef08a'
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * (0.4 + 0.6 * e), 0, Math.PI * 2)
      ctx.fill()
    } else if (effect.kind === 'fence') {
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 14 * (1 - e) + 2
      if (effect.r === 0 && effect.x === w / 2 && effect.y === h / 2) ctx.strokeRect(5, 5, w - 10, h - 10)
      else {
        ctx.beginPath()
        ctx.arc(effect.x, effect.y, 30 + e * 30, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const effect of state.effects) {
    if (effect.kind !== 'text' || !effect.text) continue
    const e = effect.age / effect.life
    ctx.globalAlpha = 1 - e * e
    ctx.font = `900 ${effect.big ? 22 : 15}px sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15,23,42,0.9)'
    ctx.fillStyle = effect.text.startsWith('-') ? '#fda4af' : effect.big ? '#fde047' : '#ffffff'
    const y = effect.y - e * 26
    ctx.strokeText(effect.text, effect.x, y)
    ctx.fillText(effect.text, effect.x, y)
  }
  ctx.globalAlpha = 1

  // 조이스틱 (화면 픽셀 좌표)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (stick) {
    ctx.globalAlpha = 0.5
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(stick.ox, stick.oy, JOYSTICK_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const dx = stick.x - stick.ox
    const dy = stick.y - stick.oy
    const d = Math.hypot(dx, dy) || 1
    const m = Math.min(d, JOYSTICK_RADIUS)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(stick.ox + (dx / d) * m, stick.oy + (dy / d) * m, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  void cssW
  void cssH
}
