// 좀비를 피해라! (Escape the Zombies) — 타입 / 상수 / 순수 조회 함수
//
// 규칙 판정(체력·방어막·공격력·역할 전이·무전기·백신·점수)은 전부 서버가 한다:
//   sql/20261021_zombie_radio_vaccine.sql 의 zombie_apply_action / zombie_strike / zombie_vaccinate /
//   zombie_sabotage / zombie_lock_radio_goal / zombie_call_heli
// 여기에 같은 규칙을 클라이언트 버전으로 다시 두지 말 것 — 두 벌이 갈라지면
// 오래된 로컬 스냅샷이 감염을 되돌리는 종류의 버그가 그대로 돌아온다.
//
// 2026-10-21 개편 (단조로움 해소): 구조 무전기 · 스캔→백신 · 피격 후 숨기 · 방어막 1장.
// 수치는 몬테카를로 시뮬레이션(scripts/zombie-balance-sim.mjs)으로 맞췄다. 실제 수업 플레이테스트 전.

export { formatTime } from '@/lib/utils/formatTime'
import type { Json } from '@/types/database.types'

// ─── 타입 정의 ───

export type ZombieRole = 'human' | 'zombie'

export interface ZombiePlayer {
  id: string
  name: string
  role: ZombieRole          // 현재 역할 (감염 시 zombie, 백신으로 human 으로 돌아올 수 있음)
  originalRole: ZombieRole  // 최초 배정 역할 (처음 좀비는 백신 면역)
  health: number            // 인간: 체력 (기본 100)
  shield: number            // 방어막 장 수 (0~1)
  attackPower: number       // 좀비: 공격력
  infectCount: number       // 좀비: 감염시킨 수
  correctStreak: number     // 연속 정답 수 (보너스용)
  totalCorrect: number      // 총 정답 수
  totalWrong: number        // 총 오답 수
  radio: number             // 무전기에 넣은 양 (생존자 보정 반영, 소수)
  radioParts: number        // 무전기에 넣은 칸 수 (점수용)
  rescues: number           // 백신으로 구한 친구 수
  sabotage: number          // 좀비: 무전기에서 깎은 양
  sabotageCount: number     // 좀비: 방해 횟수
  vaccine: number           // 좀비: 맞은 백신 수
  hiddenUntilMs: number     // 이 시각(ms)까지 숨는 중 — 공격 대상이 될 수 없다
}

export interface ZombieGameLog {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'danger' | 'infection'
  timestamp: number
}

export type ZombiePlayerMeta = {
  role: ZombieRole
  originalRole: ZombieRole
  shield: number
  infectCount: number
  correctStreak: number
  totalCorrect: number
  totalWrong: number
  radio?: number
  radioParts?: number
  rescues?: number
  sabotage?: number
  sabotageCount?: number
  vaccine?: number
  hiddenUntil?: string | null
}

export type RoomZombiePlayer = {
  id: string
  nickname: string
  health?: number | null
  attack_power?: number | null
  active_item?: unknown
  is_online?: boolean | null
  is_kicked?: boolean | null
}

/** 정답 후 고르는 행동. 대상을 지정하는 것(attack/scan/vaccine)과 아닌 것. */
export type ZombieActionType = 'attack' | 'sabotage' | 'heal' | 'shield' | 'repair' | 'scan' | 'vaccine'

// ─── 상수 ───

