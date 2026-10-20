// 황제 펭귄을 막아라! (Emperor Penguin Raid) — 협동 보스 레이드의 규칙·상수·유도 상태
//
// 학생은 크레이지아케이드 몬스터 모드식 아레나(lib/game/raidArena.ts)에서 물풍선으로 펭귄을 맞힌다.
// 물풍선은 퀴즈를 맞혀야 생긴다. 아레나(눈 블록·스노우몬)는 학생마다 자기 것이고, 펭귄의 체력만 반 전체가 공유한다.
//
// 설계 원칙: 보스 상태를 서버에 따로 두지 않는다. 모든 화면(학생·선생님)이 players 행만 보고
// 같은 보스를 계산하므로, 실시간 이벤트가 하나 유실돼도 다음 스냅샷에서 저절로 맞춰진다.
//   players.score        = 그 학생이 지금까지 입힌 데미지 합. 보스 체력 = 최대 체력 − 전원 score 합
//   players.gold         = 명중(물풍선으로 펭귄을 맞힌) 횟수. 결과 화면의 "기여"용
//   players.defense      = 마지막으로 기여한 방패 번호(보스 순번 + 1, 단조 증가). 방패를 깬 "서로 다른 친구 수"를 센다
//   players.combo_count  = 현재 연속 정답 수 (연출용. 본인 행만 쓴다)
//   players.player_class = 역할(RaidRole)
//   players.revival_streak = 마지막으로 끊기에 기여한 필살기 번호(주기 순번 + 1, 단조 증가)
//   players.position     = 깬 스노우몬 수 (결과 화면 칭호용)
// 데미지 누적은 apply_player_delta(원자적 증분)로만 쓴다 — 동시 정답이 유실되지 않는다.
// 펭귄의 필살기 예고는 room.started_at 기준 시각표라 서버 없이 전원이 같은 순간에 본다.
// 예고 중 서로 다른 친구가 충분히 맞히면 필살기가 끊기고 펭귄이 기절(데미지 2배)한다. 못 끊으면 아레나에 눈보라 물줄기가 지나간다.
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
  /** 필살기 끊기 게이지를 채우는 칸 수 (한 필살기에 한 번만 기여) */
  interruptPower: number
}

export const RAID_ROLES: Record<RaidRole, RaidRoleInfo> = {
  warrior: {
    id: 'warrior',
    name: '얼음 전사',
    shortName: '전사',
    tagline: '강한 한 방',
    description: '물풍선으로 펭귄을 맞힐 때마다 더 세게 때려요.',
    damageMultiplier: 1.2,
    comboMultiplier: 1,
    shieldPower: 1,
    interruptPower: 1,
  },
  mage: {
    id: 'mage',
    name: '오로라 마법사',
    shortName: '마법사',
    tagline: '긴 물줄기 · 물풍선 넉넉',
    description: '물줄기가 한 칸 더 길고 정답마다 물풍선을 하나 더 받아요. 연속 정답 보너스 2배, 필살기도 2칸씩 끊어요.',
    damageMultiplier: 1,
    comboMultiplier: 2,
    shieldPower: 1,
    interruptPower: 2,
  },
  guardian: {
    id: 'guardian',
    name: '빙하 수호자',
    shortName: '수호자',
    tagline: '보호막 · 방패 전문',
    description: '갇힐 뻔하면 보호막이 한 번 막아 줘요(시간이 지나면 다시 충전). 얼음 방패도 한 번에 2칸 깨요.',
    damageMultiplier: 1,
    comboMultiplier: 1,
    shieldPower: 2,
    interruptPower: 1,
  },
}

export const RAID_ROLE_ORDER: readonly RaidRole[] = ['warrior', 'mage', 'guardian']

export function isRaidRole(value: unknown): value is RaidRole {
  return value === 'warrior' || value === 'mage' || value === 'guardian'
}

// ─── 밸런스 상수 ───

