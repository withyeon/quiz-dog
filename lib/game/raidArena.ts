// 황제 펭귄을 막아라! — 크레이지아케이드 몬스터 모드식 아레나 엔진 (React 없음)
//
// 학생마다 자기 아레나(눈 블록·물풍선·스노우몬)를 돌리고, 펭귄의 체력만 반 전체가 공유한다
// (lib/game/raid.ts 의 computeRaidState — players.score 합). 이 파일은 "내 아레나" 한 판의 규칙이다:
//   - 격자 위를 4방향으로 움직이고, 물풍선을 놓으면 잠시 뒤 십자 물줄기가 터진다
//   - 물줄기는 눈 블록을 부수고(아이템이 나오기도), 알을 깨고, 스노우몬을 얼리고, 펭귄을 때린다
//   - 얼어붙은 스노우몬은 몸으로 부딪혀 깨야 하고, 시간이 지나면 녹아서 폭주한다
//   - 펭귄은 처음엔 가만히 알만 떨어뜨리다가, 시간이 지나면 물보라로 눈 블록을 쓸고 움직이기 시작한다
//   - 물줄기(내 것·펭귄 것)·스노우몬·펭귄에 닿으면 물방울에 갇히고, 잠시 뒤 출발 칸에서 다시 시작한다
// 물풍선은 퀴즈를 맞혀야 채워진다(useRaidGame 이 grantBalloons). 틀려도 잃는 건 없다.
// 상태는 ref 안에서 제자리 수정한다(tickArena). 렌더러는 상태만 읽어 그린다.

import { createSeededRandom, hashStringToSeed } from '@/lib/game/dontlookdown'
import type { RaidRole, RaidSkillPhase } from '@/lib/game/raid'

export type Dir = 'up' | 'down' | 'left' | 'right'

export const ARENA = {
  COLS: 13,
  ROWS: 11,
  /** 한 칸의 월드 픽셀 */
  TILE: 48,
  /** 펭귄 머리(왕관)가 들어갈 위쪽 여백 (월드 픽셀) */
  TOP_PAD: 40,
  /** 펭귄이 차지하는 칸 (가로×세로), 0~1행 */
  BOSS_W: 2,
  BOSS_H: 2,
  /** 플레이어 이동 속도 (칸/초) · 신발 하나당 보너스 · 신발 최대 */
  PLAYER_SPEED: 4.0,
  SHOE_BONUS: 0.7,
  MAX_SHOES: 3,
  /** 플레이어 충돌 상자 반폭 (칸) */
  PLAYER_HALF: 0.34,
  /** 물풍선 심지 (초) · 물줄기 머무는 시간 (초) */
  BALLOON_FUSE: 2.0,
  WATER_LINGER: 0.55,
  /** 물줄기 기본 길이 · 최대 */
  BASE_RANGE: 2,
  MAX_RANGE: 6,
  /** 시작 물풍선 · 최대 보유 · 한 번에 놓을 수 있는 수 */
  START_BALLOONS: 3,
  MAX_BALLOONS: 9,
  MAX_PLACED: 3,
  /** 정답 하나로 받는 물풍선. 물풍선은 퀴즈로만 생긴다(블록에서 물풍선 아이템은 나오지 않는다) — 문제를 더 자주 풀게 */
  BALLOONS_PER_ANSWER: 2,
  /** 알이 부화하는 시간 (초) · 첫 알 · 알 간격 · 동시에 있을 수 있는 부하(알+스노우몬) 수 */
  EGG_HATCH: 3.0,
  EGG_FIRST_AT: 4,
  EGG_INTERVAL: 8,
  MAX_MINIONS: 4,
  /** 스노우몬 속도 (칸/초) · 폭주 속도 · 얼음 유지 · 폭주 유지 */
  SNOWMAN_SPEED: 1.9,
  BERSERK_SPEED: 3.4,
  FREEZE_TIME: 5.0,
  BERSERK_TIME: 6.0,
  /** 물방울에 갇히는 시간 · 다시 시작한 뒤 무적 시간 */
  TRAP_TIME: 2.6,
  INVINCIBLE_TIME: 2.2,
  /** 수호자의 보호막이 다시 차는 시간 (초) */
  GUARD_COOLDOWN: 25,
  /** 펭귄이 움직이기 시작하기까지 (첫 펭귄 · 그다음 펭귄들) · 물보라 예고 */
  BOSS_WAIT_FIRST: 45,
  BOSS_WAIT_NEXT: 30,
  SWEEP_TELEGRAPH: 2.2,
  /** 펭귄 이동 속도 (칸/초) */
  BOSS_SPEED: 1.4,
  /** 물줄기 공격: 첫 공격 · 간격 · 예고 · 아래로 뻗는 길이 · 옆으로 뻗는 길이(움직이기 시작한 뒤) */
  SPRAY_FIRST_AT: 7,
  SPRAY_INTERVAL: 8,
  SPRAY_TELEGRAPH: 1.3,
  SPRAY_DOWN: 4,
  SPRAY_SIDE: 3,
  /** 필살기(눈보라)가 쓸고 가는 행 수 · 물줄기 머무는 시간 */
  SKILL_ROWS: 3,
  SKILL_LINGER: 1.2,
  /** 눈 블록이 아이템을 떨어뜨릴 확률 */
  ITEM_DROP_CHANCE: 0.32,
  /** 눈 블록 채우는 비율 (빈 칸 중) */
  BLOCK_FILL: 0.5,
  /** 스노우몬을 깼을 때 펭귄이 받는 데미지 · 알을 깼을 때 */
  SNOWMAN_KILL_DAMAGE: 5,
  EGG_CRUSH_DAMAGE: 2,
  /** 쓰러진 펭귄을 보여 주는 시간 (초) */
  DOWN_SCENE: 1.6,
  /** 무대가 열릴 때 READY → GO! 연출 (초). 그동안 세상은 멈춰 있다 */
  INTRO_TIME: 2.0,
  /** 바늘: 갇히는 순간 자동으로 터뜨리고 나온다. 가질 수 있는 수 */
  NEEDLE_MAX: 2,
  /** 갇혀 있을 때 물풍선 버튼을 연타하면 한 번에 줄어드는 시간 (초) */
  MASH_ESCAPE: 0.22,
} as const