export const GAME_CONSTANTS = {
  // 기본 설정
  GAME_DURATION: 600,         // 방에 duration_seconds가 없을 때만 쓰는 예비값 (선생님이 시작할 때 고름)
  ROUND_DURATION: 25,         // 라운드당 시간 (초)
  MIN_PLAYERS: 4,            // 권장 최소 인원 (강제하지 않음 — 적어도 게임은 돌아간다)
  MAX_PLAYERS: 20,           // 권장 최대 인원

  // 역할 배정
  ZOMBIE_RATIO_MIN: 0.15,    // 최소 좀비 비율
  ZOMBIE_RATIO_MAX: 0.20,    // 최대 좀비 비율

  // 인간 스탯
  HUMAN_INITIAL_HEALTH: 100,
  HUMAN_MAX_HEALTH: 150,
  HUMAN_HEAL_AMOUNT: 25,     // 치료량
  // 방어막은 1장. 공격 한 번을 통째로 막고 사라진다 (예전: 25씩 쌓여 최대 50 — 치료보다 늘 이득이라 선택이 없었다)
  HUMAN_SHIELD_AMOUNT: 1,
  HUMAN_MAX_SHIELD: 1,

  // 좀비 스탯
  // 35 = 무방비 인간(100)을 3번에 감염시키는 값.
  ZOMBIE_BASE_ATTACK: 35,    // 기본 공격력
  ZOMBIE_STREAK_BONUS: 5,    // 연속 정답 보너스 공격력
  ZOMBIE_MAX_ATTACK: 60,     // 최대 공격력

  // 감염 임계값
  INFECTION_THRESHOLD: 0,    // 체력이 이 이하면 감염됨

  // 보너스/페널티
  CORRECT_STREAK_3_BONUS: 10,  // 3연속 정답 보너스 (인간: 체력, 좀비: 공격력)
  // 인간 오답 페널티는 0으로 둔다 (2026-09-13 결정).
  // 체력이 오답마다 깎이면 HP가 곧 "틀린 횟수"가 되고, 좀비는 그 값을 보고 표적을 고른다.
  // 문제를 못 푸는 학생이 반 친구들에게 반복해서 찍히는 구조라 낙인 우려가 있어
  // (리더보드·오류 풍토·피구 논쟁 연구), 체력은 좀비 공격으로만 줄게 했다.
  // 오답의 대가는 행동 기회 상실과 연속 정답 보너스 초기화만 남는다.
  WRONG_PENALTY_HUMAN: 0,      // 인간 오답 페널티 (체력 감소) — 0 = 없음
  WRONG_PENALTY_ZOMBIE: 0,     // 좀비 오답 페널티 (없음)

  // 피격 후 숨기: 공격을 받으면(방어막으로 막아도) 이 시간 동안 공격 대상이 될 수 없다.
  // 여럿이 한 명을 몰아서 무너뜨리는 것과, 한 학생이 계속 노림당하는 것을 함께 막는다.
  HIDE_SECONDS: 10,

  // 스캔
  SCAN_COOLDOWN_ROUNDS: 2,   // 스캔 쿨다운 (내 행동 횟수)

  // 백신: 감염된 친구(처음부터 좀비가 아닌)에게 이만큼 맞히면 인간으로 돌아온다. 여럿이 나눠 쏴도 쌓인다.
  VACCINE_DOSES: 3,
  CURE_HEALTH: 60,
  RESCUE_SCORE: 20,          // 백신으로 친구를 구하면 받는 점수

  // 구조 무전기
  RADIO_PER_CORRECT: 1,      // 인간이 정답을 맞힐 때마다 자동으로
  RADIO_REPAIR_AMOUNT: 2,    // '수리' 행동
  SABOTAGE_AMOUNT: 3,        // 좀비 '무전기 방해'
  RADIO_GOAL_LOCK_SECONDS: 60,           // 시작 후 이 시간까지 인간이 맞힌 정답 수로 목표를 정한다
  RADIO_GOAL_MIN_PER_HUMAN_MINUTE: 2,    // 목표 하한 (인간 1명·1분당 칸)
  RADIO_GOAL_MAX_PER_HUMAN_MINUTE: 12,   // 목표 상한
  HELI_SECONDS: 45,          // 무전기를 다 고친 뒤 헬기가 오기까지 (게임 끝을 넘지 않는다)
  HELI_RUSH_MULTIPLIER: 1.5, // 헬기를 부른 뒤 좀비 공격력
}

/**
 * 무전기 목표 계수. 목표 = 첫 1분 인간 정답 수 × 게임 분 × 계수.
 * 게임이 길수록 감염이 쌓여 무전기가 느려지므로 계수를 조금씩 낮춘다 (시뮬레이션으로 인간 승률 ~60% 에 맞춘 값).
 *   ≤5분 2.0 · 7분 1.95 · ≥10분 1.8, 사이는 직선으로 잇는다.
 */
export function radioGoalCoefficient(minutes: number): number {
  if (minutes <= 5) return 2.0
  if (minutes <= 7) return 2.0 - ((minutes - 5) / 2) * 0.05
  if (minutes <= 10) return 1.95 - ((minutes - 7) / 3) * 0.15
  return 1.8
}

/** 목표를 정하는 시각(초). 아주 짧은 게임이면 전체의 1/3 시점에 정한다. */
export function radioGoalLockSeconds(durationSeconds: number): number {
  return Math.max(15, Math.min(GAME_CONSTANTS.RADIO_GOAL_LOCK_SECONDS, Math.floor(durationSeconds / 3)))
}

