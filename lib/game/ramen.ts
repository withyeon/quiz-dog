/**
 * 퀴즈독의 라면가게 — 규칙·상수·순수 함수.
 *
 * 원작 「슈의 라면가게」(2003 플래시)를 퀴즈 게임으로 옮긴 모드다.
 * 흐름: 퀴즈 정답 → 손님 1~3명 등장(냄비도 그만큼) → 냄비마다 물·면·스프를 넣고,
 * 물이 끓을 때 파·계란을 넣고 바로 쟁반에 올린다 → 손님이 라면 상태를 보고 돈을 낸다.
 *
 * 원작과 같은 규칙
 *  - 면·스프는 아무 때나 넣어도 된다. 물을 붓는 순간부터 타이머가 돈다.
 *  - 끓을 때 파·계란을 넣어야 1,000원. 덜 익었을 때(끓기 전) 넣으면 값이 떨어진다.
 *  - 끓기 시작하고 몇 초 안에 쟁반에 올리지 않으면 냄비가 탄다. 탄 냄비는 손님이 거부한다(0원).
 *  - 물·면·스프 중 하나라도 빠지면 손님이 냄비를 던진다(0원).
 *  - 냄비를 여러 개 동시에 돌려야 돈을 많이 번다 (면·스프 먼저, 물은 나중에!).
 *
 * 퀴즈 게임으로 바꾸면서 달라진 것
 *  - 손님은 정답을 맞혔을 때만 온다. 손님 수(=냄비 수)는 실력과 무관하게 랜덤이다.
 *    (정답 연속에 보상을 더 주면 잘하는 아이가 독주한다 — 붕어빵 모드와 같은 원칙)
 *  - 탄 냄비로 게임이 끝나지는 않는다. 그 손님만 0원이고 다음 문제로 간다.
 *  - 손님 인내심(한 판 제한 시간)이 있어 냄비를 들고 멍하니 있을 수 없다.
 *
 * 학생별 상태는 players 행 두 칸을 쓴다 (새 컬럼 없음, sql/20261020_ramen_mode.sql):
 *   players.score        = 번 돈 합(원) — 순위 기준
 *   players.item_effects = RamenStats JSON (판 수·손님 수·1,000원 라면 수·금액별 개수 …)
 */

// ─── 상수 ───
export const RAMEN = {
  /** 물을 붓고 끓기 시작할 때까지(ms). 원작처럼 짧다 */
  HEAT_MS: 3500,
  /** 끓는 시간(ms). 이 안에 쟁반에 올려야 한다. 지나면 탄다 */
  BOIL_MS: 4500,
  /** 끓는 시간의 뒤쪽 이 비율은 "많이 익음"(값이 떨어짐) */
  OVERCOOK_FROM: 0.7,
  /** 손님 최대 수(= 한 판 냄비 수) */
  MAX_CUSTOMERS: 3,
  /** 손님 1·2·3명이 올 가중치 */
  CUSTOMER_WEIGHTS: [52, 33, 15],
  /** 한 판 손님 인내심(ms) = BASE + 손님 수 × PER */
  PATIENCE_BASE_MS: 14000,
  PATIENCE_PER_CUSTOMER_MS: 9000,
  /** 원작의 목표 금액. 넘길 때마다 축하 (10,000 · 20,000 …) */
  GOAL_MONEY: 10000,
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 오답 화면 시간(ms) */
  WRONG_ANSWER_DELAY_MS: 2000,
} as const

/** 한 냄비가 타기까지 걸리는 전체 시간(ms) */
export const BURN_AT_MS = RAMEN.HEAT_MS + RAMEN.BOIL_MS
/** 많이 익기 시작하는 시각(ms) */
export const OVERCOOK_AT_MS = RAMEN.HEAT_MS + Math.round(RAMEN.BOIL_MS * RAMEN.OVERCOOK_FROM)

// ─── 재료 ───
export type IngredientId = 'water' | 'noodle' | 'soup' | 'leek' | 'egg'

