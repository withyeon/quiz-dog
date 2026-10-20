// 펭귄 아레나 캔버스 그리기. 상태(lib/game/raidArena)만 읽고 아무것도 바꾸지 않는다.
// 좌표는 전부 칸 단위 → 픽셀(TILE)로 바꿔 그린다. 위쪽 TOP_PAD 는 펭귄 머리가 들어가는 여백.

import { ARENA, WORLD_H, WORLD_W, getBossTiles, type ArenaState, type Dir, type Snowman } from '@/lib/game/raidArena'
import type { RaidBossSprite } from '@/lib/game/raid'

export type BossImages = Record<RaidBossSprite, { idle?: HTMLImageElement; hurt?: HTMLImageElement; down?: HTMLImageElement }>

/** 아레나 소품 그림 (public/raid/arena). 아직 안 받아졌으면 캔버스로 대신 그린다 */
export type ArenaImageKey =
  | 'snowBlock' | 'pillar' | 'balloon' | 'snowmanWalk' | 'snowmanFrozen' | 'snowmanBerserk' | 'egg'
  | 'itemRange' | 'itemShoe' | 'itemBalloon' | 'itemNeedle'
export type ArenaImages = Partial<Record<ArenaImageKey, HTMLImageElement>>
export const ARENA_IMAGE_SRC: Record<ArenaImageKey, string> = {
  snowBlock: '/raid/arena/snow-block.webp',
  pillar: '/raid/arena/ice-pillar.webp',
  balloon: '/raid/arena/water-balloon.webp',
  snowmanWalk: '/raid/arena/snowman-walk.webp',
  snowmanFrozen: '/raid/arena/snowman-frozen.webp',
  snowmanBerserk: '/raid/arena/snowman-berserk.webp',
  egg: '/raid/arena/penguin-egg.webp',
  itemRange: '/raid/arena/item-potion.webp',
  itemShoe: '/raid/arena/item-skate.webp',
  itemBalloon: '/raid/arena/item-balloon.webp',
  itemNeedle: '/raid/arena/item-needle.webp',
}

export type DrawArenaOptions = {
  bossImages: BossImages
  images: ArenaImages
  avatarImage?: HTMLImageElement | null
  /** 그림이 없을 때 쓰는 이모지/글자 */
  avatarFallback: string
  bossSprite: RaidBossSprite | null
  /** 쓰러진 장면에 그릴 이전 펭귄 */
  downSprite: RaidBossSprite | null
  groggy: boolean
  shieldActive: boolean
  /** performance.now() 기반 초 — 둥실거림·반짝임용 */
  now: number
  /** 세상이 멈춰 있을 때(퀴즈·일시정지) 살짝 어둡게 */
  frozen: boolean
}

const T = ARENA.TILE
const PAD = ARENA.TOP_PAD
const FONT = '"DNFBitBitv2", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Apple SD Gothic Neo", sans-serif'

const isReady = (img?: HTMLImageElement | null): img is HTMLImageElement => !!img && img.complete && img.naturalWidth > 0

function px(col: number): number {
  return col * T
}
function py(row: number): number {
  return PAD + row * T
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// ─── 바닥 ───

function drawFloor(ctx: CanvasRenderingContext2D, state: ArenaState, images: ArenaImages) {
  // 위쪽 왕좌 띠
  const band = ctx.createLinearGradient(0, 0, 0, PAD + ARENA.BOSS_H * T)
  band.addColorStop(0, '#0f2a5c')
  band.addColorStop(1, '#1e4f8f')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, WORLD_W, PAD + ARENA.BOSS_H * T)
  // 왕좌 뒤 얼음 결정
  ctx.save()
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 9; i++) {
    const cx = (i + 0.5) * (WORLD_W / 9)
    const h = 26 + ((i * 37) % 22)
    ctx.fillStyle = i % 2 === 0 ? '#7cc3ea' : '#a5d8f3'
    ctx.beginPath()
    ctx.moveTo(cx - 10, PAD + 6)
    ctx.lineTo(cx, PAD + 6 - h)
    ctx.lineTo(cx + 10, PAD + 6)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  // 펭귄 앞 깔개 (0~1행)
  ctx.fillStyle = 'rgba(148, 197, 232, 0.35)'
  ctx.fillRect(0, py(0), WORLD_W, ARENA.BOSS_H * T)

  // 얼음 바닥 체크무늬
  for (let row = ARENA.BOSS_H; row < ARENA.ROWS; row++) {
    for (let col = 0; col < ARENA.COLS; col++) {
      const even = (col + row) % 2 === 0
      ctx.fillStyle = even ? '#d6ecf8' : '#c3e2f3'
      ctx.fillRect(px(col), py(row), T, T)
      // 안쪽 하이라이트 선
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(px(col) + 0.5, py(row) + 0.5, T - 1, T - 1)
    }
  }
  // 왕좌 띠와 바닥 경계
  ctx.fillStyle = 'rgba(30, 79, 143, 0.5)'
  ctx.fillRect(0, py(ARENA.BOSS_H) - 3, WORLD_W, 3)

  // 기둥 · 눈 블록
  for (let row = 0; row < ARENA.ROWS; row++) {
    for (let col = 0; col < ARENA.COLS; col++) {
      const tile = state.tiles[row * ARENA.COLS + col]
      if (tile === 'pillar') drawPillar(ctx, col, row, images.pillar)
      else if (tile === 'block') drawBlock(ctx, col, row, images.snowBlock)
    }
  }
}

