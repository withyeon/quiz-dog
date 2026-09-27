// Cafe 게임 로직 및 타입 정의

import { CHARACTERS } from '@/lib/utils/characters'

/** 카페 게임 화폐: 예전 $1 단위 = ₩1,000 */
export const CAFE_WON_PER_DOLLAR = 1000

export function formatCafeMoney(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatCafeMoneyDelta(amount: number): string {
  return `+${formatCafeMoney(amount)}`
}

export interface MenuItem {
  id: string
  name: string
  emoji: string // 하위 호환성
  image: string // 메뉴 이미지 경로
  cost: number // 구매 비용
  sellPrice: number // 판매 가격
  description: string
}

export interface Customer {
  id: string
  order: string // 주문한 메뉴 ID
  characterImage: string // 캐릭터 이미지 경로
  patience: number // 인내심 (초 단위)
  spawnTime: number // 생성 시간
}

export interface Upgrade {
  id: string
  name: string
  description: string
  cost: number
  effect: (state: CafeGameState) => CafeGameState
}

export interface CafeGameState {
  status: 'lobby' | 'playing' | 'ended'
  timeRemaining: number // 초 단위
  cash: number
  totalCashEarned: number
  customersServed: number
  unlockedMenus: string[] // 해금된 메뉴 ID 목록
  menuStock: Record<string, number> // 메뉴별 재고 (퀴즈 정답 시 충전)
  upgrades: {
    customerSpeed: number // 손님 등장 속도 배율 (기본 1.0)
    sellPriceMultiplier: number // 판매가 배율 (기본 1.0)
  }
  customers: Customer[]
  stats: {
    menuSales: Record<string, number> // 메뉴별 판매 횟수
  }
}

// 메뉴 데이터
export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'toast',
    name: '토스트',
    emoji: '🍞',
    image: '/cafe/webp/toast.webp',
    cost: 0, // 기본 제공
    sellPrice: 1_000,
    description: '따뜻하고 바삭한 토스트',
  },
  {
    id: 'cereal',
    name: '시리얼',
    emoji: '🥣',
    image: '/cafe/webp/cereal.webp',
    cost: 15_000,
    sellPrice: 3_000,
    description: '아침을 깨우는 시리얼',
  },
  {
    id: 'milk',
    name: '우유',
    emoji: '🥛',
    image: '/cafe/webp/milk.webp',
    cost: 50_000,
    sellPrice: 8_000,
    description: '신선한 우유',
  },
  {
    id: 'waffle',
    name: '와플',
    emoji: '🧇',
    image: '/cafe/webp/waffle.webp',
    cost: 80_000,
    sellPrice: 15_000,
    description: '달콤한 와플',
  },
  {
    id: 'coffee',
    name: '커피',
    emoji: '☕',
    image: '/cafe/webp/coffee.webp',
    cost: 200_000,
    sellPrice: 35_000,
    description: '진한 에스프레소',
  },
  {
    id: 'cake',
    name: '케이크',
    emoji: '🎂',
    image: '/cafe/webp/cake.webp',
    cost: 400_000,
    sellPrice: 80_000,
    description: '달콤한 생크림 케이크',
  },
  {
    id: 'pizza',
    name: '피자',
    emoji: '🍕',
    image: '/cafe/webp/pizza.webp',
    cost: 450_000,
    sellPrice: 150_000,
    description: '치즈가 가득한 피자',
  },
  {
    id: 'burger',
    name: '버거',
    emoji: '🍔',
    image: '/cafe/webp/burger.webp',
    cost: 500_000,
    sellPrice: 300_000,
    description: '든든한 햄버거',
  },
]

/** 가게 홍보를 사면 손님이 이 배수로 더 빨리 온다 */
export const ADVERTISING_SPEED_MULTIPLIER = 2

