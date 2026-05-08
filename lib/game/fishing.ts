export type DollTier = '꽝' | '일반' | '희귀' | '영웅' | '전설'
export type AnswerSpeedGrade = 'perfect' | 'fast' | 'steady' | 'slow'
export type AimGrade = 'perfect' | 'great' | 'good' | 'safe'

// 연속 정답 콤보 시스템
export interface ComboState {
  count: number       // 연속 정답 수
  multiplier: number  // 점수 배수
  label: string       // 표시 레이블
}

export function getComboState(consecutiveCorrect: number): ComboState {
  if (consecutiveCorrect >= 5) return { count: consecutiveCorrect, multiplier: 2.0, label: 'MAX 콤보! 🔥🔥🔥' }
  if (consecutiveCorrect >= 4) return { count: consecutiveCorrect, multiplier: 1.7, label: '4 콤보! 🔥🔥' }
  if (consecutiveCorrect >= 3) return { count: consecutiveCorrect, multiplier: 1.4, label: '3 콤보! 🔥' }
  if (consecutiveCorrect >= 2) return { count: consecutiveCorrect, multiplier: 1.2, label: '2 콤보!' }
  return { count: consecutiveCorrect, multiplier: 1.0, label: '' }
}

// 조준 속도 계산: 기계 랭크가 오를수록 더 빠르게 (더 어렵게)
export function getAimSpeed(machineRank: MachineRank): number {
  const speeds: Record<MachineRank, number> = {
    1: 1.8,
    2: 2.2,
    3: 2.6,
    4: 3.1,
    5: 3.7,
  }
  return speeds[machineRank]
}

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

// 인형 데이터: 정답 보상과 조작 정확도에 따라 희귀도 가중치가 달라진다.
export const DOLL_TYPES: Omit<Doll, 'id' | 'score'>[] = [
  { name: '수줍은 곰 인형', emoji: '🧸', image: '/fishing/1.svg', tier: '일반', minScore: 20, maxScore: 45, color: 'text-amber-600', catchChance: 18 },
  { name: '리본 오리 인형', emoji: '🦆', image: '/fishing/4.svg', tier: '일반', minScore: 30, maxScore: 65, color: 'text-amber-600', catchChance: 17 },
  { name: '햇살 곰 인형', emoji: '🧸', image: '/fishing/2.svg', tier: '일반', minScore: 45, maxScore: 85, color: 'text-amber-600', catchChance: 13 },
  { name: '초록 점퍼 인형', emoji: '🐸', image: '/fishing/5.svg', tier: '일반', minScore: 55, maxScore: 105, color: 'text-amber-600', catchChance: 13 },

  { name: '눈꽃 곰 인형', emoji: '🧸', image: '/fishing/3.svg', tier: '희귀', minScore: 110, maxScore: 180, color: 'text-blue-500', catchChance: 6 },
  { name: '말랑 거북 인형', emoji: '🐢', image: '/fishing/8.svg', tier: '희귀', minScore: 125, maxScore: 210, color: 'text-blue-500', catchChance: 5.5 },
  { name: '밤하늘 고양이', emoji: '🐱', image: '/fishing/9.svg', tier: '희귀', minScore: 150, maxScore: 260, color: 'text-blue-500', catchChance: 4.5 },
  { name: '하트 개구리 인형', emoji: '🐸', image: '/fishing/6.svg', tier: '희귀', minScore: 180, maxScore: 330, color: 'text-blue-500', catchChance: 3.5 },

  { name: '레몬 크랩 쿠션', emoji: '🦀', image: '/fishing/10.svg', tier: '영웅', minScore: 260, maxScore: 460, color: 'text-purple-600', catchChance: 2.6 },
  { name: '도넛 블롭 인형', emoji: '🍩', image: '/fishing/11.svg', tier: '영웅', minScore: 320, maxScore: 560, color: 'text-purple-600', catchChance: 2.2 },
  { name: '네온 개구리 인형', emoji: '🐸', image: '/fishing/7.svg', tier: '영웅', minScore: 380, maxScore: 680, color: 'text-purple-600', catchChance: 1.9 },

  { name: '별빛 문어 인형', emoji: '🐙', image: '/fishing/12.svg', tier: '전설', minScore: 580, maxScore: 980, color: 'text-yellow-500', catchChance: 1.1 },
  { name: '해적 복어 인형', emoji: '🐡', image: '/fishing/14.svg', tier: '전설', minScore: 720, maxScore: 1200, color: 'text-yellow-500', catchChance: 0.8 },
  { name: '진홍 문어 인형', emoji: '🐙', image: '/fishing/13.svg', tier: '전설', minScore: 850, maxScore: 1450, color: 'text-yellow-500', catchChance: 0.6 },
  { name: '무지개 일각 인형', emoji: '🦄', image: '/fishing/16.svg', tier: '전설', minScore: 1200, maxScore: 2200, color: 'text-yellow-500 drop-shadow-[0_0_10px_rgba(255,215,0,0.7)]', catchChance: 0.35 },
  { name: 'UFO 스페셜 인형', emoji: '🛸', tier: '전설', minScore: 1600, maxScore: 3000, color: 'text-yellow-500 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]', catchChance: 0.18 },
]

