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
  icon: string
}

export type PoopAttack = {
  id: string
  type: 'poop_bomb'
  from: string
  createdAt: string
}

export const PUPPY_CHAOS_BONUS_GRACE_SECONDS = 12

/* ── 라운드 상수 ──
 * 화면에 그대로 보이는 숫자들입니다. 게임 화면·튜토리얼이 모두 여기서 가져오므로
 * 밸런스를 바꾸면 설명 문구도 함께 바뀝니다. */

/** 정답 라운드 — 맞히면 바로 받는 점수, 대소동 기본 보상, 버티는 시간 */
export const CORRECT_ROUND_SCORE = 100
export const CORRECT_ROUND_BASE_REWARD = 50
export const CORRECT_ROUND_SECONDS = 7

/** 오답 라운드 — 점수 없이 짧은 대소동만 */
export const WRONG_ROUND_BASE_REWARD = 20
export const WRONG_ROUND_SECONDS = 4

/** 문제 시간이 끝난 뒤 한 번만 하는 보너스 라운드 */
export const BONUS_ROUND_BASE_REWARD = 25
export const BONUS_ROUND_SECONDS = 5

/** 랜덤박스 — 몇 개 중에 고르는지, 몇 초 뒤 자동으로 열리는지 */
export const CARD_CHOICE_COUNT = 3
export const CARD_PICK_SECONDS = 5

/** 대소동 미니게임 — 똥에 맞으면 잃는 점수, 뼈다귀를 먹으면 받는 점수 */
export const POOP_HIT_PENALTY = 10
export const BONE_PICKUP_REWARD = 20

/** 카드 효과 */
export const BONE_CARD_SCORE = 50
export const POOP_BOMB_SCORE = 80
export const SCORE_THIEF_AMOUNT = 50
export const GOLDEN_DOG_SCORE = 500
export const CLEANER_DELAY_SECONDS = 2
export const MULTIPLIER_SMALL = 1.5
export const MULTIPLIER_BIG = 2

/** 황금 강아지가 나올 확률 (0~1) */
export const GOLDEN_DOG_CHANCE = 0.02

/** 연속 정답 배수 — 높은 단계부터 확인합니다 */
export const COMBO_STEPS: { streak: number; multiplier: number }[] = [
  { streak: 5, multiplier: MULTIPLIER_BIG },
  { streak: 3, multiplier: MULTIPLIER_SMALL },
]

export const CARD_DEFS: Record<PuppyChaosCardId, PuppyChaosCard> = {
  umbrella: {
    id: 'umbrella',
    rarity: 'common',
    label: '우산',
    emoji: '☂️',
    icon: '/puppy-chaos/umbrella.webp',
    description: '한 번은 괜찮아!',
  },
  bone: {
    id: 'bone',
    rarity: 'common',
    label: '뼈다귀',
    emoji: '🦴',
    icon: '/puppy-chaos/bone.webp',
    description: `점수 +${BONE_CARD_SCORE}!`,
  },
  multiplier_1_5: {
    id: 'multiplier_1_5',
    rarity: 'common',
    label: `${MULTIPLIER_SMALL}배`,
    emoji: '✨',
    icon: '/puppy-chaos/multiplier-1-5.webp',
    description: `이번 판 보상 ${MULTIPLIER_SMALL}배`,
  },
  cleaner: {
    id: 'cleaner',
    rarity: 'rare',
    label: '청소기',
    emoji: '🧹',
    icon: '/puppy-chaos/cleaner.webp',
    description: `${CLEANER_DELAY_SECONDS}초 후 화면을 싹!`,
  },
  multiplier_2: {
    id: 'multiplier_2',
    rarity: 'rare',
    label: `${MULTIPLIER_BIG}배`,
    emoji: '⭐',
    icon: '/puppy-chaos/multiplier-2.webp',
    description: `이번 판 보상 ${MULTIPLIER_BIG}배!`,
  },
  poop_bomb: {
    id: 'poop_bomb',
    rarity: 'attack',
    label: '똥폭탄',
    emoji: '💣',
    icon: '/puppy-chaos/poop-bomb.webp',
    description: '1등에게 대소동을!',
  },
  score_thief: {
    id: 'score_thief',
    rarity: 'attack',
    label: '점수 도둑',
    emoji: '🦹',
    icon: '/puppy-chaos/score-thief.webp',
    description: `랜덤 친구 점수 ${SCORE_THIEF_AMOUNT} 훔치기!`,
  },
  golden_dog: {
    id: 'golden_dog',
    rarity: 'legendary',
    label: '황금 강아지',
    emoji: '👑',
    icon: '/puppy-chaos/golden-dog.webp',
    description: `이번 판은 무적! +${GOLDEN_DOG_SCORE}!`,
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
  if (roll < GOLDEN_DOG_CHANCE) return CARD_DEFS.golden_dog
  if (roll < 0.60) return CARD_DEFS[pickOne(COMMON_CARDS)]
  if (roll < 0.90) return CARD_DEFS[pickOne(RARE_CARDS)]
  return CARD_DEFS[pickOne(ATTACK_CARDS)]
}

export function drawCardChoices(count = CARD_CHOICE_COUNT): PuppyChaosCard[] {
  return Array.from({ length: count }, () => drawCard())
}

export function getComboMultiplier(comboCount: number): number {
  return COMBO_STEPS.find((step) => comboCount >= step.streak)?.multiplier ?? 1
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