export type IngredientDef = {
  id: IngredientId
  label: string
  emoji: string
  /** 키보드 단축키 (표시용) */
  key: string
  hint: string
}

export const INGREDIENTS: readonly IngredientDef[] = [
  { id: 'noodle', label: '면', emoji: '🍜', key: 'Q', hint: '아무 때나' },
  { id: 'soup', label: '스프', emoji: '🧂', key: 'W', hint: '아무 때나' },
  { id: 'water', label: '물', emoji: '💧', key: 'E', hint: '넣으면 타이머 시작!' },
  { id: 'leek', label: '파', emoji: '🥬', key: 'R', hint: '끓을 때!' },
  { id: 'egg', label: '계란', emoji: '🥚', key: 'T', hint: '끓을 때!' },
] as const

export const INGREDIENT_BY_ID: Record<IngredientId, IngredientDef> = Object.fromEntries(
  INGREDIENTS.map((item) => [item.id, item]),
) as Record<IngredientId, IngredientDef>

// ─── 냄비 ───
/** 파·계란을 넣은 시점. early = 끓기 전(덜 익었을 때), boiling = 끓을 때 */
export type ToppingTiming = 'none' | 'early' | 'boiling'

export type PotPhase = 'empty' | 'cold' | 'heating' | 'boiling' | 'overcooking' | 'burnt'

export type Pot = {
  index: number
  noodle: boolean
  soup: boolean
  water: boolean
  leek: ToppingTiming
  egg: ToppingTiming
  /** 물을 부은 뒤 흐른 조리 시간(ms). 멈춤(pause) 중엔 늘지 않는다 */
  cookMs: number
  /** 쟁반에 올렸거나(또는 타서/손님이 떠나서) 끝난 결과 */
  result: ServeResult | null
}

export function createPot(index: number): Pot {
  return { index, noodle: false, soup: false, water: false, leek: 'none', egg: 'none', cookMs: 0, result: null }
}

/** 냄비 상태. 물이 없으면 cold(재료만) 또는 empty */
export function getPotPhase(pot: Pot): PotPhase {
  if (!pot.water) return pot.noodle || pot.soup ? 'cold' : 'empty'
  if (pot.cookMs >= BURN_AT_MS) return 'burnt'
  if (pot.cookMs >= OVERCOOK_AT_MS) return 'overcooking'
  if (pot.cookMs >= RAMEN.HEAT_MS) return 'boiling'
  return 'heating'
}

export function isBoilingPhase(phase: PotPhase): boolean {
  return phase === 'boiling' || phase === 'overcooking'
}

/** 조리 진행도(0~100). 게이지 표시용 — 100 이면 탔다 */
export function getPotProgress(pot: Pot): number {
  if (!pot.water) return 0
  return Math.max(0, Math.min(100, (pot.cookMs / BURN_AT_MS) * 100))
}

/** 게이지 구간 비율(%). 데우기 → 끓음(딱 좋음) → 많이 익음 → 탄다 */
export const POT_GAUGE_ZONES = [
  { id: 'heating', label: '데우는 중', color: '#93c5fd', width: (RAMEN.HEAT_MS / BURN_AT_MS) * 100 },
  { id: 'boiling', label: '끓는다!', color: '#f97316', width: ((OVERCOOK_AT_MS - RAMEN.HEAT_MS) / BURN_AT_MS) * 100 },
  { id: 'overcooking', label: '많이 익음', color: '#b45309', width: ((BURN_AT_MS - OVERCOOK_AT_MS) / BURN_AT_MS) * 100 },
] as const