// 인형뽑기 상태
export type FishingState = 'idle' | 'aim' | 'down' | 'grab' | 'up' | 'return' | 'drop' | 'release'

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
  accuracy: number
  aimGrade: AimGrade
  speedGrade: AnswerSpeedGrade
  speedMultiplier: number
  accuracyMultiplier: number
  rankMultiplier: number
  bonusPoints: number
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
    name: '보너스 코인',
    description: '이번 뽑기 점수 +150',
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
    name: '복습 티켓',
    description: '다음 정답 보상이 더 커져요.',
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
  // 전체 아이템 발동 확률 약 10%
  const ITEM_TRIGGER_CHANCE = 0.1
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
    1: { '꽝': 0, '일반': 1.15, '희귀': 0.45, '영웅': 0.18, '전설': 0.05 },
    2: { '꽝': 0, '일반': 1.0, '희귀': 0.7, '영웅': 0.3, '전설': 0.1 },
    3: { '꽝': 0, '일반': 0.9, '희귀': 1.0, '영웅': 0.55, '전설': 0.2 },
    4: { '꽝': 0, '일반': 0.72, '희귀': 1.08, '영웅': 0.85, '전설': 0.38 },
    5: { '꽝': 0, '일반': 0.58, '희귀': 1.0, '영웅': 1.05, '전설': 0.62 },
  }
  return baseMultipliers[rank][tier]
}

function getAccuracyTierMultiplier(accuracy: number, tier: DollTier): number {
  if (tier === '꽝') return 0

  const safeAccuracy = Math.max(0, Math.min(1, accuracy))
  const rareLift = 0.65 + safeAccuracy * 0.95
  const commonBalance = 1.18 - safeAccuracy * 0.35

  if (tier === '일반') return commonBalance
  if (tier === '희귀') return 0.78 + safeAccuracy * 0.62
  if (tier === '영웅') return rareLift
  return 0.45 + safeAccuracy * 1.25
}

/**
 * 대성공 이벤트 여부 확인 (Fishing Frenzy 이벤트)
 */
export function checkFrenzyEvent(): boolean {
  // 5% 확률로 대성공 이벤트 발생
  return Math.random() < 0.05
}

export function getAnswerSpeedGrade(answerTime: number): AnswerSpeedGrade {
  if (answerTime <= 6) return 'perfect'
  if (answerTime <= 12) return 'fast'
  if (answerTime <= 22) return 'steady'
  return 'slow'
}

export function getAnswerSpeedLabel(grade: AnswerSpeedGrade): string {
  const labels: Record<AnswerSpeedGrade, string> = {
    perfect: '번개 정답',
    fast: '빠른 정답',
    steady: '안정 정답',
    slow: '끈기 정답',
  }
  return labels[grade]
}

