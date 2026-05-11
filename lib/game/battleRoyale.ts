/**
 * 눈싸움 대작전 (Battle Royale) 게임 로직
 * 문제를 맞춰 눈뭉치를 던져 상대를 얼리고 마지막까지 살아남는 게임
 */

export type PlayerClass = 'ice_fist' | 'rapid_fire' | 'shield' | 'hot_choco'

export interface PlayerClassInfo {
  id: PlayerClass
  name: string
  icon: string
  description: string
  damageMultiplier: number
  attackSpeed: number
  defense: number
  maxHealth: number
  healAmount?: number
}

export const PLAYER_CLASSES: Record<PlayerClass, PlayerClassInfo> = {
  ice_fist: {
    id: 'ice_fist',
    name: '아이스 브레이커',
    icon: '🧊',
    description: '한 번 맞추면 크게 흔들지만 장전 템포가 묵직합니다.',
    damageMultiplier: 1.5,
    attackSpeed: 0.7,
    defense: 1.0,
    maxHealth: 100,
  },
  rapid_fire: {
    id: 'rapid_fire',
    name: '스노우 런처',
    icon: '⚡',
    description: '데미지는 낮아도 빠르게 다음 눈뭉치를 준비합니다.',
    damageMultiplier: 0.8,
    attackSpeed: 1.5,
    defense: 1.0,
    maxHealth: 100,
  },
  shield: {
    id: 'shield',
    name: '윈터 가드',
    icon: '🛡️',
    description: '체온이 높고 받은 피해를 안정적으로 줄입니다.',
    damageMultiplier: 1.0,
    attackSpeed: 1.0,
    defense: 0.7,
    maxHealth: 150,
  },
  hot_choco: {
    id: 'hot_choco',
    name: '핫초코 키트',
    icon: '☕',
    description: '정답을 맞힐 때마다 체온을 조금씩 되찾습니다.',
    damageMultiplier: 0.9,
    attackSpeed: 1.0,
    defense: 1.0,
    maxHealth: 100,
    healAmount: 15,
  },
}

export interface AttackResult {
  attackerId: string
  targetId: string | null // null이면 전체 공격
  damage: number
  isCritical: boolean
  itemType?: 'giant_ball' | 'blizzard' | 'heater'
}

export interface BattleAction {
  type: 'attack' | 'defend' | 'heal'
  playerId: string
  targetId?: string
  value: number
}

export interface SnowballItem {
  type: 'giant_ball' | 'blizzard' | 'heater'
  name: string
  icon: string
  description: string
}

/**
 * 눈뭉치 공격 데미지 계산 (체온 감소)
 * @param isCorrect 정답 여부
 * @param answerTime 답변 시간 (ms)
 * @param isCritical 크리티컬 여부
 * @param playerClass 플레이어 직업
 * @param gameTime 게임 진행 시간 (서든 데스용)
 * @param hasGiantBall 왕눈덩이 아이템 보유 여부
 */
export function calculateDamage(
  isCorrect: boolean,
  answerTime: number,
  isCritical: boolean = false,
  playerClass?: PlayerClass,
  gameTime: number = 0,
  hasGiantBall: boolean = false
): number {
  if (!isCorrect) return 0

  // 기본 데미지: 10 (체온 감소)
  let damage = 10

  // 직업별 데미지 배율 적용
  if (playerClass) {
    damage *= PLAYER_CLASSES[playerClass].damageMultiplier
  }

  // 빠른 답변 보너스 (10초 이내)
  if (answerTime < 10000) {
    damage += Math.floor((10000 - answerTime) / 1000) * 2
  }

  // 크리티컬 히트 (5% 확률)
  if (isCritical) {
    damage *= 2
  }

  // 왕눈덩이 아이템 (3배 데미지)
  if (hasGiantBall) {
    damage *= 3
  }

  // 서든 데스: 게임 시간이 길수록 데미지 증가 (5분마다 20% 증가)
  const suddenDeathMultiplier = 1 + Math.floor(gameTime / 300000) * 0.2
  damage *= suddenDeathMultiplier

  return Math.floor(damage)
}

/**
 * 크리티컬 히트 여부 결정
 */
export function isCriticalHit(): boolean {
  return Math.random() < 0.05 // 5% 확률
}