/** 재료 넣기. 이미 들어 있거나 끝난 냄비면 그대로 돌려준다 */
export function addIngredient(pot: Pot, id: IngredientId): Pot {
  if (pot.result) return pot
  const phase = getPotPhase(pot)
  if (phase === 'burnt') return pot
  switch (id) {
    case 'noodle': return pot.noodle ? pot : { ...pot, noodle: true }
    case 'soup': return pot.soup ? pot : { ...pot, soup: true }
    case 'water': return pot.water ? pot : { ...pot, water: true, cookMs: 0 }
    case 'leek': {
      if (pot.leek !== 'none') return pot
      return { ...pot, leek: isBoilingPhase(phase) ? 'boiling' : 'early' }
    }
    case 'egg': {
      if (pot.egg !== 'none') return pot
      return { ...pot, egg: isBoilingPhase(phase) ? 'boiling' : 'early' }
    }
  }
}

/** 이 재료를 지금 넣을 수 있는지(버튼 활성 여부) */
export function canAddIngredient(pot: Pot, id: IngredientId): boolean {
  if (pot.result) return false
  if (getPotPhase(pot) === 'burnt') return false
  switch (id) {
    case 'noodle': return !pot.noodle
    case 'soup': return !pot.soup
    case 'water': return !pot.water
    case 'leek': return pot.leek === 'none'
    case 'egg': return pot.egg === 'none'
  }
}

// ─── 서빙 판정 ───
export type Doneness = 'raw' | 'perfect' | 'over'

export type Verdict =
  | 'perfect'      // 1000 — 다 익고 파·계란 둘 다 끓을 때
  | 'good'         // 800 — 다 익고 하나는 끓을 때·하나는 일찍
  | 'okay'         // 600 — 다 익고 둘 다 일찍 / 하나만(끓을 때)
  | 'plain_plus'   // 500 — 다 익고 하나만(일찍) / 덜·많이 익고 둘 다 넣음
  | 'plain'        // 400 — 다 익은 기본 라면
  | 'meh'          // 300 — 덜·많이 익고 하나만
  | 'bad'          // 200 — 덜·많이 익은 기본 라면
  | 'missing'      // 0 — 물·면·스프 중 하나가 없음
  | 'burnt'        // 0 — 탄 냄비
  | 'left'         // 0 — 손님이 기다리다 떠남

export type ServeResult = {
  verdict: Verdict
  money: number
  doneness: Doneness | null
  /** 끓을 때 넣은 고명 수 / 일찍 넣은 고명 수 */
  boilingToppings: number
  earlyToppings: number
  /** 결과 카드 제목 */
  title: string
  /** 손님 대사 */
  reaction: string
  /** 왜 그 값인지 한 줄 */
  reason: string
}

export const VERDICT_MONEY: Record<Verdict, number> = {
  perfect: 1000, good: 800, okay: 600, plain_plus: 500, plain: 400, meh: 300, bad: 200, missing: 0, burnt: 0, left: 0,
}

const VERDICT_TITLE: Record<Verdict, string> = {
  perfect: '완벽한 라면!',
  good: '맛있는 라면',
  okay: '괜찮은 라면',
  plain_plus: '그냥 그런 라면',
  plain: '기본 라면',
  meh: '아쉬운 라면',
  bad: '이게 뭐야…',
  missing: '이게 라면이야?!',
  burnt: '탄 냄비!',
  left: '손님이 떠났어요',
}

const REACTIONS: Record<Verdict, string[]> = {
  perfect: ['와, 이 집 진짜 잘하네! 또 올게요!', '파랑 계란이 딱이야! 최고!', '국물이 예술이에요 👍'],
  good: ['맛있어요! 다음엔 완벽하게 해 줘요', '거의 완벽! 고명 하나만 조금 일찍 들어갔네'],
  okay: ['음, 먹을 만해요', '고명이 좀 퍼졌지만 괜찮아요'],
  plain_plus: ['이 정도면… 그냥 먹을게요', '뭔가 2% 부족한 맛'],
  plain: ['기본은 하네요. 파랑 계란도 넣어 줘요!', '심심한 라면… 그래도 먹죠'],
  meh: ['면이 좀 이상한데요…', '설익은 거 아니에요? 흠'],
  bad: ['이건 좀… 다시 끓여 올 수는 없죠?', '면이 안 익었잖아요!'],
  missing: ['뭐가 빠졌잖아요!! (냄비를 던졌다)', '이걸 라면이라고 주는 거예요?!'],
  burnt: ['까맣게 탔잖아요! 이건 못 먹어요', '연기 나는 냄비는 사양할게요…'],
  left: ['너무 오래 기다렸어요… 다음에 올게요', '배고파서 옆집 갔어요'],
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rand() * items.length))]
}