export function getSpeedMultiplier(answerTime: number): number {
  const grade = getAnswerSpeedGrade(answerTime)
  const multipliers: Record<AnswerSpeedGrade, number> = {
    perfect: 1.28,
    fast: 1.16,
    steady: 1.02,
    slow: 0.92,
  }
  return multipliers[grade]
}

export function getAimGrade(accuracy: number): AimGrade {
  if (accuracy >= 0.92) return 'perfect'
  if (accuracy >= 0.72) return 'great'
  if (accuracy >= 0.48) return 'good'
  return 'safe'
}

export function getAimGradeLabel(grade: AimGrade): string {
  const labels: Record<AimGrade, string> = {
    perfect: '정중앙',
    great: '좋은 조준',
    good: '안정 조준',
    safe: '아슬아슬',
  }
  return labels[grade]
}

export function getAccuracyMultiplier(accuracy: number): number {
  return 0.82 + Math.max(0, Math.min(1, accuracy)) * 0.42
}

export function getRankScoreMultiplier(rank: MachineRank): number {
  return 1 + (rank - 1) * 0.08
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
  isFrenzyEvent: boolean = false,
  aimAccuracy: number = 0.65,
  bonusPoints: number = 0,
  comboMultiplier: number = 1.0,
): FishingResult {
  const safeAccuracy = Math.max(0, Math.min(1, aimAccuracy))
  const speedGrade = getAnswerSpeedGrade(answerTime)
  const aimGrade = getAimGrade(safeAccuracy)
  const speedMultiplier = getSpeedMultiplier(answerTime)
  const accuracyMultiplier = getAccuracyMultiplier(safeAccuracy)
  const rankMultiplier = getRankScoreMultiplier(machineRank)
  const frenzyMultiplier = isFrenzyEvent ? 2.0 : 1.0

  const adjustedDolls = DOLL_TYPES.map(doll => ({
    ...doll,
    adjustedChance: doll.catchChance
      * getRarityMultiplier(machineRank, doll.tier)
      * getAccuracyTierMultiplier(safeAccuracy, doll.tier)
      * frenzyMultiplier,
  }))

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

  const scoreRange = selected.maxScore - selected.minScore
  const baseScore = selected.minScore + (scoreRange * (0.35 + safeAccuracy * 0.65))
  const finalScore = Math.round(baseScore * speedMultiplier * accuracyMultiplier * rankMultiplier * comboMultiplier) + bonusPoints

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
    accuracy: safeAccuracy,
    aimGrade,
    speedGrade,
    speedMultiplier,
    accuracyMultiplier,
    rankMultiplier,
    bonusPoints,
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

export function getTierBorderColor(tier: DollTier): string {
  switch (tier) {
    case '꽝':
      return 'border-gray-400'
    case '일반':
      return 'border-amber-300'
    case '희귀':
      return 'border-sky-300'
    case '영웅':
      return 'border-violet-300'
    case '전설':
      return 'border-yellow-300'
    default:
      return 'border-gray-300'
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

export function getMachineRankProgress(correctAnswers: number): {
  rank: MachineRank
  current: number
  next: number | null
  progress: number
  remaining: number
} {
  const rank = getMachineRank(correctAnswers)
  const thresholds: Record<MachineRank, { current: number; next: number | null }> = {
    1: { current: 0, next: 5 },
    2: { current: 5, next: 10 },
    3: { current: 10, next: 15 },
    4: { current: 15, next: 20 },
    5: { current: 20, next: null },
  }
  const { current, next } = thresholds[rank]

  if (next === null) {
    return { rank, current, next, progress: 100, remaining: 0 }
  }

  const progress = Math.min(100, Math.max(0, ((correctAnswers - current) / (next - current)) * 100))
  return { rank, current, next, progress, remaining: Math.max(0, next - correctAnswers) }
}

/**
 * 기계 업그레이드 레벨 이름
 */
export function getMachineRankName(rank: MachineRank): string {
  const names = {
    1: '스탠다드 크레인',
    2: '집중 크레인',
    3: '정밀 크레인',
    4: '프리미엄 크레인',
    5: '마스터 크레인',
  }
  return names[rank]
}