// 업그레이드 데이터
export const UPGRADES: Upgrade[] = [
  {
    id: 'advertising',
    name: '가게 홍보',
    description: `손님 등장 속도 ${ADVERTISING_SPEED_MULTIPLIER}배 증가`,
    cost: 60_000,
    effect: (state) => ({
      ...state,
      upgrades: {
        ...state.upgrades,
        customerSpeed: state.upgrades.customerSpeed * ADVERTISING_SPEED_MULTIPLIER,
      },
    }),
  },
  {
    id: 'secret_sauce',
    name: '비법 소스',
    description: '모든 메뉴 판매가 +20%',
    cost: 300_000,
    effect: (state) => ({
      ...state,
      upgrades: {
        ...state.upgrades,
        sellPriceMultiplier: state.upgrades.sellPriceMultiplier * 1.2,
      },
    }),
  },
  {
    id: 'faster_service',
    name: '빠른 서비스',
    description: '손님 등장 속도 추가 1.5배',
    cost: 450_000,
    effect: (state) => ({
      ...state,
      upgrades: {
        ...state.upgrades,
        customerSpeed: state.upgrades.customerSpeed * 1.5,
      },
    }),
  },
  {
    id: 'premium_ingredients',
    name: '프리미엄 재료',
    description: '모든 메뉴 판매가 추가 +30%',
    cost: 500_000,
    effect: (state) => ({
      ...state,
      upgrades: {
        ...state.upgrades,
        sellPriceMultiplier: state.upgrades.sellPriceMultiplier * 1.3,
      },
    }),
  },
]

/** 손님이 기다려 주는 시간 (초). 이 시간을 넘기면 그냥 가 버린다. */
export const CUSTOMER_PATIENCE_SECONDS = 15

/** 퀴즈 제한 시간 (초) */
export const CAFE_QUIZ_TIME_LIMIT = 30

/** 퀴즈 하나를 맞힐 때 채워지는 재고 수 */
export const RESTOCK_PER_CORRECT = 1

/** 처음부터 열려 있는 메뉴 */
export const STARTER_MENU_ID = 'toast'

// 손님 이모티콘 (하위 호환성)
/**
 * 손님 이미지를 못 불러올 때 쓰는 대체 이모지.
 * 캐릭터가 모두 강아지라 예전처럼 동물 이모지를 무작위로 뽑지 않는다.
 * (강아지 그림 자리에 🐸가 나오던 문제)
 */
export const CUSTOMER_FALLBACK_EMOJI = '🐶'

/**
 * 손님 캐릭터 이미지 경로.
 * 로비와 같은 캐릭터 로스터(CHARACTERS)를 쓰므로, 로스터에 캐릭터를 추가하면
 * 카페 손님에도 자동으로 등장한다. 예전에는 20이 하드코딩돼 있어서
 * 21~30번 캐릭터가 손님으로 영영 나오지 않았다.
 */
export function getRandomCharacterImage(): string {
  const characterNumber = Math.floor(Math.random() * CHARACTERS.length) + 1
  return `/character/webp/${characterNumber}.webp`
}

// 초기 게임 상태
export function getInitialState(): CafeGameState {
  return {
    status: 'lobby',
    timeRemaining: 420, // 7분 기본값
    cash: 0,
    totalCashEarned: 0,
    customersServed: 0,
    unlockedMenus: [STARTER_MENU_ID], // 토스트는 기본 제공
    menuStock: {}, // 재고는 퀴즈 정답 시 충전
    upgrades: {
      customerSpeed: 1.0,
      sellPriceMultiplier: 1.0,
    },
    customers: [],
    stats: {
      menuSales: {},
    },
  }
}

// 퀴즈 정답 시 메뉴 재고충전
export function restockMenu(state: CafeGameState, menuId: string): CafeGameState {
  // 해금된 메뉴만 재고충전 가능
  if (!state.unlockedMenus.includes(menuId)) {
    return state
  }

  return {
    ...state,
    menuStock: {
      ...state.menuStock,
      [menuId]: (state.menuStock[menuId] || 0) + RESTOCK_PER_CORRECT,
    },
  }
}

// 메뉴 재고 확인
export function hasStock(state: CafeGameState, menuId: string): boolean {
  return (state.menuStock[menuId] || 0) > 0
}

// 메뉴 구매 가능 여부 확인
export function canBuyMenu(state: CafeGameState, menuId: string): boolean {
  if (state.unlockedMenus.includes(menuId)) {
    return false // 이미 해금됨
  }
  const menu = MENU_ITEMS.find((m) => m.id === menuId)
  if (!menu) return false
  return state.cash >= menu.cost
}

