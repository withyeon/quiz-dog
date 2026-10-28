/**
 * 멍멍 서바이벌 — 규칙·상수·순수 함수.
 *
 * 서바이버류(몬스터 떼를 피하며 버티는 액션) 장르를 퀴즈 게임으로 옮긴 퀴즈독 오리지널 모드다.
 * - 학생은 움직이기만 한다. 퀴즈독은 가진 스킬로 저절로 공격한다.
 * - 쓰러뜨린 몬스터가 남긴 경험치 보석을 모아 레벨업하면 내 화면만 멈추고 문제가 나온다.
 *   정답이면 스킬 카드 3장 중 하나를 고르고, 틀려도 1장이 랜덤으로 붙는다(학습이 막히지 않게).
 * - 체력이 다 떨어지면 문제를 맞혀야 다시 일어난다. 틀리면 다음 문제. 점수는 잃지 않는다.
 * - 점수 = 몬스터 처치 점수(늦게 나온 몬스터일수록 조금 더 높다). 난이도는 학생마다 자기 전투 시간을 따른다.
 *
 * 상태 객체(SurvivorState)는 프레임마다 제자리에서 바뀐다 — 몬스터 160마리를 1초에 60번 복사하지 않으려고.
 * 화면(components/survivor/SurvivorArena.tsx)이 고정 60Hz 로 stepSurvivor 를 부르고 그린다.
 *
 * 학생별 저장은 players 행 두 칸 (새 컬럼 없음, sql/20261027_survivor_mode.sql):
 *   players.score        = 점수 — 순위 기준
 *   players.item_effects = SurvivorSave JSON (레벨·경험치·스킬·전투 시간·통계). 새로고침하면 같은 힘으로 다시 시작한다.
 */

import { withJosa } from '@/lib/utils/korean'

// ─── 상수 ───
export const SURVIVOR = {
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 고정 스텝(ms) */
  STEP_MS: 1000 / 60,
  /** 화면이 보여 주는 세계 넓이 기준 (기기와 상관없이 보이는 면적이 같도록) */
  VIEW_AREA: 1000 * 640,
  PLAYER_SPEED: 150,
  PLAYER_RADIUS: 18,
  PLAYER_MAX_HP: 100,
  PICKUP_RADIUS: 90,
  /** 정답 때 고르는 카드 수 */
  CHOICES: 3,
  /** 무기·패시브 칸 수 */
  WEAPON_SLOTS: 4,
  PASSIVE_SLOTS: 4,
  /** 부활: 무적 시간, 주변 몬스터를 치우는 반경(점수 없음) */
  REVIVE_INVULN_MS: 3500,
  REVIVE_CLEAR_RADIUS: 320,
  /** 쓰러질 때마다 난이도 시계를 이만큼(ms) 되돌린다 — 자주 쓰러지는 학생은 조금 쉬운 몬스터를 만난다 */
  REVIVE_EASE_MS: 20_000,
  /** 동시에 있을 수 있는 몬스터·보석 수 (크롬북 성능) */
  ENEMY_CAP: 160,
  GEM_CAP: 260,
  /** 보스·포위 공격 (전투 시간 기준) */
  BOSS_FIRST_MS: 150_000,
  BOSS_EVERY_MS: 150_000,
  RING_FIRST_MS: 55_000,
  RING_EVERY_MS: 75_000,
  /** 고기(체력 회복) 떨어질 확률·회복량(최대 체력 비율) */
  MEAT_CHANCE: 0.012,
  /** 보석은 이 시간(ms)이 지나면 저절로 날아온다 — 몬스터에 둘러싸여도 레벨업(=문제)이 멈추지 않게 */
  GEM_AUTO_PULL_MS: 7000,
  MEAT_HEAL: 0.3,
} as const

export const SKILL_MAX_LEVEL = 5

// ─── 스킬 ───
export type WeaponId = 'bone' | 'ball' | 'bark' | 'lightning' | 'frisbee' | 'bomb'
export type PassiveId = 'heart' | 'shoe' | 'magnet' | 'clock' | 'shield'
export type SkillId = WeaponId | PassiveId

export const WEAPON_IDS: readonly WeaponId[] = ['bone', 'ball', 'bark', 'lightning', 'frisbee', 'bomb']
export const PASSIVE_IDS: readonly PassiveId[] = ['heart', 'shoe', 'magnet', 'clock', 'shield']

/** 무기 단계별 수치 (index = 레벨 - 1) */
export const WEAPONS = {
  bone: { cooldown: [750, 700, 650, 600, 550], count: [1, 1, 2, 2, 3], damage: [12, 15, 15, 19, 24], pierce: [1, 1, 1, 2, 2] },
  ball: { count: [1, 2, 2, 3, 4], damage: [7, 7, 10, 10, 13], orbit: [72, 72, 82, 82, 92], spin: [3.2, 3.2, 3.6, 3.6, 4.2] },
  bark: { cooldown: [3200, 3000, 2800, 2500, 2200], radius: [100, 115, 130, 145, 165], damage: [10, 14, 18, 22, 28] },
  lightning: { cooldown: [2400, 2200, 2000, 1800, 1500], count: [1, 2, 2, 3, 4], damage: [22, 26, 32, 38, 46] },
  frisbee: { cooldown: [2200, 2100, 2000, 1900, 1700], count: [1, 1, 2, 2, 3], damage: [14, 18, 20, 24, 30], range: [240, 260, 280, 300, 320] },
  bomb: { cooldown: [3000, 2800, 2600, 2400, 2100], count: [1, 1, 2, 2, 3], damage: [26, 32, 38, 44, 55], blast: [70, 80, 90, 100, 115] },
} as const

/** 패시브 레벨당 효과 */
export const PASSIVES = {
  heart: 20, // 최대 체력 +20
  shoe: 0.1, // 이동 속도 +10%
  magnet: 0.45, // 줍는 거리 +45%
  clock: 0.07, // 재사용 대기 -7%
  shield: 0.08, // 받는 피해 -8%
} as const

