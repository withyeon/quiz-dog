/**
 * 블록 텃밭 키우기 — 규칙·상수·순수 함수.
 *
 * 로블록스의 텃밭 키우기(Grow a Garden)식 타이쿤을 퀴즈 게임으로 옮긴 모드다.
 * 흐름: 퀴즈 정답 → 무료 씨앗 3장 중 1장 고르기(+ 씨앗 가게 재입고) → 밭 화면(제한 시간)에서
 * 씨앗을 심고, 다 자란 작물을 수확해 팔고, 번 돈으로 씨앗·밭·스프링클러·허수아비를 산다 → 다음 문제.
 *
 * - 작물은 밭 시계(clockMs)로 자란다. 밭 시계는 퀴즈를 푸는 동안에도 돌고, 선생님이 멈추면 같이 멈춘다.
 * - 다 자란 작물은 가끔 변이(황금 ×3·무지개 ×10, 비 올 때 촉촉 ×2)가 생긴다. 실력과 무관한 랜덤이다.
 *   (정답 연속에 보상을 더 주면 잘하는 아이가 독주한다 — 붕어빵·라면가게와 같은 원칙)
 * - 딸기·사과나무처럼 한 번 심으면 여러 번 열리는 작물이 있다.
 * - 가끔 씨앗 대신 까마귀 카드가 나온다. 친구 밭에 보내면, 친구가 3번 톡톡 눌러 쫓지 못했을 때
 *   가장 많이 자란 작물이 처음부터 다시 자란다(작물이 없어지지는 않는다). 허수아비가 있으면 막아 준다.
 *
 * 학생별 상태는 players 행 두 칸을 쓴다 (새 컬럼 없음, sql/20261021_garden_mode.sql):
 *   players.score        = 작물을 팔아 번 돈 합(코인) — 순위 기준. 돈을 써도 줄지 않는다.
 *   players.item_effects = GardenState JSON (지갑·밭·씨앗 가방·가게·업그레이드·통계)
 */

// ─── 상수 ───
export const GARDEN = {
  /** 밭 한 변 칸 수 (GRID × GRID) */
  GRID: 4,
  /** 처음 열려 있는 칸 수 (UNLOCK_ORDER 앞에서부터) */
  START_UNLOCKED: 4,
  /** 처음 지갑 */
  START_COINS: 20,
  /** 밭 화면에 머무는 시간(ms). 지나면 다음 문제로 */
  VISIT_MS: 25000,
  /** 정답 때 고르는 무료 카드 수 */
  CHOICES: 3,
  /** 카드 한 장이 까마귀 카드일 확률 (친구가 있을 때만) */
  CROW_CARD_CHANCE: 0.1,
  /** 까마귀를 쫓으려면 누르는 횟수 */
  CROW_SHOO_TAPS: 3,
  /** 까마귀가 작물을 쪼기까지 시간(ms) */
  CROW_PECK_MS: 7000,
  /** 허수아비 최대 개수 */
  SCARECROW_MAX: 2,
  SCARECROW_PRICE: 80,
  /** 변이 확률·배수 */
  GOLD_CHANCE: 0.06,
  GOLD_MULT: 3,
  RAINBOW_CHANCE: 0.01,
  RAINBOW_MULT: 10,
  /** 비 올 때 다 자란 작물이 촉촉 변이가 될 확률·배수 */
  WET_CHANCE: 0.35,
  WET_MULT: 2,
  /** 비: 밭 시계 기준 이 간격(ms)마다, 이 시간 동안 내린다. 비가 오면 빨리 자란다 */
  RAIN_EVERY_MIN_MS: 60000,
  RAIN_EVERY_MAX_MS: 100000,
  RAIN_MS: 20000,
  RAIN_SPEED: 1.5,
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 오답 화면 시간(ms) */
  WRONG_ANSWER_DELAY_MS: 2000,
} as const