export const RAID = {
  /** 물풍선으로 펭귄을 한 번 맞혔을 때의 기본 데미지 */
  BASE_DAMAGE: 10,
  /** 연속 정답 보너스 — 낮은 연속수부터. 그 연속수 이상이면 그 보너스를 더한다 */
  COMBO_STEPS: [
    { streak: 3, bonus: 5 },
    { streak: 5, bonus: 10 },
    { streak: 8, bonus: 15 },
  ],
  /**
   * 펭귄의 필살기: 시작 45초 뒤 처음, 그 뒤 80초마다 20초 동안 기를 모은다(예고).
   * 예고 중 서로 다른 친구가 충분히 맞히면 끊기고, 끊긴 순간부터 예고 끝 + 15초까지 기절(데미지 2배).
   * 못 끊으면 4초 동안 눈보라 연출만 지나간다 — 점수·체력 손해는 없다.
   */
  SKILL_FIRST_AT: 45,
  SKILL_PERIOD: 80,
  SKILL_CHARGE: 20,
  GROGGY_DURATION: 15,
  GROGGY_MULTIPLIER: 2,
  BLIZZARD_DURATION: 4,
  /** 필살기를 끊는 데 필요한 "서로 다른 친구" 비율 (참가자 수 × 비율, 올림, 최소 1) */
  INTERRUPT_REQUIRED_RATIO: 0.4,
  /** 마지막 황제 펭귄이 이 체력 비율 아래로 떨어지면 분노한다 (연출만) */
  ENRAGE_HP_RATIO: 0.25,
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
  /** 정답 뒤 퀴즈 창이 닫히고 다음 문제로 넘어가기까지 (ms). 아레나로 빨리 돌아가게 짧게 */
  NEXT_QUESTION_DELAY_MS: 900,
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
  revival_streak?: number | null
  position?: number | null
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
  /** 마지막 황제 펭귄이 체력 ENRAGE_HP_RATIO 아래에서 분노한 상태 (연출만) */
  enraged: boolean
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
  /** 펭귄 군단 전체 체력 중 깎은 비율 0~1 (시간이 끝났을 때 "얼마나 막았는지") */
  progressRatio: number
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
        enraged: false,
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
      enraged: def.isFinal && !defeated && hp / Math.max(1, def.maxHp) <= RAID.ENRAGE_HP_RATIO,
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
  const totalMaxHp = roster.reduce((sum, boss) => sum + boss.maxHp, 0)
  const dealt = bosses.reduce((sum, boss) => sum + (boss.defeated ? boss.def.maxHp : Math.min(boss.damage, boss.def.maxHp - 1)), 0)
  return {
    roster,
    bosses,
    totalDamage,
    totalHits,
    totalMaxHp,
    defeatedCount,
    allDefeated: defeatedCount >= roster.length,
    current,
    activePlayerCount: active.length,
    progressRatio: totalMaxHp > 0 ? Math.min(1, dealt / totalMaxHp) : 0,
  }
}

// ─── 펭귄의 필살기 (시간표 + 끊기) ───

export type RaidSkillPhase = 'idle' | 'charging' | 'groggy' | 'blizzard'

export type RaidSkillState = {
  /** idle: 다음 예고 대기 · charging: 기를 모으는 중(끊을 수 있음) · groggy: 끊겨서 기절(데미지 2배) · blizzard: 못 끊어 눈보라 연출 */
  phase: RaidSkillPhase
  /** 몇 번째 필살기인지 (0부터). 아직 한 번도 없었으면 -1 */
  cycle: number
  /** 지금 정답을 맞히면 끊기에 기여할 수 있는 예고 구간인지 (끊긴 뒤에도 예고 시간 동안은 참) */
  inChargeWindow: boolean
  /** 예고 진행도 0~1 (charging 동안만 의미) */
  chargeRatio: number
  /** charging·groggy·blizzard 가 끝날 때까지 남은 초 */
  secondsLeft: number
  /** idle 일 때 다음 예고까지 남은 초 (그 밖에는 0) */
  nextIn: number
  /** 이번 필살기 끊기 게이지 */
  points: number
  required: number
  remaining: number
  interrupted: boolean
  /** 연출용 필살기 이름 (지금 싸우는 펭귄에 따라) */
  skillName: string
}

const SKILL_NAMES: Record<RaidBossSprite, string> = {
  guard: '눈덩이 폭격',
  knight: '얼음 창 돌진',
  general: '눈보라 호령',
  emperor: '절대영도 브레스',
}