const BALL_HIT_INTERVAL_MS = 400
const BONE_SPEED = 460
const BONE_LIFE_MS = 1400
const FRISBEE_SPEED = 420
const FRISBEE_RETURN_SPEED = 540
const BOMB_FLIGHT_MS = 600
const BOMB_RANGE = 300
const BARK_KNOCKBACK = 320
const LIGHTNING_KNOCKBACK = 60

export type SkillDef = {
  id: SkillId
  kind: 'weapon' | 'passive'
  label: string
  icon: string
  /** 카드에 쓰는 한 줄 설명. level = 이 카드로 올라갈 레벨 */
  describe: (level: number) => string
}

const at = (values: readonly number[], level: number) => values[Math.max(0, Math.min(values.length, level) - 1)]

export const SKILLS: Record<SkillId, SkillDef> = {
  bone: {
    id: 'bone', kind: 'weapon', label: '뼈다귀 던지기', icon: '/survivor/skill-bone.webp',
    describe: (lv) => lv === 1 ? '가장 가까운 몬스터에게 뼈다귀를 던져요' : `뼈다귀 ${at(WEAPONS.bone.count, lv)}개 · 피해 ${at(WEAPONS.bone.damage, lv)}${at(WEAPONS.bone.pierce, lv) > 1 ? ' · 2마리 꿰뚫기' : ''}`,
  },
  ball: {
    id: 'ball', kind: 'weapon', label: '빙글빙글 공', icon: '/survivor/skill-ball.webp',
    describe: (lv) => lv === 1 ? '테니스공이 내 주위를 빙글빙글 돌며 막아요' : `공 ${at(WEAPONS.ball.count, lv)}개 · 피해 ${at(WEAPONS.ball.damage, lv)}`,
  },
  bark: {
    id: 'bark', kind: 'weapon', label: '멍멍 짖기', icon: '/survivor/skill-bark.webp',
    describe: (lv) => lv === 1 ? '크게 짖어서 주변 몬스터를 밀어내요' : `범위 ${at(WEAPONS.bark.radius, lv)} · 피해 ${at(WEAPONS.bark.damage, lv)}`,
  },
  lightning: {
    id: 'lightning', kind: 'weapon', label: '번개 꼬리', icon: '/survivor/skill-lightning.webp',
    describe: (lv) => lv === 1 ? '화면 안 몬스터에게 번개가 떨어져요' : `번개 ${at(WEAPONS.lightning.count, lv)}개 · 피해 ${at(WEAPONS.lightning.damage, lv)}`,
  },
  frisbee: {
    id: 'frisbee', kind: 'weapon', label: '부메랑 원반', icon: '/survivor/skill-frisbee.webp',
    describe: (lv) => lv === 1 ? '원반이 날아갔다 돌아오며 줄줄이 맞혀요' : `원반 ${at(WEAPONS.frisbee.count, lv)}개 · 피해 ${at(WEAPONS.frisbee.damage, lv)}`,
  },
  bomb: {
    id: 'bomb', kind: 'weapon', label: '간식 폭탄', icon: '/survivor/skill-bomb.webp',
    describe: (lv) => lv === 1 ? '몬스터 무리에 쿠키 폭탄을 던져요' : `폭탄 ${at(WEAPONS.bomb.count, lv)}개 · 피해 ${at(WEAPONS.bomb.damage, lv)}`,
  },
  heart: {
    id: 'heart', kind: 'passive', label: '튼튼 심장', icon: '/survivor/item-heart.webp',
    describe: () => `최대 체력 +${PASSIVES.heart}`,
  },
  shoe: {
    id: 'shoe', kind: 'passive', label: '날쌘 운동화', icon: '/survivor/item-shoe.webp',
    describe: () => `이동 속도 +${Math.round(PASSIVES.shoe * 100)}%`,
  },
  magnet: {
    id: 'magnet', kind: 'passive', label: '보석 자석', icon: '/survivor/item-magnet.webp',
    describe: () => `보석 줍는 거리 +${Math.round(PASSIVES.magnet * 100)}%`,
  },
  clock: {
    id: 'clock', kind: 'passive', label: '빨리빨리 모래시계', icon: '/survivor/item-clock.webp',
    describe: () => `스킬 다시 쓰는 시간 -${Math.round(PASSIVES.clock * 100)}%`,
  },
  shield: {
    id: 'shield', kind: 'passive', label: '발바닥 방패', icon: '/survivor/item-shield.webp',
    describe: () => `받는 피해 -${Math.round(PASSIVES.shield * 100)}%`,
  },
}

export function isWeapon(id: SkillId): id is WeaponId {
  return (WEAPON_IDS as readonly string[]).includes(id)
}

// ─── 몬스터 ───
export type EnemyKind = 'slime' | 'bat' | 'mushroom' | 'ghost' | 'golem' | 'boss'

export const ENEMIES: Record<EnemyKind, { label: string; hp: number; speed: number; radius: number; dps: number; xp: number; score: number; sprite: string }> = {
  slime: { label: '젤리 슬라임', hp: 14, speed: 52, radius: 16, dps: 8, xp: 1, score: 10, sprite: '/survivor/enemy-slime.webp' },
  bat: { label: '꼬마 박쥐', hp: 9, speed: 92, radius: 14, dps: 6, xp: 1, score: 10, sprite: '/survivor/enemy-bat.webp' },
  mushroom: { label: '심술 버섯', hp: 32, speed: 44, radius: 18, dps: 11, xp: 2, score: 20, sprite: '/survivor/enemy-mushroom.webp' },
  ghost: { label: '장난꾸러기 유령', hp: 22, speed: 70, radius: 17, dps: 10, xp: 2, score: 15, sprite: '/survivor/enemy-ghost.webp' },
  golem: { label: '돌멩이 골렘', hp: 80, speed: 36, radius: 24, dps: 16, xp: 4, score: 35, sprite: '/survivor/enemy-golem.webp' },
  boss: { label: '대왕 슬라임', hp: 450, speed: 40, radius: 50, dps: 24, xp: 25, score: 400, sprite: '/survivor/enemy-boss.webp' },
}