/** 지금 쟁반에 올리면 어떤 라면인지 — 순수 함수 */
export function evaluatePot(pot: Pot, rand: () => number = Math.random): ServeResult {
  const phase = getPotPhase(pot)
  const toppings = [pot.leek, pot.egg]
  const boilingToppings = toppings.filter((timing) => timing === 'boiling').length
  const earlyToppings = toppings.filter((timing) => timing === 'early').length

  const finish = (verdict: Verdict, doneness: Doneness | null, reason: string): ServeResult => ({
    verdict,
    money: VERDICT_MONEY[verdict],
    doneness,
    boilingToppings,
    earlyToppings,
    title: VERDICT_TITLE[verdict],
    reaction: pick(REACTIONS[verdict], rand),
    reason,
  })

  if (phase === 'burnt') return finish('burnt', null, '끓기 시작하면 바로 쟁반에 올려야 해요')
  if (!pot.water || !pot.noodle || !pot.soup) {
    const missing = [!pot.water && '물', !pot.noodle && '면', !pot.soup && '스프'].filter(Boolean).join('·')
    return finish('missing', null, `${missing}이(가) 빠졌어요`)
  }

  const doneness: Doneness = phase === 'boiling' ? 'perfect' : phase === 'overcooking' ? 'over' : 'raw'
  const total = boilingToppings + earlyToppings

  if (doneness === 'perfect') {
    if (boilingToppings === 2) return finish('perfect', doneness, '잘 익힌 면 + 끓을 때 넣은 파·계란')
    if (boilingToppings === 1 && earlyToppings === 1) return finish('good', doneness, '고명 하나를 끓기 전에 넣었어요')
    if (earlyToppings === 2) return finish('okay', doneness, '파·계란을 끓기 전에 넣어 퍼졌어요')
    if (boilingToppings === 1) return finish('okay', doneness, '고명이 하나뿐이에요')
    if (earlyToppings === 1) return finish('plain_plus', doneness, '고명 하나를 끓기 전에 넣었어요')
    return finish('plain', doneness, '파·계란이 없는 기본 라면')
  }

  const donenessText = doneness === 'raw' ? '면이 덜 익었어요' : '면이 너무 익었어요'
  if (total === 2) return finish('plain_plus', doneness, `${donenessText} (고명은 둘 다 넣었어요)`)
  if (total === 1) return finish('meh', doneness, `${donenessText} (고명 하나)`)
  return finish('bad', doneness, donenessText)
}

/** 손님이 기다리다 떠난 냄비 결과 */
export function makeLeftResult(): ServeResult {
  return {
    verdict: 'left',
    money: 0,
    doneness: null,
    boilingToppings: 0,
    earlyToppings: 0,
    title: VERDICT_TITLE.left,
    reaction: REACTIONS.left[0],
    reason: '손님 인내심이 다 떨어졌어요',
  }
}

// ─── 손님 ───
export type Customer = {
  /** 아바타 번호 (public/character/<n>.webp) */
  avatar: number
  name: string
  /** 기다리는 동안 하는 말 */
  order: string
}

const CUSTOMER_NAMES = ['배고픈 손님', '단골 손님', '급한 손님', '라면 박사', '옆집 아저씨', '하교하는 학생', '야근하는 직원', '라면 애호가', '수줍은 손님']
const ORDER_LINES = ['라면 하나요!', '파랑 계란 꼭 넣어 주세요!', '빨리요, 배고파요!', '국물 진하게!', '여기 라면 맛집이라던데?', '계란은 반숙으로!']