// 메뉴 구매
export function buyMenu(state: CafeGameState, menuId: string): CafeGameState {
  if (!canBuyMenu(state, menuId)) {
    return state
  }
  const menu = MENU_ITEMS.find((m) => m.id === menuId)
  if (!menu) return state

  return {
    ...state,
    cash: state.cash - menu.cost,
    unlockedMenus: [...state.unlockedMenus, menuId],
  }
}

// 업그레이드 구매 가능 여부 확인
export function canBuyUpgrade(state: CafeGameState, upgradeId: string): boolean {
  const upgrade = UPGRADES.find((u) => u.id === upgradeId)
  if (!upgrade) return false
  return state.cash >= upgrade.cost
}

// 업그레이드 구매
export function buyUpgrade(state: CafeGameState, upgradeId: string): CafeGameState {
  if (!canBuyUpgrade(state, upgradeId)) {
    return state
  }
  const upgrade = UPGRADES.find((u) => u.id === upgradeId)
  if (!upgrade) return state

  const newState = upgrade.effect(state)
  return {
    ...newState,
    cash: newState.cash - upgrade.cost,
  }
}

// 손님 생성 (재고가 없어도 손님은 계속 나옴)
export function spawnCustomer(state: CafeGameState, currentTime: number): Customer | null {
  // 해금된 메뉴 중에서 선택 (재고 여부와 관계없이)
  if (state.unlockedMenus.length === 0) {
    return null // 해금된 메뉴가 없으면 손님 생성 안함
  }

  // 재고가 있는 메뉴 우선, 없으면 해금된 메뉴 중 랜덤
  const availableMenus = state.unlockedMenus.filter((menuId) => hasStock(state, menuId))
  const randomMenu = availableMenus.length > 0
    ? availableMenus[Math.floor(Math.random() * availableMenus.length)]
    : state.unlockedMenus[Math.floor(Math.random() * state.unlockedMenus.length)]

  const characterImage = getRandomCharacterImage()

  return {
    id: `customer-${Date.now()}-${Math.random()}`,
    order: randomMenu,
    characterImage: characterImage,
    patience: CUSTOMER_PATIENCE_SECONDS,
    spawnTime: currentTime,
  }
}

// 메뉴 서빙 (재고 소모)
export function serveCustomer(
  state: CafeGameState,
  customerId: string,
  menuId: string
): { success: boolean; newState: CafeGameState; earned: number } {
  const customer = state.customers.find((c) => c.id === customerId)
  if (!customer || customer.order !== menuId) {
    return { success: false, newState: state, earned: 0 }
  }

  // 재고 확인
  if (!hasStock(state, menuId)) {
    return { success: false, newState: state, earned: 0 }
  }

  const menu = MENU_ITEMS.find((m) => m.id === menuId)
  if (!menu) {
    return { success: false, newState: state, earned: 0 }
  }

  const basePrice = menu.sellPrice
  const finalPrice = Math.floor(basePrice * state.upgrades.sellPriceMultiplier)

  // 재고 소모
  const newStock = { ...state.menuStock }
  newStock[menuId] = (newStock[menuId] || 0) - 1

  const newState: CafeGameState = {
    ...state,
    cash: state.cash + finalPrice,
    totalCashEarned: state.totalCashEarned + finalPrice,
    customersServed: state.customersServed + 1,
    customers: state.customers.filter((c) => c.id !== customerId),
    menuStock: newStock,
    stats: {
      ...state.stats,
      menuSales: {
        ...state.stats.menuSales,
        [menuId]: (state.stats.menuSales[menuId] || 0) + 1,
      },
    },
  }

  return { success: true, newState, earned: finalPrice }
}

// 손님 제거 (인내심 소진)
export function removeCustomer(state: CafeGameState, customerId: string): CafeGameState {
  return {
    ...state,
    customers: state.customers.filter((c) => c.id !== customerId),
  }
}