/** 전투 시간(초)에 따라 나오는 몬스터 비중 */
function spawnWeights(t: number): Array<[EnemyKind, number]> {
  return [
    ['slime', t < 200 ? 1 : 0.6],
    ['bat', t >= 20 ? 0.8 : 0],
    ['mushroom', t >= 60 ? 0.6 : 0],
    ['ghost', t >= 110 ? 0.7 : 0],
    ['golem', t >= 170 ? 0.35 + Math.min(0.4, (t - 170) / 600) : 0],
  ]
}

/** 1초에 새로 나오는 몬스터 수 */
export function spawnRate(t: number): number {
  return Math.min(12, 1 + t * 0.025)
}

/** 몬스터 체력 배수 */
export function enemyHpMultiplier(t: number): number {
  return 1 + t / 90
}

/** 다음 레벨까지 필요한 경험치 */
export function xpForLevel(level: number): number {
  return Math.round(5 + 3.5 * level + 0.3 * level * level)
}

// ─── 상태 ───
export type Enemy = {
  id: number
  kind: EnemyKind
  x: number
  y: number
  hp: number
  maxHp: number
  speed: number
  radius: number
  dps: number
  /** 맞았을 때 하얗게 번쩍이는 남은 시간 */
  flashMs: number
  /** 밀려나는 속도 */
  kx: number
  ky: number
  /** 빙글빙글 공에 마지막으로 맞은 전투 시각 */
  ballHitAt: number
}

export type Projectile = {
  id: number
  kind: 'bone' | 'frisbee' | 'bomb'
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  pierceLeft: number
  age: number
  /** 이미 맞힌 몬스터 (꿰뚫기·원반 한 바퀴에 한 번) */
  hit: number[]
  /** 원반: 날아간 거리·돌아오는 중 */
  travelled: number
  range: number
  returning: boolean
  /** 폭탄: 출발·도착 지점, 폭발 반경 */
  sx: number
  sy: number
  tx: number
  ty: number
  blast: number
}

export type Effect = {
  id: number
  kind: 'bark' | 'boom' | 'zap' | 'revive' | 'text' | 'levelup'
  x: number
  y: number
  r: number
  age: number
  life: number
  text?: string
  /** 번개 선 흔들림 씨앗 */
  seed?: number
  big?: boolean
}

export type Pickup = {
  id: number
  kind: 'gem' | 'meat' | 'chest'
  x: number
  y: number
  value: number
  pulled: boolean
  age: number
}

export type SurvivorStats = {
  kills: number
  bossKills: number
  revives: number
  levelUps: number
  /** 카드로 얻은 스킬 레벨 합 */
  cards: number
}

export type SurvivorState = {
  /** 전투가 실제로 흐른 시간 (문제 푸는 동안·쓰러져 있는 동안은 멈춘다) */
  battleMs: number
  /** 난이도 시계: 전투 시간과 같이 흐르지만 쓰러지면 조금 되돌아간다. 몬스터 수·체력·점수 배수가 이걸 따른다 */
  diffMs: number
  score: number
  level: number
  xp: number
  xpNeed: number
  /** 아직 문제를 못 푼 레벨업 수. 0 보다 크면 전투가 멈춘다 */
  pendingLevelUps: number
  player: { x: number; y: number; hp: number; maxHp: number; fx: number; fy: number; invulnMs: number; hurtMs: number; dead: boolean }
  skills: Partial<Record<SkillId, number>>
  cooldowns: Partial<Record<WeaponId, number>>
  enemies: Enemy[]
  projectiles: Projectile[]
  effects: Effect[]
  pickups: Pickup[]
  stats: SurvivorStats
  nextId: number
  spawnAcc: number
  nextBossMs: number
  nextRingMs: number
  ringCount: number
}

export type SurvivorSave = {
  v: 1
  score: number
  level: number
  xp: number
  battleMs: number
  diffMs: number
  skills: Partial<Record<SkillId, number>>
  stats: SurvivorStats
}

export type StepInput = { mx: number; my: number }
export type ViewSize = { w: number; h: number }

export type StepEvent =
  | { type: 'levelup' }
  | { type: 'death' }
  | { type: 'boss' }
  | { type: 'bossDown' }
  | { type: 'ring' }
  | { type: 'chest' }
  | { type: 'meat' }
  | { type: 'kill'; count: number }
  | { type: 'hurt' }

const emptyStats = (): SurvivorStats => ({ kills: 0, bossKills: 0, revives: 0, levelUps: 0, cards: 0 })

function maxHpFor(skills: Partial<Record<SkillId, number>>): number {
  return SURVIVOR.PLAYER_MAX_HP + (skills.heart ?? 0) * PASSIVES.heart
}

/** 다음 보스·포위 공격 시각: 지금 전투 시간 뒤의 첫 차례 */
function nextScheduled(first: number, every: number, battleMs: number): number {
  if (battleMs < first) return first
  return first + Math.ceil((battleMs - first + 1) / every) * every
}

/** 새 판(또는 저장값에서 이어서). 저장값이 있으면 같은 레벨·스킬·점수로 몬스터만 새로 시작한다 */
export function createSurvivorState(save?: SurvivorSave | null): SurvivorState {
  const skills = save?.skills && Object.keys(save.skills).length > 0 ? { ...save.skills } : { bone: 1 }
  const battleMs = save?.battleMs ?? 0
  const maxHp = maxHpFor(skills)
  const level = save?.level ?? 1
  return {
    battleMs,
    diffMs: save?.diffMs ?? battleMs,
    score: save?.score ?? 0,
    level,
    xp: save?.xp ?? 0,
    xpNeed: xpForLevel(level),
    pendingLevelUps: 0,
    player: { x: 0, y: 0, hp: maxHp, maxHp, fx: 1, fy: 0, invulnMs: save ? 1500 : 0, hurtMs: 0, dead: false },
    skills,
    cooldowns: {},
    enemies: [],
    projectiles: [],
    effects: [],
    pickups: [],
    stats: { ...emptyStats(), ...(save?.stats ?? {}) },
    nextId: 1,
    spawnAcc: 0,
    nextBossMs: nextScheduled(SURVIVOR.BOSS_FIRST_MS, SURVIVOR.BOSS_EVERY_MS, battleMs),
    nextRingMs: nextScheduled(SURVIVOR.RING_FIRST_MS, SURVIVOR.RING_EVERY_MS, battleMs),
    ringCount: 0,
  }
}

