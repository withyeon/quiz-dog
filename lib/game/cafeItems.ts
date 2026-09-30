export type ItemId =
  | 'GOLDEN_SPATULA'
  | 'EXPRESS_LANE'
  | 'SECRET_RECIPE'
  | 'RUSH_HOUR'
  | 'BAD_REVIEW'
  | 'COPY_CAT'
  | 'ROACH_ALERT'
  | 'PRICE_CRASH'
  | 'SUPER_AD'
  | 'TAX'

export interface CafeItem {
  id: ItemId
  name: string
  emoji: string // 이미지를 못 불러올 때 쓰는 대체 문자
  image: string // 픽셀 아트 경로
  description: string
  type: 'buff' | 'debuff'
  duration?: number
  rarity: 'common' | 'rare'
  /** 방해 아이템: 공격받은 친구 배너에 보여 줄 "나에게 무슨 일이 생겼는지" (description 은 공격자 시점) */
  victimText?: string
}

/** 황금 주걱을 쓰면 다음 서빙 수익이 몇 배가 되는지 */
export const GOLDEN_SPATULA_MULTIPLIER = 3

/** 세금: 상대가 지금 가진 돈에서 이 비율만큼 사라진다 (블루킷 카페의 TAXES!!! 와 같은 25%) */
export const TAX_RATE = 0.25

/**
 * 세금을 한 번 내면 이 시간(초) 동안은 또 걷히지 않는다.
 * 순위가 "끝났을 때 가진 돈"이라 1등에게 세금이 몰리는데, 아이템은 정답마다 공짜로 나오니
 * 막아 두지 않으면 여러 명이 연달아 걷어 1등 돈이 0에 가까워진다.
 */
export const TAX_IMMUNITY_SECONDS = 30

export const CAFE_ITEMS: Record<ItemId, CafeItem> = {
  GOLDEN_SPATULA: {
    id: 'GOLDEN_SPATULA',
    name: '황금 주걱',
    emoji: '🥄',
    image: '/cafe-items/golden-spatula.webp',
    description: `다음 서빙 수익 ${GOLDEN_SPATULA_MULTIPLIER}배!`,
    type: 'buff',
    rarity: 'rare',
  },
  EXPRESS_LANE: {
    id: 'EXPRESS_LANE',
    name: '특급 배달',
    emoji: '🚀',
    image: '/cafe-items/express-lane.webp',
    description: '30초간 손님 인내심 2배',
    type: 'buff',
    duration: 30000,
    rarity: 'common',
  },
  SECRET_RECIPE: {
    id: 'SECRET_RECIPE',
    name: '비법 레시피',
    emoji: '📖',
    image: '/cafe-items/secret-recipe.webp',
    description: '잠금 해제한 모든 메뉴 재고 +2',
    type: 'buff',
    rarity: 'common',
  },
  RUSH_HOUR: {
    id: 'RUSH_HOUR',
    name: '러시아워',
    emoji: '⚡',
    image: '/cafe-items/rush-hour.webp',
    description: '20초간 손님이 2배로 몰려옴',
    type: 'buff',
    duration: 20000,
    rarity: 'common',
  },
  BAD_REVIEW: {
    id: 'BAD_REVIEW',
    name: '악성 리뷰',
    emoji: '⭐',
    image: '/cafe-items/bad-review.webp',
    description: '상대 카페 손님이 모두 떠나고 15초간 발길 끊김',
    victimText: '손님이 모두 떠났어요 · 15초간 새 손님이 안 와요',
    type: 'debuff',
    duration: 15000,
    rarity: 'common',
  },
  COPY_CAT: {
    id: 'COPY_CAT',
    name: '카피캣',
    emoji: '🐱',
    image: '/cafe-items/copy-cat.webp',
    description: '1등이 연 가장 비싼 메뉴 1개를 무료로 해금!',
    type: 'buff',
    rarity: 'rare',
  },
  ROACH_ALERT: {
    id: 'ROACH_ALERT',
    name: '바퀴벌레 경보',
    emoji: '🪳',
    image: '/cafe-items/roach-alert.webp',
    description: '상대 카페 손님 절반이 도망가고 재고도 절반 버려짐!',
    victimText: '손님 절반이 도망가고 재고도 절반 버려졌어요',
    type: 'debuff',
    rarity: 'rare',
  },
  PRICE_CRASH: {
    id: 'PRICE_CRASH',
    name: '가격 폭락',
    emoji: '📉',
    image: '/cafe-items/price-crash.webp',
    description: '상대 판매가 20초간 반토막',
    victimText: '20초간 판매가가 반토막이에요',
    type: 'debuff',
    duration: 20000,
    rarity: 'common',
  },
  SUPER_AD: {
    id: 'SUPER_AD',
    name: '슈퍼 광고',
    emoji: '📢',
    image: '/cafe-items/super-ad.webp',
    description: '30초간 내 수익 1.5배',
    type: 'buff',
    duration: 30000,
    rarity: 'common',
  },
  TAX: {
    id: 'TAX',
    name: '세금',
    emoji: '💸',
    image: '/cafe-items/tax.webp',
    description: `상대가 가진 돈의 ${Math.round(TAX_RATE * 100)}%가 세금으로 사라짐!`,
    type: 'debuff',
    rarity: 'rare',
  },
}

/** 정답 한 번에 고를 수 있는 아이템 후보 개수 */
export const ITEM_CHOICE_COUNT = 3

/**
 * 아이템을 고를 수 있는 시간(초). 지나면 자동으로 버프 하나를 골라 준다.
 * 예전에는 3초였는데, 방해 아이템은 "아이템 → 대상" 두 번 눌러야 해서
 * 대상을 고르기 전에 타이머가 건너뛰기를 눌러 버렸다(방해 아이템이 안 먹히던 원인).
 */
export const ITEM_CHOICE_SECONDS = 10

/** 이만큼 연속으로 맞히면 희귀 아이템이 후보에 들어온다 */
export const RARE_ITEM_STREAK = 3

export function getRandomItemChoices(consecutiveCorrect: number = 0): CafeItem[] {
  const commons = Object.values(CAFE_ITEMS).filter(item => item.rarity === 'common')
  const rares = Object.values(CAFE_ITEMS).filter(item => item.rarity === 'rare')
  const pool = [...commons]

  if (consecutiveCorrect >= RARE_ITEM_STREAK && rares.length > 0) {
    pool.push(rares[Math.floor(Math.random() * rares.length)])
  }

  return [...pool].sort(() => Math.random() - 0.5).slice(0, ITEM_CHOICE_COUNT)
}