export const WORLD_W = ARENA.COLS * ARENA.TILE
export const WORLD_H = ARENA.ROWS * ARENA.TILE + ARENA.TOP_PAD

export type TileKind = 'floor' | 'pillar' | 'block'
export type ArenaItemKind = 'range' | 'shoe' | 'balloon' | 'needle'

export type ArenaPlayer = {
  /** 칸 단위 중심 좌표 */
  x: number
  y: number
  dir: Dir
  moving: boolean
  state: 'alive' | 'trapped'
  trappedT: number
  invincibleT: number
  range: number
  shoes: number
  balloons: number
  /** 수호자 보호막. 있으면 한 번 갇히는 걸 막는다 */
  guard: boolean
  guardCooldown: number
  /** 걷는 애니메이션용 */
  walkT: number
  /** 바늘 (갇히면 자동 탈출) */
  needles: number
}

/** 화면 위로 떠오르는 글자 (+5, 아이템 이름 등) */
export type FloatText = { x: number; y: number; text: string; color: string; t: number; total: number }

export type Balloon = { id: number; col: number; row: number; t: number; range: number; passable: boolean }
export type Water = { col: number; row: number; t: number; explosionId: number; source: 'player' | 'boss'; shape: 'center' | 'h' | 'v' }
export type Egg = { id: number; col: number; row: number; t: number; wobble: number }
export type Snowman = {
  id: number
  x: number
  y: number
  dir: Dir
  state: 'walk' | 'frozen' | 'berserk'
  stateT: number
  targetCol: number
  targetRow: number
  walkT: number
}
export type ArenaItem = { id: number; col: number; row: number; kind: ArenaItemKind; t: number }
export type Telegraph = { kind: 'spray' | 'skill' | 'sweep'; tiles: Array<{ col: number; row: number }>; t: number; total: number }
export type Fx = { x: number; y: number; vx: number; vy: number; t: number; total: number; color: string; size: number }

export type ArenaEvent =
  | { type: 'boss_hit' }
  | { type: 'snowman_killed' }
  | { type: 'egg_crushed' }
  | { type: 'trapped'; by: 'water' | 'snowman' | 'boss' }
  | { type: 'guarded' }
  | { type: 'needle' }
  | { type: 'mash' }
  | { type: 'respawn' }
  | { type: 'item'; kind: ArenaItemKind }
  | { type: 'balloon_placed' }
  | { type: 'no_balloons' }
  | { type: 'explosion' }
  | { type: 'sweep' }
  | { type: 'frozen' }
  | { type: 'thawed' }
  | { type: 'stage_start'; bossIndex: number }

export type ArenaState = {
  seedKey: string
  /** 이 판의 펭귄 순번 (roster index). 바뀌면 새 무대를 깐다 */
  bossIndex: number
  bossPresent: boolean
  time: number
  tiles: TileKind[]
  player: ArenaPlayer
  spawn: { col: number; row: number }
  balloons: Balloon[]
  water: Water[]
  eggs: Egg[]
  snowmen: Snowman[]
  items: ArenaItem[]
  telegraphs: Telegraph[]
  fx: Fx[]
  texts: FloatText[]
  /** 화면 흔들림 세기 (0~1, 렌더러가 읽고 매 프레임 줄어든다) */
  shake: number
  /** READY → GO! 남은 시간. 0보다 크면 세상이 멈춰 있다 */
  introT: number
  /** 펭귄 왼쪽 위 칸 (가로는 소수) */
  boss: { x: number; moving: boolean; dirRight: number; hurtT: number; waitLeft: number; sweepDone: boolean; sprayT: number; downT: number; downSprite: number | null }
  /** 필살기 단계 전환 감지용 */
  skill: { phase: RaidSkillPhase; cycle: number; rows: number[] }
  nextEggAt: number
  nextId: number
  nextExplosionId: number
  /** 이미 펭귄을 한 번 때린 폭발 번호 (물줄기가 남아 있는 동안 두 번 세지 않게) */
  countedBossHits: Set<number>
  events: ArenaEvent[]
  random: () => number
  /** 눈 블록이 남아 있는 수 (물보라 연출용) */
  blocksLeft: number
}

export type ArenaInput = {
  dir: Dir | null
  placeBalloon: boolean
}

export type ArenaExternal = {
  bossIndex: number
  bossPresent: boolean
  bossGroggy: boolean
  skillPhase: RaidSkillPhase
  skillCycle: number
  role: RaidRole | null
}

// ─── 격자 도우미 ───

export function tileIndex(col: number, row: number): number {
  return row * ARENA.COLS + col
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < ARENA.COLS && row < ARENA.ROWS
}

export function getTile(state: Pick<ArenaState, 'tiles'>, col: number, row: number): TileKind | 'wall' {
  if (!inBounds(col, row)) return 'wall'
  return state.tiles[tileIndex(col, row)]
}

/** 펭귄이 덮고 있는 칸들 (가로 위치가 소수면 세 칸을 덮는다) */
export function getBossTiles(state: Pick<ArenaState, 'boss' | 'bossPresent'>): Array<{ col: number; row: number }> {
  if (!state.bossPresent) return []
  const left = Math.floor(state.boss.x)
  const right = Math.ceil(state.boss.x) + ARENA.BOSS_W - 1
  const tiles: Array<{ col: number; row: number }> = []
  for (let col = left; col <= right; col++) {
    for (let row = 0; row < ARENA.BOSS_H; row++) {
      if (inBounds(col, row)) tiles.push({ col, row })
    }
  }
  return tiles
}

function isBossTile(state: ArenaState, col: number, row: number): boolean {
  if (!state.bossPresent) return false
  if (row >= ARENA.BOSS_H) return false
  const left = Math.floor(state.boss.x)
  const right = Math.ceil(state.boss.x) + ARENA.BOSS_W - 1
  return col >= left && col <= right
}

function hasBalloonAt(state: ArenaState, col: number, row: number, forPlayer: boolean): boolean {
  return state.balloons.some((b) => b.col === col && b.row === row && !(forPlayer && b.passable))
}