/**
 * 서버 RPC 로 넘기는 밸런스 값. 규칙 수치는 GAME_CONSTANTS 한 곳에서만 관리하고 SQL은 이 값을 받아 적용한다.
 */
export const ZOMBIE_ACTION_LIMITS = {
  humanMaxHealth: GAME_CONSTANTS.HUMAN_MAX_HEALTH,
  humanMaxShield: GAME_CONSTANTS.HUMAN_MAX_SHIELD,
  healAmount: GAME_CONSTANTS.HUMAN_HEAL_AMOUNT,
  shieldAmount: GAME_CONSTANTS.HUMAN_SHIELD_AMOUNT,
  streakBonus: GAME_CONSTANTS.CORRECT_STREAK_3_BONUS,
  zombieStreakBonus: GAME_CONSTANTS.ZOMBIE_STREAK_BONUS,
  zombieMaxAttack: GAME_CONSTANTS.ZOMBIE_MAX_ATTACK,
  wrongPenaltyHuman: GAME_CONSTANTS.WRONG_PENALTY_HUMAN,
  infectionThreshold: GAME_CONSTANTS.INFECTION_THRESHOLD,
  zombieBaseAttack: GAME_CONSTANTS.ZOMBIE_BASE_ATTACK,
  radioPerCorrect: GAME_CONSTANTS.RADIO_PER_CORRECT,
  radioRepairAmount: GAME_CONSTANTS.RADIO_REPAIR_AMOUNT,
  hideSeconds: GAME_CONSTANTS.HIDE_SECONDS,
  heliRushMultiplier: GAME_CONSTANTS.HELI_RUSH_MULTIPLIER,
  vaccineDoses: GAME_CONSTANTS.VACCINE_DOSES,
  cureHealth: GAME_CONSTANTS.CURE_HEALTH,
  sabotageAmount: GAME_CONSTANTS.SABOTAGE_AMOUNT,
} as const

/** zombie_lock_radio_goal 에 넘기는 값 (게임 길이에 따라 달라진다) */
export function buildRadioGoalLimits(durationSeconds: number) {
  const minutes = Math.max(1, durationSeconds / 60)
  const lockSeconds = radioGoalLockSeconds(durationSeconds)
  return {
    radioGoalMinutes: Math.round(minutes * 100) / 100,
    // 서버는 '확정 시각까지 맞힌 정답 수'를 센다. 계수는 1분 기준이라, 3분 미만 게임처럼 더 일찍(예: 40초) 정하면
    // 그만큼 키워서 1분 분량으로 맞춘다 — 안 그러면 2분 체험에서 목표가 2/3로 작아져 1분 만에 60%가 찼다.
    radioGoalCoefficient: Math.round(radioGoalCoefficient(minutes) * (60 / lockSeconds) * 1000) / 1000,
    radioGoalMinPerHumanMinute: GAME_CONSTANTS.RADIO_GOAL_MIN_PER_HUMAN_MINUTE,
    radioGoalMaxPerHumanMinute: GAME_CONSTANTS.RADIO_GOAL_MAX_PER_HUMAN_MINUTE,
    radioGoalLockSeconds: lockSeconds,
  }
}

// ─── 방 옵션 (rooms.settings.zombie) ───

export type ZombieSettings = {
  /**
   * 좀비가 공격 대상을 고를 때 인간의 체력 숫자를 보여줄지. 방어막·숨는 중은 늘 보인다.
   * 켜면 체력 낮은 친구를 노리는 전략이 살고, 끄면 누가 약한지 드러나지 않는다.
   * 기본은 끔 (2026-10-21) — 켜 두면 덜 맞히는 학생에게 공격이 더 몰린다(시뮬레이션 12명 반 한 명 몫 23%→28%).
   */
  showHumanStatus: boolean
}

export const DEFAULT_ZOMBIE_SETTINGS: ZombieSettings = {
  showHumanStatus: false,
}