/** 칸이 열리는 순서. 가운데 4칸에서 시작해 바깥으로 넓어진다 (0 = 맨 뒤 왼쪽, 15 = 맨 앞 오른쪽) */
export const UNLOCK_ORDER: readonly number[] = [5, 6, 9, 10, 1, 2, 4, 8, 7, 11, 13, 14, 0, 3, 12, 15]

/** 칸 늘리기 값 (START_UNLOCKED 다음 칸부터 차례로) */
export const EXPAND_PRICES: readonly number[] = [40, 60, 90, 130, 180, 240, 320, 420, 550, 700, 900, 1200]

/** 스프링클러 단계별 값·성장 속도 */
export const SPRINKLER_LEVELS: ReadonlyArray<{ price: number; speed: number }> = [
  { price: 0, speed: 1 },
  { price: 120, speed: 1.25 },
  { price: 300, speed: 1.5 },
  { price: 650, speed: 2 },
]

// ─── 작물 ───
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythic'

export const RARITY: Record<Rarity, { label: string; weight: number; color: string; ring: string; stockChance: number; stockQty: [number, number] }> = {
  common: { label: '흔함', weight: 50, color: 'text-slate-600', ring: 'border-slate-300 bg-slate-50', stockChance: 1, stockQty: [2, 4] },
  uncommon: { label: '보통', weight: 28, color: 'text-emerald-700', ring: 'border-emerald-300 bg-emerald-50', stockChance: 0.6, stockQty: [1, 3] },
  rare: { label: '희귀', weight: 14, color: 'text-sky-700', ring: 'border-sky-300 bg-sky-50', stockChance: 0.3, stockQty: [1, 2] },
  legendary: { label: '전설', weight: 6, color: 'text-amber-700', ring: 'border-amber-300 bg-amber-50', stockChance: 0.12, stockQty: [1, 1] },
  mythic: { label: '신화', weight: 2, color: 'text-fuchsia-700', ring: 'border-fuchsia-300 bg-fuchsia-50', stockChance: 0.04, stockQty: [1, 1] },
}

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary', 'mythic']

export type CropId = 'carrot' | 'strawberry' | 'blueberry' | 'tomato' | 'corn' | 'watermelon' | 'pumpkin' | 'apple_tree' | 'dragonfruit'

export type CropDef = {
  id: CropId
  label: string
  rarity: Rarity
  /** 심고 처음 다 자랄 때까지(ms, 밭 시계 기준) */
  growMs: number
  /** 한 번 수확할 때 값 */
  value: number
  /** 수확 횟수. 0 = 끝없이 열림 */
  harvests: number
  /** 다시 열릴 때까지(ms). harvests 가 1이면 쓰지 않음 */
  regrowMs: number
  /** 씨앗 가게 값 */
  price: number
  image: string
}

export const CROPS: readonly CropDef[] = [
  { id: 'carrot', label: '당근', rarity: 'common', growMs: 18000, value: 22, harvests: 1, regrowMs: 0, price: 10, image: '/garden/crop-carrot.webp' },
  { id: 'strawberry', label: '딸기', rarity: 'common', growMs: 22000, value: 12, harvests: 5, regrowMs: 10000, price: 20, image: '/garden/crop-strawberry.webp' },
  { id: 'blueberry', label: '블루베리', rarity: 'uncommon', growMs: 28000, value: 20, harvests: 5, regrowMs: 12000, price: 45, image: '/garden/crop-blueberry.webp' },
  { id: 'tomato', label: '토마토', rarity: 'uncommon', growMs: 32000, value: 26, harvests: 6, regrowMs: 14000, price: 70, image: '/garden/crop-tomato.webp' },
  { id: 'corn', label: '옥수수', rarity: 'rare', growMs: 40000, value: 70, harvests: 4, regrowMs: 20000, price: 160, image: '/garden/crop-corn.webp' },
  { id: 'watermelon', label: '수박', rarity: 'rare', growMs: 50000, value: 320, harvests: 1, regrowMs: 0, price: 200, image: '/garden/crop-watermelon.webp' },
  { id: 'pumpkin', label: '호박', rarity: 'legendary', growMs: 60000, value: 520, harvests: 1, regrowMs: 0, price: 350, image: '/garden/crop-pumpkin.webp' },
  { id: 'apple_tree', label: '사과나무', rarity: 'legendary', growMs: 70000, value: 60, harvests: 0, regrowMs: 15000, price: 500, image: '/garden/crop-apple_tree.webp' },
  { id: 'dragonfruit', label: '용과', rarity: 'mythic', growMs: 80000, value: 400, harvests: 4, regrowMs: 30000, price: 1000, image: '/garden/crop-dragonfruit.webp' },
] as const