const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

/** players.item_effects → 저장값. 모양이 다르면 null (새 판) */
export function parseSurvivorSave(raw: unknown): SurvivorSave | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<SurvivorSave>
  if (value.v !== 1) return null
  const skills: Partial<Record<SkillId, number>> = {}
  if (value.skills && typeof value.skills === 'object') {
    for (const id of [...WEAPON_IDS, ...PASSIVE_IDS]) {
      const level = num((value.skills as Record<string, unknown>)[id])
      if (level > 0) skills[id] = Math.min(SKILL_MAX_LEVEL, Math.floor(level))
    }
  }
  const stats = (value.stats ?? {}) as Partial<SurvivorStats>
  return {
    v: 1,
    score: Math.max(0, Math.floor(num(value.score))),
    level: Math.max(1, Math.floor(num(value.level, 1))),
    xp: Math.max(0, num(value.xp)),
    battleMs: Math.max(0, num(value.battleMs)),
    diffMs: Math.max(0, num(value.diffMs, num(value.battleMs))),
    skills,
    stats: {
      kills: num(stats.kills),
      bossKills: num(stats.bossKills),
      revives: num(stats.revives),
      levelUps: num(stats.levelUps),
      cards: num(stats.cards),
    },
  }
}

export function toSurvivorSave(state: SurvivorState): SurvivorSave {
  return {
    v: 1,
    score: state.score,
    level: state.level,
    xp: Math.round(state.xp),
    battleMs: Math.round(state.battleMs),
    diffMs: Math.round(state.diffMs),
    skills: { ...state.skills },
    stats: { ...state.stats },
  }
}

/** 화면 크기(px) → 세계 단위로 본 화면 크기와 배율. 어떤 기기든 보이는 넓이가 같다 */
export function viewForScreen(width: number, height: number): ViewSize & { scale: number } {
  const scale = Math.sqrt((Math.max(1, width) * Math.max(1, height)) / SURVIVOR.VIEW_AREA)
  return { w: width / scale, h: height / scale, scale }
}

// ─── 스킬 카드 ───
export type SkillCard = { skillId: SkillId; level: number } | { skillId: 'snack'; level: 0 }

/** 아직 다 못 올린 스킬 중에서 count 장. 새 무기·패시브는 빈 칸이 있을 때만 */
export function drawSkillCards(state: SurvivorState, count: number = SURVIVOR.CHOICES, rng: () => number = Math.random): SkillCard[] {
  const weaponsOwned = WEAPON_IDS.filter((id) => (state.skills[id] ?? 0) > 0).length
  const passivesOwned = PASSIVE_IDS.filter((id) => (state.skills[id] ?? 0) > 0).length
  const pool: Array<{ id: SkillId; weight: number }> = []
  for (const id of [...WEAPON_IDS, ...PASSIVE_IDS]) {
    const level = state.skills[id] ?? 0
    if (level >= SKILL_MAX_LEVEL) continue
    if (level > 0) {
      pool.push({ id, weight: isWeapon(id) ? 3 : 2 })
    } else if (isWeapon(id) ? weaponsOwned < SURVIVOR.WEAPON_SLOTS : passivesOwned < SURVIVOR.PASSIVE_SLOTS) {
      pool.push({ id, weight: isWeapon(id) ? 2.2 : 1.6 })
    }
  }
  const cards: SkillCard[] = []
  while (cards.length < count && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0)
    let roll = rng() * total
    let index = 0
    for (; index < pool.length - 1; index += 1) {
      roll -= pool[index].weight
      if (roll <= 0) break
    }
    const [picked] = pool.splice(index, 1)
    cards.push({ skillId: picked.id, level: (state.skills[picked.id] ?? 0) + 1 })
  }
  if (cards.length === 0) cards.push({ skillId: 'snack', level: 0 })
  return cards
}

/** 카드 적용. 레벨업 대기 하나를 푼다 */
export function applySkillCard(state: SurvivorState, card: SkillCard | null): void {
  state.pendingLevelUps = Math.max(0, state.pendingLevelUps - 1)
  if (!card) return
  if (card.skillId === 'snack') {
    state.player.hp = state.player.maxHp
    state.score += 50
    return
  }
  const id = card.skillId
  state.skills[id] = Math.min(SKILL_MAX_LEVEL, (state.skills[id] ?? 0) + 1)
  state.stats.cards += 1
  if (id === 'heart') {
    state.player.maxHp = maxHpFor(state.skills)
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + PASSIVES.heart)
  }
  if (isWeapon(id) && state.skills[id] === 1) state.cooldowns[id] = 300
}

/** 문제를 맞혀 다시 일어나기: 체력 가득·잠깐 무적·주변 몬스터를 치운다(점수 없음) */
export function reviveSurvivor(state: SurvivorState): void {
  const player = state.player
  player.dead = false
  player.hp = player.maxHp
  player.invulnMs = SURVIVOR.REVIVE_INVULN_MS
  state.stats.revives += 1
  state.diffMs = Math.max(0, state.diffMs - SURVIVOR.REVIVE_EASE_MS)
  const r = SURVIVOR.REVIVE_CLEAR_RADIUS
  state.enemies = state.enemies.filter((enemy) => {
    const dx = enemy.x - player.x
    const dy = enemy.y - player.y
    const d = Math.hypot(dx, dy) || 1
    if (d > r) return true
    if (enemy.kind !== 'boss') return false
    enemy.x = player.x + (dx / d) * (r + 40)
    enemy.y = player.y + (dy / d) * (r + 40)
    return true
  })
  state.projectiles = state.projectiles.filter((p) => p.kind !== 'bomb')
  pushEffect(state, { kind: 'revive', x: player.x, y: player.y, r, life: 700 })
}