/** 플레이어가 지나갈 수 없는 칸인지 */
function isSolidForPlayer(state: ArenaState, col: number, row: number): boolean {
  const tile = getTile(state, col, row)
  if (tile !== 'floor') return true
  if (isBossTile(state, col, row)) return true
  if (hasBalloonAt(state, col, row, true)) return true
  return false
}

/** 스노우몬이 지나갈 수 없는 칸인지 */
function isSolidForSnowman(state: ArenaState, col: number, row: number): boolean {
  const tile = getTile(state, col, row)
  if (tile !== 'floor') return true
  if (isBossTile(state, col, row)) return true
  if (hasBalloonAt(state, col, row, false)) return true
  return false
}

const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

// ─── 무대 만들기 ───

function buildTiles(random: () => number, spawn: { col: number; row: number }): TileKind[] {
  const tiles: TileKind[] = new Array(ARENA.COLS * ARENA.ROWS).fill('floor')
  // 얼음 기둥: 3행부터 홀수 칸 — 펭귄 앞 두 줄(0~2행)은 비워 둔다
  for (let row = 3; row < ARENA.ROWS; row += 2) {
    for (let col = 1; col < ARENA.COLS; col += 2) {
      tiles[tileIndex(col, row)] = 'pillar'
    }
  }
  // 눈 블록: 기둥·펭귄 자리·출발 칸 주변 3×3 을 뺀 빈 칸에 비율만큼. 크아 맵처럼 좌우 대칭으로 깐다
  const half = Math.floor(ARENA.COLS / 2)
  for (let row = 2; row < ARENA.ROWS; row++) {
    for (let col = 0; col <= half; col++) {
      if (tiles[tileIndex(col, row)] !== 'floor') continue
      if (Math.abs(col - spawn.col) <= 1 && Math.abs(row - spawn.row) <= 1) continue
      if (random() >= ARENA.BLOCK_FILL) continue
      tiles[tileIndex(col, row)] = 'block'
      const mirror = ARENA.COLS - 1 - col
      if (mirror !== col && tiles[tileIndex(mirror, row)] === 'floor' && !(Math.abs(mirror - spawn.col) <= 1 && Math.abs(row - spawn.row) <= 1)) {
        tiles[tileIndex(mirror, row)] = 'block'
      }
    }
  }
  // 펭귄 바로 앞 줄(2행) 가운데는 비워 둔다 — 첫 공격 길
  tiles[tileIndex(spawn.col, 2)] = 'floor'
  return tiles
}

function createPlayer(spawn: { col: number; row: number }, role: RaidRole | null): ArenaPlayer {
  return {
    x: spawn.col + 0.5,
    y: spawn.row + 0.5,
    dir: 'up',
    moving: false,
    state: 'alive',
    trappedT: 0,
    invincibleT: 0,
    range: ARENA.BASE_RANGE + (role === 'mage' ? 1 : 0),
    shoes: 0,
    balloons: ARENA.START_BALLOONS,
    guard: role === 'guardian',
    guardCooldown: 0,
    walkT: 0,
    needles: 0,
  }
}

export function createArena(seedKey: string, external: ArenaExternal): ArenaState {
  const random = createSeededRandom(hashStringToSeed(`raid-arena:${seedKey}:${external.bossIndex}`))
  const spawn = { col: Math.floor(ARENA.COLS / 2), row: ARENA.ROWS - 1 }
  const tiles = buildTiles(random, spawn)
  const state: ArenaState = {
    seedKey,
    bossIndex: external.bossIndex,
    bossPresent: external.bossPresent,
    time: 0,
    tiles,
    player: createPlayer(spawn, external.role),
    spawn,
    balloons: [],
    water: [],
    eggs: [],
    snowmen: [],
    items: [],
    telegraphs: [],
    fx: [],
    texts: [],
    shake: 0,
    introT: ARENA.INTRO_TIME,
    boss: {
      x: (ARENA.COLS - ARENA.BOSS_W) / 2,
      moving: false,
      dirRight: 1,
      hurtT: 0,
      waitLeft: external.bossIndex === 0 ? ARENA.BOSS_WAIT_FIRST : ARENA.BOSS_WAIT_NEXT,
      sweepDone: false,
      sprayT: ARENA.SPRAY_FIRST_AT,
      downT: 0,
      downSprite: null,
    },
    skill: { phase: external.skillPhase, cycle: external.skillCycle, rows: [] },
    nextEggAt: ARENA.EGG_FIRST_AT,
    nextId: 1,
    nextExplosionId: 1,
    countedBossHits: new Set(),
    events: [],
    random,
    blocksLeft: tiles.filter((t) => t === 'block').length,
  }
  return state
}

/** 다음 펭귄이 나오면 새 무대를 깐다. 플레이어의 물풍선·아이템은 그대로 가져간다 */
function startStage(state: ArenaState, external: ArenaExternal) {
  const previousIndex = state.bossIndex
  const player = state.player
  const fresh = createArena(state.seedKey, external)
  fresh.player = {
    ...player,
    x: fresh.spawn.col + 0.5,
    y: fresh.spawn.row + 0.5,
    state: 'alive',
    trappedT: 0,
    invincibleT: ARENA.INVINCIBLE_TIME,
    moving: false,
  }
  fresh.boss.downT = ARENA.DOWN_SCENE
  fresh.boss.downSprite = previousIndex
  Object.assign(state, fresh)
  state.events.push({ type: 'stage_start', bossIndex: external.bossIndex })
}

// ─── 물줄기 ───

type WaterTile = { col: number; row: number; shape: Water['shape'] }

/**
 * 한 칸에서 십자로 뻗는 물줄기. 기둥·벽에서 멈추고, 눈 블록은 부수고 거기서 멈추고, 펭귄 칸은 덮고 멈춘다.
 * 부순 블록은 호출자가 처리할 수 있게 돌려준다.
 */