export const CROP_BY_ID: Record<CropId, CropDef> = Object.fromEntries(CROPS.map((crop) => [crop.id, crop])) as Record<CropId, CropDef>

export function isCropId(value: unknown): value is CropId {
  return typeof value === 'string' && value in CROP_BY_ID
}

// ─── 변이 ───
export type Mutation = 'none' | 'wet' | 'gold' | 'rainbow'

export const MUTATIONS: Record<Exclude<Mutation, 'none'>, { label: string; mult: number; emoji: string }> = {
  wet: { label: '촉촉', mult: GARDEN.WET_MULT, emoji: '💧' },
  gold: { label: '황금', mult: GARDEN.GOLD_MULT, emoji: '✨' },
  rainbow: { label: '무지개', mult: GARDEN.RAINBOW_MULT, emoji: '🌈' },
}

export function mutationMult(mutation: Mutation): number {
  return mutation === 'none' ? 1 : MUTATIONS[mutation].mult
}

/** 다 자란 순간 변이를 정한다. 무지개·황금이 먼저, 비가 오면 촉촉 */
export function rollMutation(raining: boolean, rand: () => number = Math.random): Mutation {
  const roll = rand()
  if (roll < GARDEN.RAINBOW_CHANCE) return 'rainbow'
  if (roll < GARDEN.RAINBOW_CHANCE + GARDEN.GOLD_CHANCE) return 'gold'
  if (raining && rand() < GARDEN.WET_CHANCE) return 'wet'
  return 'none'
}

// ─── 밭 ───
export type PlantedCrop = {
  cropId: CropId
  /** 이번 자라기를 시작한 밭 시계(ms) */
  startedAt: number
  /** 이번 자라기에 필요한 시간(ms) — 처음엔 growMs, 다시 열릴 땐 regrowMs */
  needMs: number
  /** 남은 수확 횟수. 0 = 끝없이 */
  harvestsLeft: number
  /** 다 자란 뒤 정해진 변이. 자라는 중엔 null */
  mutation: Mutation | null
}

export type Plot = {
  unlocked: boolean
  crop: PlantedCrop | null
}

export type GardenStats = {
  /** 맞힌 문제(받은 무료 카드) 수 */
  rounds: number
  harvests: number
  /** 변이 작물 수확 수 */
  mutated: number
  rainbow: number
  /** 한 번 수확 최고 값 */
  bestHarvest: number
  bestCrop: CropId | null
  planted: number
  crowsSent: number
  crowsShooed: number
  crowsPecked: number
  scarecrowsUsed: number
}

export type SeedBag = Partial<Record<CropId, number>>
export type ShopStock = Partial<Record<CropId, number>>

export type GardenState = {
  v: 1
  /** 지갑(쓸 수 있는 돈) */
  coins: number
  /** 번 돈 합 = players.score */
  earned: number
  /** 밭 시계(ms) */
  clockMs: number
  plots: Plot[]
  seeds: SeedBag
  shop: ShopStock
  sprinkler: number
  scarecrows: number
  stats: GardenStats
}

