// 좀비를 피해라! (Escape the Zombies) 게임 로직 및 타입 정의
// 블루킷 스타일 좀비 감염 + 정체 숨김 + PvP 퀴즈 게임

export { formatTime } from '@/lib/utils/formatTime'

// ─── 타입 정의 ───

export type ZombieRole = 'human' | 'zombie'

export interface ZombiePlayer {
  id: string
  name: string
  isAi: boolean
  role: ZombieRole          // 현재 역할 (감염 시 zombie로 변경)
  originalRole: ZombieRole  // 최초 배정 역할
  health: number            // 인간: 체력 (기본 100)
  shield: number            // 방어막 (0~50)
  attackPower: number       // 좀비: 공격력 (기본 20)
  infectCount: number       // 좀비: 감염시킨 수
  correctStreak: number     // 연속 정답 수 (보너스용)
  totalCorrect: number      // 총 정답 수
  totalWrong: number        // 총 오답 수
  isEliminated: boolean     // 감염되어 탈락 (체력 0)
  lastAction?: string       // 마지막 행동 (UI용)
  statusEffects: StatusEffect[]
}

export type StatusEffect = {
  type: 'speed_boost' | 'shield' | 'poison' | 'reveal' | 'stealth'
  duration: number  // 남은 라운드 수
  value: number     // 효과 수치
}

export interface ZombieGameLog {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'danger' | 'infection'
  timestamp: number
}

export type ZombieActionType = 
  | 'attack'      // 좀비: 인간 공격 (정답 시)
  | 'heal'        // 인간: 체력 회복 (정답 시)
  | 'shield'      // 인간: 방어막 획득 (정답 시)
  | 'scan'        // 인간: 다른 플레이어 역할 스캔 (정답 시)
  | 'sabotage'    // 좀비: 인간 방해 (오답 시에도 사용 가능)

export interface RoundResult {
  roundNumber: number
  playersInfected: string[]
  playersHealed: string[]
  logs: ZombieGameLog[]
}

// ─── 상수 ───

export const AI_ZOMBIE_NAMES = [
  '수상한 멍멍이', '의심스런 냥이', '비밀의 토끼', '몰래 여우',
  '은밀한 곰돌이', '미스터리 부엉이', '그림자 펭귄', '수수께끼 다람쥐',
  '비밀요원 판다', '요상한 오리', '괴짜 고슴도치', '숨은 라쿤',
  '미스터 늑대', '불안한 기린', '미지의 코끼리', '유령 햄스터',
  '신비한 고래', '떠도는 너구리', '엉뚱한 사슴', '장난꾸러기 원숭이',
]

export const ZOMBIE_EMOJIS = [
  '🐶', '🐱', '🐰', '🦊', '🐻', '🦉', '🐧', '🐿️',
  '🐼', '🦆', '🦔', '🦝', '🐺', '🦒', '🐘', '🐹',
  '🐳', '🦝', '🦌', '🐵',
]