function spreadWater(state: ArenaState, col: number, row: number, range: number): { tiles: WaterTile[]; broken: Array<{ col: number; row: number }> } {
  const tiles: WaterTile[] = [{ col, row, shape: 'center' }]
  const broken: Array<{ col: number; row: number }> = []
  const dirs: Dir[] = ['up', 'down', 'left', 'right']
  for (const dir of dirs) {
    const { dx, dy } = DIRS[dir]
    const shape: Water['shape'] = dx !== 0 ? 'h' : 'v'
    for (let step = 1; step <= range; step++) {
      const c = col + dx * step
      const r = row + dy * step
      const tile = getTile(state, c, r)
      if (tile === 'wall' || tile === 'pillar') break
      if (tile === 'block') {
        tiles.push({ col: c, row: r, shape })
        broken.push({ col: c, row: r })
        break
      }
      tiles.push({ col: c, row: r, shape })
      if (isBossTile(state, c, r)) break
    }
  }
  return { tiles, broken }
}

function pushWater(state: ArenaState, tiles: WaterTile[], explosionId: number, source: Water['source'], linger: number) {
  for (const tile of tiles) {
    const existing = state.water.find((w) => w.col === tile.col && w.row === tile.row)
    if (existing) {
      existing.t = Math.max(existing.t, linger)
      if (existing.explosionId !== explosionId) existing.explosionId = explosionId
      continue
    }
    state.water.push({ col: tile.col, row: tile.row, t: linger, explosionId, source, shape: tile.shape })
  }
}

function breakBlock(state: ArenaState, col: number, row: number) {
  if (getTile(state, col, row) !== 'block') return
  state.tiles[tileIndex(col, row)] = 'floor'
  state.blocksLeft = Math.max(0, state.blocksLeft - 1)
  burst(state, col + 0.5, row + 0.5, '#f8fafc', 8, 2.2)
  if (state.random() < ARENA.ITEM_DROP_CHANCE) {
    const roll = state.random()
    // 물풍선 아이템은 없다: 물풍선은 퀴즈를 맞혀야만 생긴다
    const kind: ArenaItemKind = roll < 0.5 ? 'range' : roll < 0.78 ? 'shoe' : 'needle'
    state.items.push({ id: state.nextId++, col, row, kind, t: 0 })
  }
}

function explodeBalloon(state: ArenaState, balloon: Balloon, explosionId: number) {
  state.balloons = state.balloons.filter((b) => b.id !== balloon.id)
  const { tiles, broken } = spreadWater(state, balloon.col, balloon.row, balloon.range)
  for (const b of broken) breakBlock(state, b.col, b.row)
  pushWater(state, tiles, explosionId, 'player', ARENA.WATER_LINGER)
  burst(state, balloon.col + 0.5, balloon.row + 0.5, '#7dd3fc', 10, 3)
  if (Math.hypot(state.player.x - balloon.col - 0.5, state.player.y - balloon.row - 0.5) < 4) state.shake = Math.max(state.shake, 0.35)
  // 물줄기에 닿은 다른 물풍선은 연쇄로 터진다 (같은 폭발 번호 — 펭귄은 한 번만 맞는다)
  for (const other of [...state.balloons]) {
    if (tiles.some((t) => t.col === other.col && t.row === other.row)) explodeBalloon(state, other, explosionId)
  }
}

function burst(state: ArenaState, x: number, y: number, color: string, count: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const angle = state.random() * Math.PI * 2
    const v = speed * (0.4 + state.random() * 0.8)
    state.fx.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 1,
      t: 0,
      total: 0.45 + state.random() * 0.35,
      color,
      size: 0.08 + state.random() * 0.08,
    })
  }
}

// ─── 플레이어 ───

function placeBalloon(state: ArenaState) {
  const player = state.player
  if (player.state !== 'alive') return
  if (player.balloons <= 0) {
    state.events.push({ type: 'no_balloons' })
    return
  }
  if (state.balloons.length >= ARENA.MAX_PLACED) return
  const col = Math.floor(player.x)
  const row = Math.floor(player.y)
  if (getTile(state, col, row) !== 'floor' || isBossTile(state, col, row)) return
  if (state.balloons.some((b) => b.col === col && b.row === row)) return
  player.balloons -= 1
  state.balloons.push({ id: state.nextId++, col, row, t: ARENA.BALLOON_FUSE, range: player.range, passable: true })
  state.events.push({ type: 'balloon_placed' })
}

/** 플레이어 상자가 겹치는 칸 중 막힌 칸이 있는지 */
function playerBlocked(state: ArenaState, x: number, y: number): boolean {
  const half = ARENA.PLAYER_HALF
  const minCol = Math.floor(x - half)
  const maxCol = Math.floor(x + half - 0.001)
  const minRow = Math.floor(y - half)
  const maxRow = Math.floor(y + half - 0.001)
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      if (isSolidForPlayer(state, col, row)) return true
    }
  }
  return false
}

