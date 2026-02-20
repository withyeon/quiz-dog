/**
 * 미션: 등교 임파서블 게임 로직 (개선판)
 * Blooket Racing 파워업 시스템 + 동적 장애물 시스템
 */

// ==================== 장애물 시스템 ====================

export type ObstacleType =
  | 'CAR'          // 자동차
  | 'CONSTRUCTION' // 공사 구간
  | 'PUDDLE'       // 물웅덩이
  | 'TRAFFIC_LIGHT'// 신호등
  | 'DOG'          // 강아지
  | 'SCOOTER'      // 배달 오토바이
  | 'FALLING_BOX'  // 낙하물

export interface Obstacle {
  id: string
  type: ObstacleType
  position: number  // 트랙 위치 (0-100)
  lane: number      // 차선 (0, 1, 2)
  isActive: boolean
}

export interface ObstacleInfo {
  type: ObstacleType
  name: string
  emoji: string
  effect: string
  probability: number // 생성 확률 (%)
}

export const OBSTACLE_INFO: Record<ObstacleType, ObstacleInfo> = {
  CAR: {
    type: 'CAR',
    name: '자동차',
    emoji: '🚗',
    effect: '-5 step 후퇴',
    probability: 25,
  },
  CONSTRUCTION: {
    type: 'CONSTRUCTION',
    name: '공사 구간',
    emoji: '🚧',
    effect: '3초 정지',
    probability: 20,
  },
  PUDDLE: {
    type: 'PUDDLE',
    name: '물웅덩이',
    emoji: '💧',
    effect: '속도 50% 감소 (5초)',
    probability: 15,
  },
  TRAFFIC_LIGHT: {
    type: 'TRAFFIC_LIGHT',
    name: '신호등',
    emoji: '🚦',
    effect: '3초 대기',
    probability: 10,
  },
  DOG: {
    type: 'DOG',
    name: '강아지',
    emoji: '🐕',
    effect: '-3 step 후퇴',
    probability: 15,
  },
  SCOOTER: {
    type: 'SCOOTER',
    name: '배달 오토바이',
    emoji: '🛵',
    effect: '-7 step 후퇴',
    probability: 10,
  },
  FALLING_BOX: {
    type: 'FALLING_BOX',
    name: '낙하물',
    emoji: '📦',
    effect: '2초 기절',
    probability: 5,
  },
}

/**
 * 장애물 생성 (50m마다)
 */
export function generateObstacles(currentDistance: number): Obstacle[] {
  const obstacles: Obstacle[] = []

  // 50 step마다 1-2개 장애물 생성
  const obstacleCount = Math.floor(currentDistance / 50) * 2

  for (let i = 0; i < obstacleCount; i++) {
    const position = (i + 1) * 50 + Math.random() * 30 - 15
    const lane = Math.floor(Math.random() * 3) // 0, 1, 2

    // 확률에 따라 장애물 타입 결정
    const random = Math.random() * 100
    let cumulativeProbability = 0
    let selectedType: ObstacleType = 'CAR'

    for (const [type, info] of Object.entries(OBSTACLE_INFO)) {
      cumulativeProbability += info.probability
      if (random <= cumulativeProbability) {
        selectedType = type as ObstacleType
        break
      }
    }

    obstacles.push({
      id: `obstacle_${i}_${Date.now()}`,
      type: selectedType,
      position,
      lane,
      isActive: true,
    })
  }

  return obstacles
}

/**
 * 장애물 충돌 감지
 */
export function checkObstacleCollision(
  playerPosition: number,
  playerLane: number,
  obstacles: Obstacle[]
): Obstacle | null {
  for (const obstacle of obstacles) {
    if (!obstacle.isActive) continue

    // 같은 차선에 있고, 위치가 비슷하면 충돌
    if (
      obstacle.lane === playerLane &&
      Math.abs(obstacle.position - playerPosition) < 2
    ) {
      return obstacle
    }
  }

  return null
}

/**
 * 장애물 충돌 효과 적용
 */
export interface ObstacleEffect {
  type: 'POSITION_CHANGE' | 'FREEZE' | 'SPEED_REDUCTION' | 'STUN'
  value?: number      // 위치 변화값 또는 속도 감소율
  duration?: number   // 지속 시간 (초)
}

