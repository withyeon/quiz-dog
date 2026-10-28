'use client'

import { useEffect, useRef, type MutableRefObject } from 'react'
import {
  BALL_RADIUS,
  ENEMIES,
  SURVIVOR,
  ballPositions,
  stepSurvivor,
  viewForScreen,
  type Enemy,
  type StepEvent,
  type SurvivorState,
} from '@/lib/game/survivor'

/**
 * 멍멍 서바이벌 전투 화면 (캔버스).
 *
 * - 고정 60Hz 스텝으로 lib/game/survivor.ts 의 stepSurvivor 를 부른다. 프레임 수가 아니라 실제 시간을 따라야
 *   느린 크롬북에서 슬로모션이 되지 않는다(간식런과 같은 방식). 한 프레임에 최대 5스텝.
 * - running 이 false 면(문제 푸는 중·쓰러짐·선생님 멈춤) 멈춘 화면을 그대로 그린다.
 * - 조작: 방향키/WASD, 또는 화면 아무 데나 누르고 끌기(가상 조이스틱). 마우스로도 된다.
 * - 그림은 public/survivor/*.webp 를 쓰고, 없으면 도형·이모지로 대신 그린다.
 */

export type SurvivorArenaProps = {
  stateRef: MutableRefObject<SurvivorState>
  running: boolean
  onEvents: (events: StepEvent[]) => void
}

const SPRITES = {
  hero: '/survivor/hero.webp',
  slime: ENEMIES.slime.sprite,
  bat: ENEMIES.bat.sprite,
  mushroom: ENEMIES.mushroom.sprite,
  ghost: ENEMIES.ghost.sprite,
  golem: ENEMIES.golem.sprite,
  boss: ENEMIES.boss.sprite,
  bone: '/survivor/skill-bone.webp',
  ball: '/survivor/skill-ball.webp',
  frisbee: '/survivor/skill-frisbee.webp',
  bomb: '/survivor/skill-bomb.webp',
  gem: '/survivor/item-gem.webp',
  meat: '/survivor/item-meat.webp',
  chest: '/survivor/item-chest.webp',
} as const
type SpriteKey = keyof typeof SPRITES