/** 손님 수 뽑기 (1~MAX). 실력과 무관하게 랜덤 */
export function drawCustomerCount(rand: () => number = Math.random): number {
  const weights = RAMEN.CUSTOMER_WEIGHTS
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let roll = rand() * total
  for (let index = 0; index < weights.length; index++) {
    roll -= weights[index]
    if (roll < 0) return index + 1
  }
  return 1
}

export function drawCustomers(count: number, rand: () => number = Math.random): Customer[] {
  const used = new Set<number>()
  return Array.from({ length: count }, () => {
    let avatar = 1 + Math.floor(rand() * 24)
    while (used.has(avatar)) avatar = (avatar % 24) + 1
    used.add(avatar)
    return { avatar, name: pick(CUSTOMER_NAMES, rand), order: pick(ORDER_LINES, rand) }
  })
}

export function getPatienceMs(customerCount: number): number {
  return RAMEN.PATIENCE_BASE_MS + customerCount * RAMEN.PATIENCE_PER_CUSTOMER_MS
}

// ─── 학생 통계 (players.item_effects) ───
export type RamenStats = {
  v: 1
  /** 치른 판(정답) 수 */
  rounds: number
  /** 받은 손님 수(냄비 수) */
  customers: number
  /** 돈을 받은 라면 수(0원 제외) */
  served: number
  /** 1,000원 라면 수 */
  perfect: number
  /** 금액별 개수 */
  verdicts: Record<Verdict, number>
  /** 한 판 최고 매출 */
  bestRound: number
  /** 3냄비 판에서 셋 다 1,000원 */
  tripleCrowns: number
  /** 번 돈 합 (score 와 같지만 결과 요약용으로 복사) */
  money: number
}

export function createEmptyStats(): RamenStats {
  return {
    v: 1,
    rounds: 0,
    customers: 0,
    served: 0,
    perfect: 0,
    verdicts: { perfect: 0, good: 0, okay: 0, plain_plus: 0, plain: 0, meh: 0, bad: 0, missing: 0, burnt: 0, left: 0 },
    bestRound: 0,
    tripleCrowns: 0,
    money: 0,
  }
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0

/** DB 의 item_effects 를 통계로. 모양이 다르면(다른 게임 흔적·null) 빈 통계 */
export function parseStats(raw: unknown): RamenStats {
  const empty = createEmptyStats()
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return empty
  const data = raw as Partial<RamenStats> & { verdicts?: Partial<Record<Verdict, unknown>> }
  const verdicts = { ...empty.verdicts }
  for (const key of Object.keys(verdicts) as Verdict[]) verdicts[key] = toCount(data.verdicts?.[key])
  return {
    v: 1,
    rounds: toCount(data.rounds),
    customers: toCount(data.customers),
    served: toCount(data.served),
    perfect: toCount(data.perfect),
    verdicts,
    bestRound: toCount(data.bestRound),
    tripleCrowns: toCount(data.tripleCrowns),
    money: toCount(data.money),
  }
}

// ─── 한 판 결과 ───
export type RoundOutcome = {
  customers: Customer[]
  results: ServeResult[]
  /** 이번 판 매출 */
  money: number
  /** 이번 판 전까지 번 돈 */
  moneyBefore: number
  /** 이번 판으로 목표(10,000원 단위)를 새로 넘었는지 */
  goalReached: number | null
  /** 셋 다 1,000원 */
  tripleCrown: boolean
  stats: RamenStats
}

/** 판이 끝났을 때(모든 냄비 결과 확정) 점수·통계 반영 — 순수 함수 */
export function resolveRound(stats: RamenStats, customers: Customer[], results: ServeResult[], moneyBefore: number): RoundOutcome {
  const money = results.reduce((sum, result) => sum + result.money, 0)
  const verdicts = { ...stats.verdicts }
  for (const result of results) verdicts[result.verdict] += 1
  const tripleCrown = results.length >= 3 && results.every((result) => result.verdict === 'perfect')
  const moneyAfter = moneyBefore + money
  const goalBefore = Math.floor(moneyBefore / RAMEN.GOAL_MONEY)
  const goalAfter = Math.floor(moneyAfter / RAMEN.GOAL_MONEY)

  const nextStats: RamenStats = {
    ...stats,
    rounds: stats.rounds + 1,
    customers: stats.customers + results.length,
    served: stats.served + results.filter((result) => result.money > 0).length,
    perfect: stats.perfect + results.filter((result) => result.verdict === 'perfect').length,
    verdicts,
    bestRound: Math.max(stats.bestRound, money),
    tripleCrowns: stats.tripleCrowns + (tripleCrown ? 1 : 0),
    money: moneyAfter,
  }

  return {
    customers,
    results,
    money,
    moneyBefore,
    goalReached: goalAfter > goalBefore ? goalAfter * RAMEN.GOAL_MONEY : null,
    tripleCrown,
    stats: nextStats,
  }
}

// ─── 결과: 칭호 ───
export type RamenTitleId = 'master' | 'tycoon' | 'popular' | 'triple' | 'steady' | 'apprentice'
export type RamenTitle = { id: RamenTitleId; emoji: string; label: string; description: string }

export const TITLES: Record<RamenTitleId, RamenTitle> = {
  master: { id: 'master', emoji: '🍜', label: '라면 장인', description: '1,000원 라면을 가장 많이 만들었어요' },
  tycoon: { id: 'tycoon', emoji: '💰', label: '라면가게 큰손', description: '돈을 가장 많이 벌었어요' },
  popular: { id: 'popular', emoji: '🙋', label: '손님 몰이 사장', description: '손님을 가장 많이 받았어요' },
  triple: { id: 'triple', emoji: '👑', label: '세 냄비의 신', description: '냄비 3개를 동시에 완벽하게 끓였어요' },
  steady: { id: 'steady', emoji: '🧑‍🍳', label: '부지런한 사장', description: '끝까지 열심히 끓였어요' },
  apprentice: { id: 'apprentice', emoji: '🥢', label: '라면 견습생', description: '다음엔 꼭 첫 라면을 팔아요' },
}

type TitlePlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown }

const MAX_TITLE_RULES: Array<{ id: RamenTitleId; value: (stats: RamenStats) => number }> = [
  { id: 'master', value: (stats) => stats.perfect },
  { id: 'tycoon', value: (stats) => stats.money },
  { id: 'popular', value: (stats) => stats.customers },
]

/**
 * 모든 참가자에게 칭호를 하나 이상 준다. 1등이 아니어도 뭔가 하나는 받는다.
 * 최다 칭호(공동 1등 포함) → 세 냄비의 신(한 번이라도) → 하나도 없으면 부지런한 사장(1개 이상 팔았음) / 견습생.
 */
export function assignTitles(players: TitlePlayer[]): Map<string, RamenTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const statsById = new Map(active.map((player) => [player.id, parseStats(player.item_effects)]))
  const result = new Map<string, RamenTitle[]>(active.map((player) => [player.id, []]))

  for (const rule of MAX_TITLE_RULES) {
    let best = 0
    for (const stats of statsById.values()) best = Math.max(best, rule.value(stats))
    if (best <= 0) continue
    for (const [id, stats] of statsById) {
      if (rule.value(stats) === best) result.get(id)!.push(TITLES[rule.id])
    }
  }

  for (const [id, stats] of statsById) {
    const titles = result.get(id)!
    if (stats.tripleCrowns > 0) titles.push(TITLES.triple)
    if (titles.length === 0) titles.push(stats.served > 0 ? TITLES.steady : TITLES.apprentice)
  }

  return result
}

/** 결과 요약 칸에 보여 줄 숫자들 */
export function summarizeStats(stats: RamenStats): Array<{ label: string; value: string }> {
  return [
    { label: '받은 손님', value: `${stats.customers}명` },
    { label: '1,000원 라면', value: `${stats.perfect}개` },
    { label: '한 판 최고', value: `${stats.bestRound.toLocaleString()}원` },
    { label: '번 돈', value: `${stats.money.toLocaleString()}원` },
  ]
}