export function createEmptyStats(): GardenStats {
  return {
    rounds: 0,
    harvests: 0,
    mutated: 0,
    rainbow: 0,
    bestHarvest: 0,
    bestCrop: null,
    planted: 0,
    crowsSent: 0,
    crowsShooed: 0,
    crowsPecked: 0,
    scarecrowsUsed: 0,
  }
}

export function createGarden(): GardenState {
  const size = GARDEN.GRID * GARDEN.GRID
  const unlocked = new Set(UNLOCK_ORDER.slice(0, GARDEN.START_UNLOCKED))
  return {
    v: 1,
    coins: GARDEN.START_COINS,
    earned: 0,
    clockMs: 0,
    plots: Array.from({ length: size }, (_, index) => ({ unlocked: unlocked.has(index), crop: null })),
    // 처음엔 당근 씨앗 2개로 시작해서 바로 심어 볼 수 있게
    seeds: { carrot: 2 },
    shop: { carrot: 3, strawberry: 2 },
    sprinkler: 0,
    scarecrows: 0,
    stats: createEmptyStats(),
  }
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0

function parseCounts(raw: unknown): Partial<Record<CropId, number>> {
  const result: Partial<Record<CropId, number>> = {}
  if (!raw || typeof raw !== 'object') return result
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const count = toCount(value)
    if (isCropId(key) && count > 0) result[key] = count
  }
  return result
}

function parseMutation(value: unknown): Mutation | null {
  return value === 'none' || value === 'wet' || value === 'gold' || value === 'rainbow' ? value : null
}

/** DB 의 item_effects 를 밭 상태로. 모양이 다르면(다른 게임 흔적·null) 새 밭 */
export function parseGarden(raw: unknown): GardenState {
  const fresh = createGarden()
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return fresh
  const data = raw as Partial<GardenState> & { stats?: Partial<GardenStats> }
  const plots = fresh.plots.map((plot, index) => {
    const saved = Array.isArray(data.plots) ? (data.plots[index] as Partial<Plot> | undefined) : undefined
    if (!saved) return plot
    const crop = saved.crop as Partial<PlantedCrop> | null | undefined
    return {
      unlocked: Boolean(saved.unlocked) || plot.unlocked,
      crop: crop && isCropId(crop.cropId)
        ? {
            cropId: crop.cropId,
            startedAt: toCount(crop.startedAt),
            needMs: toCount(crop.needMs) || CROP_BY_ID[crop.cropId].growMs,
            harvestsLeft: toCount(crop.harvestsLeft),
            mutation: parseMutation(crop.mutation),
          }
        : null,
    }
  })
  const stats: Partial<GardenStats> = data.stats ?? {}
  return {
    v: 1,
    coins: toCount(data.coins),
    earned: toCount(data.earned),
    clockMs: toCount(data.clockMs),
    plots,
    seeds: parseCounts(data.seeds),
    shop: parseCounts(data.shop),
    sprinkler: Math.min(SPRINKLER_LEVELS.length - 1, toCount(data.sprinkler)),
    scarecrows: Math.min(GARDEN.SCARECROW_MAX, toCount(data.scarecrows)),
    stats: {
      rounds: toCount(stats.rounds),
      harvests: toCount(stats.harvests),
      mutated: toCount(stats.mutated),
      rainbow: toCount(stats.rainbow),
      bestHarvest: toCount(stats.bestHarvest),
      bestCrop: isCropId(stats.bestCrop) ? stats.bestCrop : null,
      planted: toCount(stats.planted),
      crowsSent: toCount(stats.crowsSent),
      crowsShooed: toCount(stats.crowsShooed),
      crowsPecked: toCount(stats.crowsPecked),
      scarecrowsUsed: toCount(stats.scarecrowsUsed),
    },
  }
}

// ─── 자라기 ───
export type CropStage = 'seed' | 'sprout' | 'young' | 'ripe'

export function getCropProgress(crop: PlantedCrop, clockMs: number): number {
  if (crop.needMs <= 0) return 1
  return Math.max(0, Math.min(1, (clockMs - crop.startedAt) / crop.needMs))
}