/** 그림이 없을 때 대신 쓰는 이모지 */
const FALLBACK_EMOJI: Partial<Record<SpriteKey, string>> = {
  hero: '🐶', bone: '🦴', ball: '🎾', frisbee: '🥏', bomb: '🍪', meat: '🍖', chest: '🎁',
}
const ENEMY_COLORS: Record<Enemy['kind'], string> = {
  slime: '#4ade80', bat: '#a855f7', mushroom: '#ef4444', ghost: '#bae6fd', golem: '#94a3b8', boss: '#7c3aed',
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

/** 화면 픽셀 상한 (큰 화면·고해상도에서 캔버스가 너무 커지지 않게) */
const MAX_PIXELS = 2_600_000
const JOYSTICK_RADIUS = 56

/** 잔디 무늬 한 장 (세계 단위 160×160). 세계 좌표에 붙어 있어서 움직이면 땅이 흐른다 */
function makeGrassPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const size = 160
  const tile = document.createElement('canvas')
  tile.width = size
  tile.height = size
  const g = tile.getContext('2d')
  if (!g) return null
  g.fillStyle = '#86d07a'
  g.fillRect(0, 0, size, size)
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 26; i += 1) {
    g.fillStyle = rand() < 0.5 ? '#78c46c' : '#93da86'
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

export default function SurvivorArena({ stateRef, running, onEvents }: SurvivorArenaProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runningRef = useRef(running)
  const onEventsRef = useRef(onEvents)
  const keysRef = useRef<Set<string>>(new Set())
  const stickRef = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null)

  useEffect(() => { runningRef.current = running }, [running])
  useEffect(() => { onEventsRef.current = onEvents }, [onEvents])

  // 멈추면 누르고 있던 키·조이스틱을 놓는다 (퀴즈 창이 덮으면 pointerup 을 못 받는다)
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
      const rect = wrap.getBoundingClientRect()
      cssW = Math.max(1, rect.width)
      cssH = Math.max(1, rect.height)
      dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (cssW * cssH)), 2)
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
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
      const view = viewForScreen(cssW, cssH)

      if (runningRef.current) {
        acc += elapsed
        const input = readInput(keysRef.current, stickRef.current)
        const events: StepEvent[] = []
        let steps = 0
        while (acc >= SURVIVOR.STEP_MS && steps < 5) {
          acc -= SURVIVOR.STEP_MS
          steps += 1
          events.push(...stepSurvivor(state, SURVIVOR.STEP_MS, input, view))
          if (state.pendingLevelUps > 0 || state.player.dead) {
            acc = 0
            break
          }
        }
        if (steps === 5) acc = 0
        if (events.length > 0) onEventsRef.current(events)
      } else {
        acc = 0
      }

      draw(ctx, state, view, dpr, cssW, cssH, now, grass, stickRef.current, runningRef.current)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [stateRef])

  // ─── 가상 조이스틱 (터치·마우스) ───
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
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden bg-[#86d07a]">
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
  } else if (key === 'gem') {
    ctx.fillStyle = '#22d3ee'
    ctx.strokeStyle = '#0e7490'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, -size / 2)
    ctx.lineTo(size / 2.6, 0)
    ctx.lineTo(0, size / 2)
    ctx.lineTo(-size / 2.6, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.fillStyle = '#000000'
    ctx.font = `${Math.round(size * 0.82)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(FALLBACK_EMOJI[key] ?? '●', 0, size * 0.04)
  }
  ctx.restore()
}

function drawEnemyFallback(ctx: CanvasRenderingContext2D, enemy: Enemy, size: number, t: number) {
  const r = size * 0.36
  ctx.strokeStyle = 'rgba(15,23,42,0.9)'
  ctx.lineWidth = 3
  ctx.fillStyle = ENEMY_COLORS[enemy.kind]
  ctx.beginPath()
  switch (enemy.kind) {
    case 'bat': {
      const flap = Math.sin(t * 18 + enemy.id) * 0.35
      for (const side of [-1, 1]) {
        ctx.moveTo(side * r * 0.5, -r * 0.1)
        ctx.lineTo(side * r * 1.7, -r * (0.6 + flap))
        ctx.lineTo(side * r * 1.4, r * 0.2)
        ctx.lineTo(side * r * 0.5, r * 0.3)
      }
      ctx.fill()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2)
      break
    }
    case 'mushroom':
      ctx.fillStyle = '#fde68a'
      ctx.fillRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.9)
      ctx.strokeRect(-r * 0.4, -r * 0.1, r * 0.8, r * 0.9)
      ctx.beginPath()
      ctx.fillStyle = ENEMY_COLORS.mushroom
      ctx.ellipse(0, -r * 0.15, r, r * 0.7, 0, Math.PI, 0)
      ctx.closePath()
      break
    case 'ghost':
      ctx.moveTo(-r, r * 0.8)
      ctx.lineTo(-r, -r * 0.1)
      ctx.arc(0, -r * 0.1, r, Math.PI, 0)
      ctx.lineTo(r, r * 0.8)
      for (let i = 3; i >= 0; i -= 1) ctx.quadraticCurveTo(-r + (i + 0.5) * (r / 2), r * 0.4, -r + i * (r / 2), r * 0.8)
      ctx.closePath()
      break
    case 'golem':
      ctx.roundRect(-r, -r * 0.9, r * 2, r * 1.8, r * 0.3)
      break
    default:
      // 슬라임·대왕 슬라임: 아래가 납작한 젤리
      ctx.moveTo(-r, r * 0.7)
      ctx.quadraticCurveTo(-r * 1.05, -r * 0.9, 0, -r)
      ctx.quadraticCurveTo(r * 1.05, -r * 0.9, r, r * 0.7)
      ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()
  if (enemy.kind === 'mushroom') {
    ctx.fillStyle = '#ffffff'
    for (const [dx, dy] of [[-0.45, -0.45], [0.2, -0.6], [0.55, -0.3]]) {
      ctx.beginPath()
      ctx.arc(r * dx, r * dy, r * 0.13, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (enemy.kind === 'golem') {
    ctx.fillStyle = '#65a30d'
    ctx.fillRect(-r * 0.9, -r * 0.9, r * 1.8, r * 0.3)
  }
  if (enemy.kind === 'slime' || enemy.kind === 'boss') {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.ellipse(-r * 0.45, -r * 0.45, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2)
    ctx.fill()
  }
  // 눈
  const eyeY = enemy.kind === 'mushroom' ? r * 0.25 : enemy.kind === 'ghost' ? -r * 0.15 : 0
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-r * 0.3, eyeY, r * 0.12, 0, Math.PI * 2)
  ctx.arc(r * 0.3, eyeY, r * 0.12, 0, Math.PI * 2)
  ctx.fill()
  if (enemy.kind === 'boss') {
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.moveTo(-r * 0.5, -r * 0.85)
    ctx.lineTo(-r * 0.35, -r * 1.3)
    ctx.lineTo(-r * 0.12, -r * 1.05)
    ctx.lineTo(0, -r * 1.4)
    ctx.lineTo(r * 0.12, -r * 1.05)
    ctx.lineTo(r * 0.35, -r * 1.3)
    ctx.lineTo(r * 0.5, -r * 0.85)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}

/** 0~1 사이 고정 난수 (번개 선이 프레임마다 흔들리지 않게) */
function seeded(seed: number, i: number) {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: SurvivorState,
  view: { w: number; h: number; scale: number },
  dpr: number,
  cssW: number,
  cssH: number,
  now: number,
  grass: CanvasPattern | null,
  stick: { ox: number; oy: number; x: number; y: number } | null,
  running: boolean,
) {
  const p = state.player
  const k = view.scale * dpr
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  // 세계 좌표 → 화면: 플레이어가 가운데
  ctx.setTransform(k, 0, 0, k, (cssW * dpr) / 2 - p.x * k, (cssH * dpr) / 2 - p.y * k)
  const left = p.x - view.w / 2 - 40
  const top = p.y - view.h / 2 - 40
  ctx.fillStyle = grass ?? '#86d07a'
  ctx.fillRect(left, top, view.w + 80, view.h + 80)

  const visible = (x: number, y: number, pad: number) => Math.abs(x - p.x) < view.w / 2 + pad && Math.abs(y - p.y) < view.h / 2 + pad
  const t = now / 1000

  // 줍는 것
  for (const item of state.pickups) {
    if (!visible(item.x, item.y, 40)) continue
    const bob = Math.sin(t * 4 + item.id) * 2
    if (item.kind === 'gem') drawSprite(ctx, 'gem', item.x, item.y + bob, item.value >= 5 ? 24 : item.value >= 2 ? 19 : 15)
    else if (item.kind === 'meat') drawSprite(ctx, 'meat', item.x, item.y + bob, 28)
    else {
      ctx.save()
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5)
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.arc(item.x, item.y, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      drawSprite(ctx, 'chest', item.x, item.y + bob, 50)
    }
  }

  // 그림자
  ctx.fillStyle = 'rgba(15, 23, 42, 0.18)'
  for (const enemy of state.enemies) {
    if (!visible(enemy.x, enemy.y, 80)) continue
    ctx.beginPath()
    ctx.ellipse(enemy.x, enemy.y + enemy.radius * 0.9, enemy.radius * 0.9, enemy.radius * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.ellipse(p.x, p.y + 26, 20, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  // 몬스터 (아래쪽이 앞)
  const sorted = state.enemies.filter((enemy) => visible(enemy.x, enemy.y, 80)).sort((a, b) => a.y - b.y)
  for (const enemy of sorted) {
    const size = enemy.radius * 2.7
    const bob = Math.sin(t * 7 + enemy.id) * (enemy.kind === 'bat' || enemy.kind === 'ghost' ? 4 : 1.5)
    ctx.save()
    ctx.translate(enemy.x, enemy.y + bob)
    if (enemy.flashMs > 0) {
      ctx.scale(1.12, 0.9)
      ctx.filter = 'brightness(2.4)'
    }
    const flip = p.x > enemy.x
    if (sprite(enemy.kind)) drawSprite(ctx, enemy.kind, 0, 0, size, { flip })
    else drawEnemyFallback(ctx, enemy, size, t)
    ctx.restore()
    if (enemy.kind === 'boss' || enemy.kind === 'golem') {
      const w = enemy.radius * 1.6
      const ratio = Math.max(0, enemy.hp / enemy.maxHp)
      ctx.fillStyle = 'rgba(15,23,42,0.6)'
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius * 1.35 - 6, w, 6)
      ctx.fillStyle = enemy.kind === 'boss' ? '#f43f5e' : '#f97316'
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius * 1.35 - 6, w * ratio, 6)
    }
  }

  // 날아가는 것
  for (const proj of state.projectiles) {
    if (proj.kind === 'bone') drawSprite(ctx, 'bone', proj.x, proj.y, 28, { rotate: proj.age / 70 })
    else if (proj.kind === 'frisbee') drawSprite(ctx, 'frisbee', proj.x, proj.y, 36, { rotate: proj.age / 45 })
    else {
      const k2 = Math.min(1, proj.age / 600)
      const arc = Math.sin(k2 * Math.PI) * 70
      ctx.fillStyle = 'rgba(15,23,42,0.15)'
      ctx.beginPath()
      ctx.ellipse(proj.x, proj.y + 8, 12, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      drawSprite(ctx, 'bomb', proj.x, proj.y - arc, 28, { rotate: proj.age / 120 })
    }
  }

  // 퀴즈독
  const blink = p.invulnMs > 0 && Math.floor(now / 110) % 2 === 0
  ctx.save()
  if (p.hurtMs > 0) ctx.filter = 'sepia(1) saturate(5) hue-rotate(-40deg)'
  const heroBob = running ? Math.abs(Math.sin(t * 10)) * -3 : 0
  drawSprite(ctx, 'hero', p.x, p.y + heroBob, 66, { flip: p.fx < 0, alpha: blink ? 0.45 : 1 })
  ctx.restore()
  // 체력 막대
  const hpRatio = Math.max(0, p.hp / p.maxHp)
  ctx.fillStyle = 'rgba(15,23,42,0.7)'
  ctx.fillRect(p.x - 25, p.y + 36, 50, 7)
  ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444'
  ctx.fillRect(p.x - 24, p.y + 37, 48 * hpRatio, 5)

  // 빙글빙글 공
  for (const ball of ballPositions(state)) drawSprite(ctx, 'ball', ball.x, ball.y, BALL_RADIUS * 2.3, { rotate: t * 8 })

  // 효과
  for (const effect of state.effects) {
    const e = effect.age / effect.life
    ctx.save()
    if (effect.kind === 'bark') {
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = '#fb923c'
      ctx.lineWidth = 8 * (1 - e) + 2
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * (0.35 + 0.65 * e), 0, Math.PI * 2)
      ctx.stroke()
    } else if (effect.kind === 'boom') {
      ctx.globalAlpha = 0.8 * (1 - e)
      ctx.fillStyle = e < 0.3 ? '#fef08a' : '#fb923c'
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * (0.5 + 0.5 * Math.min(1, e * 3)), 0, Math.PI * 2)
      ctx.fill()
    } else if (effect.kind === 'zap') {
      ctx.globalAlpha = 1 - e
      const seed = effect.seed ?? 1
      ctx.beginPath()
      ctx.moveTo(effect.x + (seeded(seed, 0) - 0.5) * 40, effect.y - 260)
      for (let i = 1; i <= 6; i += 1) {
        ctx.lineTo(effect.x + (i === 6 ? 0 : (seeded(seed, i) - 0.5) * 34), effect.y - 260 + (260 * i) / 6)
      }
      ctx.strokeStyle = '#facc15'
      ctx.lineWidth = 7
      ctx.stroke()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.stroke()
      ctx.fillStyle = 'rgba(254,240,138,0.7)'
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * (1 - e * 0.5), 0, Math.PI * 2)
      ctx.fill()
    } else if (effect.kind === 'revive' || effect.kind === 'levelup') {
      ctx.globalAlpha = 1 - e
      ctx.strokeStyle = effect.kind === 'revive' ? '#fde047' : '#67e8f9'
      ctx.lineWidth = 10 * (1 - e) + 2
      ctx.beginPath()
      ctx.arc(effect.x, effect.y, effect.r * e + 20, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
  // 피해 숫자
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const effect of state.effects) {
    if (effect.kind !== 'text' || !effect.text) continue
    const e = effect.age / effect.life
    ctx.globalAlpha = 1 - e * e
    ctx.font = `900 ${effect.big ? 20 : 15}px sans-serif`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15,23,42,0.9)'
    ctx.fillStyle = effect.big ? '#fde047' : '#ffffff'
    const y = effect.y - e * 24
    ctx.strokeText(effect.text, effect.x, y)
    ctx.fillText(effect.text, effect.x, y)
  }
  ctx.globalAlpha = 1

  // 화면 밖 보스 화살표
  const boss = state.enemies.find((enemy) => enemy.kind === 'boss')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (boss && !visible(boss.x, boss.y, -20)) {
    const angle = Math.atan2(boss.y - p.y, boss.x - p.x)
    const rx = cssW / 2 - 34
    const ry = cssH / 2 - 34
    const s = Math.min(Math.abs(rx / Math.cos(angle) || Infinity), Math.abs(ry / Math.sin(angle) || Infinity))
    const ax = cssW / 2 + Math.cos(angle) * s
    const ay = cssH / 2 + Math.sin(angle) * s
    ctx.save()
    ctx.translate(ax, ay)
    ctx.rotate(angle)
    ctx.fillStyle = '#f43f5e'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(16, 0)
    ctx.lineTo(-10, -12)
    ctx.lineTo(-10, 12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // 조이스틱
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
}