export function applyObstacleEffect(obstacleType: ObstacleType): ObstacleEffect {
  switch (obstacleType) {
    case 'CAR':
      return { type: 'POSITION_CHANGE', value: -5 }

    case 'CONSTRUCTION':
      return { type: 'FREEZE', duration: 3 }

    case 'PUDDLE':
      return { type: 'SPEED_REDUCTION', value: 0.5, duration: 5 }

    case 'TRAFFIC_LIGHT':
      return { type: 'FREEZE', duration: 3 }

    case 'DOG':
      return { type: 'POSITION_CHANGE', value: -3 }

    case 'SCOOTER':
      return { type: 'POSITION_CHANGE', value: -7 }

    case 'FALLING_BOX':
      return { type: 'STUN', duration: 2 }

    default:
      return { type: 'POSITION_CHANGE', value: 0 }
  }
}

// ==================== 환경 시스템 ====================

export type WeatherType = 'SUNNY' | 'RAINY' | 'WINDY' | 'STORM'

export interface WeatherInfo {
  type: WeatherType
  name: string
  emoji: string
  speedModifier: number // 속도 배율
  startPosition: number
  endPosition: number
}

export const WEATHER_ZONES: WeatherInfo[] = [
  {
    type: 'SUNNY',
    name: '맑음',
    emoji: '☀️',
    speedModifier: 1.0,
    startPosition: 0,
    endPosition: 30,
  },
  {
    type: 'RAINY',
    name: '비',
    emoji: '🌧️',
    speedModifier: 0.9,
    startPosition: 30,
    endPosition: 60,
  },
  {
    type: 'WINDY',
    name: '바람',
    emoji: '💨',
    speedModifier: 0.85,
    startPosition: 60,
    endPosition: 90,
  },
  {
    type: 'STORM',
    name: '폭우',
    emoji: '⚡',
    speedModifier: 0.8,
    startPosition: 90,
    endPosition: 100,
  },
]

export function getCurrentWeather(position: number): WeatherInfo {
  for (const weather of WEATHER_ZONES) {
    if (position >= weather.startPosition && position < weather.endPosition) {
      return weather
    }
  }
  return WEATHER_ZONES[0]
}

// ==================== 차선 시스템 ====================

export interface LaneInfo {
  lane: number
  name: string
  speedModifier: number
  obstacleDensity: number // 장애물 밀도 (0-1)
}

export const LANES: LaneInfo[] = [
  { lane: 0, name: '상단 차선', speedModifier: 1.2, obstacleDensity: 0.8 },
  { lane: 1, name: '중간 차선', speedModifier: 1.0, obstacleDensity: 0.5 },
  { lane: 2, name: '하단 차선', speedModifier: 0.8, obstacleDensity: 0.3 },
]

// ==================== 기존 아이템 시스템 ====================

export type SchoolRacingItemType =
  | 'ENERGY_BOOST' // 에너지 부스트: 자동으로 1미터 앞으로
  | 'SODA_BLAST' // 소다 블라스트: 4미터 앞으로
  | 'SPICY_PEPPER' // 매운 고추: 다음 3문제가 2배 가치
  | 'WHOOSH' // 후우시: 뒤에 있는 플레이어를 1미터 뒤로
  | 'ROCKET_ATTACK' // 로켓 공격: 플레이어를 1미터 뒤로
  | 'BUSY_BEES' // 바쁜 벌들: 1등을 3미터 뒤로
  | 'FREEZE' // 얼리기: 플레이어를 7초간 얼리기
  | 'MINIFY' // 축소: 모든 플레이어 화면 축소
  | 'MIGHTY_SHIELD' // 강력한 방패: 다음 해로운 파워업 차단
  | 'BLOOK_FIESTA' // 블록 피에스타: 플레이어를 방해하는 블록 표시
  | 'INVINCIBLE' // 무적: 5초간 장애물 무시
  | 'OBSTACLE_SHIELD' // 방패: 다음 장애물 1회 무시
  | 'LASER_BLAST' // 파괴광선: 앞의 장애물 3개 파괴
  | 'JUMP' // 점프: 장애물 회피