export function getRaidSkillName(sprite: RaidBossSprite | null | undefined): string {
  return sprite ? SKILL_NAMES[sprite] : SKILL_NAMES.emperor
}

/** 참가자 수 기준으로 필살기를 끊는 데 필요한 칸 수 */
export function getInterruptRequired(activePlayerCount: number): number {
  return Math.max(1, Math.ceil(activePlayerCount * RAID.INTERRUPT_REQUIRED_RATIO))
}

/** 시작 시각 기준 시간표만 본 필살기 주기. 선수 행과 무관해 모든 화면이 같은 순간에 같은 값을 얻는다 */
export function getRaidSkillClock(startedAt: string | null | undefined, now: number = Date.now()) {
  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN
  if (!Number.isFinite(startedMs)) return { cycle: -1, offset: -1, nextIn: RAID.SKILL_FIRST_AT }
  const elapsed = (now - startedMs) / 1000
  if (elapsed < RAID.SKILL_FIRST_AT) return { cycle: -1, offset: -1, nextIn: Math.ceil(RAID.SKILL_FIRST_AT - elapsed) }
  const since = elapsed - RAID.SKILL_FIRST_AT
  const cycle = Math.floor(since / RAID.SKILL_PERIOD)
  const offset = since - cycle * RAID.SKILL_PERIOD
  return { cycle, offset, nextIn: Math.ceil(RAID.SKILL_PERIOD - offset) }
}

/**
 * 필살기 상태. 끊기 게이지는 revival_streak 가 정확히 이번 주기 번호(+1)인 친구만 센다 —
 * 주기가 겹치지 않으니(예고 20초 + 기절 15초 < 주기 80초) 지난 주기의 기여가 섞이지 않는다.
 * 끊겼는지는 게이지로 판단하므로, 늦게 도착한 기여는 다음 스냅샷에서 저절로 반영된다.
 */
export function getRaidSkillState(
  startedAt: string | null | undefined,
  players: RaidPlayerLike[],
  currentSprite: RaidBossSprite | null,
  now: number = Date.now(),
): RaidSkillState {
  const active = players.filter((player) => !player.is_kicked)
  const required = getInterruptRequired(active.length)
  const clock = getRaidSkillClock(startedAt, now)
  const skillName = getRaidSkillName(currentSprite)
  const idle: RaidSkillState = {
    phase: 'idle',
    cycle: clock.cycle,
    inChargeWindow: false,
    chargeRatio: 0,
    secondsLeft: 0,
    nextIn: clock.nextIn,
    points: 0,
    required,
    remaining: required,
    interrupted: false,
    skillName,
  }
  if (clock.cycle < 0) return idle

  const points = active.reduce((sum, player) => {
    if (toNumber(player.revival_streak) !== clock.cycle + 1) return sum
    const role = getRaidRole(player)
    return sum + (role ? RAID_ROLES[role].interruptPower : 1)
  }, 0)
  const interrupted = points >= required
  const gauge = { points: Math.min(points, required), required, remaining: Math.max(0, required - points), interrupted }
  const inChargeWindow = clock.offset < RAID.SKILL_CHARGE

  if (interrupted && clock.offset < RAID.SKILL_CHARGE + RAID.GROGGY_DURATION) {
    return {
      ...idle,
      ...gauge,
      phase: 'groggy',
      inChargeWindow,
      chargeRatio: Math.min(1, clock.offset / RAID.SKILL_CHARGE),
      secondsLeft: Math.ceil(RAID.SKILL_CHARGE + RAID.GROGGY_DURATION - clock.offset),
      nextIn: 0,
    }
  }
  if (inChargeWindow) {
    return {
      ...idle,
      ...gauge,
      phase: 'charging',
      inChargeWindow,
      chargeRatio: clock.offset / RAID.SKILL_CHARGE,
      secondsLeft: Math.ceil(RAID.SKILL_CHARGE - clock.offset),
      nextIn: 0,
    }
  }
  if (!interrupted && clock.offset < RAID.SKILL_CHARGE + RAID.BLIZZARD_DURATION) {
    return {
      ...idle,
      ...gauge,
      phase: 'blizzard',
      chargeRatio: 1,
      secondsLeft: Math.ceil(RAID.SKILL_CHARGE + RAID.BLIZZARD_DURATION - clock.offset),
      nextIn: 0,
    }
  }
  return idle
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
  /** 펭귄이 기절해 있는지 (필살기를 끊은 보상) */
  groggy: boolean
}): RaidHitBreakdown {
  const role = input.role ? RAID_ROLES[input.role] : null
  const base = Math.round(RAID.BASE_DAMAGE * (role?.damageMultiplier ?? 1))
  const comboBonus = getComboBonus(input.streak) * (role?.comboMultiplier ?? 1)
  const multiplier = input.groggy ? RAID.GROGGY_MULTIPLIER : 1
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
  if (boss.enraged) return `${boss.def.name}이(가) 분노했어요! 마지막 힘을 모아요`
  if (boss.hpRatio > 0.75) return `${boss.def.name}이(가) 여유를 부리고 있어요`
  if (boss.hpRatio > 0.5) return `${boss.def.name}이(가) 조금 당황했어요`
  if (boss.hpRatio > 0.25) return `${boss.def.name}이(가) 비틀거려요!`
  return '거의 다 왔어요! 마지막 한 방!'
}

