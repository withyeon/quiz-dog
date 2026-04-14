export const INITIAL_SCORE = 1000

export const MIN_SCORE = 100

export const STREAK_THRESHOLD = 3
export const STREAK_MULTIPLIER = 1.5

export const RESCUE_INTERVAL = 5
export const RESCUE_MULTIPLIER = 3
export const RESCUE_BOTTOM_RATIO = 0.3

export const BETTING_TIME_LIMIT = 7

export const DOUBLE_DOWN_TIME_LIMIT = 5

export interface BetOption {
  id: string
  label: string
  emoji: string
  color: string
  bgColor: string
  borderColor: string
  glowColor: string
  getAmount: (score: number) => number
}

export const BET_OPTIONS: BetOption[] = [
  {
    id: 'safe',
    label: '조금만',
    emoji: '🛡️',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-400',
    glowColor: 'shadow-emerald-200',
    getAmount: (score) => Math.max(10, Math.floor(score * 0.1)),
  },
  {
    id: 'medium',
    label: '적당히',
    emoji: '💰',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-400',
    glowColor: 'shadow-blue-200',
    getAmount: (score) => Math.max(25, Math.floor(score * 0.25)),
  },
  {
    id: 'risky',
    label: '크게!',
    emoji: '🔥',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-400',
    glowColor: 'shadow-orange-200',
    getAmount: (score) => Math.max(50, Math.floor(score * 0.5)),
  },
  {
    id: 'allin',
    label: '전부!',
    emoji: '💎',
    color: 'text-purple-700',
    bgColor: 'bg-gradient-to-br from-purple-50 to-pink-50',
    borderColor: 'border-purple-500',
    glowColor: 'shadow-purple-300',
    getAmount: (score) => score,
  },
]

export function calculateBetResult(
  currentScore: number,
  betAmount: number,
  isCorrect: boolean,
): number {
  if (isCorrect) {
    return currentScore + betAmount
  }
  return Math.max(MIN_SCORE, currentScore - betAmount)
}

export function calculateDoubleDownResult(
  currentScore: number,
  originalReward: number,
  isCorrect: boolean,
): number {
  if (isCorrect) {
    return currentScore + originalReward * 2
  }
  return Math.max(MIN_SCORE, currentScore - originalReward)
}

export function getStreakMultiplier(consecutiveCorrect: number): number {
  if (consecutiveCorrect >= STREAK_THRESHOLD) {
    return STREAK_MULTIPLIER
  }
  return 1
}

export function isRescueRound(questionIndex: number): boolean {
  return questionIndex > 0 && questionIndex % RESCUE_INTERVAL === 0
}

export function shouldGetRescue(
  playerRank: number,
  totalPlayers: number,
): boolean {
  return playerRank > Math.ceil(totalPlayers * (1 - RESCUE_BOTTOM_RATIO))
}

export function getAppliedBetAmount(
  option: BetOption,
  score: number,
  streakMultiplier: number,
  hasRescueBoost: boolean,
): number {
  let amount = option.getAmount(score)
  if (streakMultiplier > 1) {
    amount = Math.floor(amount * streakMultiplier)
  }
  if (hasRescueBoost) {
    amount = Math.floor(amount * RESCUE_MULTIPLIER)
  }
  return amount
}

export function getPlayerRank(
  playerId: string,
  players: { id: string; score: number }[],
): number {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return sorted.findIndex((p) => p.id === playerId) + 1
}