export interface SchoolRacingItem {
  type: SchoolRacingItemType
  name: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export const SCHOOL_RACING_ITEMS: Record<SchoolRacingItemType, SchoolRacingItem> = {
  ENERGY_BOOST: {
    type: 'ENERGY_BOOST',
    name: '에너지 부스트',
    description: '자동으로 1미터 앞으로 이동!',
    icon: '⚡',
    rarity: 'common',
  },
  SODA_BLAST: {
    type: 'SODA_BLAST',
    name: '소다 블라스트',
    description: '4미터 앞으로 슝~ 날아감!',
    icon: '🥤',
    rarity: 'common',
  },
  SPICY_PEPPER: {
    type: 'SPICY_PEPPER',
    name: '매운 고추',
    description: '다음 3문제가 2배 가치!',
    icon: '🌶️',
    rarity: 'rare',
  },
  WHOOSH: {
    type: 'WHOOSH',
    name: '후우시',
    description: '뒤에 있는 친구를 1미터 뒤로!',
    icon: '💨',
    rarity: 'common',
  },
  ROCKET_ATTACK: {
    type: 'ROCKET_ATTACK',
    name: '로켓 공격',
    description: '아무 플레이어나 1미터 뒤로!',
    icon: '🚀',
    rarity: 'rare',
  },
  BUSY_BEES: {
    type: 'BUSY_BEES',
    name: '바쁜 벌들',
    description: '1등을 3미터 뒤로 보내기!',
    icon: '🐝',
    rarity: 'rare',
  },
  FREEZE: {
    type: 'FREEZE',
    name: '얼리기',
    description: '플레이어를 7초간 얼려서 못 움직이게!',
    icon: '❄️',
    rarity: 'epic',
  },
  MINIFY: {
    type: 'MINIFY',
    name: '축소',
    description: '모든 플레이어 화면을 축소!',
    icon: '🔍',
    rarity: 'epic',
  },
  MIGHTY_SHIELD: {
    type: 'MIGHTY_SHIELD',
    name: '강력한 방패',
    description: '다음 해로운 파워업을 차단!',
    icon: '🛡️',
    rarity: 'legendary',
  },
  BLOOK_FIESTA: {
    type: 'BLOOK_FIESTA',
    name: '블록 피에스타',
    description: '친구 화면에 블록이 나타나 방해!',
    icon: '🎉',
    rarity: 'epic',
  },
  // 새로운 장애물 관련 파워업
  INVINCIBLE: {
    type: 'INVINCIBLE',
    name: '무적',
    description: '5초간 모든 장애물을 무시!',
    icon: '🌟',
    rarity: 'epic',
  },
  OBSTACLE_SHIELD: {
    type: 'OBSTACLE_SHIELD',
    name: '장애물 방패',
    description: '다음 장애물 1회 무시!',
    icon: '🛡️',
    rarity: 'rare',
  },
  LASER_BLAST: {
    type: 'LASER_BLAST',
    name: '파괴광선',
    description: '앞의 장애물 3개 파괴!',
    icon: '💥',
    rarity: 'legendary',
  },
  JUMP: {
    type: 'JUMP',
    name: '점프',
    description: '앞의 장애물을 뛰어넘기!',
    icon: '🦘',
    rarity: 'common',
  },
}

// 맵 스테이지
export type MapStage = 'home' | 'city' | 'school'

export interface MapStageInfo {
  stage: MapStage
  name: string
  emoji: string
  startPosition: number
  endPosition: number
  description: string
}

export const MAP_STAGES: MapStageInfo[] = [
  {
    stage: 'home',
    name: '집 앞',
    emoji: '🏠',
    startPosition: 0,
    endPosition: 33,
    description: '엄마의 잔소리를 피해 아파트 단지 탈출',
  },
  {
    stage: 'city',
    name: '시내',
    emoji: '🏙️',
    startPosition: 33,
    endPosition: 66,
    description: '횡단보도, 편의점 앞을 지나는 혼잡한 거리',
  },
  {
    stage: 'school',
    name: '학교 앞',
    emoji: '🏫',
    startPosition: 66,
    endPosition: 100,
    description: '저 멀리 교문이 보이고, 선도부 선생님이 시계를 보며 기다림',
  },
]

export const TRACK_LENGTH = 100 // 100 step

/**
 * 랜덤 아이템 생성
 */
export function generateSchoolRacingItem(): SchoolRacingItem {
  const random = Math.random()

  let itemPool: SchoolRacingItem[]

  if (random < 0.5) {
    // Common (50%)
    itemPool = Object.values(SCHOOL_RACING_ITEMS).filter(item => item.rarity === 'common')
  } else if (random < 0.8) {
    // Rare (30%)
    itemPool = Object.values(SCHOOL_RACING_ITEMS).filter(item => item.rarity === 'rare')
  } else if (random < 0.95) {
    // Epic (15%)
    itemPool = Object.values(SCHOOL_RACING_ITEMS).filter(item => item.rarity === 'epic')
  } else {
    // Legendary (5%)
    itemPool = Object.values(SCHOOL_RACING_ITEMS).filter(item => item.rarity === 'legendary')
  }

  if (itemPool.length === 0) {
    itemPool = Object.values(SCHOOL_RACING_ITEMS)
  }

  return itemPool[Math.floor(Math.random() * itemPool.length)]
}

/**
 * 정답 속도에 따른 이동 거리 계산
 */
export function calculateMoveDistance(
  answerTime: number,
  timeLimit: number = 30,
  consecutiveCorrect: number = 0,
  multiplier: number = 1
): number {
  let baseDistance = 1

  // 빠를수록 보너스
  if (answerTime < 10) {
    baseDistance += 1
  }

  // 연속 정답 보너스
  if (consecutiveCorrect >= 3) {
    baseDistance += 1
  }

  return Math.floor(baseDistance * multiplier)
}

/**
 * 아이템 효과 적용
 */
export interface SchoolItemEffect {
  type: SchoolRacingItemType
  targetPlayerId?: string
  duration?: number
  value?: number
  affectsAll?: boolean
  obstacleIds?: string[] // 파괴할 장애물 ID
}

export function applySchoolItemEffect(
  item: SchoolRacingItem,
  currentPlayerId: string,
  allPlayers: Array<{ id: string; position: number }>,
  currentPosition: number,
  obstacles?: Obstacle[]
): SchoolItemEffect {
  switch (item.type) {
    case 'ENERGY_BOOST':
      return { type: 'ENERGY_BOOST', value: 1 }

    case 'SODA_BLAST':
      return { type: 'SODA_BLAST', value: 4 }

    case 'SPICY_PEPPER':
      return { type: 'SPICY_PEPPER', duration: 3 }

    case 'WHOOSH':
      const behindPlayers = allPlayers
        .filter(p => p.id !== currentPlayerId && p.position < currentPosition)
        .sort((a, b) => b.position - a.position)
      if (behindPlayers.length > 0) {
        return { type: 'WHOOSH', targetPlayerId: behindPlayers[0].id, value: -1 }
      }
      return { type: 'WHOOSH' }

    case 'ROCKET_ATTACK':
      const otherPlayers = allPlayers.filter(p => p.id !== currentPlayerId)
      if (otherPlayers.length > 0) {
        const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)]
        return { type: 'ROCKET_ATTACK', targetPlayerId: target.id, value: -1 }
      }
      return { type: 'ROCKET_ATTACK' }