function movePlayer(state: ArenaState, input: ArenaInput, dt: number) {
  const player = state.player
  if (player.state !== 'alive') {
    player.moving = false
    return
  }
  const dir = input.dir
  player.moving = dir !== null
  if (!dir) return
  player.dir = dir
  player.walkT += dt
  const speed = ARENA.PLAYER_SPEED + player.shoes * ARENA.SHOE_BONUS
  const step = speed * dt
  const { dx, dy } = DIRS[dir]
  const half = ARENA.PLAYER_HALF

  if (dx !== 0) {
    const nx = player.x + dx * step
    if (!playerBlocked(state, nx, player.y)) {
      player.x = nx
    } else {
      // 막혔다: 칸 경계까지만 가고, 가까운 길이 열려 있으면 그쪽 줄로 미끄러진다 (모서리 보정)
      const edgeCol = dx > 0 ? Math.floor(player.x + half) + 1 : Math.floor(player.x - half) - 1
      player.x = dx > 0 ? Math.min(nx, edgeCol - half - 0.001) : Math.max(nx, edgeCol + 1 + half + 0.001)
      const lane = Math.floor(player.y)
      const laneCenter = lane + 0.5
      const offset = player.y - laneCenter
      const nextCol = Math.floor(player.x) + dx
      if (Math.abs(offset) > 0.01 && !isSolidForPlayer(state, nextCol, lane)) {
        const ny = player.y - Math.sign(offset) * Math.min(Math.abs(offset), step)
        if (!playerBlocked(state, player.x, ny)) player.y = ny
      } else if (Math.abs(offset) <= 0.01) {
        // 바로 옆 줄이 열려 있으면 그쪽으로 미끄러진다
        for (const side of [-1, 1]) {
          const sideRow = lane + side
          if (!isSolidForPlayer(state, nextCol, sideRow) && !isSolidForPlayer(state, Math.floor(player.x), sideRow)) {
            const target = sideRow + 0.5
            if (Math.abs(target - player.y) < 0.75) {
              const ny = player.y + Math.sign(target - player.y) * step
              if (!playerBlocked(state, player.x, ny)) player.y = ny
              break
            }
          }
        }
      }
    }
  } else {
    const ny = player.y + dy * step
    if (!playerBlocked(state, player.x, ny)) {
      player.y = ny
    } else {
      const edgeRow = dy > 0 ? Math.floor(player.y + half) + 1 : Math.floor(player.y - half) - 1
      player.y = dy > 0 ? Math.min(ny, edgeRow - half - 0.001) : Math.max(ny, edgeRow + 1 + half + 0.001)
      const lane = Math.floor(player.x)
      const laneCenter = lane + 0.5
      const offset = player.x - laneCenter
      const nextRow = Math.floor(player.y) + dy
      if (Math.abs(offset) > 0.01 && !isSolidForPlayer(state, lane, nextRow)) {
        const nx = player.x - Math.sign(offset) * Math.min(Math.abs(offset), step)
        if (!playerBlocked(state, nx, player.y)) player.x = nx
      } else if (Math.abs(offset) <= 0.01) {
        for (const side of [-1, 1]) {
          const sideCol = lane + side
          if (!isSolidForPlayer(state, sideCol, nextRow) && !isSolidForPlayer(state, sideCol, Math.floor(player.y))) {
            const target = sideCol + 0.5
            if (Math.abs(target - player.x) < 0.75) {
              const nx = player.x + Math.sign(target - player.x) * step
              if (!playerBlocked(state, nx, player.y)) player.x = nx
              break
            }
          }
        }
      }
    }
  }
  player.x = Math.min(ARENA.COLS - half, Math.max(half, player.x))
  player.y = Math.min(ARENA.ROWS - half, Math.max(half, player.y))
}

export function pushFloatText(state: ArenaState, x: number, y: number, text: string, color = '#ffffff') {
  state.texts.push({ x, y, text, color, t: 0, total: 1.1 })
}

function trapPlayer(state: ArenaState, by: 'water' | 'snowman' | 'boss') {
  const player = state.player
  if (player.state !== 'alive' || player.invincibleT > 0) return
  if (player.needles > 0) {
    player.needles -= 1
    player.invincibleT = 1.2
    burst(state, player.x, player.y, '#fde68a', 14, 3)
    pushFloatText(state, player.x, player.y - 0.6, '바늘로 탈출!', '#fde68a')
    state.events.push({ type: 'needle' })
    return
  }
  if (player.guard) {
    player.guard = false
    player.guardCooldown = ARENA.GUARD_COOLDOWN
    player.invincibleT = 1.2
    burst(state, player.x, player.y, '#a5f3fc', 14, 3)
    state.events.push({ type: 'guarded' })
    return
  }
  player.state = 'trapped'
  player.trappedT = ARENA.TRAP_TIME
  player.moving = false
  state.shake = Math.max(state.shake, 0.5)
  state.events.push({ type: 'trapped', by })
}

function respawnPlayer(state: ArenaState) {
  const player = state.player
  player.state = 'alive'
  player.x = state.spawn.col + 0.5
  player.y = state.spawn.row + 0.5
  player.invincibleT = ARENA.INVINCIBLE_TIME
  player.range = Math.max(ARENA.BASE_RANGE, player.range - 1)
  burst(state, player.x, player.y, '#bae6fd', 10, 2.5)
  state.events.push({ type: 'respawn' })
}

// ─── 스노우몬 · 알 ───

function freeTileForEgg(state: ArenaState): { col: number; row: number } | null {
  const candidates: Array<{ col: number; row: number }> = []
  for (let row = 2; row < ARENA.ROWS; row++) {
    for (let col = 0; col < ARENA.COLS; col++) {
      if (getTile(state, col, row) !== 'floor') continue
      if (state.balloons.some((b) => b.col === col && b.row === row)) continue
      if (state.eggs.some((e) => e.col === col && e.row === row)) continue
      if (Math.abs(col + 0.5 - state.player.x) < 2.5 && Math.abs(row + 0.5 - state.player.y) < 2.5) continue
      candidates.push({ col, row })
    }
  }
  if (candidates.length === 0) return null
  return candidates[Math.floor(state.random() * candidates.length)]
}

function pickSnowmanTarget(state: ArenaState, snowman: Snowman) {
  const col = Math.floor(snowman.x)
  const row = Math.floor(snowman.y)
  const open = (['up', 'down', 'left', 'right'] as Dir[]).filter((dir) => {
    const { dx, dy } = DIRS[dir]
    return !isSolidForSnowman(state, col + dx, row + dy)
  })
  if (open.length === 0) {
    snowman.targetCol = col
    snowman.targetRow = row
    return
  }
  const forward = open.filter((dir) => dir !== OPPOSITE[snowman.dir])
  const pool = forward.length > 0 ? forward : open
  const chaseChance = snowman.state === 'berserk' ? 0.8 : 0.55
  let chosen: Dir | null = null
  if (state.random() < chaseChance) {
    const ddx = state.player.x - snowman.x
    const ddy = state.player.y - snowman.y
    const preferred: Dir[] = Math.abs(ddx) > Math.abs(ddy)
      ? [ddx > 0 ? 'right' : 'left', ddy > 0 ? 'down' : 'up']
      : [ddy > 0 ? 'down' : 'up', ddx > 0 ? 'right' : 'left']
    chosen = preferred.find((dir) => pool.includes(dir)) ?? null
  }
  if (!chosen) chosen = pool[Math.floor(state.random() * pool.length)]
  snowman.dir = chosen
  snowman.targetCol = col + DIRS[chosen].dx
  snowman.targetRow = row + DIRS[chosen].dy
}