// ─── 한 스텝 ───
/** 난이도 계산용 시간(초) */
const elapsedSec = (state: SurvivorState) => state.diffMs / 1000

function pushEffect(state: SurvivorState, effect: Omit<Effect, 'id' | 'age'>) {
  if (effect.kind === 'text' && state.effects.length > 45) return
  state.effects.push({ ...effect, id: state.nextId++, age: 0 })
}

function spawnEnemy(state: SurvivorState, kind: EnemyKind, x: number, y: number) {
  const def = ENEMIES[kind]
  const t = elapsedSec(state)
  const hpMul = kind === 'boss' ? 1 + t / 150 : enemyHpMultiplier(t)
  const hp = Math.round(def.hp * hpMul)
  state.enemies.push({
    id: state.nextId++, kind, x, y, hp, maxHp: hp,
    speed: def.speed * (1 + t / 1200),
    radius: def.radius, dps: def.dps, flashMs: 0, kx: 0, ky: 0, ballHitAt: -1e9,
  })
}

function spawnRingRadius(view: ViewSize) {
  return Math.hypot(view.w / 2, view.h / 2) + 40
}

function pickKind(t: number, rng: () => number): EnemyKind {
  const weights = spawnWeights(t).filter(([, w]) => w > 0)
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [kind, w] of weights) {
    roll -= w
    if (roll <= 0) return kind
  }
  return 'slime'
}

function dropLoot(state: SurvivorState, enemy: Enemy, rng: () => number) {
  const def = ENEMIES[enemy.kind]
  if (enemy.kind === 'boss') {
    state.pickups.push({ id: state.nextId++, kind: 'chest', x: enemy.x, y: enemy.y, value: 1, pulled: false, age: 0 })
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2
      state.pickups.push({ id: state.nextId++, kind: 'gem', x: enemy.x + Math.cos(a) * 46, y: enemy.y + Math.sin(a) * 46, value: Math.ceil(def.xp / 8) + 1, pulled: false, age: 0 })
    }
    return
  }
  if (rng() < SURVIVOR.MEAT_CHANCE) {
    state.pickups.push({ id: state.nextId++, kind: 'meat', x: enemy.x, y: enemy.y, value: 1, pulled: false, age: 0 })
  }
  const gems = state.pickups.filter((p) => p.kind === 'gem')
  if (gems.length >= SURVIVOR.GEM_CAP) {
    // 보석이 너무 많으면 새로 떨구지 않고 아무 보석 하나를 키운다
    gems[Math.floor(rng() * gems.length)].value += def.xp
    return
  }
  state.pickups.push({ id: state.nextId++, kind: 'gem', x: enemy.x, y: enemy.y, value: def.xp, pulled: false, age: 0 })
}

function damageEnemy(state: SurvivorState, enemy: Enemy, damage: number, kx: number, ky: number, knock: number) {
  if (enemy.hp <= 0) return
  enemy.hp -= damage
  enemy.flashMs = 90
  const resist = enemy.kind === 'boss' ? 0.12 : enemy.kind === 'golem' ? 0.5 : 1
  const d = Math.hypot(kx, ky) || 1
  enemy.kx += (kx / d) * knock * resist
  enemy.ky += (ky / d) * knock * resist
  pushEffect(state, { kind: 'text', x: enemy.x + (Math.random() - 0.5) * 10, y: enemy.y - enemy.radius, r: 0, life: 600, text: String(Math.round(damage)), big: damage >= 30 })
}

function nearestEnemy(state: SurvivorState, x: number, y: number, maxDist: number): Enemy | null {
  let best: Enemy | null = null
  let bestD = maxDist * maxDist
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue
    const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = enemy
    }
  }
  return best
}

function cooldownMultiplier(state: SurvivorState) {
  return Math.max(0.5, 1 - (state.skills.clock ?? 0) * PASSIVES.clock)
}

function fireWeapon(state: SurvivorState, id: WeaponId, level: number, view: ViewSize, rng: () => number): boolean {
  const p = state.player
  switch (id) {
    case 'bone': {
      const target = nearestEnemy(state, p.x, p.y, 560)
      if (!target) return false
      const base = Math.atan2(target.y - p.y, target.x - p.x)
      const count = at(WEAPONS.bone.count, level)
      for (let i = 0; i < count; i += 1) {
        const a = base + (i - (count - 1) / 2) * 0.16
        state.projectiles.push(makeProjectile(state, 'bone', p.x, p.y, Math.cos(a) * BONE_SPEED, Math.sin(a) * BONE_SPEED, at(WEAPONS.bone.damage, level), 11, at(WEAPONS.bone.pierce, level)))
      }
      return true
    }
    case 'bark': {
      const radius = at(WEAPONS.bark.radius, level)
      const damage = at(WEAPONS.bark.damage, level)
      for (const enemy of state.enemies) {
        const dx = enemy.x - p.x
        const dy = enemy.y - p.y
        if (dx * dx + dy * dy <= (radius + enemy.radius) ** 2) damageEnemy(state, enemy, damage, dx, dy, BARK_KNOCKBACK)
      }
      pushEffect(state, { kind: 'bark', x: p.x, y: p.y, r: radius, life: 380 })
      return true
    }
    case 'lightning': {
      const halfW = view.w / 2
      const halfH = view.h / 2
      const inView = state.enemies.filter((e) => e.hp > 0 && Math.abs(e.x - p.x) < halfW && Math.abs(e.y - p.y) < halfH)
      if (inView.length === 0) return false
      const count = at(WEAPONS.lightning.count, level)
      for (let i = 0; i < count && inView.length > 0; i += 1) {
        const [target] = inView.splice(Math.floor(rng() * inView.length), 1)
        damageEnemy(state, target, at(WEAPONS.lightning.damage, level), target.x - p.x, target.y - p.y, LIGHTNING_KNOCKBACK)
        pushEffect(state, { kind: 'zap', x: target.x, y: target.y, r: 26, life: 260, seed: Math.floor(rng() * 1e6) })
      }
      return true
    }
    case 'frisbee': {
      const target = nearestEnemy(state, p.x, p.y, 520)
      const base = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.fy, p.fx)
      const count = at(WEAPONS.frisbee.count, level)
      for (let i = 0; i < count; i += 1) {
        const a = base + (i * Math.PI * 2) / count
        const proj = makeProjectile(state, 'frisbee', p.x, p.y, Math.cos(a) * FRISBEE_SPEED, Math.sin(a) * FRISBEE_SPEED, at(WEAPONS.frisbee.damage, level), 16, 999)
        proj.range = at(WEAPONS.frisbee.range, level)
        state.projectiles.push(proj)
      }
      return true
    }
    case 'bomb': {
      const near = state.enemies.filter((e) => e.hp > 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 < BOMB_RANGE * BOMB_RANGE)
      const count = at(WEAPONS.bomb.count, level)
      for (let i = 0; i < count; i += 1) {
        let tx: number
        let ty: number
        if (near.length > 0) {
          const target = near[Math.floor(rng() * near.length)]
          tx = target.x
          ty = target.y
        } else {
          const a = rng() * Math.PI * 2
          tx = p.x + Math.cos(a) * 160
          ty = p.y + Math.sin(a) * 160
        }
        const proj = makeProjectile(state, 'bomb', p.x, p.y, 0, 0, at(WEAPONS.bomb.damage, level), 0, 0)
        proj.sx = p.x
        proj.sy = p.y
        proj.tx = tx
        proj.ty = ty
        proj.blast = at(WEAPONS.bomb.blast, level)
        state.projectiles.push(proj)
      }
      return true
    }
    default:
      return true
  }
}