export function getCropStage(crop: PlantedCrop, clockMs: number): CropStage {
  const progress = getCropProgress(crop, clockMs)
  if (progress >= 1) return 'ripe'
  // 다시 열리는 중인 나무·덤불은 새싹으로 돌아가지 않는다
  const isRegrow = crop.needMs !== CROP_BY_ID[crop.cropId].growMs
  if (isRegrow) return 'young'
  if (progress < 0.25) return 'seed'
  if (progress < 0.6) return 'sprout'
  return 'young'
}

export function getRemainingMs(crop: PlantedCrop, clockMs: number): number {
  return Math.max(0, crop.startedAt + crop.needMs - clockMs)
}

export function getGrowSpeed(state: GardenState, raining: boolean): number {
  const level = SPRINKLER_LEVELS[state.sprinkler] ?? SPRINKLER_LEVELS[0]
  return level.speed * (raining ? GARDEN.RAIN_SPEED : 1)
}

/**
 * 밭 시계를 dt 만큼 돌린다. 새로 다 자란 작물은 이때 변이가 정해진다.
 * 바뀐 게 없으면 clockMs 만 바뀐 새 객체를 돌려준다.
 */
export function advanceGarden(
  state: GardenState,
  dtMs: number,
  raining: boolean,
  rand: () => number = Math.random,
): { state: GardenState; ripened: number[] } {
  const clockMs = state.clockMs + dtMs * getGrowSpeed(state, raining)
  const ripened: number[] = []
  let changed = false
  const plots = state.plots.map((plot, index) => {
    const crop = plot.crop
    if (!crop || crop.mutation !== null) return plot
    if (getCropProgress(crop, clockMs) < 1) return plot
    ripened.push(index)
    changed = true
    return { ...plot, crop: { ...crop, mutation: rollMutation(raining, rand) } }
  })
  return { state: { ...state, clockMs, plots: changed ? plots : state.plots }, ripened }
}

// ─── 심기·수확 ───
export function seedCount(state: GardenState): number {
  return Object.values(state.seeds).reduce((sum, count) => sum + (count ?? 0), 0)
}

export function plantSeed(state: GardenState, plotIndex: number, cropId: CropId): GardenState | null {
  const plot = state.plots[plotIndex]
  if (!plot || !plot.unlocked || plot.crop) return null
  const have = state.seeds[cropId] ?? 0
  if (have <= 0) return null
  const def = CROP_BY_ID[cropId]
  const seeds = { ...state.seeds, [cropId]: have - 1 }
  if (seeds[cropId] === 0) delete seeds[cropId]
  const plots = state.plots.map((item, index) => index === plotIndex
    ? { ...item, crop: { cropId, startedAt: state.clockMs, needMs: def.growMs, harvestsLeft: def.harvests, mutation: null } }
    : item)
  return { ...state, seeds, plots, stats: { ...state.stats, planted: state.stats.planted + 1 } }
}

export type HarvestResult = {
  plotIndex: number
  cropId: CropId
  mutation: Mutation
  coins: number
  /** 이번 수확으로 작물이 사라졌는지 (다시 안 열림) */
  cleared: boolean
}

export function isRipe(plot: Plot | undefined, clockMs: number): boolean {
  return Boolean(plot?.crop && plot.crop.mutation !== null && getCropProgress(plot.crop, clockMs) >= 1)
}