/** 게임 중 서버가 채우는 방 상태 (rooms.settings.zombie 의 나머지 키) */
export type ZombieRoomState = ZombieSettings & {
  /** 시작할 때의 게임 길이(초). 일시정지 뒤에는 rooms.duration_seconds 가 남은 시간으로 바뀌므로 따로 둔다. */
  durationSeconds: number | null
  /** 무전기 목표 칸 수. 첫 1분이 지나기 전에는 null */
  radioGoal: number | null
  /** 헬기를 부른 시각 (ISO). 부르기 전에는 null */
  heliAt: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** rooms.settings 에서 좀비 옵션·상태를 읽는다. 없거나 깨져 있으면 기본값. */
export function parseZombieSettings(settings: unknown): ZombieRoomState {
  const zombie = isRecord(settings) && isRecord(settings.zombie) ? settings.zombie : null
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
  return {
    // 키가 없으면 기본값(끔). 예전 방(키가 true 로 저장됨)은 그대로 켜진다.
    showHumanStatus: zombie?.showHumanStatus === true,
    durationSeconds: num(zombie?.durationSeconds),
    radioGoal: num(zombie?.radioGoal),
    heliAt: typeof zombie?.heliAt === 'string' ? zombie.heliAt : null,
  }
}

/** 기존 rooms.settings 를 보존한 채 좀비 옵션을 새로 쓴다. 지난 판의 무전기 목표·헬기 시각은 지운다. */
export function buildZombieRoomSettings(
  zombie: ZombieSettings,
  existing: Json | null | undefined,
  durationSeconds: number,
): Json {
  return {
    ...(isRecord(existing) ? existing : {}),
    zombie: { showHumanStatus: zombie.showHumanStatus, durationSeconds },
  }
}

/** 클라이언트가 서버에 보고하는 행동. 역할은 서버가 판정하므로 보내지 않는다. */
export type ZombieActionKind = 'correct' | 'wrong' | 'heal' | 'shield' | 'repair'

/**
 * 결과 리포트 순위용 점수.
 *   생존한 인간이 항상 상위(무전기 기여 + 구조), 좀비끼리는 감염시킨 수와 방해 횟수로 정렬한다.
 *   체력은 넣지 않는다 — 체력은 '맞은 이력'이라 넣으면 표적이 된 학생이 순위에서도 밀린다.
 *   sql/20261021_zombie_radio_vaccine.sql 의 _qd_zombie_score_v2 와 같은 식이어야 한다.
 */
export function zombieScore(role: ZombieRole, meta: Partial<ZombiePlayerMeta>): number {
  if (role === 'human') {
    return 200 + Math.max(0, meta.radioParts ?? 0) + GAME_CONSTANTS.RESCUE_SCORE * Math.max(0, meta.rescues ?? 0)
  }
  // 상한 199 = 생존자 최저점(200)을 넘지 못하게 하는 티어 경계
  return Math.min(199, 10 * Math.max(0, meta.infectCount ?? 0) + Math.max(0, meta.sabotageCount ?? 0))
}

// ─── 유틸리티 함수 ───

/**
 * 좀비 수 계산 — 전체 인원의 15~20%, 단 최소 1명이고 최소 1명은 인간으로 남긴다.
 *
 * 인원이 적으면 반올림 때문에 실제 비율이 15~20%를 넘는다 (4명 → 1명 = 25%).
 * 0.6명짜리 좀비를 만들 수는 없으니 이건 어쩔 수 없고, 20명 이상부터 명세대로 맞는다.
 * 혼자 접속해 테스트하는 경우(1명)에는 좀비를 만들지 않는다 — 인간이 0명이면
 * 교사 대시보드가 곧바로 "좀비 승리"로 자동 종료해버린다.
 */
export function calculateZombieCount(totalPlayers: number): number {
  if (totalPlayers <= 1) return 0

  const minZombies = Math.max(1, Math.floor(totalPlayers * GAME_CONSTANTS.ZOMBIE_RATIO_MIN))
  const maxZombies = Math.max(1, Math.ceil(totalPlayers * GAME_CONSTANTS.ZOMBIE_RATIO_MAX))
  const count = Math.floor(Math.random() * (maxZombies - minZombies + 1)) + minZombies

  return Math.min(count, totalPlayers - 1)
}

export function isZombieMeta(value: unknown): value is ZombiePlayerMeta {
  if (!value || typeof value !== 'object') return false
  const meta = value as Partial<ZombiePlayerMeta>
  return (meta.role === 'human' || meta.role === 'zombie')
    && (meta.originalRole === 'human' || meta.originalRole === 'zombie')
}

export function createZombieMeta(role: ZombieRole): ZombiePlayerMeta {
  return {
    role,
    originalRole: role,
    shield: 0,
    infectCount: 0,
    correctStreak: 0,
    totalCorrect: 0,
    totalWrong: 0,
  }
}

export function getZombieMeta(player: RoomZombiePlayer): ZombiePlayerMeta | null {
  return isZombieMeta(player.active_item) ? player.active_item : null
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : 0
}

export function roomPlayerToZombiePlayer(player: RoomZombiePlayer): ZombiePlayer {
  const meta = getZombieMeta(player) ?? createZombieMeta('human')
  const role = meta.role
  const hiddenUntilMs = meta.hiddenUntil ? Date.parse(meta.hiddenUntil) : NaN

  return {
    id: player.id,
    name: player.nickname,
    role,
    originalRole: meta.originalRole,
    health: role === 'zombie' ? 999 : (player.health ?? GAME_CONSTANTS.HUMAN_INITIAL_HEALTH),
    shield: meta.shield ?? 0,
    attackPower: role === 'zombie' ? (player.attack_power ?? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK) : 0,
    infectCount: meta.infectCount ?? 0,
    correctStreak: meta.correctStreak ?? 0,
    totalCorrect: meta.totalCorrect ?? 0,
    totalWrong: meta.totalWrong ?? 0,
    radio: toNumber(meta.radio),
    radioParts: toNumber(meta.radioParts),
    rescues: toNumber(meta.rescues),
    sabotage: toNumber(meta.sabotage),
    sabotageCount: toNumber(meta.sabotageCount),
    vaccine: toNumber(meta.vaccine),
    hiddenUntilMs: Number.isFinite(hiddenUntilMs) ? hiddenUntilMs : 0,
  }
}

/** 지금 숨는 중인지 (공격 대상이 될 수 없음). 서버가 최종 판정하고, 화면은 이 값으로 회색 처리만 한다. */
export function isHiding(player: ZombiePlayer, nowMs: number): boolean {
  return player.role === 'human' && player.hiddenUntilMs > nowMs
}

// 주의: 클라이언트에서 players 행을 절대값으로 덮어쓰는 함수는 두지 않는다.
// role/health/attack_power/shield/infectCount/radio 등은 전부 서버 RPC 가 소유한다 —
// 로컬 스냅샷으로 덮어쓰면 감염이 취소된다.
export type ZombieRolePatch = {
  active_item: ZombiePlayerMeta
  health: number
  attack_power: number
  score: number
}

/** 역할 하나를 새로 받는 플레이어 행의 초기값 (시작 배정·도중 입장 공용). */
export function createRolePatch(role: ZombieRole): ZombieRolePatch {
  const meta = createZombieMeta(role)
  return {
    active_item: meta,
    health: role === 'zombie' ? 999 : GAME_CONSTANTS.HUMAN_INITIAL_HEALTH,
    attack_power: role === 'zombie' ? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK : 0,
    score: zombieScore(role, meta),
  }
}

/**
 * 게임이 시작된 뒤 들어온 학생의 역할. 항상 인간으로 시작한다 —
 * 늦게 온 학생이 좀비면 시작부터 공격당하는 쪽이 억울하고, 좀비 비율도 시작 때 이미 맞춰져 있다.
 */
export function createLateJoinerPatch(): ZombieRolePatch {
  return createRolePatch('human')
}

export function createRoleAssignmentPatches(players: RoomZombiePlayer[]): Array<{
  playerId: string
  patch: ZombieRolePatch
}> {
  const zombieCount = calculateZombieCount(players.length)
  const zombieIds = new Set(
    [...players]
      .sort(() => Math.random() - 0.5)
      .slice(0, zombieCount)
      .map((player) => player.id),
  )

  return players.map((player) => ({
    playerId: player.id,
    patch: createRolePatch(zombieIds.has(player.id) ? 'zombie' : 'human'),
  }))
}

/**
 * 인간이 다른 플레이어 스캔 (역할 확인). 좀비면 처음부터 좀비인지(백신 면역) 감염된 친구인지도 알려준다.
 */
export function scanPlayer(
  target: ZombiePlayer,
): { isZombie: boolean; isHost: boolean; log: string } {
  const isZombie = target.role === 'zombie'
  const isHost = isZombie && target.originalRole === 'zombie'
  const log = !isZombie
    ? `스캔 결과: ${target.name}은(는) 인간입니다.`
    : isHost
      ? `스캔 결과: ${target.name}은(는) 처음부터 좀비였어요! (백신이 안 들어요)`
      : `스캔 결과: ${target.name}은(는) 감염된 친구예요! 백신 ${GAME_CONSTANTS.VACCINE_DOSES}발이면 되돌릴 수 있어요.`

  return { isZombie, isHost, log }
}

// ─── 구조 무전기 ───

export type ZombieRadioPhase = 'searching' | 'repairing' | 'heli'

export type ZombieRadioState = {
  phase: ZombieRadioPhase
  /** 목표 칸 수 (searching 이면 null) */
  goal: number | null
  /** 지금 진행도 = Σ radio − Σ sabotage */
  progress: number
  /** 0~100 */
  percent: number
  /** 생존자 보정 배율 (시작 인간 수 ÷ 지금 인간 수) — 인간 화면의 '수리 효율 ×1.4' */
  repairMultiplier: number
  /** 헬기를 부른 시각(ms) */
  heliAtMs: number | null
  /** 헬기가 도착하는 시각(ms) = min(부른 시각 + 45초, 게임 끝) */
  heliArrivalMs: number | null
  /** 목표를 정하는 시각(ms, 게임 시작 기준) */
  goalLockAtMs: number | null
}

/**
 * players 행과 rooms.settings.zombie 로 무전기 상태를 유도한다 (학생·선생님 화면이 같은 값을 본다).
 * gameEndMs: started_at + duration_seconds (헬기는 게임 끝보다 늦게 오지 않는다)
 */
export function computeZombieRadio(
  players: ZombiePlayer[],
  room: ZombieRoomState,
  timing: { startedAtMs: number | null; gameEndMs: number | null; durationSeconds: number | null },
): ZombieRadioState {
  let radio = 0
  let sabotage = 0
  let humansTotal = 0
  let humansAlive = 0
  for (const player of players) {
    radio += player.radio
    sabotage += player.sabotage
    if (player.originalRole === 'human') humansTotal += 1
    if (player.role === 'human') humansAlive += 1
  }
  const progress = Math.max(0, Math.round((radio - sabotage) * 100) / 100)
  const goal = room.radioGoal
  const heliAtMs = room.heliAt ? Date.parse(room.heliAt) : NaN
  const hasHeli = Number.isFinite(heliAtMs)
  const heliArrivalMs = hasHeli
    ? Math.min(heliAtMs + GAME_CONSTANTS.HELI_SECONDS * 1000, timing.gameEndMs ?? Infinity)
    : null
  const lockSeconds = radioGoalLockSeconds(room.durationSeconds ?? timing.durationSeconds ?? GAME_CONSTANTS.GAME_DURATION)

  return {
    phase: hasHeli ? 'heli' : goal === null ? 'searching' : 'repairing',
    goal,
    progress,
    percent: hasHeli ? 100 : goal ? Math.min(100, Math.floor((progress / goal) * 100)) : 0,
    repairMultiplier: Math.round((Math.max(1, humansTotal) / Math.max(1, humansAlive)) * 10) / 10,
    heliAtMs: hasHeli ? heliAtMs : null,
    heliArrivalMs,
    goalLockAtMs: timing.startedAtMs !== null ? timing.startedAtMs + lockSeconds * 1000 : null,
  }
}

export type ZombieOutcome = {
  winner: ZombieRole
  reason: 'all_infected' | 'rescued' | 'radio_failed'
  message: string
}

/**
 * 끝났을 때의 승패.
 *   인간이 모두 감염 → 좀비 승 / 헬기를 불렀고 생존자가 있음 → 인간 승(구조) / 무전기를 못 고침 → 좀비 승
 */
export function resolveZombieOutcome(players: ZombiePlayer[], room: ZombieRoomState): ZombieOutcome {
  const humans = players.filter((player) => player.role === 'human').length
  if (players.length > 0 && humans === 0) {
    return { winner: 'zombie', reason: 'all_infected', message: '모든 인간이 감염되었습니다! 좀비 팀 승리!' }
  }
  if (room.heliAt) {
    return { winner: 'human', reason: 'rescued', message: `헬기가 도착했어요! ${humans}명 구조 성공! 인간 팀 승리!` }
  }
  return { winner: 'zombie', reason: 'radio_failed', message: '무전기를 다 고치지 못해 구조 헬기가 오지 않았어요. 좀비 팀 승리!' }
}

/**
 * 지금 게임이 끝났는지 (학생 화면 로컬 종료용 — 방의 finished 기록은 선생님 화면이 한다).
 *   인간 전원 감염 / 시간 종료 / 헬기 도착
 */
export function isZombieGameOver(
  players: ZombiePlayer[],
  timeRemaining: number,
  radio: ZombieRadioState,
  nowMs: number,
): boolean {
  if (players.length > 0 && !players.some((player) => player.role === 'human')) return true
  if (timeRemaining <= 0) return true
  return radio.heliArrivalMs !== null && nowMs >= radio.heliArrivalMs
}