/** 칸 안에 그림을 꽉 채워 그린다 (아래 끝 정렬, 살짝 위로 튀어나와 입체감) */
function drawTileImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, col: number, row: number, scale = 1.06, lift = 4) {
  const size = T * scale
  const x = px(col) + (T - size) / 2
  const y = py(row) + T - size - lift + 2
  ctx.drawImage(img, x, y, size, size)
}

function drawPillar(ctx: CanvasRenderingContext2D, col: number, row: number, img?: HTMLImageElement) {
  const x = px(col)
  const y = py(row)
  if (isReady(img)) {
    ctx.fillStyle = 'rgba(15, 42, 92, 0.22)'
    ctx.beginPath()
    ctx.ellipse(x + T / 2, y + T - 4, T * 0.42, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    drawTileImage(ctx, img, col, row, 1.3, 12)
    return
  }
  // 그림자
  ctx.fillStyle = 'rgba(15, 42, 92, 0.25)'
  roundRect(ctx, x + 4, y + 8, T - 6, T - 8, 8)
  ctx.fill()
  const g = ctx.createLinearGradient(x, y, x + T, y + T)
  g.addColorStop(0, '#9fdcff')
  g.addColorStop(0.5, '#4ea3e3')
  g.addColorStop(1, '#2b6cb0')
  ctx.fillStyle = g
  roundRect(ctx, x + 3, y + 2, T - 6, T - 6, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 2
  roundRect(ctx, x + 5, y + 4, T - 10, T - 10, 6)
  ctx.stroke()
  // 결정 반짝임
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.moveTo(x + 14, y + 10)
  ctx.lineTo(x + 18, y + 16)
  ctx.lineTo(x + 12, y + 20)
  ctx.closePath()
  ctx.fill()
}

function drawBlock(ctx: CanvasRenderingContext2D, col: number, row: number, img?: HTMLImageElement) {
  const x = px(col)
  const y = py(row)
  if (isReady(img)) {
    ctx.fillStyle = 'rgba(15, 42, 92, 0.18)'
    ctx.beginPath()
    ctx.ellipse(x + T / 2, y + T - 4, T * 0.42, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    drawTileImage(ctx, img, col, row, 1.04, 5)
    return
  }
  ctx.fillStyle = 'rgba(15, 42, 92, 0.18)'
  roundRect(ctx, x + 4, y + 7, T - 6, T - 8, 9)
  ctx.fill()
  const g = ctx.createLinearGradient(x, y, x, y + T)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(1, '#dbeafe')
  ctx.fillStyle = g
  roundRect(ctx, x + 3, y + 3, T - 6, T - 6, 9)
  ctx.fill()
  ctx.strokeStyle = '#a8c9e6'
  ctx.lineWidth = 2
  roundRect(ctx, x + 3, y + 3, T - 6, T - 6, 9)
  ctx.stroke()
  // 눈 결 점
  ctx.fillStyle = 'rgba(147, 197, 253, 0.55)'
  for (const [dx, dy] of [[12, 14], [30, 12], [22, 30], [36, 32]]) {
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, 2.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── 예고 · 물줄기 ───

function drawTelegraphs(ctx: CanvasRenderingContext2D, state: ArenaState, now: number) {
  for (const telegraph of state.telegraphs) {
    const pulse = 0.35 + 0.25 * Math.sin(now * (telegraph.kind === 'skill' ? 6 : 10))
    if (telegraph.kind === 'spray') {
      const urgency = 1 - Math.max(0, telegraph.t / telegraph.total)
      ctx.fillStyle = `rgba(244, 63, 94, ${0.22 + urgency * 0.3 + pulse * 0.2})`
    } else if (telegraph.kind === 'skill') {
      ctx.fillStyle = `rgba(168, 85, 247, ${0.18 + pulse * 0.25})`
    } else {
      const urgency = 1 - Math.max(0, telegraph.t / telegraph.total)
      ctx.fillStyle = `rgba(56, 189, 248, ${0.15 + urgency * 0.4})`
    }
    for (const tile of telegraph.tiles) {
      ctx.fillRect(px(tile.col) + 2, py(tile.row) + 2, T - 4, T - 4)
    }
    if (telegraph.kind !== 'sweep') {
      ctx.save()
      ctx.font = `bold 20px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = telegraph.kind === 'spray' ? '#fecdd3' : '#e9d5ff'
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)'
      ctx.lineWidth = 3
      for (const tile of telegraph.tiles) {
        if ((tile.col + tile.row) % 2 !== 0) continue
        const x = px(tile.col) + T / 2
        const y = py(tile.row) + T / 2
        ctx.strokeText('!', x, y)
        ctx.fillText('!', x, y)
      }
      ctx.restore()
    }
  }
}

function drawWater(ctx: CanvasRenderingContext2D, state: ArenaState, now: number) {
  for (const water of state.water) {
    const life = Math.min(1, water.t / ARENA.WATER_LINGER)
    const alpha = 0.55 + 0.4 * life
    const x = px(water.col)
    const y = py(water.row)
    const inset = water.shape === 'center' ? 3 : 7
    const color = water.source === 'boss' ? `rgba(129, 140, 248, ${alpha})` : `rgba(56, 189, 248, ${alpha})`
    ctx.fillStyle = color
    if (water.shape === 'h') roundRect(ctx, x - 2, y + inset, T + 4, T - inset * 2, 10)
    else if (water.shape === 'v') roundRect(ctx, x + inset, y - 2, T - inset * 2, T + 4, 10)
    else roundRect(ctx, x + inset, y + inset, T - inset * 2, T - inset * 2, 12)
    ctx.fill()
    // 물방울 하이라이트
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.25 * Math.sin(now * 20 + water.col + water.row)})`
    ctx.beginPath()
    ctx.arc(x + T / 2 - 6, y + T / 2 - 6, 5, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ─── 물건들 ───

function drawItems(ctx: CanvasRenderingContext2D, state: ArenaState, now: number, images: ArenaImages) {
  for (const item of state.items) {
    const x = px(item.col) + T / 2
    const y = py(item.row) + T / 2 + Math.sin(now * 4 + item.id) * 2
    ctx.fillStyle = 'rgba(15, 42, 92, 0.2)'
    ctx.beginPath()
    ctx.ellipse(x, py(item.row) + T - 6, 12, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    const img = item.kind === 'range' ? images.itemRange : item.kind === 'shoe' ? images.itemShoe : item.kind === 'needle' ? images.itemNeedle : images.itemBalloon
    if (isReady(img)) {
      // 반짝이는 테 + 그림
      ctx.strokeStyle = `rgba(253, 224, 71, ${0.5 + 0.4 * Math.sin(now * 6 + item.id)})`
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, 17, 0, Math.PI * 2)
      ctx.stroke()
      const size = T * 0.78
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
      continue
    }
    ctx.fillStyle = '#fff7cc'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 15, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.font = `18px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000'
    ctx.fillText(item.kind === 'range' ? '💧' : item.kind === 'shoe' ? '👟' : item.kind === 'needle' ? '📍' : '🎈', x, y + 1)
  }
}

function drawBalloons(ctx: CanvasRenderingContext2D, state: ArenaState, now: number, images: ArenaImages) {
  for (const balloon of state.balloons) {
    const x = px(balloon.col) + T / 2
    const y = py(balloon.row) + T / 2
    const urgency = 1 - balloon.t / ARENA.BALLOON_FUSE
    const scale = 1 + Math.sin(now * (8 + urgency * 18)) * (0.05 + urgency * 0.08)
    const r = 17 * scale
    ctx.fillStyle = 'rgba(15, 42, 92, 0.22)'
    ctx.beginPath()
    ctx.ellipse(x, y + 18, r * 0.8, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    if (isReady(images.balloon)) {
      const size = T * 0.98 * scale
      ctx.drawImage(images.balloon, x - size / 2, y - size / 2 - 2, size, size)
      continue
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r)
    g.addColorStop(0, '#bfe9ff')
    g.addColorStop(0.6, '#38bdf8')
    g.addColorStop(1, '#1d4ed8')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2)
    ctx.fill()
    // 매듭
    ctx.fillStyle = '#1d4ed8'
    ctx.beginPath()
    ctx.moveTo(x - 4, y + r - 1)
    ctx.lineTo(x + 4, y + r - 1)
    ctx.lineTo(x, y + r + 5)
    ctx.closePath()
    ctx.fill()
  }
}

function drawEggs(ctx: CanvasRenderingContext2D, state: ArenaState, now: number, images: ArenaImages) {
  for (const egg of state.eggs) {
    const progress = egg.t / ARENA.EGG_HATCH
    const x = px(egg.col) + T / 2
    const y = py(egg.row) + T / 2 + 4
    const wobble = Math.sin(now * (6 + progress * 20) + egg.wobble) * (0.08 + progress * 0.25)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(wobble)
    if (isReady(images.egg)) {
      ctx.fillStyle = 'rgba(15, 42, 92, 0.22)'
      ctx.beginPath()
      ctx.ellipse(0, 16, 14, 4, 0, 0, Math.PI * 2)
      ctx.fill()
      const size = T * 0.9
      ctx.drawImage(images.egg, -size / 2, -size / 2 - 4, size, size)
      ctx.restore()
      continue
    }
    ctx.fillStyle = 'rgba(15, 42, 92, 0.22)'
    ctx.beginPath()
    ctx.ellipse(0, 16, 14, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    const g = ctx.createLinearGradient(-14, -18, 14, 18)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#e2e8f0')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, 13, 17, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#7dd3fc'
    for (const [dx, dy] of [[-5, -6], [5, 2], [-2, 8]]) {
      ctx.beginPath()
      ctx.arc(dx, dy, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
    if (progress > 0.55) {
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-8, -2)
      ctx.lineTo(-3, 2)
      ctx.lineTo(1, -3)
      ctx.lineTo(6, 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawSnowman(ctx: CanvasRenderingContext2D, snowman: Snowman, now: number, images: ArenaImages) {
  const x = px(snowman.x)
  const y = py(snowman.y)
  const bob = snowman.state === 'frozen' ? 0 : Math.abs(Math.sin(snowman.walkT * (snowman.state === 'berserk' ? 16 : 9))) * 3
  ctx.save()
  ctx.translate(x, y - bob)
  ctx.fillStyle = 'rgba(15, 42, 92, 0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 20 + bob, 15, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  const img = snowman.state === 'frozen' ? images.snowmanFrozen : snowman.state === 'berserk' ? images.snowmanBerserk : images.snowmanWalk
  if (isReady(img)) {
    const size = T * (snowman.state === 'frozen' ? 1.08 : 1.0)
    const tilt = snowman.state === 'berserk' ? Math.sin(now * 25) * 0.12 : snowman.state === 'walk' ? Math.sin(snowman.walkT * 9) * 0.06 : 0
    ctx.rotate(tilt)
    if (snowman.dir === 'left') ctx.scale(-1, 1)
    ctx.drawImage(img, -size / 2, -size / 2 - 6, size, size)
    if (snowman.state === 'frozen' && snowman.stateT / ARENA.FREEZE_TIME < 0.4 && Math.floor(now * 8) % 2 === 0) {
      // 곧 녹는다 — 깜빡임
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.fillRect(-size / 2, -size / 2 - 6, size, size)
    }
    ctx.restore()
    return
  }
  // 몸 · 머리
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 8, 14, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -9, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // 단추
  ctx.fillStyle = '#1e293b'
  for (const dy of [3, 10]) {
    ctx.beginPath()
    ctx.arc(0, dy, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  // 눈 · 코
  ctx.fillStyle = snowman.state === 'berserk' ? '#ef4444' : '#1e293b'
  ctx.beginPath()
  ctx.arc(-3.5, -11, 1.8, 0, Math.PI * 2)
  ctx.arc(3.5, -11, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(7, -6)
  ctx.lineTo(0, -5)
  ctx.closePath()
  ctx.fill()
  // 팔
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(-12, 4)
  ctx.lineTo(-20, -2)
  ctx.moveTo(12, 4)
  ctx.lineTo(20, -2)
  ctx.stroke()
  if (snowman.state === 'berserk') {
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      const off = ((now * 30 + i * 7) % 14) - 7
      ctx.beginPath()
      ctx.moveTo(-26, -6 + i * 8 + off)
      ctx.lineTo(-18, -6 + i * 8 + off)
      ctx.stroke()
    }
  }
  if (snowman.state === 'frozen') {
    const left = snowman.stateT / ARENA.FREEZE_TIME
    ctx.fillStyle = 'rgba(125, 211, 252, 0.5)'
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    roundRect(ctx, -19, -22, 38, 44, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.moveTo(-14, -16)
    ctx.lineTo(-8, -18)
    ctx.lineTo(-12, -8)
    ctx.closePath()
    ctx.fill()
    if (left < 0.4) {
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(-10, -20)
      ctx.lineTo(-2, -6)
      ctx.lineTo(6, -10)
      ctx.lineTo(10, 8)
      ctx.stroke()
    }
  }
  ctx.restore()
}

// ─── 펭귄 ───

function drawBoss(ctx: CanvasRenderingContext2D, state: ArenaState, opts: DrawArenaOptions) {
  const downScene = state.boss.downT > 0 && opts.downSprite
  const sprite = downScene ? opts.downSprite : opts.bossSprite
  if (!sprite) return
  if (!downScene && !state.bossPresent) return
  const set = opts.bossImages[sprite]
  const width = ARENA.BOSS_W * T * 1.12
  const height = width * 1.25
  const anchorX = downScene ? (ARENA.COLS - ARENA.BOSS_W) / 2 : state.boss.x
  const cx = px(anchorX + ARENA.BOSS_W / 2)
  const bottom = py(ARENA.BOSS_H) + 6
  const bob = downScene ? 0 : Math.sin(opts.now * 2.2) * 2
  // 그림자
  ctx.fillStyle = 'rgba(2, 6, 23, 0.35)'
  ctx.beginPath()
  ctx.ellipse(cx, bottom - 4, width * 0.42, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  // 얼음 방패 고리
  if (opts.shieldActive && !downScene) {
    ctx.save()
    ctx.strokeStyle = `rgba(165, 243, 252, ${0.6 + 0.3 * Math.sin(opts.now * 5)})`
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.ellipse(cx, bottom - height * 0.42, width * 0.6, height * 0.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }
  const image = downScene ? set.down : state.boss.hurtT > 0 && set.hurt ? set.hurt : set.idle
  ctx.save()
  if (opts.groggy && !downScene) ctx.globalAlpha = 0.92
  if (isReady(image)) {
    ctx.drawImage(image, cx - width / 2, bottom - height - bob, width, height)
  } else {
    ctx.font = `${Math.round(width * 0.7)}px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText('🐧', cx, bottom - bob)
  }
  ctx.restore()
  if (state.boss.hurtT > 0 && !downScene) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, state.boss.hurtT)})`
    ctx.beginPath()
    ctx.ellipse(cx, bottom - height * 0.45, width * 0.4, height * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  if (opts.groggy && !downScene) {
    ctx.font = `20px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    for (let i = 0; i < 3; i++) {
      const angle = opts.now * 3 + (i * Math.PI * 2) / 3
      ctx.fillText('⭐', cx + Math.cos(angle) * width * 0.4, bottom - height + 6 + Math.sin(angle) * 8)
    }
  }
}

// ─── 플레이어 ───

function dirFacesLeft(dir: Dir): boolean {
  return dir === 'left'
}

function drawPlayer(ctx: CanvasRenderingContext2D, state: ArenaState, opts: DrawArenaOptions) {
  const player = state.player
  const x = px(player.x)
  const y = py(player.y)
  const blink = player.invincibleT > 0 && Math.floor(opts.now * 12) % 2 === 0
  const bob = player.moving ? Math.abs(Math.sin(player.walkT * 14)) * 3 : 0
  ctx.save()
  ctx.fillStyle = 'rgba(15, 42, 92, 0.25)'
  ctx.beginPath()
  ctx.ellipse(x, y + 19, 14, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  if (player.guard) {
    ctx.strokeStyle = `rgba(103, 232, 249, ${0.6 + 0.3 * Math.sin(opts.now * 4)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(x, y, 24, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (blink) ctx.globalAlpha = 0.35
  const size = T * 1.08
  ctx.translate(x, y - bob)
  if (dirFacesLeft(player.dir)) ctx.scale(-1, 1)
  if (isReady(opts.avatarImage)) {
    const ratio = opts.avatarImage.naturalWidth / opts.avatarImage.naturalHeight || 1
    const h = size
    const w = h * ratio
    ctx.drawImage(opts.avatarImage, -w / 2, -h / 2 - 4, w, h)
  } else {
    ctx.font = `${Math.round(size * 0.7)}px ${EMOJI_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(opts.avatarFallback, 0, -2)
  }
  ctx.restore()

  if (player.state === 'trapped') {
    const wobble = Math.sin(opts.now * 6) * 2
    const r = 27 + wobble
    const g = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.7, 'rgba(125, 211, 252, 0.35)')
    g.addColorStop(1, 'rgba(37, 99, 235, 0.55)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y - 2, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.ellipse(x - 10, y - 12, 6, 4, -0.7, 0, Math.PI * 2)
    ctx.fill()
    const left = Math.ceil(player.trappedT)
    ctx.font = `bold 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.lineWidth = 3
    ctx.fillStyle = '#fff'
    ctx.strokeText(String(left), x, y - r - 10)
    ctx.fillText(String(left), x, y - r - 10)
    ctx.font = `bold 12px ${FONT}`
    ctx.fillStyle = '#fde68a'
    const hint = '연타로 탈출!'
    const hy = Math.min(WORLD_H - 12, y + r + 14)
    ctx.strokeText(hint, x, hy)
    ctx.fillText(hint, x, hy)
  }
}

function drawFx(ctx: CanvasRenderingContext2D, state: ArenaState) {
  for (const fx of state.fx) {
    const life = 1 - fx.t / fx.total
    ctx.globalAlpha = Math.max(0, life)
    ctx.fillStyle = fx.color
    ctx.beginPath()
    ctx.arc(px(fx.x), py(fx.y), fx.size * T * (0.6 + life * 0.6), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawFloatTexts(ctx: CanvasRenderingContext2D, state: ArenaState) {
  for (const text of state.texts) {
    const life = 1 - text.t / text.total
    ctx.save()
    ctx.globalAlpha = Math.min(1, life * 1.6)
    ctx.font = `bold ${text.text.length > 4 ? 15 : 20}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)'
    ctx.fillStyle = text.color
    const x = px(text.x)
    const y = py(text.y)
    ctx.strokeText(text.text, x, y)
    ctx.fillText(text.text, x, y)
    ctx.restore()
  }
}

/** 무대가 열릴 때 READY → GO! */
function drawIntro(ctx: CanvasRenderingContext2D, state: ArenaState, now: number) {
  if (state.introT <= 0 || state.boss.downT > 0) return
  const elapsed = ARENA.INTRO_TIME - state.introT
  const go = elapsed > ARENA.INTRO_TIME * 0.6
  const label = go ? 'GO!' : 'READY'
  const pop = go ? 1 + Math.max(0, 0.25 - (elapsed - ARENA.INTRO_TIME * 0.6)) : 1 + Math.sin(now * 6) * 0.03
  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)'
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  ctx.translate(WORLD_W / 2, WORLD_H / 2)
  ctx.scale(pop, pop)
  ctx.font = `bold ${go ? 64 : 48}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fillStyle = go ? '#fde047' : '#e0f2fe'
  ctx.strokeText(label, 0, 0)
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

export function drawArena(ctx: CanvasRenderingContext2D, state: ArenaState, opts: DrawArenaOptions) {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H)
  const images = opts.images
  ctx.save()
  if (state.shake > 0) {
    const amp = state.shake * 6
    ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp)
  }
  drawFloor(ctx, state, images)
  drawTelegraphs(ctx, state, opts.now)
  drawItems(ctx, state, opts.now, images)
  drawWater(ctx, state, opts.now)
  drawEggs(ctx, state, opts.now, images)
  drawBalloons(ctx, state, opts.now, images)
  drawBoss(ctx, state, opts)
  for (const snowman of state.snowmen) drawSnowman(ctx, snowman, opts.now, images)
  drawPlayer(ctx, state, opts)
  drawFx(ctx, state)
  drawFloatTexts(ctx, state)

  // 펭귄 칸 테두리 (닿으면 갇힌다는 걸 알리는 가는 선)
  if (state.bossPresent && state.boss.downT <= 0) {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)'
    ctx.lineWidth = 2
    for (const tile of getBossTiles(state)) {
      ctx.strokeRect(px(tile.col) + 2, py(tile.row) + 2, T - 4, T - 4)
    }
  }

  ctx.restore()
  drawIntro(ctx, state, opts.now)

  if (opts.frozen) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)'
    ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  }
}