function makeProjectile(state: SurvivorState, kind: Projectile['kind'], x: number, y: number, vx: number, vy: number, damage: number, radius: number, pierce: number): Projectile {
  return {
    id: state.nextId++, kind, x, y, vx, vy, damage, radius, pierceLeft: pierce, age: 0, hit: [],
    travelled: 0, range: 0, returning: false, sx: x, sy: y, tx: x, ty: y, blast: 0,
  }
}

/** 빙글빙글 공 위치 (그리기에도 쓴다) */
export function ballPositions(state: SurvivorState): Array<{ x: number; y: number }> {
  const level = state.skills.ball ?? 0
  if (level <= 0) return []
  const count = at(WEAPONS.ball.count, level)
  const orbit = at(WEAPONS.ball.orbit, level)
  const base = (state.battleMs / 1000) * at(WEAPONS.ball.spin, level)
  return Array.from({ length: count }, (_, i) => {
    const a = base + (i * Math.PI * 2) / count
    return { x: state.player.x + Math.cos(a) * orbit, y: state.player.y + Math.sin(a) * orbit }
  })
}

export const BALL_RADIUS = 13

/**
 * 고정 스텝 하나. 레벨업 문제를 기다리거나 쓰러져 있으면 아무것도 하지 않는다.
 * 돌려주는 이벤트로 화면이 소리·알림·퀴즈를 띄운다.
 */