export function harvestPlot(state: GardenState, plotIndex: number): { state: GardenState; harvest: HarvestResult } | null {
  const plot = state.plots[plotIndex]
  if (!plot?.crop || !isRipe(plot, state.clockMs)) return null
  const crop = plot.crop
  const def = CROP_BY_ID[crop.cropId]
  const mutation = crop.mutation ?? 'none'
  const coins = Math.round(def.value * mutationMult(mutation))
  const endless = crop.harvestsLeft === 0
  const cleared = !endless && crop.harvestsLeft <= 1
  const nextCrop: PlantedCrop | null = cleared
    ? null
    : {
        ...crop,
        startedAt: state.clockMs,
        needMs: def.regrowMs,
        harvestsLeft: endless ? 0 : crop.harvestsLeft - 1,
        mutation: null,
      }
  const plots = state.plots.map((item, index) => index === plotIndex ? { ...item, crop: nextCrop } : item)
  const best = coins > state.stats.bestHarvest
  return {
    state: {
      ...state,
      plots,
      coins: state.coins + coins,
      earned: state.earned + coins,
      stats: {
        ...state.stats,
        harvests: state.stats.harvests + 1,
        mutated: state.stats.mutated + (mutation === 'none' ? 0 : 1),
        rainbow: state.stats.rainbow + (mutation === 'rainbow' ? 1 : 0),
        bestHarvest: best ? coins : state.stats.bestHarvest,
        bestCrop: best ? crop.cropId : state.stats.bestCrop,
      },
    },
    harvest: { plotIndex, cropId: crop.cropId, mutation, coins, cleared },
  }
}

/** 다 자란 작물 전부 수확 (수확 버튼) */
export function harvestAll(state: GardenState): { state: GardenState; harvests: HarvestResult[] } {
  let next = state
  const harvests: HarvestResult[] = []
  state.plots.forEach((_, index) => {
    const result = harvestPlot(next, index)
    if (!result) return
    next = result.state
    harvests.push(result.harvest)
  })
  return { state: next, harvests }
}

// ─── 가게 ───
export function unlockedCount(state: GardenState): number {
  return state.plots.filter((plot) => plot.unlocked).length
}

/** 다음 칸 늘리기 값. 다 열렸으면 null */
export function nextExpandPrice(state: GardenState): number | null {
  const bought = unlockedCount(state) - GARDEN.START_UNLOCKED
  return EXPAND_PRICES[bought] ?? null
}

export function buyExpansion(state: GardenState): GardenState | null {
  const price = nextExpandPrice(state)
  if (price === null || state.coins < price) return null
  const nextIndex = UNLOCK_ORDER.find((index) => !state.plots[index]?.unlocked)
  if (nextIndex === undefined) return null
  const plots = state.plots.map((plot, index) => index === nextIndex ? { ...plot, unlocked: true } : plot)
  return { ...state, coins: state.coins - price, plots }
}

export function nextSprinklerPrice(state: GardenState): number | null {
  return SPRINKLER_LEVELS[state.sprinkler + 1]?.price ?? null
}

export function buySprinkler(state: GardenState): GardenState | null {
  const price = nextSprinklerPrice(state)
  if (price === null || state.coins < price) return null
  return { ...state, coins: state.coins - price, sprinkler: state.sprinkler + 1 }
}

export function buyScarecrow(state: GardenState): GardenState | null {
  if (state.scarecrows >= GARDEN.SCARECROW_MAX || state.coins < GARDEN.SCARECROW_PRICE) return null
  return { ...state, coins: state.coins - GARDEN.SCARECROW_PRICE, scarecrows: state.scarecrows + 1 }
}

export function buySeed(state: GardenState, cropId: CropId): GardenState | null {
  const stock = state.shop[cropId] ?? 0
  const def = CROP_BY_ID[cropId]
  if (stock <= 0 || state.coins < def.price) return null
  const shop = { ...state.shop, [cropId]: stock - 1 }
  return {
    ...state,
    coins: state.coins - def.price,
    shop,
    seeds: { ...state.seeds, [cropId]: (state.seeds[cropId] ?? 0) + 1 },
  }
}

const randInt = (min: number, max: number, rand: () => number) => min + Math.floor(rand() * (max - min + 1))

