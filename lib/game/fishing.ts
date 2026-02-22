/**
 * 인형뽑기 게임 로직 (Fishing Frenzy 방식)
 */

// 물고기 관련 타입 (FishingPond 컴포넌트용)
export type FishRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Fish {
  id: string
  name: string
  emoji: string
  rarity: FishRarity
  points: number
  catchChance: number // 0-100 (낚을 확률)
}

export type DollTier = '꽝' | '일반' | '희귀' | '영웅' | '전설'

export interface Doll {
  id: string
  name: string
  emoji: string
  image?: string // 커스텀 이미지 경로 (없으면 emoji 사용)
  tier: DollTier
  score: number // 실제 획득 점수 (범위 내에서 계산됨)
  minScore: number // 최소 점수
  maxScore: number // 최대 점수
  color: string
  catchChance: number // 기본 낚을 확률 (0-100)
}

// 인형 데이터 (Fishing Frenzy 방식: 점수 범위와 확률 포함)
export const DOLL_TYPES: Omit<Doll, 'id' | 'score'>[] = [

  // 일반 (Easy One)
  { name: '하찮은 곰', emoji: '🧸', image: '/fishing/1.svg', tier: '일반', minScore: 10, maxScore: 25, color: 'text-amber-600', catchChance: 15 },
  { name: '오리 인형', emoji: '🦆', image: '/fishing/4.svg', tier: '일반', minScore: 20, maxScore: 45, color: 'text-amber-600', catchChance: 15 },
  { name: '골드 곰', emoji: '🧸', image: '/fishing/2.svg', tier: '일반', minScore: 30, maxScore: 65, color: 'text-amber-600', catchChance: 10 },
  { name: '개구리 인형', emoji: '🐸', image: '/fishing/5.svg', tier: '일반', minScore: 50, maxScore: 100, color: 'text-amber-600', catchChance: 15 },

  // 희귀 (Great Catch)
  { name: '눈사람 곰', emoji: '🧸', image: '/fishing/3.svg', tier: '희귀', minScore: 75, maxScore: 125, color: 'text-blue-500', catchChance: 5 },
  { name: '거북이 인형', emoji: '🐢', image: '/fishing/8.svg', tier: '희귀', minScore: 100, maxScore: 150, color: 'text-blue-500', catchChance: 5 },
  { name: '고양이 인형', emoji: '🐱', image: '/fishing/9.svg', tier: '희귀', minScore: 100, maxScore: 200, color: 'text-blue-500', catchChance: 5 },
  { name: '로맨틱 개구리', emoji: '🐸', image: '/fishing/6.svg', tier: '희귀', minScore: 150, maxScore: 350, color: 'text-blue-500', catchChance: 2 },

  // 영웅 (Rare Find)
  { name: '레몬 게', emoji: '🦀', image: '/fishing/10.svg', tier: '영웅', minScore: 200, maxScore: 400, color: 'text-purple-600', catchChance: 3 },
  { name: '도넛 블롭', emoji: '🍩', image: '/fishing/11.svg', tier: '영웅', minScore: 250, maxScore: 500, color: 'text-purple-600', catchChance: 2 },
  { name: '독 개구리', emoji: '🐸', image: '/fishing/7.svg', tier: '영웅', minScore: 300, maxScore: 600, color: 'text-purple-600', catchChance: 2 },

  // 전설 (Epic Grab)
  { name: '문어 인형', emoji: '🐙', image: '/fishing/12.svg', tier: '전설', minScore: 400, maxScore: 800, color: 'text-purple-600', catchChance: 1.5 },
  { name: '해적 복어', emoji: '🐡', image: '/fishing/14.svg', tier: '전설', minScore: 500, maxScore: 1000, color: 'text-purple-600', catchChance: 1 },
  { name: '진홍 문어', emoji: '🐙', image: '/fishing/13.svg', tier: '전설', minScore: 600, maxScore: 1200, color: 'text-purple-600', catchChance: 0.8 },

  // 신화 (Catch of the Day)
  { name: '메갈로돈', emoji: '🦈', image: '/fishing/15.svg', tier: '전설', minScore: 800, maxScore: 1500, color: 'text-yellow-500', catchChance: 0.5 },
  { name: '일각고래', emoji: '🦄', image: '/fishing/16.svg', tier: '전설', minScore: 1000, maxScore: 2000, color: 'text-yellow-500', catchChance: 0.3 },
  { name: 'UFO 인형', emoji: '🛸', tier: '전설', minScore: 1200, maxScore: 2500, color: 'text-yellow-500', catchChance: 0.2 },
  { name: '무지개 일각고래', emoji: '🦄', tier: '전설', minScore: 1500, maxScore: 3000, color: 'text-yellow-500', catchChance: 0.1 },

  // 신비 (Angler's Legend)
  { name: '신비의 외계인', emoji: '👽', tier: '전설', minScore: 2000, maxScore: 5000, color: 'text-yellow-500 drop-shadow-[0_0_10px_rgba(255,215,0,0.8)]', catchChance: 0.05 },
]