/**
 * 정답을 맞혔을 때 어느 메뉴의 재고를 채울지 고른다.
 *
 * 예전에는 해금 메뉴 중 무작위였다. 그래서 토스트 손님 3명이 줄을 섰는데
 * 시리얼만 채워지고, 시리얼을 막 해금하면 시리얼은 영영 안 채워지는 식으로
 * 손님 주문과 재고가 어긋났다.
 *
 * 1순위: 지금 줄 선 손님이 주문했는데 재고가 0인 메뉴 (오래 기다린 손님부터)
 * 2순위: 해금 메뉴 중 재고가 가장 적은 메뉴 (같으면 비싼 메뉴) — 새로 연 메뉴가 여기서 채워진다
 */
export function pickRestockMenu(state: CafeGameState): string | null {
  if (state.unlockedMenus.length === 0) return null

  const waiting = [...state.customers].sort((a, b) => a.spawnTime - b.spawnTime)
  const unmet = waiting.find(
    (customer) => state.unlockedMenus.includes(customer.order) && !hasStock(state, customer.order),
  )
  if (unmet) return unmet.order

  return [...state.unlockedMenus].sort((a, b) => {
    const stockDiff = (state.menuStock[a] || 0) - (state.menuStock[b] || 0)
    if (stockDiff !== 0) return stockDiff
    const priceA = MENU_ITEMS.find((m) => m.id === a)?.sellPrice ?? 0
    const priceB = MENU_ITEMS.find((m) => m.id === b)?.sellPrice ?? 0
    return priceB - priceA
  })[0] ?? null
}

/** 바퀴벌레 경보: 모든 메뉴 재고가 절반(내림)으로 줄어든다 */
export function discardHalfStock(state: CafeGameState): CafeGameState {
  const menuStock: Record<string, number> = {}
  for (const [menuId, stock] of Object.entries(state.menuStock)) {
    menuStock[menuId] = Math.floor((stock || 0) / 2)
  }
  return { ...state, menuStock }
}

/**
 * 카페 진행 정보를 players.active_item(jsonb)에 실어 둔다.
 * 카피캣이 "1등이 어떤 메뉴를 열었는지" 알아야 해서 필요하다. 카페 방에서는
 * active_item을 다른 용도로 쓰지 않으므로(좀비·마피아 전용) 충돌하지 않는다.
 */
export type CafePlayerMeta = {
  unlockedMenus: string[]
}

export function getCafePlayerMenus(player: { active_item?: unknown } | null | undefined): string[] {
  const meta = player?.active_item as Partial<CafePlayerMeta> | null | undefined
  if (!meta || !Array.isArray(meta.unlockedMenus)) return []
  return meta.unlockedMenus.filter((id): id is string => typeof id === 'string')
}

/**
 * 카피캣: 나를 제외한 1등(점수 최고) 플레이어가 연 메뉴 중,
 * 내가 아직 안 연 것 가운데 가장 비싼 메뉴 하나. 없으면 null.
 *
 * 예전에는 1등이 누군지만 확인하고 정작 메뉴는 "내가 안 연 첫 메뉴"를 줬다.
 * 1등이 시리얼만 열었어도 나는 시리얼→우유→와플…이 차례로 열리는 버그.
 */
export function pickCopyCatMenu(
  players: Array<{ id: string; score?: number | null; is_kicked?: boolean | null; active_item?: unknown }>,
  currentPlayerId: string | null,
  myUnlockedMenus: string[],
): { topPlayer: { id: string } | null; menuId: string | null } {
  const topPlayer = players
    .filter((player) => player.id !== currentPlayerId && !player.is_kicked)
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0] ?? null
  if (!topPlayer) return { topPlayer: null, menuId: null }

  const theirMenus = new Set(getCafePlayerMenus(topPlayer))
  const candidate = [...MENU_ITEMS]
    .filter((menu) => theirMenus.has(menu.id) && !myUnlockedMenus.includes(menu.id))
    .sort((a, b) => b.cost - a.cost)[0]

  return { topPlayer, menuId: candidate?.id ?? null }
}

// 시간 포맷팅 (공통 유틸 re-export)
export { formatTime } from '@/lib/utils/formatTime'