/** 정답마다 씨앗 가게를 새로 채운다 (남은 재고는 버리고 새로 뽑는다) */
export function restockShop(rand: () => number = Math.random): ShopStock {
  const shop: ShopStock = {}
  for (const crop of CROPS) {
    const rarity = RARITY[crop.rarity]
    if (rand() >= rarity.stockChance) continue
    shop[crop.id] = randInt(rarity.stockQty[0], rarity.stockQty[1], rand)
  }
  return shop
}

// ─── 정답 보상 카드 ───
export type RewardCard =
  | { kind: 'seed'; cropId: CropId; count: number }
  | { kind: 'crow' }

function drawRarity(rand: () => number): Rarity {
  const total = RARITY_ORDER.reduce((sum, id) => sum + RARITY[id].weight, 0)
  let roll = rand() * total
  for (const id of RARITY_ORDER) {
    roll -= RARITY[id].weight
    if (roll < 0) return id
  }
  return 'common'
}

/** 무료 카드 3장. 같은 작물은 겹치지 않게, 까마귀 카드는 많아야 1장 */
export function drawRewardCards(canSendCrow: boolean, rand: () => number = Math.random): RewardCard[] {
  const cards: RewardCard[] = []
  const used = new Set<CropId>()
  let crow = false
  for (let i = 0; i < GARDEN.CHOICES; i += 1) {
    if (canSendCrow && !crow && rand() < GARDEN.CROW_CARD_CHANCE) {
      crow = true
      cards.push({ kind: 'crow' })
      continue
    }
    let cropId: CropId = 'carrot'
    for (let tries = 0; tries < 8; tries += 1) {
      const rarity = drawRarity(rand)
      const pool = CROPS.filter((crop) => crop.rarity === rarity && !used.has(crop.id))
      if (pool.length === 0) continue
      cropId = pool[Math.floor(rand() * pool.length)].id
      break
    }
    used.add(cropId)
    // 흔한 씨앗은 2개씩
    cards.push({ kind: 'seed', cropId, count: CROP_BY_ID[cropId].rarity === 'common' ? 2 : 1 })
  }
  return cards
}

/** 카드 받기 + 가게 재입고 */
export function claimRewardCard(state: GardenState, card: RewardCard, shop: ShopStock): GardenState {
  const stats = { ...state.stats, rounds: state.stats.rounds + 1, crowsSent: state.stats.crowsSent + (card.kind === 'crow' ? 1 : 0) }
  if (card.kind === 'crow') return { ...state, shop, stats }
  return {
    ...state,
    shop,
    stats,
    seeds: { ...state.seeds, [card.cropId]: (state.seeds[card.cropId] ?? 0) + card.count },
  }
}

// ─── 까마귀 ───
/** 까마귀가 노릴 칸: 다 자란 것 중 값이 큰 것 → 없으면 가장 많이 자란 것. 작물이 없으면 null */
export function pickCrowTarget(state: GardenState): number | null {
  let best: { index: number; score: number } | null = null
  state.plots.forEach((plot, index) => {
    if (!plot.crop) return
    const progress = getCropProgress(plot.crop, state.clockMs)
    const def = CROP_BY_ID[plot.crop.cropId]
    const score = progress >= 1 ? 10 + def.value * mutationMult(plot.crop.mutation ?? 'none') / 1000 : progress
    if (!best || score > best.score) best = { index, score }
  })
  return best === null ? null : (best as { index: number }).index
}

/** 까마귀가 쪼았다: 그 작물은 이번 자라기를 처음부터 다시 (작물은 남는다) */
export function applyCrowPeck(state: GardenState, plotIndex: number): GardenState {
  const plot = state.plots[plotIndex]
  if (!plot?.crop) return state
  const plots = state.plots.map((item, index) => index === plotIndex && item.crop
    ? { ...item, crop: { ...item.crop, startedAt: state.clockMs, mutation: null } }
    : item)
  return { ...state, plots, stats: { ...state.stats, crowsPecked: state.stats.crowsPecked + 1 } }
}