// ─── 결과: 팀 별 등급 · 칭호 ───

/** 팀 별 0~3. 3 = 전부 처치, 2 = 60% 이상, 1 = 25% 이상. 0이어도 결과 화면은 "도전 도장"을 준다 */
export function getRaidTeamStars(state: Pick<RaidState, 'allDefeated' | 'progressRatio'>): 0 | 1 | 2 | 3 {
  if (state.allDefeated) return 3
  if (state.progressRatio >= 0.6) return 2
  if (state.progressRatio >= 0.25) return 1
  return 0
}

export type RaidTitleId = 'top_damage' | 'top_hits' | 'top_hunter' | 'role' | 'together'

export type RaidTitle = {
  id: RaidTitleId
  name: string
  description: string
}

const ROLE_TITLES: Record<RaidRole, string> = {
  warrior: '용감한 얼음 전사',
  mage: '빛나는 오로라 마법사',
  guardian: '든든한 빙하 수호자',
}

/**
 * 모든 참가자에게 칭호를 하나 이상 준다. 순위가 아니라 "무엇을 잘했는지"만 말한다.
 * 특별 칭호(최다 데미지·최다 명중·스노우몬 사냥)는 공동 1등이면 모두 받는다. 나머지는 역할 칭호,
 * 아직 한 번도 못 맞힌 친구도 "함께한 용사"를 받는다 — 결과 화면에서 빈손인 학생이 없게.
 */
export function getRaidTitles(players: RaidPlayerLike[]): Map<string, RaidTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const maxOf = (pick: (player: RaidPlayerLike) => number) =>
    active.reduce((max, player) => Math.max(max, pick(player)), 0)
  const maxDamage = maxOf((player) => toNumber(player.score))
  const maxHits = maxOf((player) => toNumber(player.gold))
  const maxKills = maxOf((player) => toNumber(player.position))

  const titles = new Map<string, RaidTitle[]>()
  for (const player of active) {
    const list: RaidTitle[] = []
    if (maxDamage > 0 && toNumber(player.score) === maxDamage) {
      list.push({ id: 'top_damage', name: '최강의 일격', description: `가장 많은 데미지 ${maxDamage.toLocaleString()}` })
    }
    if (maxHits > 0 && toNumber(player.gold) === maxHits) {
      list.push({ id: 'top_hits', name: '명중왕', description: `가장 많이 맞힌 친구 · ${maxHits}번` })
    }
    if (maxKills > 0 && toNumber(player.position) === maxKills) {
      list.push({ id: 'top_hunter', name: '스노우몬 사냥꾼', description: `스노우몬을 ${maxKills}마리 깼어요` })
    }
    const role = getRaidRole(player)
    if (toNumber(player.gold) > 0) {
      list.push(role
        ? { id: 'role', name: ROLE_TITLES[role], description: RAID_ROLES[role].tagline }
        : { id: 'role', name: '펭귄 사냥꾼', description: '펭귄 군단과 맞섰어요' })
    } else {
      list.push({ id: 'together', name: '함께한 용사', description: '반 친구들과 끝까지 함께했어요' })
    }
    titles.set(player.id, list)
  }
  return titles
}