function moveSnowman(state: ArenaState, snowman: Snowman, dt: number) {
  if (snowman.state === 'frozen') return
  const speed = snowman.state === 'berserk' ? ARENA.BERSERK_SPEED : ARENA.SNOWMAN_SPEED
  const tx = snowman.targetCol + 0.5
  const ty = snowman.targetRow + 0.5
  // 목표 칸이 막혔으면(물풍선이 놓였거나 펭귄이 왔거나) 제자리에서 다시 고른다
  if (isSolidForSnowman(state, snowman.targetCol, snowman.targetRow)) {
    const cx = Math.floor(snowman.x) + 0.5
    const cy = Math.floor(snowman.y) + 0.5
    snowman.x += Math.sign(cx - snowman.x) * Math.min(Math.abs(cx - snowman.x), speed * dt)
    snowman.y += Math.sign(cy - snowman.y) * Math.min(Math.abs(cy - snowman.y), speed * dt)
    if (Math.abs(cx - snowman.x) < 0.01 && Math.abs(cy - snowman.y) < 0.01) pickSnowmanTarget(state, snowman)
    return
  }
  snowman.walkT += dt
  const dx = tx - snowman.x
  const dy = ty - snowman.y
  const dist = Math.hypot(dx, dy)
  const step = speed * dt
  if (dist <= step) {
    snowman.x = tx
    snowman.y = ty
    pickSnowmanTarget(state, snowman)
  } else {
    snowman.x += (dx / dist) * step
    snowman.y += (dy / dist) * step
  }
}

// ─── 펭귄 ───

function bossSprayTiles(state: ArenaState): Array<{ col: number; row: number }> {
  const tiles: Array<{ col: number; row: number }> = []
  const left = Math.round(state.boss.x)
  for (let col = left; col < left + ARENA.BOSS_W; col++) {
    for (let step = 0; step < ARENA.SPRAY_DOWN; step++) {
      const row = ARENA.BOSS_H + step
      if (!inBounds(col, row)) break
      const tile = getTile(state, col, row)
      if (tile === 'pillar') break
      tiles.push({ col, row })
      if (tile === 'block') break
    }
  }
  if (state.boss.moving) {
    const row = ARENA.BOSS_H
    for (const side of [-1, 1]) {
      const start = side < 0 ? left - 1 : left + ARENA.BOSS_W
      for (let step = 0; step < ARENA.SPRAY_SIDE; step++) {
        const col = start + side * step
        if (!inBounds(col, row)) break
        const tile = getTile(state, col, row)
        if (tile === 'pillar') break
        tiles.push({ col, row })
        if (tile === 'block') break
      }
    }
  }
  return tiles
}

function fireBossWater(state: ArenaState, tiles: Array<{ col: number; row: number }>, linger: number) {
  const explosionId = state.nextExplosionId++
  for (const t of tiles) breakBlock(state, t.col, t.row)
  pushWater(state, tiles.map((t) => ({ col: t.col, row: t.row, shape: 'v' as const })), explosionId, 'boss', linger)
}

function pickSkillRows(cycle: number, seedKey: string): number[] {
  const random = createSeededRandom(hashStringToSeed(`raid-skill:${seedKey}:${cycle}`))
  const rows: number[] = []
  const pool = Array.from({ length: ARENA.ROWS - ARENA.BOSS_H }, (_, i) => i + ARENA.BOSS_H)
  while (rows.length < ARENA.SKILL_ROWS && pool.length > 0) {
    const i = Math.floor(random() * pool.length)
    rows.push(pool.splice(i, 1)[0])
  }
  return rows.sort((a, b) => a - b)
}

function updateBoss(state: ArenaState, external: ArenaExternal, dt: number) {
  const boss = state.boss
  boss.hurtT = Math.max(0, boss.hurtT - dt)
  if (!state.bossPresent) return

  // 처음엔 가만히 있다가, 기다림이 끝나면 물보라로 눈 블록을 쓸고 움직이기 시작한다
  if (!boss.sweepDone) {
    boss.waitLeft -= dt
    const sweep = state.telegraphs.find((t) => t.kind === 'sweep')
    if (boss.waitLeft <= 0 && !sweep) {
      const tiles: Array<{ col: number; row: number }> = []
      for (let row = ARENA.BOSS_H; row < ARENA.ROWS; row++) {
        for (let col = 0; col < ARENA.COLS; col++) {
          if (getTile(state, col, row) === 'block') tiles.push({ col, row })
        }
      }
      state.telegraphs.push({ kind: 'sweep', tiles, t: ARENA.SWEEP_TELEGRAPH, total: ARENA.SWEEP_TELEGRAPH })
    }
  }

  if (boss.moving && !external.bossGroggy) {
    const max = ARENA.COLS - ARENA.BOSS_W
    boss.x += boss.dirRight * ARENA.BOSS_SPEED * dt
    if (boss.x >= max) {
      boss.x = max
      boss.dirRight = -1
    } else if (boss.x <= 0) {
      boss.x = 0
      boss.dirRight = 1
    }
  }

  // 물줄기 공격 (기절 중엔 쉰다)
  if (!external.bossGroggy) {
    boss.sprayT -= dt
    if (boss.sprayT <= 0) {
      boss.sprayT = ARENA.SPRAY_INTERVAL
      const tiles = bossSprayTiles(state)
      if (tiles.length > 0) state.telegraphs.push({ kind: 'spray', tiles, t: ARENA.SPRAY_TELEGRAPH, total: ARENA.SPRAY_TELEGRAPH })
    }
  }

  // 알 떨어뜨리기 (기절 중엔 쉰다)
  if (!external.bossGroggy && state.time >= state.nextEggAt) {
    state.nextEggAt = state.time + ARENA.EGG_INTERVAL
    if (state.eggs.length + state.snowmen.length < ARENA.MAX_MINIONS) {
      const spot = freeTileForEgg(state)
      if (spot) state.eggs.push({ id: state.nextId++, col: spot.col, row: spot.row, t: 0, wobble: state.random() * Math.PI * 2 })
    }
  }

  // 필살기: 예고가 시작되면 쓸고 갈 행을 정하고, 못 끊어 눈보라가 되면 그 행에 물줄기
  const phaseChanged = external.skillPhase !== state.skill.phase || external.skillCycle !== state.skill.cycle
  if (phaseChanged) {
    const previous = state.skill.phase
    state.skill.phase = external.skillPhase
    state.skill.cycle = external.skillCycle
    if (external.skillPhase === 'charging') {
      state.skill.rows = pickSkillRows(external.skillCycle, state.seedKey)
      state.telegraphs = state.telegraphs.filter((t) => t.kind !== 'skill')
    } else if (external.skillPhase === 'blizzard' && previous !== 'blizzard') {
      const rows = state.skill.rows.length > 0 ? state.skill.rows : pickSkillRows(external.skillCycle, state.seedKey)
      const tiles: Array<{ col: number; row: number }> = []
      for (const row of rows) {
        for (let col = 0; col < ARENA.COLS; col++) {
          if (getTile(state, col, row) !== 'pillar') tiles.push({ col, row })
        }
      }
      fireBossWater(state, tiles, ARENA.SKILL_LINGER)
      state.telegraphs = state.telegraphs.filter((t) => t.kind !== 'skill')
    } else if (external.skillPhase === 'groggy' || external.skillPhase === 'idle') {
      state.telegraphs = state.telegraphs.filter((t) => t.kind !== 'skill')
    }
  }
  if (external.skillPhase === 'charging' && !state.telegraphs.some((t) => t.kind === 'skill')) {
    const tiles: Array<{ col: number; row: number }> = []
    for (const row of state.skill.rows) {
      for (let col = 0; col < ARENA.COLS; col++) {
        if (getTile(state, col, row) !== 'pillar') tiles.push({ col, row })
      }
    }
    state.telegraphs.push({ kind: 'skill', tiles, t: Number.POSITIVE_INFINITY, total: 1 })
  }
}

