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

export interface CafeItem {
  id: ItemId
  name: string
  emoji: string
  description: string
  type: 'buff' | 'debuff'
  duration?: number
  rarity: 'common' | 'rare'
}

export const CAFE_ITEMS: Record<ItemId, CafeItem> = {
  GOLDEN_SPATULA: {
    id: 'GOLDEN_SPATULA',
    name: '황금 주걱',
    emoji: '🥄',
    description: '다음 서빙 수익 3배!',
    type: 'buff',
    rarity: 'rare',
  },
  EXPRESS_LANE: {
    id: 'EXPRESS_LANE',
    name: '특급 배달',
    emoji: '🚀',
    description: '30초간 손님 인내심 2배',
    type: 'buff',
    duration: 30000,
    rarity: 'common',
  },
  SECRET_RECIPE: {
    id: 'SECRET_RECIPE',
    name: '비법 레시피',
    emoji: '📖',
    description: '잠금 해제한 모든 메뉴 재고 +2',
    type: 'buff',
    rarity: 'common',
  },
  RUSH_HOUR: {
    id: 'RUSH_HOUR',
    name: '러시아워',
    emoji: '⚡',
    description: '20초간 손님이 2배로 몰려옴',
    type: 'buff',
    duration: 20000,
    rarity: 'common',
  },
  BAD_REVIEW: {
    id: 'BAD_REVIEW',
    name: '악성 리뷰',
    emoji: '⭐',
    description: '상대 카페에 15초간 손님 발길 끊김',
    type: 'debuff',
    duration: 15000,
    rarity: 'common',
  },
  COPY_CAT: {
    id: 'COPY_CAT',
    name: '카피캣',
    emoji: '🐱',
    description: '1등 플레이어 메뉴 1개 무료 잠금 해제!',
    type: 'buff',
    rarity: 'rare',
  },
  ROACH_ALERT: {
    id: 'ROACH_ALERT',
    name: '바퀴벌레 경보',
    emoji: '🪳',
    description: '상대 카페 손님 절반이 도망감!',
    type: 'debuff',
    rarity: 'rare',
  },
  PRICE_CRASH: {
    id: 'PRICE_CRASH',
    name: '가격 폭락',
    emoji: '📉',
    description: '상대 판매가 20초간 반토막',
    type: 'debuff',
    duration: 20000,
    rarity: 'common',
  },
  SUPER_AD: {
    id: 'SUPER_AD',
    name: '슈퍼 광고',
    emoji: '📢',
    description: '30초간 내 수익 1.5배',
    type: 'buff',
    duration: 30000,
    rarity: 'common',
  },
}

export function getRandomItemChoices(consecutiveCorrect: number = 0): CafeItem[] {
  const commons = Object.values(CAFE_ITEMS).filter(item => item.rarity === 'common')
  const rares = Object.values(CAFE_ITEMS).filter(item => item.rarity === 'rare')
  const pool = [...commons]

  if (consecutiveCorrect >= 3 && rares.length > 0) {
    pool.push(rares[Math.floor(Math.random() * rares.length)])
  }

  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3)
}