export function stepSurvivor(state: SurvivorState, dtMs: number, input: StepInput, view: ViewSize, rng: () => number = Math.random): StepEvent[] {
  const events: StepEvent[] = []
  const p = state.player
  if (state.pendingLevelUps > 0 || p.dead) return events
  const dt = dtMs / 1000
  state.battleMs += dtMs
  state.diffMs += dtMs
  const t = elapsedSec(state)

  // 1) 이동
  let mx = input.mx
  let my = input.my
  const mag = Math.hypot(mx, my)
  if (mag > 1) {
    mx /= mag
    my /= mag
  }
  const speed = SURVIVOR.PLAYER_SPEED * (1 + (state.skills.shoe ?? 0) * PASSIVES.shoe)
  p.x += mx * speed * dt
  p.y += my * speed * dt
  if (mag > 0.15) {
    const m = Math.hypot(mx, my) || 1
    p.fx = mx / m
    p.fy = my / m
  }
  p.invulnMs = Math.max(0, p.invulnMs - dtMs)
  p.hurtMs = Math.max(0, p.hurtMs - dtMs)

  // 2) 몬스터 나오기
  const ringR = spawnRingRadius(view)
  state.spawnAcc += spawnRate(t) * dt
  while (state.spawnAcc >= 1) {
    state.spawnAcc -= 1
    if (state.enemies.length >= SURVIVOR.ENEMY_CAP) {
      state.spawnAcc = 0
      break
    }
    const a = rng() * Math.PI * 2
    spawnEnemy(state, pickKind(t, rng), p.x + Math.cos(a) * ringR, p.y + Math.sin(a) * ringR)
  }
  if (state.battleMs >= state.nextRingMs) {
    state.nextRingMs += SURVIVOR.RING_EVERY_MS
    state.ringCount += 1
    const count = Math.min(40, 16 + Math.floor(t / 15))
    const kind: EnemyKind = state.ringCount % 2 === 1 ? 'bat' : 'slime'
    const room = Math.max(0, SURVIVOR.ENEMY_CAP + 20 - state.enemies.length)
    for (let i = 0; i < Math.min(count, room); i += 1) {
      const a = (i / count) * Math.PI * 2
      spawnEnemy(state, kind, p.x + Math.cos(a) * (ringR - 20), p.y + Math.sin(a) * (ringR - 20))
    }
    events.push({ type: 'ring' })
  }
  if (state.battleMs >= state.nextBossMs) {
    state.nextBossMs += SURVIVOR.BOSS_EVERY_MS
    const a = rng() * Math.PI * 2
    spawnEnemy(state, 'boss', p.x + Math.cos(a) * ringR, p.y + Math.sin(a) * ringR)
    events.push({ type: 'boss' })
  }

  // 3) 몬스터 움직이기 (멀리 떨어진 몬스터는 반대편으로 옮겨 다시 쫓아오게)
  const farR = ringR * 1.5
  const damp = Math.exp(-dt * 9)
  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x
    const dy = p.y - enemy.y
    const d = Math.hypot(dx, dy) || 1
    if (d > farR && enemy.kind !== 'boss') {
      enemy.x = p.x + (dx / d) * ringR
      enemy.y = p.y + (dy / d) * ringR
      continue
    }
    enemy.x += (dx / d) * enemy.speed * dt + enemy.kx * dt
    enemy.y += (dy / d) * enemy.speed * dt + enemy.ky * dt
    enemy.kx *= damp
    enemy.ky *= damp
    enemy.flashMs = Math.max(0, enemy.flashMs - dtMs)
  }
  // 겹치지 않게 살짝 밀어내기
  const list = state.enemies
  for (let i = 0; i < list.length; i += 1) {
    const a = list[i]
    for (let j = i + 1; j < list.length; j += 1) {
      const b = list[j]
      const min = (a.radius + b.radius) * 0.8
      const dx = b.x - a.x
      if (dx > min || dx < -min) continue
      const dy = b.y - a.y
      if (dy > min || dy < -min) continue
      const d2 = dx * dx + dy * dy
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const push = (min - d) * 0.5
      const wa = a.kind === 'boss' ? 0.1 : b.kind === 'boss' ? 1.9 : 1
      const wb = 2 - wa
      a.x -= (dx / d) * push * wa
      a.y -= (dy / d) * push * wa
      b.x += (dx / d) * push * wb
      b.y += (dy / d) * push * wb
    }
  }

  // 4) 몸으로 부딪히면 체력이 준다
  if (p.invulnMs <= 0) {
    let damage = 0
    for (const enemy of state.enemies) {
      const r = enemy.radius + SURVIVOR.PLAYER_RADIUS - 6
      if ((enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2 < r * r) damage += enemy.dps * dt
    }
    if (damage > 0) {
      damage *= Math.max(0.4, 1 - (state.skills.shield ?? 0) * PASSIVES.shield)
      p.hp -= damage
      if (p.hurtMs <= 0) events.push({ type: 'hurt' })
      p.hurtMs = 160
      if (p.hp <= 0) {
        p.hp = 0
        p.dead = true
        events.push({ type: 'death' })
        return events
      }
    }
  }

  // 5) 무기
  const cdMul = cooldownMultiplier(state)
  for (const id of WEAPON_IDS) {
    const level = state.skills[id] ?? 0
    if (level <= 0 || id === 'ball') continue
    const left = (state.cooldowns[id] ?? 0) - dtMs
    if (left > 0) {
      state.cooldowns[id] = left
      continue
    }
    const fired = fireWeapon(state, id, level, view, rng)
    const base = (WEAPONS[id] as { cooldown: readonly number[] }).cooldown
    state.cooldowns[id] = fired ? at(base, level) * cdMul : 200
  }
  const ballLevel = state.skills.ball ?? 0
  if (ballLevel > 0) {
    const damage = at(WEAPONS.ball.damage, ballLevel)
    for (const ball of ballPositions(state)) {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || state.battleMs - enemy.ballHitAt < BALL_HIT_INTERVAL_MS) continue
        const r = enemy.radius + BALL_RADIUS
        if ((enemy.x - ball.x) ** 2 + (enemy.y - ball.y) ** 2 < r * r) {
          enemy.ballHitAt = state.battleMs
          damageEnemy(state, enemy, damage, enemy.x - p.x, enemy.y - p.y, 140)
        }
      }
    }
  }

  // 6) 날아가는 것들
  const keep: Projectile[] = []
  for (const proj of state.projectiles) {
    proj.age += dtMs
    if (proj.kind === 'bomb') {
      const k = Math.min(1, proj.age / BOMB_FLIGHT_MS)
      proj.x = proj.sx + (proj.tx - proj.sx) * k
      proj.y = proj.sy + (proj.ty - proj.sy) * k
      if (k < 1) {
        keep.push(proj)
        continue
      }
      for (const enemy of state.enemies) {
        const r = proj.blast + enemy.radius
        if ((enemy.x - proj.x) ** 2 + (enemy.y - proj.y) ** 2 < r * r) damageEnemy(state, enemy, proj.damage, enemy.x - proj.x, enemy.y - proj.y, 160)
      }
      pushEffect(state, { kind: 'boom', x: proj.x, y: proj.y, r: proj.blast, life: 420 })
      continue
    }
    if (proj.kind === 'frisbee') {
      if (!proj.returning) {
        proj.x += proj.vx * dt
        proj.y += proj.vy * dt
        proj.travelled += FRISBEE_SPEED * dt
        if (proj.travelled >= proj.range) {
          proj.returning = true
          proj.hit = []
        }
      } else {
        const dx = p.x - proj.x
        const dy = p.y - proj.y
        const d = Math.hypot(dx, dy) || 1
        if (d < 20) continue
        proj.x += (dx / d) * FRISBEE_RETURN_SPEED * dt
        proj.y += (dy / d) * FRISBEE_RETURN_SPEED * dt
      }
      if (proj.age > 4000) continue
    } else {
      proj.x += proj.vx * dt
      proj.y += proj.vy * dt
      if (proj.age > BONE_LIFE_MS) continue
    }
    let alive = true
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || proj.hit.includes(enemy.id)) continue
      const r = enemy.radius + proj.radius
      if ((enemy.x - proj.x) ** 2 + (enemy.y - proj.y) ** 2 >= r * r) continue
      proj.hit.push(enemy.id)
      damageEnemy(state, enemy, proj.damage, proj.kind === 'bone' ? proj.vx : enemy.x - proj.x, proj.kind === 'bone' ? proj.vy : enemy.y - proj.y, proj.kind === 'bone' ? 90 : 120)
      proj.pierceLeft -= 1
      if (proj.pierceLeft <= 0) {
        alive = false
        break
      }
    }
    if (alive) keep.push(proj)
  }
  state.projectiles = keep

  // 7) 쓰러진 몬스터 → 점수·보석
  let killed = 0
  if (state.enemies.some((enemy) => enemy.hp <= 0)) {
    const scoreMul = 1 + t / 240
    state.enemies = state.enemies.filter((enemy) => {
      if (enemy.hp > 0) return true
      killed += 1
      state.stats.kills += 1
      state.score += Math.round(ENEMIES[enemy.kind].score * scoreMul)
      if (enemy.kind === 'boss') {
        state.stats.bossKills += 1
        events.push({ type: 'bossDown' })
      }
      dropLoot(state, enemy, rng)
      return false
    })
  }
  if (killed > 0) events.push({ type: 'kill', count: killed })

  // 8) 줍기
  const pickupR = SURVIVOR.PICKUP_RADIUS * (1 + (state.skills.magnet ?? 0) * PASSIVES.magnet)
  const collectR = SURVIVOR.PLAYER_RADIUS + 8
  state.pickups = state.pickups.filter((item) => {
    item.age += dtMs
    const dx = p.x - item.x
    const dy = p.y - item.y
    const d = Math.hypot(dx, dy)
    if (d < collectR) {
      if (item.kind === 'gem') state.xp += item.value
      if (item.kind === 'meat') {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * SURVIVOR.MEAT_HEAL)
        events.push({ type: 'meat' })
      }
      if (item.kind === 'chest') {
        state.pendingLevelUps += 1
        state.stats.levelUps += 1
        p.hp = p.maxHp
        events.push({ type: 'chest' })
      }
      return false
    }
    if (item.pulled || d < pickupR || (item.kind === 'gem' && item.age > SURVIVOR.GEM_AUTO_PULL_MS)) {
      item.pulled = true
      const pull = (380 + Math.max(0, 260 - d)) * dt
      item.x += (dx / (d || 1)) * Math.min(d, pull)
      item.y += (dy / (d || 1)) * Math.min(d, pull)
    }
    return true
  })

  // 9) 레벨업
  let leveled = false
  while (state.xp >= state.xpNeed) {
    state.xp -= state.xpNeed
    state.level += 1
    state.xpNeed = xpForLevel(state.level)
    state.pendingLevelUps += 1
    state.stats.levelUps += 1
    leveled = true
  }
  if (leveled) {
    pushEffect(state, { kind: 'levelup', x: p.x, y: p.y, r: 60, life: 600 })
    events.push({ type: 'levelup' })
  }

  // 10) 효과 나이 먹기
  state.effects = state.effects.filter((effect) => {
    effect.age += dtMs
    return effect.age < effect.life
  })

  return events
}