// ─── 한 프레임 ───

export function grantBalloons(state: ArenaState, count: number) {
  state.player.balloons = Math.min(ARENA.MAX_BALLOONS, state.player.balloons + count)
}

export function tickArena(state: ArenaState, dt: number, input: ArenaInput, external: ArenaExternal): ArenaEvent[] {
  state.events = []
  if (external.bossIndex !== state.bossIndex) startStage(state, external)
  state.bossPresent = external.bossPresent
  const player = state.player

  // 쓰러진 펭귄 장면 동안은 세상이 멈춘다
  if (state.boss.downT > 0) {
    state.boss.downT = Math.max(0, state.boss.downT - dt)
    advanceFx(state, dt)
    return state.events
  }
  // READY → GO!
  if (state.introT > 0) {
    state.introT = Math.max(0, state.introT - dt)
    advanceFx(state, dt)
    return state.events
  }

  state.time += dt
  player.invincibleT = Math.max(0, player.invincibleT - dt)
  if (!player.guard && external.role === 'guardian') {
    player.guardCooldown = Math.max(0, player.guardCooldown - dt)
    if (player.guardCooldown === 0) player.guard = true
  }

  if (player.state === 'trapped') {
    player.trappedT -= dt
    // 연타 탈출: 물풍선 버튼을 누를 때마다 조금 빨리 터진다
    if (input.placeBalloon) {
      player.trappedT -= ARENA.MASH_ESCAPE
      state.events.push({ type: 'mash' })
    }
    if (player.trappedT <= 0) respawnPlayer(state)
  } else {
    movePlayer(state, input, dt)
    if (input.placeBalloon) placeBalloon(state)
  }

  // 놓은 물풍선은 플레이어가 그 칸을 벗어나면 막힌 칸이 된다
  for (const balloon of state.balloons) {
    if (balloon.passable) {
      const inside = Math.abs(player.x - (balloon.col + 0.5)) < 0.5 + ARENA.PLAYER_HALF
        && Math.abs(player.y - (balloon.row + 0.5)) < 0.5 + ARENA.PLAYER_HALF
      if (!inside) balloon.passable = false
    }
  }

  // 심지
  let exploded = false
  for (const balloon of [...state.balloons]) {
    if (!state.balloons.includes(balloon)) continue
    balloon.t -= dt
    if (balloon.t <= 0) {
      explodeBalloon(state, balloon, state.nextExplosionId++)
      exploded = true
    }
  }
  if (exploded) state.events.push({ type: 'explosion' })

  // 펭귄 · 예고
  updateBoss(state, external, dt)
  for (const telegraph of [...state.telegraphs]) {
    telegraph.t -= dt
    if (telegraph.t > 0) continue
    state.telegraphs = state.telegraphs.filter((t) => t !== telegraph)
    if (telegraph.kind === 'spray') {
      fireBossWater(state, telegraph.tiles, ARENA.WATER_LINGER + 0.1)
    } else if (telegraph.kind === 'sweep') {
      // 물보라: 남은 눈 블록이 전부 부서지고 펭귄이 움직이기 시작한다 (아이템은 떨어지지 않는다)
      for (const t of telegraph.tiles) {
        if (getTile(state, t.col, t.row) === 'block') {
          state.tiles[tileIndex(t.col, t.row)] = 'floor'
          burst(state, t.col + 0.5, t.row + 0.5, '#e0f2fe', 4, 2)
        }
      }
      state.blocksLeft = 0
      state.boss.sweepDone = true
      state.boss.moving = true
      state.events.push({ type: 'sweep' })
    }
  }

  // 알 → 스노우몬
  for (const egg of [...state.eggs]) {
    egg.t += dt
    if (egg.t >= ARENA.EGG_HATCH) {
      state.eggs = state.eggs.filter((e) => e !== egg)
      const snowman: Snowman = {
        id: state.nextId++,
        x: egg.col + 0.5,
        y: egg.row + 0.5,
        dir: 'down',
        state: 'walk',
        stateT: 0,
        targetCol: egg.col,
        targetRow: egg.row,
        walkT: 0,
      }
      state.snowmen.push(snowman)
      pickSnowmanTarget(state, snowman)
      burst(state, snowman.x, snowman.y, '#ffffff', 6, 2)
    }
  }

  // 스노우몬
  for (const snowman of state.snowmen) {
    if (snowman.state === 'frozen') {
      snowman.stateT -= dt
      if (snowman.stateT <= 0) {
        snowman.state = 'berserk'
        snowman.stateT = ARENA.BERSERK_TIME
        state.events.push({ type: 'thawed' })
        pickSnowmanTarget(state, snowman)
      }
    } else if (snowman.state === 'berserk') {
      snowman.stateT -= dt
      if (snowman.stateT <= 0) snowman.state = 'walk'
    }
    moveSnowman(state, snowman, dt)
  }

  // 물줄기가 닿는 것들
  let bossHits = 0
  for (const water of state.water) {
    water.t -= dt
    // 펭귄 (폭발 하나당 한 번)
    if (water.source === 'player' && isBossTile(state, water.col, water.row) && !state.countedBossHits.has(water.explosionId)) {
      state.countedBossHits.add(water.explosionId)
      bossHits += 1
    }
    // 알
    for (const egg of [...state.eggs]) {
      if (egg.col === water.col && egg.row === water.row) {
        state.eggs = state.eggs.filter((e) => e !== egg)
        burst(state, egg.col + 0.5, egg.row + 0.5, '#fef9c3', 8, 2.5)
        pushFloatText(state, egg.col + 0.5, egg.row, `+${ARENA.EGG_CRUSH_DAMAGE}`, '#fef9c3')
        state.events.push({ type: 'egg_crushed' })
      }
    }
    // 스노우몬
    for (const snowman of state.snowmen) {
      if (Math.floor(snowman.x) === water.col && Math.floor(snowman.y) === water.row) {
        if (snowman.state !== 'frozen') state.events.push({ type: 'frozen' })
        snowman.state = 'frozen'
        snowman.stateT = ARENA.FREEZE_TIME
        snowman.x = water.col + 0.5
        snowman.y = water.row + 0.5
      }
    }
    // 나
    if (player.state === 'alive' && Math.abs(player.x - (water.col + 0.5)) < 0.5 && Math.abs(player.y - (water.row + 0.5)) < 0.5) {
      trapPlayer(state, 'water')
    }
  }
  state.water = state.water.filter((w) => w.t > 0)
  if (state.countedBossHits.size > 0) {
    const alive = new Set(state.water.map((w) => w.explosionId))
    for (const id of state.countedBossHits) if (!alive.has(id)) state.countedBossHits.delete(id)
  }
  // 이번 프레임에 펭귄을 맞힌 폭발마다 한 번씩 알린다
  if (bossHits > 0) {
    for (let i = 0; i < bossHits; i++) state.events.push({ type: 'boss_hit' })
    state.boss.hurtT = 0.35
    burst(state, state.boss.x + ARENA.BOSS_W / 2, 1, '#bae6fd', 12, 3)
  }

  // 몸으로 부딪히기: 얼어붙은 스노우몬은 깨지고, 움직이는 스노우몬·펭귄에 닿으면 갇힌다
  if (player.state === 'alive') {
    for (const snowman of [...state.snowmen]) {
      const dist = Math.hypot(player.x - snowman.x, player.y - snowman.y)
      if (dist > 0.78) continue
      if (snowman.state === 'frozen') {
        state.snowmen = state.snowmen.filter((s) => s !== snowman)
        burst(state, snowman.x, snowman.y, '#e0f2fe', 14, 3.5)
        pushFloatText(state, snowman.x, snowman.y - 0.5, `+${ARENA.SNOWMAN_KILL_DAMAGE}`, '#bae6fd')
        state.shake = Math.max(state.shake, 0.2)
        state.events.push({ type: 'snowman_killed' })
      } else {
        trapPlayer(state, 'snowman')
      }
    }
    if (player.state === 'alive' && isBossTile(state, Math.floor(player.x), Math.floor(player.y))) {
      trapPlayer(state, 'boss')
    }
  }

  // 아이템 줍기
  for (const item of [...state.items]) {
    item.t += dt
    if (Math.abs(player.x - (item.col + 0.5)) < 0.55 && Math.abs(player.y - (item.row + 0.5)) < 0.55 && player.state === 'alive') {
      state.items = state.items.filter((i) => i !== item)
      if (item.kind === 'range') player.range = Math.min(ARENA.MAX_RANGE, player.range + 1)
      else if (item.kind === 'shoe') player.shoes = Math.min(ARENA.MAX_SHOES, player.shoes + 1)
      else if (item.kind === 'needle') player.needles = Math.min(ARENA.NEEDLE_MAX, player.needles + 1)
      else grantBalloons(state, 2)
      const label = item.kind === 'range' ? '물줄기 +1' : item.kind === 'shoe' ? '스케이트!' : item.kind === 'needle' ? '바늘!' : '물풍선 +2'
      pushFloatText(state, player.x, player.y - 0.7, label, '#fde68a')
      burst(state, player.x, player.y, '#fde68a', 10, 2.5)
      state.events.push({ type: 'item', kind: item.kind })
    }
  }

  advanceFx(state, dt)
  return state.events
}

