export type PuppyChaosQuestion = {
  id: number
  question: string
  choices: string[]
  answerIndex: number
}

export type CardRarity = 'common' | 'rare' | 'attack' | 'legendary'

export type PuppyChaosCardId =
  | 'umbrella'
  | 'bone'
  | 'multiplier_1_5'
  | 'cleaner'
  | 'multiplier_2'
  | 'poop_bomb'
  | 'score_thief'
  | 'golden_dog'

export type PuppyChaosCard = {
  id: PuppyChaosCardId
  rarity: CardRarity
  label: string
  description: string
  emoji: string
}

export type PoopAttack = {
  id: string
  type: 'poop_bomb'
  from: string
  createdAt: string
}

export const DUMMY_QUESTIONS: PuppyChaosQuestion[] = [
  { id: 1, question: '2 + 3 = ?', choices: ['4', '5', '6', '7'], answerIndex: 1 },
  { id: 2, question: '강아지는 무엇을 좋아할까요?', choices: ['뼈다귀', '당근', '사과', '양파'], answerIndex: 0 },
  { id: 3, question: '대한민국의 수도는?', choices: ['부산', '대구', '서울', '인천'], answerIndex: 2 },
  { id: 4, question: '물은 몇 도에서 얼까요?', choices: ['0도', '10도', '-10도', '100도'], answerIndex: 0 },
  { id: 5, question: '다음 중 동물은?', choices: ['책상', '고양이', '연필', '컵'], answerIndex: 1 },
  { id: 6, question: '5 x 2 = ?', choices: ['7', '10', '12', '15'], answerIndex: 1 },
  { id: 7, question: '봄 다음 계절은?', choices: ['겨울', '가을', '여름', '봄'], answerIndex: 2 },
  { id: 8, question: '하늘이 맑을 때 많이 보이는 것은?', choices: ['구름', '태양', '눈', '번개'], answerIndex: 1 },
  { id: 9, question: '다음 중 과일은?', choices: ['축구공', '바나나', '가위', '신발'], answerIndex: 1 },
  { id: 10, question: '10 - 4 = ?', choices: ['4', '5', '6', '8'], answerIndex: 2 },
]

export const CARD_DEFS: Record<PuppyChaosCardId, PuppyChaosCard> = {
  umbrella: {
    id: 'umbrella',
    rarity: 'common',
    label: '우산',
    emoji: '☂️',
    description: '한 번은 괜찮아!',
  },
  bone: {
    id: 'bone',
    rarity: 'common',
    label: '뼈다귀',
    emoji: '🦴',
    description: '점수 +50!',
  },
  multiplier_1_5: {
    id: 'multiplier_1_5',
    rarity: 'common',
    label: '1.5배',
    emoji: '✨',
    description: '이번 판 보상 1.5배',
  },
  cleaner: {
    id: 'cleaner',
    rarity: 'rare',
    label: '청소기',
    emoji: '🧹',
    description: '2초 후 화면을 싹!',
  },
  multiplier_2: {
    id: 'multiplier_2',
    rarity: 'rare',
    label: '2배',
    emoji: '⭐',
    description: '이번 판 보상 2배!',
  },
  poop_bomb: {
    id: 'poop_bomb',
    rarity: 'attack',
    label: '똥폭탄',
    emoji: '💣',
    description: '1등에게 대소동을!',
  },
  score_thief: {
    id: 'score_thief',
    rarity: 'attack',
    label: '점수 도둑',
    emoji: '🦹',
    description: '랜덤 친구 점수 50 훔치기!',
  },
  golden_dog: {
    id: 'golden_dog',
    rarity: 'legendary',
    label: '황금 강아지',
    emoji: '👑🐕',
    description: '이번 판은 무적! +500!',
  },
}

const COMMON_CARDS: PuppyChaosCardId[] = ['umbrella', 'bone', 'multiplier_1_5']
const RARE_CARDS: PuppyChaosCardId[] = ['cleaner', 'multiplier_2']
const ATTACK_CARDS: PuppyChaosCardId[] = ['poop_bomb', 'score_thief']

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function drawCard(): PuppyChaosCard {
  const roll = Math.random()
  if (roll < 0.02) return CARD_DEFS.golden_dog
  if (roll < 0.60) return CARD_DEFS[pickOne(COMMON_CARDS)]
  if (roll < 0.90) return CARD_DEFS[pickOne(RARE_CARDS)]
  return CARD_DEFS[pickOne(ATTACK_CARDS)]
}

export function drawCardChoices(count = 3): PuppyChaosCard[] {
  return Array.from({ length: count }, () => drawCard())
}

export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 5) return 2
  if (comboCount >= 3) return 1.5
  return 1
}

export function clampRoundReward(value: number): number {
  return Math.max(0, Math.round(value))
}

export function createPoopBombAttack(from: string): PoopAttack {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'poop_bomb',
    from,
    createdAt: new Date().toISOString(),
  }
}

export function parsePendingAttacks(value: unknown): PoopAttack[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is PoopAttack => {
    if (!item || typeof item !== 'object') return false
    const attack = item as Partial<PoopAttack>
    return attack.type === 'poop_bomb' && typeof attack.id === 'string'
  })
}
