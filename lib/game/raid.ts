// 황제 펭귄을 막아라! (Emperor Penguin Raid) — 협동 보스 레이드의 규칙·상수·유도 상태
//
// 설계 원칙: 보스 상태를 서버에 따로 두지 않는다. 모든 화면(학생·선생님)이 players 행만 보고
// 같은 보스를 계산하므로, 실시간 이벤트가 하나 유실돼도 다음 스냅샷에서 저절로 맞춰진다.
//   players.score        = 그 학생이 지금까지 입힌 데미지 합. 보스 체력 = 최대 체력 − 전원 score 합
//   players.gold         = 명중(정답) 횟수. 결과 화면의 "기여"용
//   players.defense      = 마지막으로 기여한 방패 번호(보스 순번 + 1, 단조 증가). 방패를 깬 "서로 다른 친구 수"를 센다
//   players.combo_count  = 현재 연속 정답 수 (연출용. 본인 행만 쓴다)
//   players.player_class = 역할(RaidRole)
// 데미지 누적은 apply_player_delta(원자적 증분)로만 쓴다 — 동시 정답이 유실되지 않는다.
// 시간 이벤트(집중 공격)는 room.started_at 기준 시각표라 서버 없이 전원이 같은 순간에 본다.
//
// 낙인 방지: 보스는 틀린 학생 때문에 공격하지 않는다(시간표대로만). 화면에는 기여(데미지)만 보이고,
// 방패가 안 깨질 때도 "누가 안 때렸는지"가 아니라 "친구 N명이 더 때리면 깨져요"로만 알린다.

import type { Json } from '@/types/database.types'

// ─── 역할 ───

export type RaidRole = 'warrior' | 'mage' | 'guardian'

export type RaidRoleInfo = {
  id: RaidRole
  name: string
  /** 좁은 칸(폰 HUD)용 짧은 이름 */
  shortName: string
  tagline: string
  description: string
  /** 기본 데미지 배율 */
  damageMultiplier: number
  /** 연속 정답 보너스 배율 */
  comboMultiplier: number
  /** 방패를 깎는 칸 수 (한 방패에 한 번만 기여) */
  shieldPower: number
}

export const RAID_ROLES: Record<RaidRole, RaidRoleInfo> = {
  warrior: {
    id: 'warrior',
    name: '얼음 전사',
    shortName: '전사',
    tagline: '강한 한 방',
    description: '정답마다 펭귄을 더 세게 때려요.',
    damageMultiplier: 1.2,
    comboMultiplier: 1,
    shieldPower: 1,
  },
  mage: {
    id: 'mage',
    name: '오로라 마법사',
    shortName: '마법사',
    tagline: '연속 정답',
    description: '연속으로 맞히면 보너스 데미지가 2배로 커져요.',
    damageMultiplier: 1,
    comboMultiplier: 2,
    shieldPower: 1,
  },
  guardian: {
    id: 'guardian',
    name: '빙하 수호자',
    shortName: '수호자',
    tagline: '방패 전문',
    description: '펭귄의 얼음 방패를 한 번에 2칸 깨요.',
    damageMultiplier: 1,
    comboMultiplier: 1,
    shieldPower: 2,
  },
}

export const RAID_ROLE_ORDER: readonly RaidRole[] = ['warrior', 'mage', 'guardian']

export function isRaidRole(value: unknown): value is RaidRole {
  return value === 'warrior' || value === 'mage' || value === 'guardian'
}

// ─── 밸런스 상수 ───

export const RAID = {
  /** 정답 1개의 기본 데미지 */
  BASE_DAMAGE: 10,
  /** 연속 정답 보너스 — 낮은 연속수부터. 그 연속수 이상이면 그 보너스를 더한다 */
  COMBO_STEPS: [
    { streak: 3, bonus: 5 },
    { streak: 5, bonus: 10 },
    { streak: 8, bonus: 15 },
  ],
  /** 집중 공격: 시작 60초 뒤 처음, 그 뒤 90초마다 15초 동안 데미지 2배 */
  FRENZY_FIRST_AT: 60,
  FRENZY_PERIOD: 90,
  FRENZY_DURATION: 15,
  FRENZY_MULTIPLIER: 2,
  /** 보스 체력이 이 비율 이하로 떨어지면 얼음 방패가 올라온다 */
  SHIELD_HP_RATIO: 0.5,
  /** 방패를 깨는 데 필요한 "서로 다른 친구" 비율 (참가자 수 × 비율, 올림, 최소 1) */
  SHIELD_REQUIRED_RATIO: 0.5,
  /** 보스 체력 = 참가자 수 × 이 값 (첫 보스). 뒤로 갈수록 HP_GROWTH 배 */
  HP_PER_PLAYER: 32,
  HP_GROWTH: 1.25,
  /** 마지막 황제 펭귄은 한 번 더 세다 */
  EMPEROR_HP_BONUS: 1.4,
  /** 혼자 테스트해도 게임이 성립하는 최소 체력 */
  MIN_BOSS_HP: 150,
  /** 문제당 제한 시간 (초) */
  QUESTION_TIME_LIMIT: 30,
  /** 정답 뒤 다음 문제까지 (ms). 반 전체 템포를 위해 짧게 */
  NEXT_QUESTION_DELAY_MS: 1100,
  /** 오답 뒤 정답을 보여주는 시간 (ms) */
  WRONG_ANSWER_DELAY_MS: 2500,
} as const