// 인형뽑기 상태
export type FishingState = 'idle' | 'down' | 'grab' | 'up' | 'return' | 'drop' | 'release'

// 기계 업그레이드 레벨 (Lure Rank)
export type MachineRank = 1 | 2 | 3 | 4 | 5

// 뽑기 결과
export interface FishingResult {
  success: boolean
  doll: Doll | null
  item: SpecialItem | null  // 아이템 뽑기 시 설정
  points: number
  message: string
  willFail: boolean // 떨어뜨릴지 여부
}

// ─── 특별 아이템 ───────────────────────────────────────────────
export type SpecialItemType =
  | 'DOUBLE_SCORE'    // 다음 인형 점수 2배
  | 'LUCKY_BOOST'     // 다음 뽑기 희귀도 상승
  | 'COIN_RAIN'       // 즉시 보너스 점수 지급
  | 'EXTRA_PULL'      // 즉시 한 번 더 뽑기
  | 'SHIELD'          // 다음 뽑기 실패 방지 (꽝 방지)

export interface SpecialItem {
  type: SpecialItemType
  name: string
  description: string
  emoji: string
  rarity: '일반' | '희귀' | '전설'
  bonusPoints?: number  // COIN_RAIN 전용
  catchChance: number   // 발동 확률 (0~100 중 가중치)
}

export const SPECIAL_ITEMS: SpecialItem[] = [
  {
    type: 'COIN_RAIN',
    name: '동전 소나기',
    description: '즉시 +150점!',
    emoji: '🪙',
    rarity: '일반',
    bonusPoints: 150,
    catchChance: 3.5,
  },
  {
    type: 'DOUBLE_SCORE',
    name: '2배 부스터',
    description: '다음 인형 점수가 2배!',
    emoji: '⚡',
    rarity: '희귀',
    catchChance: 2.5,
  },
  {
    type: 'LUCKY_BOOST',
    name: '행운의 별',
    description: '다음 뽑기에서 희귀 인형 확률 대폭 상승!',
    emoji: '⭐',
    rarity: '희귀',
    catchChance: 1.5,
  },
  {
    type: 'EXTRA_PULL',
    name: '한 번 더!',
    description: '즉시 한 번 더 뽑을 수 있어요!',
    emoji: '🎰',
    rarity: '전설',
    catchChance: 0.4,
  },
  {
    type: 'SHIELD',
    name: '행운의 부적',
    description: '다음 뽑기에서 절대 꽝이 없어요!',
    emoji: '🍀',
    rarity: '전설',
    catchChance: 0.3,
  },
]

/**
 * 특별 아이템 뽑기 시도 (전체 뽑기의 약 8% 발동)
 */
export function trySpecialItem(): SpecialItem | null {
  // 전체 아이템 발동 확률 약 8.2%
  const ITEM_TRIGGER_CHANCE = 0.082
  if (Math.random() > ITEM_TRIGGER_CHANCE) return null

  const total = SPECIAL_ITEMS.reduce((s, i) => s + i.catchChance, 0)
  let rand = Math.random() * total
  for (const item of SPECIAL_ITEMS) {
    rand -= item.catchChance
    if (rand <= 0) return item
  }
  return SPECIAL_ITEMS[0]
}


/**
 * 기계 업그레이드 레벨에 따른 희귀도 확률 보정
 */
function getRarityMultiplier(rank: MachineRank, tier: DollTier): number {
  const baseMultipliers: Record<MachineRank, Record<DollTier, number>> = {
    1: { '꽝': 0, '일반': 1.0, '희귀': 0.5, '영웅': 0.3, '전설': 0.1 },
    2: { '꽝': 0, '일반': 1.0, '희귀': 0.7, '영웅': 0.5, '전설': 0.2 },
    3: { '꽝': 0, '일반': 0.9, '희귀': 1.0, '영웅': 0.7, '전설': 0.4 },
    4: { '꽝': 0, '일반': 0.7, '희귀': 1.0, '영웅': 1.0, '전설': 0.7 },
    5: { '꽝': 0, '일반': 0.5, '희귀': 0.8, '영웅': 1.0, '전설': 1.0 },
  }
  return baseMultipliers[rank][tier]
}

/**
 * 대성공 이벤트 여부 확인 (Fishing Frenzy 이벤트)
 */
export function checkFrenzyEvent(): boolean {
  // 5% 확률로 대성공 이벤트 발생
  return Math.random() < 0.05
}