/**
 * 공격 대상 선택
 * @param players 모든 플레이어
 * @param attackerId 공격자 ID
 * @param attackType 공격 타입 ('single' | 'all')
 */
export function selectAttackTarget(
  players: Array<{ id: string; health?: number }>,
  attackerId: string,
  attackType: 'single' | 'all' = 'single'
): string | null {
  if (attackType === 'all') {
    return null // 전체 공격
  }

  // 살아있는 다른 플레이어 중 랜덤 선택
  const alivePlayers = players.filter(
    p => p.id !== attackerId && (p.health || 100) > 0
  )

  if (alivePlayers.length === 0) return null

  const randomIndex = Math.floor(Math.random() * alivePlayers.length)
  return alivePlayers[randomIndex].id
}

/**
 * 공격 결과 생성
 */
export function generateAttack(
  attackerId: string,
  targetId: string | null,
  damage: number,
  isCritical: boolean
): AttackResult {
  return {
    attackerId,
    targetId,
    damage,
    isCritical,
  }
}

/**
 * 체온 감소 처리 (방어력 적용)
 */
export function applyDamage(
  currentHealth: number,
  damage: number,
  playerClass?: PlayerClass
): number {
  // 방어력 적용
  if (playerClass) {
    damage *= PLAYER_CLASSES[playerClass].defense
  }
  return Math.max(0, currentHealth - Math.floor(damage))
}

/**
 * 체온 회복 (핫초코 직업)
 */
export function applyHeal(
  currentHealth: number,
  playerClass?: PlayerClass
): number {
  if (playerClass === 'hot_choco' && PLAYER_CLASSES[playerClass].healAmount) {
    const maxHealth = PLAYER_CLASSES[playerClass].maxHealth
    return Math.min(maxHealth, currentHealth + PLAYER_CLASSES[playerClass].healAmount!)
  }
  return currentHealth
}

/**
 * 난로 아이템 효과 (체온 회복)
 */
export function applyHeater(currentHealth: number, maxHealth: number): number {
  const healAmount = 30
  return Math.min(maxHealth, currentHealth + healAmount)
}

/**
 * 랜덤 아이템 획득
 * 호출 자체가 아이템 획득 판정 이후에 일어나므로 여기서는 종류만 고릅니다.
 */
export function generateItem(): SnowballItem {
  const random = Math.random()
  
  if (random < 0.34) {
    return {
      type: 'giant_ball',
      name: '왕눈덩이',
      icon: '❄️',
      description: '다음 공격은 3배 데미지!',
    }
  } else if (random < 0.67) {
    return {
      type: 'blizzard',
      name: '눈보라',
      icon: '🌨️',
      description: '1등 플레이어 화면을 가린다!',
    }
  }

  return {
    type: 'heater',
    name: '휴대 난로',
    icon: '🔥',
    description: '체온을 30 회복한다!',
  }
}

/**
 * 자기장(폭설 주의보) 데미지 계산
 * @param gameTime 게임 진행 시간 (ms)
 * @param zoneLevel 자기장 레벨
 */
export function calculateZoneDamage(gameTime: number, zoneLevel: number): number {
  const lateGameBonus = Math.floor(gameTime / 300000)
  return Math.min(18, 3 + zoneLevel * 2 + lateGameBonus)
}

/**
 * 생존자 확인
 */
export function getSurvivors(
  players: Array<{ id: string; health?: number }>
): Array<{ id: string; health: number }> {
  return players
    .filter(p => (p.health || 100) > 0)
    .map(p => ({ id: p.id, health: p.health || 100 }))
}

/**
 * 승자 확인 (1명만 남았는지)
 * 참가자가 2명 이상일 때만 승자 인정 (혼자 dev 테스트 시 바로 결과 화면 뜨는 것 방지)
 */
export function checkWinner(
  players: Array<{ id: string; health?: number }>
): string | null {
  const survivors = getSurvivors(players)
  if (survivors.length === 1 && players.length >= 2) {
    return survivors[0].id
  }
  return null
}

/**
 * 게임 종료 조건 확인
 * 전원 탈락이거나, 참가자 2명 이상 중 1명만 남았을 때만 종료
 */
export function isGameOver(
  players: Array<{ id: string; health?: number }>
): boolean {
  const survivors = getSurvivors(players)
  if (survivors.length === 0) return true
  if (survivors.length === 1 && players.length >= 2) return true
  return false
}