/** 선생님이 고르는 펭귄(보스) 수 */
export const RAID_BOSS_COUNT_OPTIONS = [2, 3, 5] as const
export const DEFAULT_RAID_BOSS_COUNT = 3

// ─── 방 옵션 (rooms.settings.raid) ───

export type RaidSettings = {
  /** 쓰러뜨려야 할 펭귄 수 (마지막은 항상 황제 펭귄) */
  bossCount: number
  /** 시작 때 참가자 수. 보스 체력의 기준이라 시작 뒤 입장해도 체력이 흔들리지 않는다. 0이면 현재 인원 */
  playerCount: number
}

export const DEFAULT_RAID_SETTINGS: RaidSettings = {
  bossCount: DEFAULT_RAID_BOSS_COUNT,
  playerCount: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toCount(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/** rooms.settings 에서 레이드 옵션을 읽는다. 없거나 깨져 있으면 기본값 */
export function parseRaidSettings(settings: unknown): RaidSettings {
  const raid = isRecord(settings) && isRecord(settings.raid) ? settings.raid : null
  if (!raid) return { ...DEFAULT_RAID_SETTINGS }
  return {
    bossCount: toCount(raid.bossCount, DEFAULT_RAID_BOSS_COUNT),
    playerCount: toCount(raid.playerCount, 0),
  }
}

/** 기존 rooms.settings 를 보존한 채 레이드 옵션만 덮어쓴 값 */
export function buildRaidRoomSettings(raid: RaidSettings, existing: Json | null | undefined): Json {
  return {
    ...(isRecord(existing) ? existing : {}),
    raid: { bossCount: raid.bossCount, playerCount: raid.playerCount },
  }
}

// ─── 보스 명단 ───

export type RaidBossSprite = 'guard' | 'knight' | 'general' | 'emperor'

export type RaidBossDef = {
  index: number
  name: string
  sprite: RaidBossSprite
  maxHp: number
  isFinal: boolean
}

const SOLDIER_LINEUP: Array<{ name: string; sprite: RaidBossSprite }> = [
  { name: '펭귄 경비병', sprite: 'guard' },
  { name: '펭귄 기사', sprite: 'knight' },
  { name: '펭귄 장군', sprite: 'general' },
  { name: '펭귄 대장군', sprite: 'general' },
]

/** 병사 수별로 SOLDIER_LINEUP 에서 고르는 순번 */
const SOLDIER_PICKS: Record<number, number[]> = {
  1: [2],
  2: [0, 2],
  3: [0, 1, 2],
  4: [0, 1, 2, 3],
}

const EMPEROR = { name: '황제 펭귄', sprite: 'emperor' as const }

function roundTo10(value: number): number {
  return Math.max(10, Math.round(value / 10) * 10)
}

/** 보스 체력의 기준 인원. 시작 때 저장된 인원이 없으면(옛 방) 현재 인원을 쓴다 */
export function resolveRaidPlayerCount(settings: RaidSettings, activePlayerCount: number): number {
  return Math.max(1, settings.playerCount > 0 ? settings.playerCount : activePlayerCount)
}

/**
 * 쓰러뜨려야 할 펭귄 목록. 앞은 병사들, 마지막은 항상 황제 펭귄.
 * 체력은 참가자 수에 비례하고 뒤로 갈수록 세진다. 5분·25명 기준으로 3마리를 1분쯤 남기고 잡도록 맞췄다.
 */
export function getRaidBossRoster(settings: RaidSettings, activePlayerCount: number): RaidBossDef[] {
  const count = Math.max(1, settings.bossCount)
  const playerCount = resolveRaidPlayerCount(settings, activePlayerCount)
  const baseHp = Math.max(RAID.MIN_BOSS_HP, playerCount * RAID.HP_PER_PLAYER)

  // 병사 수에 맞게 고른다. 2마리면 장군→황제, 3마리면 경비병→장군→황제, 5마리면 넷 다.
  const soldierCount = count - 1
  const picks = SOLDIER_PICKS[soldierCount]
    ?? Array.from({ length: soldierCount }, (_, i) => Math.min(i, SOLDIER_LINEUP.length - 1))
  const soldiers = picks.map((i) => SOLDIER_LINEUP[i])

  return [...soldiers, EMPEROR].map((entry, index) => {
    const isFinal = index === count - 1
    const grown = baseHp * Math.pow(RAID.HP_GROWTH, index)
    return {
      index,
      name: entry.name,
      sprite: entry.sprite,
      maxHp: roundTo10(isFinal ? grown * RAID.EMPEROR_HP_BONUS : grown),
      isFinal,
    }
  })
}

// ─── 유도 상태 ───

export type RaidPlayerLike = {
  id: string
  nickname: string
  score?: number | null
  gold?: number | null
  defense?: number | null
  combo_count?: number | null
  player_class?: string | null
  is_kicked?: boolean | null
}

export type RaidShieldState = {
  /** 체력이 기준 이하로 떨어져 방패가 올라와 있는지 */
  active: boolean
  /** 충분한 친구가 기여해 방패가 깨졌는지 */
  broken: boolean
  /** 지금까지 깎은 칸 수 */
  points: number
  /** 깨는 데 필요한 칸 수 */
  required: number
  /** 더 필요한 칸 수 */
  remaining: number
}

export type RaidBossState = {
  def: RaidBossDef
  /** 이 보스가 받은 데미지 (최대 체력까지) */
  damage: number
  /** 화면에 보여줄 남은 체력. 방패가 버티는 동안은 1 아래로 내려가지 않는다 */
  hp: number
  hpRatio: number
  shield: RaidShieldState
  defeated: boolean
}

export type RaidState = {
  roster: RaidBossDef[]
  bosses: RaidBossState[]
  /** 전원이 입힌 데미지 합 */
  totalDamage: number
  /** 전원의 명중 수 합 */
  totalHits: number
  totalMaxHp: number
  defeatedCount: number
  allDefeated: boolean
  /** 지금 싸우는 보스. 전부 쓰러뜨렸으면 null */
  current: RaidBossState | null
  activePlayerCount: number
}

export function getRaidRole(player: Pick<RaidPlayerLike, 'player_class'> | null | undefined): RaidRole | null {
  return player && isRaidRole(player.player_class) ? player.player_class : null
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 참가자 수 기준으로 방패를 깨는 데 필요한 칸 수 */
export function getShieldRequired(activePlayerCount: number): number {
  return Math.max(1, Math.ceil(activePlayerCount * RAID.SHIELD_REQUIRED_RATIO))
}

/**
 * players 행에서 보스 상태를 유도한다. 입력이 같으면 어느 화면에서 계산해도 결과가 같다.
 * 보스는 순서대로 쓰러진다: 앞 보스가 살아 있으면 뒤 보스는 손대지 않은 상태.
 * 데미지가 최대 체력을 넘어도 방패가 안 깨졌으면 체력 1로 버티고, 깨지는 순간 넘친 데미지는 다음 보스로 흘러간다.
 */
export function computeRaidState(players: RaidPlayerLike[], settings: RaidSettings): RaidState {
  const active = players.filter((player) => !player.is_kicked)
  const roster = getRaidBossRoster(settings, active.length)
  const totalDamage = active.reduce((sum, player) => sum + Math.max(0, toNumber(player.score)), 0)
  const totalHits = active.reduce((sum, player) => sum + Math.max(0, toNumber(player.gold)), 0)
  const required = getShieldRequired(active.length)

  const bosses: RaidBossState[] = []
  let cumulative = 0
  let previousDefeated = true
  let current: RaidBossState | null = null

  for (const def of roster) {
    if (!previousDefeated) {
      bosses.push({
        def,
        damage: 0,
        hp: def.maxHp,
        hpRatio: 1,
        shield: { active: false, broken: false, points: 0, required, remaining: required },
        defeated: false,
      })
      continue
    }

    const rawDamage = Math.max(0, totalDamage - cumulative)
    const damage = Math.min(def.maxHp, rawDamage)
    const shieldThreshold = def.maxHp * (1 - RAID.SHIELD_HP_RATIO)
    // defense 는 "마지막으로 기여한 방패 번호"라 단조 증가한다. 뒤 보스에 기여했다는 건 앞 보스가
    // 이미 쓰러진 뒤였다는 뜻이므로 앞 보스의 기여로도 친다(>=). 정확히 같은 번호만 세면
    // 다음 보스 방패에 기여하는 순간 앞 보스의 기여가 사라져 잡은 보스가 되살아난다.
    const points = active.reduce((sum, player) => {
      if (toNumber(player.defense) < def.index + 1) return sum
      const role = getRaidRole(player)
      return sum + (role ? RAID_ROLES[role].shieldPower : 1)
    }, 0)
    const broken = points >= required
    const shieldActive = damage >= shieldThreshold && !broken
    const defeated = rawDamage >= def.maxHp && broken
    const hp = defeated ? 0 : Math.max(shieldActive ? 1 : 0, def.maxHp - damage)
    const state: RaidBossState = {
      def,
      damage,
      hp,
      hpRatio: def.maxHp > 0 ? hp / def.maxHp : 0,
      shield: {
        active: shieldActive,
        broken,
        points: Math.min(points, required),
        required,
        remaining: Math.max(0, required - points),
      },
      defeated,
    }
    bosses.push(state)

    if (defeated) {
      cumulative += def.maxHp
    } else {
      previousDefeated = false
      current = state
    }
  }

  const defeatedCount = bosses.filter((boss) => boss.defeated).length
  return {
    roster,
    bosses,
    totalDamage,
    totalHits,
    totalMaxHp: roster.reduce((sum, boss) => sum + boss.maxHp, 0),
    defeatedCount,
    allDefeated: defeatedCount >= roster.length,
    current,
    activePlayerCount: active.length,
  }
}

// ─── 집중 공격 (시간표) ───

export type RaidFrenzyState = {
  active: boolean
  /** 진행 중이면 남은 초, 아니면 0 */
  secondsLeft: number
  /** 다음 집중 공격까지 남은 초 (진행 중이면 0) */
  nextIn: number
  /** 몇 번째 집중 공격인지 (0부터). 아직 한 번도 없었으면 -1 */
  index: number
}

export function getRaidFrenzyState(startedAt: string | null | undefined, now: number = Date.now()): RaidFrenzyState {
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN
  if (!Number.isFinite(startedMs)) {
    return { active: false, secondsLeft: 0, nextIn: RAID.FRENZY_FIRST_AT, index: -1 }
  }
  const elapsed = (now - startedMs) / 1000
  if (elapsed < RAID.FRENZY_FIRST_AT) {
    return { active: false, secondsLeft: 0, nextIn: Math.ceil(RAID.FRENZY_FIRST_AT - elapsed), index: -1 }
  }
  const sinceFirst = elapsed - RAID.FRENZY_FIRST_AT
  const index = Math.floor(sinceFirst / RAID.FRENZY_PERIOD)
  const offset = sinceFirst - index * RAID.FRENZY_PERIOD
  if (offset < RAID.FRENZY_DURATION) {
    return { active: true, secondsLeft: Math.ceil(RAID.FRENZY_DURATION - offset), nextIn: 0, index }
  }
  return { active: false, secondsLeft: 0, nextIn: Math.ceil(RAID.FRENZY_PERIOD - offset), index }
}

// ─── 데미지 ───

export function getComboBonus(streak: number): number {
  let bonus = 0
  for (const step of RAID.COMBO_STEPS) {
    if (streak >= step.streak) bonus = step.bonus
  }
  return bonus
}

export type RaidHitBreakdown = {
  damage: number
  base: number
  comboBonus: number
  multiplier: number
}

/** 정답 하나의 데미지. streak 은 이번 정답을 포함한 연속 정답 수 */
export function computeHitDamage(input: {
  role: RaidRole | null
  streak: number
  frenzyActive: boolean
}): RaidHitBreakdown {
  const role = input.role ? RAID_ROLES[input.role] : null
  const base = Math.round(RAID.BASE_DAMAGE * (role?.damageMultiplier ?? 1))
  const comboBonus = getComboBonus(input.streak) * (role?.comboMultiplier ?? 1)
  const multiplier = input.frenzyActive ? RAID.FRENZY_MULTIPLIER : 1
  return {
    damage: Math.max(1, Math.round((base + comboBonus) * multiplier)),
    base,
    comboBonus,
    multiplier,
  }
}

/** 보스 체력 비율에 따른 한 줄 상태 문구 (연출용) */
export function getBossMoodLine(boss: RaidBossState | null): string {
  if (!boss) return '펭귄 군단을 모두 물리쳤어요!'
  if (boss.shield.active) return '얼음 방패가 올라왔어요! 더 많은 친구가 때려야 깨져요'
  if (boss.hpRatio > 0.75) return `${boss.def.name}이(가) 여유를 부리고 있어요`
  if (boss.hpRatio > 0.5) return `${boss.def.name}이(가) 조금 당황했어요`
  if (boss.hpRatio > 0.25) return `${boss.def.name}이(가) 비틀거려요!`
  return '거의 다 왔어요! 마지막 한 방!'
}
