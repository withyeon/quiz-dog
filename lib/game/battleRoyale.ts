/**
 * 눈싸움 대작전 (Battle Royale) 게임 로직
 * 팀전: 홍팀(🐕) vs 청팀(🐺). 상대팀 전원 탈락 시 우리팀 승리.
 */

export type PlayerClass = 'ice_fist' | 'rapid_fire' | 'shield' | 'hot_choco'
export type Team = 'red' | 'blue'

export const TEAM_INFO: Record<Team, { name: string; emoji: string; icon: string; color: string; bg: string; border: string }> = {
  red: {
    name: '홍팀',
    emoji: '🐕',
    icon: '🔥',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
  },
  blue: {
    name: '청팀',
    emoji: '🐺',
    icon: '❄️',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
  },
}

export const TEAM_MIN_PLAYERS = 6
export const REVIVAL_STREAK_REQUIRED = 3
export const REVIVAL_HEALTH_RATIO = 0.5
export const TARGET_LOCK_COOLDOWN_MS = 2000

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
    defense: 0.8,
    maxHealth: 130,
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
 * 공격 대상 선택 (팀전)
 * - 상대팀 생존자만 후보
 * - 체력이 가장 높은 1~2명 중 랜덤 (몰빵 방지)
 * - 직전 타겟은 제외
 *
 * 팀이 지정되지 않은 (개인전 폴백) 경우 기존 랜덤 선택.
 */
export function selectAttackTarget(
  players: Array<{ id: string; health?: number; team?: Team | null }>,
  attackerId: string,
  options: { attackType?: 'single' | 'all'; lastTargetId?: string | null } = {}
): string | null {
  const { attackType = 'single', lastTargetId = null } = options
  if (attackType === 'all') return null

  const attacker = players.find((p) => p.id === attackerId)
  const isTeamGame = Boolean(attacker?.team)

  const candidates = players.filter((p) => {
    if (p.id === attackerId) return false
    if ((p.health ?? 100) <= 0) return false
    if (isTeamGame) return p.team && p.team !== attacker?.team
    return true
  })

  if (candidates.length === 0) return null

  // 체력 높은 순으로 정렬, 동률은 그대로
  const sorted = [...candidates].sort((a, b) => (b.health ?? 100) - (a.health ?? 100))
  // 상위 절반(최소 1명)을 후보풀로 — 약한 상대 몰빵 방지
  const poolSize = Math.max(1, Math.ceil(sorted.length / 2))
  let pool = sorted.slice(0, poolSize)

  // 직전 타겟 제외 (단, 다른 선택지가 있을 때만)
  if (lastTargetId) {
    const filtered = pool.filter((p) => p.id !== lastTargetId)
    if (filtered.length > 0) pool = filtered
  }

  return pool[Math.floor(Math.random() * pool.length)].id
}

/**
 * 공격이 유효한지 — 같은 팀 공격 차단
 */