export function recordCrowShooed(state: GardenState, byScarecrow: boolean): GardenState {
  return {
    ...state,
    scarecrows: byScarecrow ? Math.max(0, state.scarecrows - 1) : state.scarecrows,
    stats: {
      ...state.stats,
      crowsShooed: state.stats.crowsShooed + (byScarecrow ? 0 : 1),
      scarecrowsUsed: state.stats.scarecrowsUsed + (byScarecrow ? 1 : 0),
    },
  }
}

export type CrowEventPayload = {
  targetId: string
  fromId: string
  fromName: string
  /** 같은 까마귀가 두 번 오지 않게 (REST 폴백 재전송) */
  crowId: string
}

// ─── 결과: 칭호 ───
export type GardenTitleId = 'tycoon' | 'golden' | 'harvester' | 'guardian' | 'diligent' | 'sprout'
export type GardenTitle = { id: GardenTitleId; emoji: string; label: string; description: string }

export const TITLES: Record<GardenTitleId, GardenTitle> = {
  tycoon: { id: 'tycoon', emoji: '💰', label: '텃밭 부자', description: '작물을 팔아 가장 많이 벌었어요' },
  golden: { id: 'golden', emoji: '✨', label: '황금 손', description: '특별한 변이 작물을 가장 많이 거뒀어요' },
  harvester: { id: 'harvester', emoji: '🧺', label: '수확왕', description: '가장 많이 수확했어요' },
  guardian: { id: 'guardian', emoji: '🐦', label: '까마귀 지킴이', description: '까마귀를 쫓아 밭을 지켰어요' },
  diligent: { id: 'diligent', emoji: '🧑‍🌾', label: '부지런한 농부', description: '끝까지 열심히 밭을 가꿨어요' },
  sprout: { id: 'sprout', emoji: '🌱', label: '새싹 농부', description: '다음엔 첫 수확을 해 봐요' },
}

type TitlePlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown }

const MAX_TITLE_RULES: Array<{ id: GardenTitleId; value: (state: GardenState) => number }> = [
  { id: 'tycoon', value: (state) => state.earned },
  { id: 'golden', value: (state) => state.stats.mutated },
  { id: 'harvester', value: (state) => state.stats.harvests },
]

/**
 * 모든 참가자에게 칭호를 하나 이상 준다. 1등이 아니어도 뭔가 하나는 받는다.
 * 최다 칭호(공동 1등 포함) → 까마귀 지킴이(한 번이라도) → 하나도 없으면 부지런한 농부(1번 이상 수확) / 새싹 농부.
 */
export function assignTitles(players: TitlePlayer[]): Map<string, GardenTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const stateById = new Map(active.map((player) => [player.id, parseGarden(player.item_effects)]))
  const result = new Map<string, GardenTitle[]>(active.map((player) => [player.id, []]))

  for (const rule of MAX_TITLE_RULES) {
    let best = 0
    for (const state of stateById.values()) best = Math.max(best, rule.value(state))
    if (best <= 0) continue
    for (const [id, state] of stateById) {
      if (rule.value(state) === best) result.get(id)!.push(TITLES[rule.id])
    }
  }

  for (const [id, state] of stateById) {
    const titles = result.get(id)!
    if (state.stats.crowsShooed > 0) titles.push(TITLES.guardian)
    if (titles.length === 0) titles.push(state.stats.harvests > 0 ? TITLES.diligent : TITLES.sprout)
  }

  return result
}

/** 결과 요약 칸에 보여 줄 숫자들 */
export function summarizeGarden(state: GardenState): Array<{ label: string; value: string }> {
  return [
    { label: '수확', value: `${state.stats.harvests}번` },
    { label: '변이 작물', value: `${state.stats.mutated}개` },
    { label: '한 번 최고', value: `${state.stats.bestHarvest.toLocaleString()}코인` },
    { label: '밭 크기', value: `${unlockedCount(state)}칸` },
  ]
}

export function formatSeconds(ms: number): string {
  return `${Math.ceil(ms / 1000)}초`
}