// ─── 결과·칭호 ───
export type SurvivorTitle = { id: string; emoji: string; label: string; description: string }

type TitlePlayer = { id: string; is_kicked?: boolean | null; score?: number | null; item_effects?: unknown }

const TITLES: Record<string, SurvivorTitle> = {
  champion: { id: 'champion', emoji: '🏆', label: '최강 생존자', description: '점수가 가장 높아요' },
  hunter: { id: 'hunter', emoji: '⚔️', label: '몬스터 사냥꾼', description: '몬스터를 가장 많이 물리쳤어요' },
  bossHunter: { id: 'bossHunter', emoji: '👑', label: '보스 헌터', description: '대왕 슬라임을 가장 많이 물리쳤어요' },
  grower: { id: 'grower', emoji: '📈', label: '쑥쑥 성장왕', description: '레벨이 가장 높아요' },
  collector: { id: 'collector', emoji: '🎒', label: '스킬 수집가', description: '스킬을 가장 많이 모았어요' },
}

const totalSkillLevels = (save: SurvivorSave) => Object.values(save.skills).reduce((sum, level) => sum + (level ?? 0), 0)

/** 가장 높이 올린 무기로 붙는 칭호 — 모든 참가자가 하나는 받는다 */
function favoriteTitle(save: SurvivorSave): SurvivorTitle {
  let best: WeaponId = 'bone'
  for (const id of WEAPON_IDS) if ((save.skills[id] ?? 0) > (save.skills[best] ?? 0)) best = id
  const def = SKILLS[best]
  return { id: `fav-${best}`, emoji: '🐶', label: `${def.label} 달인`, description: `${withJosa(def.label, '을/를')} 가장 많이 키웠어요` }
}

export function assignTitles(players: TitlePlayer[]): Map<string, SurvivorTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const saveById = new Map(active.map((player) => [player.id, parseSurvivorSave(player.item_effects) ?? toSurvivorSave(createSurvivorState())]))
  const result = new Map<string, SurvivorTitle[]>(active.map((player) => [player.id, []]))
  const rules: Array<[string, (save: SurvivorSave) => number]> = [
    ['champion', (save) => save.score],
    ['hunter', (save) => save.stats.kills],
    ['bossHunter', (save) => save.stats.bossKills],
    ['grower', (save) => save.level - 1],
    ['collector', (save) => totalSkillLevels(save) - 1],
  ]
  for (const [id, value] of rules) {
    let best = 0
    for (const save of saveById.values()) best = Math.max(best, value(save))
    if (best <= 0) continue
    for (const [playerId, save] of saveById) {
      if (value(save) === best) result.get(playerId)!.push(TITLES[id])
    }
  }
  for (const [playerId, save] of saveById) {
    const titles = result.get(playerId)!
    if (titles.length === 0) titles.push(favoriteTitle(save))
  }
  return result
}

export function formatBattleTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function summarizeSurvivor(save: SurvivorSave): Array<{ label: string; value: string }> {
  return [
    { label: '물리친 몬스터', value: `${save.stats.kills.toLocaleString()}마리` },
    { label: '최고 레벨', value: `Lv.${save.level}` },
    { label: '버틴 시간', value: formatBattleTime(save.battleMs) },
    { label: '대왕 슬라임', value: `${save.stats.bossKills}마리` },
  ]
}