    case 'BUSY_BEES':
      const topPlayer = allPlayers.reduce((top, p) =>
        p.position > top.position ? p : top
      )
      if (topPlayer.id !== currentPlayerId) {
        return { type: 'BUSY_BEES', targetPlayerId: topPlayer.id, value: -3 }
      }
      return { type: 'BUSY_BEES' }

    case 'FREEZE':
      const freezeTargets = allPlayers.filter(p => p.id !== currentPlayerId)
      if (freezeTargets.length > 0) {
        const target = freezeTargets[Math.floor(Math.random() * freezeTargets.length)]
        return { type: 'FREEZE', targetPlayerId: target.id, duration: 7 }
      }
      return { type: 'FREEZE' }

    case 'MINIFY':
      return { type: 'MINIFY', affectsAll: true, duration: 5 }

    case 'MIGHTY_SHIELD':
      return { type: 'MIGHTY_SHIELD', targetPlayerId: currentPlayerId, duration: 999 }

    case 'BLOOK_FIESTA':
      return { type: 'BLOOK_FIESTA', affectsAll: true, duration: 5 }

    // 새로운 장애물 파워업
    case 'INVINCIBLE':
      return { type: 'INVINCIBLE', targetPlayerId: currentPlayerId, duration: 5 }

    case 'OBSTACLE_SHIELD':
      return { type: 'OBSTACLE_SHIELD', targetPlayerId: currentPlayerId, duration: 999 }

    case 'LASER_BLAST':
      // 앞의 장애물 3개 파괴
      if (obstacles) {
        const aheadObstacles = obstacles
          .filter(o => o.isActive && o.position > currentPosition)
          .sort((a, b) => a.position - b.position)
          .slice(0, 3)
        return {
          type: 'LASER_BLAST',
          obstacleIds: aheadObstacles.map(o => o.id)
        }
      }
      return { type: 'LASER_BLAST' }

    case 'JUMP':
      return { type: 'JUMP', targetPlayerId: currentPlayerId, value: 2 }

    default:
      return { type: 'ENERGY_BOOST', value: 1 }
  }
}

/**
 * 현재 맵 스테이지 확인
 */
export function getCurrentStage(position: number): MapStageInfo {
  const percentage = (position / TRACK_LENGTH) * 100

  for (let i = MAP_STAGES.length - 1; i >= 0; i--) {
    if (percentage >= MAP_STAGES[i].startPosition) {
      return MAP_STAGES[i]
    }
  }

  return MAP_STAGES[0]
}