export function canAttackTarget(
  attacker: { id: string; team?: Team | null },
  target: { id: string; team?: Team | null; health?: number },
): boolean {
  if (attacker.id === target.id) return false
  if ((target.health ?? 100) <= 0) return false
  if (attacker.team && target.team) {
    return attacker.team !== target.team
  }
  return true
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
 * 방어력 적용 후 실제 감소할 체온량(양수). 원자적 증분(delta)에 사용한다.
 */
export function getDamageReduction(
  damage: number,
  playerClass?: PlayerClass
): number {
  if (playerClass) {
    damage *= PLAYER_CLASSES[playerClass].defense
  }
  return Math.floor(damage)
}

/**
 * 체온 감소 처리 (방어력 적용)
 */
export function applyDamage(
  currentHealth: number,
  damage: number,
  playerClass?: PlayerClass
): number {
  return Math.max(0, currentHealth - getDamageReduction(damage, playerClass))
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

/** 휴대 난로 아이템 체온 회복량 */
export const HEATER_HEAL_AMOUNT = 30

/**
 * 난로 아이템 효과 (체온 회복)
 */
export function applyHeater(currentHealth: number, maxHealth: number): number {
  return Math.min(maxHealth, currentHealth + HEATER_HEAL_AMOUNT)
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
export function getSurvivors<T extends { id: string; health?: number }>(
  players: T[]
): T[] {
  return players.filter((p) => (p.health ?? 100) > 0)
}

/**
 * 팀별 생존자 카운트
 */
export function getTeamSurvivors(
  players: Array<{ id: string; health?: number; team?: Team | null }>,
): Record<Team, number> {
  const result: Record<Team, number> = { red: 0, blue: 0 }
  for (const p of players) {
    if ((p.health ?? 100) <= 0) continue
    if (p.team === 'red' || p.team === 'blue') {
      result[p.team] += 1
    }
  }
  return result
}

/**
 * 팀전 승리팀 확인 — 상대팀 전원 탈락 시 우리팀 승리.
 * 팀이 지정된 게임에서만 의미가 있음.
 */
export function checkWinningTeam(
  players: Array<{ id: string; health?: number; team?: Team | null }>,
): Team | null {
  const hasTeams = players.some((p) => p.team === 'red' || p.team === 'blue')
  if (!hasTeams) return null

  const survivors = getTeamSurvivors(players)
  if (survivors.red > 0 && survivors.blue === 0) return 'red'
  if (survivors.blue > 0 && survivors.red === 0) return 'blue'
  return null
}

/**
 * 개인전 승자 (팀 없음). 한 명만 남았을 때.
 */
export function checkWinner(
  players: Array<{ id: string; health?: number; team?: Team | null }>
): string | null {
  const hasTeams = players.some((p) => p.team === 'red' || p.team === 'blue')
  if (hasTeams) return null
  const survivors = getSurvivors(players)
  if (survivors.length === 1 && players.length >= 2) {
    return survivors[0].id
  }
  return null
}

/**
 * 게임 종료 조건 확인 — 팀전이면 한 팀이 전멸했을 때, 개인전이면 1명 남았을 때.
 */
export function isGameOver(
  players: Array<{ id: string; health?: number; team?: Team | null }>
): boolean {
  const hasTeams = players.some((p) => p.team === 'red' || p.team === 'blue')

  if (hasTeams) {
    const survivors = getTeamSurvivors(players)
    if (players.length >= 2 && (survivors.red === 0 || survivors.blue === 0)) {
      return true
    }
    return false
  }

  const survivors = getSurvivors(players)
  if (survivors.length === 0) return true
  if (survivors.length === 1 && players.length >= 2) return true
  return false
}

/**
 * 연속 정답에 따른 눈뭉치 데미지 배율
 */
export function getComboDamageMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= 5) return 2
  if (consecutiveCorrect >= 3) return 1.5
  if (consecutiveCorrect >= 2) return 1.2
  return 1
}

/**
 * 팀 배정 — 스네이크 드래프트
 * 정답률 기반 데이터가 있으면 강한 학생부터 1·2·2·1·1·2... 패턴으로 분배해 평균을 맞춥니다.
 * 데이터가 부족하면 무작위 셔플 후 짝수 인덱스 = red, 홀수 인덱스 = blue.
 * 홀수 인원이면 한 팀이 +1.
 */
export function assignTeams<T extends { id: string }>(
  players: T[],
  options: { accuracyOf?: (player: T) => number | null } = {},
): Map<string, Team> {
  const { accuracyOf } = options
  const teamMap = new Map<string, Team>()
  if (players.length === 0) return teamMap

  const hasAccuracyData =
    accuracyOf !== undefined && players.some((p) => accuracyOf(p) !== null)

  let ordered: T[]
  if (hasAccuracyData) {
    // 정답률 내림차순. null은 0.5 평균으로 취급.
    ordered = [...players].sort((a, b) => {
      const av = accuracyOf!(a) ?? 0.5
      const bv = accuracyOf!(b) ?? 0.5
      return bv - av
    })
  } else {
    // 무작위 셔플
    ordered = [...players]
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
    }
  }

  // 스네이크 드래프트: R, B, B, R, R, B, B, R ...
  // 균형이 잘 맞는 패턴. snake = floor(i/2) % 2 결과를 기준으로 토글.
  ordered.forEach((player, index) => {
    const round = Math.floor(index / 2)
    const isReverse = round % 2 === 1
    const slot = index % 2
    const team: Team = (slot === 0) === !isReverse ? 'red' : 'blue'
    teamMap.set(player.id, team)
  })

  // 균형 보정: 홀수 인원이면 한쪽이 +1, 그건 자연스러움. 그대로 둠.
  return teamMap
}

/**
 * 부활 조건 충족 시 — 탈락자가 연속 정답 누적 후 50% 체력으로 복귀.
 * 반환: 부활하면 새 체력, 아니면 null.
 */
export function checkRevival(
  revivalStreak: number,
  playerClass?: PlayerClass,
): number | null {
  if (revivalStreak < REVIVAL_STREAK_REQUIRED) return null
  const maxHealth = playerClass ? PLAYER_CLASSES[playerClass].maxHealth : 100
  return Math.floor(maxHealth * REVIVAL_HEALTH_RATIO)
}

/**
 * 팀전 가능 여부 — 인원이 부족하면 개인전 폴백.
 */
export function canPlayTeamMode(playerCount: number): boolean {
  return playerCount >= TEAM_MIN_PLAYERS
}