/**
 * 인형뽑기 실행 (Fishing Frenzy 방식)
 * @param answerTime 정답까지 걸린 시간 (초)
 * @param machineRank 기계 업그레이드 레벨 (1-5)
 * @param isFrenzyEvent 대성공 이벤트 활성화 여부
 */
export function tryFishing(
  answerTime: number = 30,
  machineRank: MachineRank = 1,
  isFrenzyEvent: boolean = false
): FishingResult {
  // 1. 정답 시간에 따른 점수 보정 (빠를수록 높은 점수)
  // 30초 기준, 빠를수록 1.0에 가까워짐
  const timeBonus = Math.max(0, 30 - answerTime) / 30 // 0 ~ 1
  const speedMultiplier = 0.5 + (timeBonus * 0.5) // 0.5 ~ 1.0 (빠를수록 높음)

  // 2. 대성공 이벤트 보정
  const frenzyMultiplier = isFrenzyEvent ? 2.0 : 1.0

  // 3. 확률 계산 (기계 업그레이드 레벨 반영)
  const adjustedDolls = DOLL_TYPES.map(doll => ({
    ...doll,
    adjustedChance: doll.catchChance * getRarityMultiplier(machineRank, doll.tier) * frenzyMultiplier,
  }))

  // 4. 누적 확률로 인형 선택
  const totalChance = adjustedDolls.reduce((sum, doll) => sum + doll.adjustedChance, 0)
  const random = Math.random() * totalChance
  let cumulativeChance = 0

  let selected: typeof DOLL_TYPES[0] | null = null
  for (const doll of adjustedDolls) {
    cumulativeChance += doll.adjustedChance
    if (random <= cumulativeChance) {
      selected = doll
      break
    }
  }

  // 안전장치: 선택되지 않았으면 가장 흔한 것 선택
  if (!selected) {
    selected = DOLL_TYPES[0]
  }

  // 5. 점수 범위 내에서 실제 점수 계산 (속도 보너스 적용)
  const scoreRange = selected.maxScore - selected.minScore
  const baseScore = selected.minScore + (scoreRange * speedMultiplier)
  const finalScore = Math.round(baseScore)

  // 6. 무조건 성공 (꽝 제거, 떨어뜨리기 제거)
  const newDoll: Doll = {
    ...selected,
    id: Math.random().toString(),
    score: finalScore,
  }

  return {
    success: true,
    doll: newDoll,
    item: null,
    points: finalScore,
    message: `${newDoll.name} 획득! (+${finalScore}점)`,
    willFail: false,
  }
}

/**
 * 티어별 색상 클래스
 */
export function getTierColor(tier: DollTier): string {
  switch (tier) {
    case '꽝':
      return 'bg-gray-500'
    case '일반':
      return 'bg-amber-500'
    case '희귀':
      return 'bg-blue-500'
    case '영웅':
      return 'bg-purple-500'
    case '전설':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-500'
  }
}

/**
 * 티어별 한글 이름
 */
export function getTierName(tier: DollTier): string {
  return tier
}

/**
 * 플레이어의 획득한 인형 목록에서 총 점수 계산
 */
export function calculateTotalPoints(caughtDolls: Doll[]): number {
  return caughtDolls.reduce((total, doll) => total + doll.score, 0)
}

/**
 * 문제 수에 따른 기계 업그레이드 레벨 계산
 * @param correctAnswers 맞춘 문제 수
 */
export function getMachineRank(correctAnswers: number): MachineRank {
  if (correctAnswers >= 20) return 5
  if (correctAnswers >= 15) return 4
  if (correctAnswers >= 10) return 3
  if (correctAnswers >= 5) return 2
  return 1
}

/**
 * 기계 업그레이드 레벨 이름
 */
export function getMachineRankName(rank: MachineRank): string {
  const names = {
    1: '기본 기계',
    2: '개선된 기계',
    3: '고급 기계',
    4: '프리미엄 기계',
    5: '전설의 기계',
  }
  return names[rank]
}

/**
 * 희귀도별 색상 (FishingPond 컴포넌트용)
 */
export function getRarityColor(rarity: FishRarity): string {
  switch (rarity) {
    case 'common':
      return 'bg-gray-500'
    case 'rare':
      return 'bg-blue-500'
    case 'epic':
      return 'bg-purple-500'
    case 'legendary':
      return 'bg-yellow-500'
    default:
      return 'bg-gray-500'
  }
}

/**
 * 희귀도별 한글 이름 (FishingPond 컴포넌트용)
 */
export function getRarityName(rarity: FishRarity): string {
  switch (rarity) {
    case 'common':
      return '일반'
    case 'rare':
      return '레어'
    case 'epic':
      return '에픽'
    case 'legendary':
      return '전설'
    default:
      return '일반'
  }
}