// 게임 밸런스 상수
export const GAME_CONSTANTS = {
  // 기본 설정
  GAME_DURATION: 600,         // 10분 (초)
  ROUND_DURATION: 25,         // 라운드당 시간 (초)
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 20,
  
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

// ─── 유틸리티 함수 ───

/**
 * 좀비 수 계산 (전체 인원의 15~20%)
 */
export function calculateZombieCount(totalPlayers: number): number {
  const minZombies = Math.max(1, Math.floor(totalPlayers * GAME_CONSTANTS.ZOMBIE_RATIO_MIN))
  const maxZombies = Math.max(1, Math.ceil(totalPlayers * GAME_CONSTANTS.ZOMBIE_RATIO_MAX))
  return Math.floor(Math.random() * (maxZombies - minZombies + 1)) + minZombies
}

/**
 * 역할 배정 (랜덤으로 좀비 선택)
 */
export function assignRoles(players: ZombiePlayer[]): ZombiePlayer[] {
  const zombieCount = calculateZombieCount(players.length)
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  
  return players.map(player => {
    const zombieIndex = shuffled.findIndex(p => p.id === player.id)
    const isZombie = zombieIndex < zombieCount
    
    return {
      ...player,
      role: isZombie ? 'zombie' : 'human',
      originalRole: isZombie ? 'zombie' : 'human',
      health: isZombie ? 999 : GAME_CONSTANTS.HUMAN_INITIAL_HEALTH,
      attackPower: isZombie ? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK : 0,
      shield: 0,
    }
  })
}

/**
 * 초기 AI 플레이어 생성
 */
export function createInitialPlayers(playerCount: number = 10): ZombiePlayer[] {
  const selectedNames = [...AI_ZOMBIE_NAMES]
    .sort(() => Math.random() - 0.5)
    .slice(0, playerCount - 1)

  const players: ZombiePlayer[] = [
    {
      id: 'player',
      name: '나',
      isAi: false,
      role: 'human',
      originalRole: 'human',
      health: GAME_CONSTANTS.HUMAN_INITIAL_HEALTH,
      shield: 0,
      attackPower: 0,
      infectCount: 0,
      correctStreak: 0,
      totalCorrect: 0,
      totalWrong: 0,
      isEliminated: false,
      statusEffects: [],
    },
  ]

  selectedNames.forEach((name, i) => {
    players.push({
      id: `ai-${i}`,
      name,
      isAi: true,
      role: 'human',
      originalRole: 'human',
      health: GAME_CONSTANTS.HUMAN_INITIAL_HEALTH,
      shield: 0,
      attackPower: 0,
      infectCount: 0,
      correctStreak: 0,
      totalCorrect: 0,
      totalWrong: 0,
      isEliminated: false,
      statusEffects: [],
    })
  })

  return players
}

/**
 * 좀비가 인간을 공격
 */
export function zombieAttack(
  zombie: ZombiePlayer,
  target: ZombiePlayer,
): { newZombie: ZombiePlayer; newTarget: ZombiePlayer; log: string; infected: boolean } {
  if (target.role !== 'human' || target.isEliminated) {
    return {
      newZombie: zombie,
      newTarget: target,
      log: `${target.name}은(는) 이미 좀비이거나 탈락했습니다.`,
      infected: false,
    }
  }

  const damage = zombie.attackPower
  let remainingDamage = damage
  let newShield = target.shield
  let newHealth = target.health

  // 방어막이 있으면 먼저 흡수
  if (newShield > 0) {
    if (newShield >= remainingDamage) {
      newShield -= remainingDamage
      remainingDamage = 0
    } else {
      remainingDamage -= newShield
      newShield = 0
    }
  }

  // 남은 데미지를 체력에서 차감
  newHealth = Math.max(0, newHealth - remainingDamage)

  const infected = newHealth <= GAME_CONSTANTS.INFECTION_THRESHOLD

  const newTarget: ZombiePlayer = {
    ...target,
    health: infected ? 999 : newHealth,
    shield: infected ? 0 : newShield,
    role: infected ? 'zombie' : target.role,
    attackPower: infected ? GAME_CONSTANTS.ZOMBIE_BASE_ATTACK : target.attackPower,
    isEliminated: false,  // 감염 시 좀비로 부활
  }

  const newZombie: ZombiePlayer = {
    ...zombie,
    infectCount: infected ? zombie.infectCount + 1 : zombie.infectCount,
  }

  let log: string
  if (infected) {
    log = `🧟 ${zombie.name}이(가) ${target.name}을(를) 감염시켰습니다! ${target.name}은(는) 이제 좀비입니다!`
  } else if (target.shield > 0 && newShield === 0) {
    log = `⚔️ ${zombie.name}이(가) ${target.name}의 방어막을 파괴했습니다! (HP: ${newHealth})`
  } else {
    log = `⚔️ ${zombie.name}이(가) ${target.name}을(를) 공격했습니다! (HP: ${target.health} → ${newHealth})`
  }

  return { newZombie, newTarget, log, infected }
}

/**
 * 인간이 체력 회복
 */
export function humanHeal(player: ZombiePlayer): { newPlayer: ZombiePlayer; log: string } {
  const healAmount = GAME_CONSTANTS.HUMAN_HEAL_AMOUNT
  const newHealth = Math.min(GAME_CONSTANTS.HUMAN_MAX_HEALTH, player.health + healAmount)
  const actualHeal = newHealth - player.health

  return {
    newPlayer: { ...player, health: newHealth },
    log: `💚 ${player.name}이(가) 체력을 ${actualHeal} 회복했습니다! (HP: ${newHealth})`,
  }
}

/**
 * 인간이 방어막 획득
 */
export function humanShield(player: ZombiePlayer): { newPlayer: ZombiePlayer; log: string } {
  const shieldAmount = GAME_CONSTANTS.HUMAN_SHIELD_AMOUNT
  const newShield = Math.min(GAME_CONSTANTS.HUMAN_MAX_SHIELD, player.shield + shieldAmount)
  const actualShield = newShield - player.shield

  return {
    newPlayer: { ...player, shield: newShield },
    log: `🛡️ ${player.name}이(가) 방어막 ${actualShield}을(를) 획득했습니다! (방어막: ${newShield})`,
  }
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
    ? `🔍 스캔 결과: ${target.name}은(는) 🧟 좀비입니다!!!`
    : `🔍 스캔 결과: ${target.name}은(는) ✅ 인간입니다.`

  return { isZombie, log }
}

/**
 * 정답 후 스트릭 보너스 적용
 */
export function applyCorrectBonus(player: ZombiePlayer): { newPlayer: ZombiePlayer; bonusLog: string | null } {
  const newStreak = player.correctStreak + 1
  const newPlayer: ZombiePlayer = {
    ...player,
    correctStreak: newStreak,
    totalCorrect: player.totalCorrect + 1,
  }

  // 3연속 정답 보너스
  if (newStreak >= 3 && newStreak % 3 === 0) {
    if (player.role === 'human') {
      newPlayer.health = Math.min(
        GAME_CONSTANTS.HUMAN_MAX_HEALTH,
        newPlayer.health + GAME_CONSTANTS.CORRECT_STREAK_3_BONUS,
      )
      return {
        newPlayer,
        bonusLog: `🔥 ${player.name} ${newStreak}연속 정답! 보너스 체력 +${GAME_CONSTANTS.CORRECT_STREAK_3_BONUS}`,
      }
    } else {
      newPlayer.attackPower = Math.min(
        GAME_CONSTANTS.ZOMBIE_MAX_ATTACK,
        newPlayer.attackPower + GAME_CONSTANTS.ZOMBIE_STREAK_BONUS,
      )
      return {
        newPlayer,
        bonusLog: `🔥 ${player.name} ${newStreak}연속 정답! 공격력 +${GAME_CONSTANTS.ZOMBIE_STREAK_BONUS}`,
      }
    }
  }

  return { newPlayer, bonusLog: null }
}

/**
 * 오답 처리
 */
export function applyWrongPenalty(player: ZombiePlayer): { newPlayer: ZombiePlayer; log: string } {
  const newPlayer: ZombiePlayer = {
    ...player,
    correctStreak: 0,
    totalWrong: player.totalWrong + 1,
  }

  if (player.role === 'human') {
    newPlayer.health = Math.max(0, newPlayer.health - GAME_CONSTANTS.WRONG_PENALTY_HUMAN)
    return {
      newPlayer,
      log: `❌ ${player.name} 오답! 체력 -${GAME_CONSTANTS.WRONG_PENALTY_HUMAN} (HP: ${newPlayer.health})`,
    }
  }

  return {
    newPlayer,
    log: `❌ ${player.name} 오답!`,
  }
}

/**
 * AI 행동 결정 (정답 후)
 */
export function aiDecideAction(
  aiPlayer: ZombiePlayer,
  allPlayers: ZombiePlayer[],
): { action: ZombieActionType; targetId?: string } {
  if (aiPlayer.role === 'zombie') {
    // 좀비: 인간을 공격
    const humans = allPlayers.filter(
      p => p.role === 'human' && !p.isEliminated && p.id !== aiPlayer.id,
    )
    if (humans.length > 0) {
      // 체력이 가장 낮은 인간을 우선 타겟
      const target = humans.sort((a, b) => a.health - b.health)[0]
      return { action: 'attack', targetId: target.id }
    }
    return { action: 'attack' }
  } else {
    // 인간: 확률적으로 행동 선택
    const rand = Math.random()
    if (aiPlayer.health < 50) {
      // 체력이 낮으면 회복 우선
      return { action: rand < 0.7 ? 'heal' : 'shield' }
    } else if (aiPlayer.shield < 25) {
      // 방어막이 낮으면 방어 우선
      return { action: rand < 0.4 ? 'shield' : rand < 0.7 ? 'heal' : 'scan' }
    } else {
      return { action: rand < 0.3 ? 'heal' : rand < 0.6 ? 'shield' : 'scan' }
    }
  }
}

/**
 * 게임 승리 조건 체크
 */
export function checkWinCondition(
  players: ZombiePlayer[],
  timeRemaining: number,
): { gameOver: boolean; winner: 'human' | 'zombie' | null; reason: string } {
  const aliveHumans = players.filter(p => p.role === 'human' && !p.isEliminated)
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

/**
 * 상태 효과 업데이트 (라운드 종료 시)
 */
export function tickStatusEffects(player: ZombiePlayer): ZombiePlayer {
  const remainingEffects = player.statusEffects
    .map(e => ({ ...e, duration: e.duration - 1 }))
    .filter(e => e.duration > 0)

  return { ...player, statusEffects: remainingEffects }
}

/**
 * AI 정답률 결정 (난이도 기반)
 */
export function aiWillAnswerCorrectly(aiPlayer: ZombiePlayer): boolean {
  // AI 기본 정답률: 50~70%
  const baseRate = 0.5 + Math.random() * 0.2
  // 좀비 AI는 약간 더 높은 정답률 (위협감 조성)
  const zombieBonus = aiPlayer.role === 'zombie' ? 0.1 : 0
  return Math.random() < (baseRate + zombieBonus)
}

/**
 * 라운드 사이 이벤트 (랜덤 이벤트)
 */
export type RandomEvent = {
  type: 'fog' | 'antidote' | 'mutation' | 'safe_zone' | 'none'
  description: string
  effect: (players: ZombiePlayer[]) => ZombiePlayer[]
}

export function generateRandomEvent(round: number): RandomEvent {
  // 5라운드마다 랜덤 이벤트 발생
  if (round % 5 !== 0 || round === 0) {
    return { type: 'none', description: '', effect: (p) => p }
  }

  const events: RandomEvent[] = [
    {
      type: 'fog',
      description: '🌫️ 안개가 짙어집니다... 이번 라운드는 아무도 스캔할 수 없습니다!',
      effect: (players) => players,
    },
    {
      type: 'antidote',
      description: '💉 해독제를 발견했습니다! 모든 인간의 체력이 15 회복됩니다!',
      effect: (players) =>
        players.map(p =>
          p.role === 'human'
            ? { ...p, health: Math.min(GAME_CONSTANTS.HUMAN_MAX_HEALTH, p.health + 15) }
            : p,
        ),
    },
    {
      type: 'mutation',
      description: '☠️ 좀비 바이러스가 변이했습니다! 좀비 공격력이 5 증가합니다!',
      effect: (players) =>
        players.map(p =>
          p.role === 'zombie'
            ? { ...p, attackPower: Math.min(GAME_CONSTANTS.ZOMBIE_MAX_ATTACK, p.attackPower + 5) }
            : p,
        ),
    },
    {
      type: 'safe_zone',
      description: '🏥 안전 구역을 발견했습니다! 모든 인간이 방어막 10을 획득합니다!',
      effect: (players) =>
        players.map(p =>
          p.role === 'human'
            ? { ...p, shield: Math.min(GAME_CONSTANTS.HUMAN_MAX_SHIELD, p.shield + 10) }
            : p,
        ),
    },
  ]

  return events[Math.floor(Math.random() * events.length)]
}