function advanceFx(state: ArenaState, dt: number) {
  state.shake = Math.max(0, state.shake - dt * 2.2)
  for (const text of state.texts) {
    text.t += dt
    text.y -= dt * 0.9
  }
  state.texts = state.texts.filter((text) => text.t < text.total)
  for (const fx of state.fx) {
    fx.t += dt
    fx.x += fx.vx * dt
    fx.y += fx.vy * dt
    fx.vy += 4 * dt
  }
  state.fx = state.fx.filter((fx) => fx.t < fx.total)
}

/** 화면 안내용: 지금 펭귄이 무엇을 하고 있는지 한 줄 */
export function getArenaBossLine(state: ArenaState, groggy: boolean): string {
  if (!state.bossPresent) return '펭귄 군단을 모두 물리쳤어요!'
  if (groggy) return '펭귄이 기절했어요! 지금 때리면 데미지 2배'
  if (state.telegraphs.some((t) => t.kind === 'sweep')) return '물보라가 와요! 눈 블록이 모두 부서져요'
  if (!state.boss.sweepDone) return `펭귄이 알을 떨어뜨려요 · ${Math.max(0, Math.ceil(state.boss.waitLeft))}초 뒤 움직여요`
  return '펭귄이 움직여요! 물줄기를 피하며 공격해요'
}
