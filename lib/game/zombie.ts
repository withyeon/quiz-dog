// 좀비를 피해라! (Escape the Zombies) — 타입 / 상수 / 순수 조회 함수
//
// 규칙 판정(체력·방어막·공격력·역할 전이·점수)은 전부 서버가 한다:
//   sql/20260910_zombie_server_authority.sql 의 zombie_apply_action / zombie_attack
// 여기에 같은 규칙을 클라이언트 버전으로 다시 두지 말 것 — 두 벌이 갈라지면
// 오래된 로컬 스냅샷이 감염을 되돌리는 종류의 버그가 그대로 돌아온다.

export { formatTime } from '@/lib/utils/formatTime'

// ─── 타입 정의 ───

export type ZombieRole = 'human' | 'zombie'

export interface ZombiePlayer {
  id: string
  name: string
  role: ZombieRole          // 현재 역할 (감염 시 zombie로 변경)
  originalRole: ZombieRole  // 최초 배정 역할
  health: number            // 인간: 체력 (기본 100)
  shield: number            // 방어막 (0~50)
  attackPower: number       // 좀비: 공격력 (기본 20)
  infectCount: number       // 좀비: 감염시킨 수
  correctStreak: number     // 연속 정답 수 (보너스용)
  totalCorrect: number      // 총 정답 수
  totalWrong: number        // 총 오답 수
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

/** 정답 후 고르는 행동. 대상을 지정하는 것(attack/scan)과 자기에게 쓰는 것(heal/shield). */
export type ZombieActionType = 'attack' | 'heal' | 'shield' | 'scan'

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
  HUMAN_HEAL_AMOUNT: 20,     // 정답 시 회복량
  HUMAN_SHIELD_AMOUNT: 25,   // 방어막 획득량
  HUMAN_MAX_SHIELD: 50,
  
  // 좀비 스탯
  ZOMBIE_BASE_ATTACK: 25,    // 기본 공격력
  ZOMBIE_STREAK_BONUS: 5,    // 연속 정답 보너스 공격력
  ZOMBIE_MAX_ATTACK: 50,     // 최대 공격력
  
  // 감염 임계값
  INFECTION_THRESHOLD: 0,    // 체력이 이 이하면 감염됨
  
  // 보너스/페널티
  CORRECT_STREAK_3_BONUS: 10,  // 3연속 정답 보너스 (인간: 체력, 좀비: 공격력)
  WRONG_PENALTY_HUMAN: 10,     // 인간 오답 페널티 (체력 감소)
  WRONG_PENALTY_ZOMBIE: 0,     // 좀비 오답 페널티 (없음)
  
  // 스캔
  SCAN_COOLDOWN_ROUNDS: 3,   // 스캔 쿨다운 (라운드)
}

/**
 * 서버(zombie_apply_action)로 넘기는 밸런스 값.
 * 규칙 수치는 GAME_CONSTANTS 한 곳에서만 관리하고 SQL은 이 값을 받아 적용한다.
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
} as const

/** 클라이언트가 서버에 보고하는 행동. 역할은 서버가 판정하므로 보내지 않는다. */
export type ZombieActionKind = 'correct' | 'wrong' | 'heal' | 'shield'

/**
 * 결과 리포트 순위용 점수.
 *   생존한 인간이 항상 상위, 좀비끼리는 감염시킨 수로 정렬한다.
 *   sql/20260910_zombie_server_authority.sql 의 _qd_zombie_score 와 같은 식이어야 한다.
 */
export function zombieScore(role: ZombieRole, health: number, infectCount: number): number {
  if (role === 'human') return 200 + Math.max(0, health)
  // 상한 199 = 생존자 최저점(210)을 넘지 못하게 하는 티어 경계
  return Math.min(199, 10 * Math.max(0, infectCount))
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

export function roomPlayerToZombiePlayer(player: RoomZombiePlayer): ZombiePlayer {
  const meta = getZombieMeta(player) ?? createZombieMeta('human')
  const role = meta.role

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
  }
}

// 주의: 클라이언트에서 players 행을 절대값으로 덮어쓰는 함수는 두지 않는다.
// role/health/attack_power/shield/infectCount 는 전부 서버(zombie_apply_action,
// zombie_attack)가 소유한다 — 로컬 스냅샷으로 덮어쓰면 감염이 취소된다.
export function createRoleAssignmentPatches(players: RoomZombiePlayer[]): Array<{
  playerId: string
  patch: {
    active_item: ZombiePlayerMeta
    health: number
    attack_power: number
    score: number
  }
}> {
  const zombieCount = calculateZombieCount(players.length)
  const zombieIds = new Set(
    [...players]
      .sort(() => Math.random() - 0.5)
      .slice(0, zombieCount)
      .map((player) => player.id),
  )

  return players.map((player) => {
    const role: ZombieRole = zombieIds.has(player.id) ? 'zombie' : 'human'
    return {
      playerId: player.id,
      patch: {
        active_item: createZombieMeta(role),
        health: role === 'zombie' ? 999 : GAME_CONSTANTS.HUMAN_INITIAL_HEALTH,
        attack_power: role === 'zombie' ? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK : 0,
        score: zombieScore(role, GAME_CONSTANTS.HUMAN_INITIAL_HEALTH, 0),
      },
    }
  })
}

/**
 * 인간이 다른 플레이어 스캔 (역할 확인)
 */
export function scanPlayer(
  scanner: ZombiePlayer,
  target: ZombiePlayer,
): { isZombie: boolean; log: string } {
  const isZombie = target.role === 'zombie'
  const log = isZombie
    ? `스캔 결과: ${target.name}은(는) 좀비입니다!`
    : `스캔 결과: ${target.name}은(는) 인간입니다.`

  return { isZombie, log }
}

/**
 * 게임 승리 조건 체크
 */
export function checkWinCondition(
  players: ZombiePlayer[],
  timeRemaining: number,
): { gameOver: boolean; winner: 'human' | 'zombie' | null; reason: string } {
  const aliveHumans = players.filter(p => p.role === 'human')
  const zombies = players.filter(p => p.role === 'zombie')

  // 좀비 승리: 모든 인간이 감염됨
  if (aliveHumans.length === 0) {
    return {
      gameOver: true,
      winner: 'zombie',
      reason: '모든 인간이 감염되었습니다! 좀비 팀 승리!',
    }
  }

  // 인간 승리: 시간 종료 시 인간이 남아있음
  if (timeRemaining <= 0 && aliveHumans.length > 0) {
    return {
      gameOver: true,
      winner: 'human',
      reason: `${aliveHumans.length}명의 인간이 생존했습니다! 인간 팀 승리!`,
    }
  }

  return { gameOver: false, winner: null, reason: '' }
}
