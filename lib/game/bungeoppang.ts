/**
 * 붕어빵 굽굽! — 규칙·상수·순수 함수.
 *
 * 흐름: 퀴즈 정답 → 반죽이 틀에 들어가고 굽기 게이지가 차오름 → 「뒤집기!」 → 멈춘 위치의 등급(덜 익음~탔다)으로
 * 기본 점수 → 속(팥·슈크림·치즈·초코·쌍둥이·황금)이 랜덤으로 공개되어 배율 → 6칸 판이 다 차면 보너스.
 *
 * 학생별 상태는 players 행 두 칸을 쓴다 (새 컬럼 없음, sql/20261020_bungeoppang_mode.sql):
 *   players.score        = 점수 합 (순위 기준)
 *   players.item_effects = BungeoStats JSON (구운 개수·완벽·황금·속별 개수·판 진행·버프)
 *
 * 설계 원칙 (사용자 기획서 2026-10-20)
 *  - 완벽 구간을 너무 좁게 하지 않는다. 탔어도 0점은 아니다 — 문제를 맞혔는데 보상이 사라지면 억울하다.
 *  - 콤보는 정답 콤보가 아니라 "굽기(완벽) 콤보"다. 정답 연속까지 점수 차이를 벌리면 잘하는 아이가 독주한다.
 *  - 하위권 도움(장갑·장인)은 겉으로는 그냥 랜덤 아이템처럼 보인다. "꼴찌에게 지급" 같은 문구는 절대 쓰지 않는다.
 */

// ─── 상수 ───
export const BUNGEO = {
  /** 한 판(철판) 칸 수 */
  TRAY_SIZE: 6,
  /** 한 판 완성 보너스 */
  TRAY_BONUS: 300,
  /** 게이지 0→100% 기본 시간(ms). 완벽 구간 25% ≈ 0.8초 */
  GAUGE_DURATION_MS: 3200,
  /** 초코·따뜻한 장갑: 게이지 속도 −25% */
  SLOW_FACTOR: 0.75,
  /** 화력 폭주: 게이지 속도 1.5배 */
  FAST_FACTOR: 1.5,
  /** 버터 타임·장인의 도움: 완벽 구간 +30% */
  WIDE_PERFECT_FACTOR: 1.3,
  /** 연속 완벽 n번 → 불맛 모드(다음 붕어빵 점수 2배) */
  FIRE_MODE_STREAK: 3,
  FIRE_MODE_MULTIPLIER: 2,
  /** 한파주의보: 점수 +30% (다음 붕어빵 3개) */
  COLD_WAVE_BONUS: 0.3,
  COLD_WAVE_BAKES: 3,
  /** 화력 폭주·버터 타임·장갑·장인: 다음 붕어빵 2개 */
  EFFECT_BAKES: 2,
  /** 단골손님: 다음 붕어빵이 완벽이면 +500 */
  REGULAR_CUSTOMER_BONUS: 500,
  /** 황금 붕어빵 기본 확률 / 황금 반죽 때 확률 */
  GOLDEN_BASE_CHANCE: 0.05,
  GOLDEN_BOOSTED_CHANCE: 0.25,
  /** 정답 하나마다 랜덤 이벤트가 터질 확률 */
  EVENT_CHANCE: 0.14,
  /** 하위권 도움 아이템이 나올 확률(정답마다, 조건 맞을 때) */
  HELP_CHANCE: 0.3,
  /** 하위권 기준: 순위가 뒤에서 이 비율 안 */
  HELP_RANK_RATIO: 0.3,
  /** 도움을 줄 최소 인원 */
  HELP_MIN_PLAYERS: 4,
  /** 퀴즈 제한 시간(초) */
  QUESTION_TIME_LIMIT: 30,
  /** 오답 화면 시간(ms) */
  WRONG_ANSWER_DELAY_MS: 2000,
} as const

// ─── 굽기 등급 ───
export type GradeId = 'underdone' | 'tasty' | 'perfect' | 'crispy' | 'burnt'

export type GradeDef = {
  id: GradeId
  label: string
  emoji: string
  /** 게이지에서 차지하는 비율(%) — 전체 합 100 */
  width: number
  score: number
  /** 게이지 색 */
  color: string
}

/** 게이지 왼쪽부터: 덜 익음 15 · 맛있음 30 · 완벽 25 · 바삭 20 · 탔다 10 */
export const GRADES: readonly GradeDef[] = [
  { id: 'underdone', label: '덜 익음', emoji: '😵', width: 15, score: 70, color: '#fde68a' },
  { id: 'tasty', label: '맛있음', emoji: '😋', width: 30, score: 100, color: '#fbbf24' },
  { id: 'perfect', label: '완벽', emoji: '✨', width: 25, score: 160, color: '#f97316' },
  { id: 'crispy', label: '바삭', emoji: '🔥', width: 20, score: 120, color: '#c2410c' },
  { id: 'burnt', label: '탔다', emoji: '💀', width: 10, score: 50, color: '#44403c' },
] as const

export const GRADE_BY_ID: Record<GradeId, GradeDef> = Object.fromEntries(
  GRADES.map((grade) => [grade.id, grade]),
) as Record<GradeId, GradeDef>

export type GradeZone = GradeDef & { start: number; end: number }

/**
 * 게이지 구간. 완벽 구간이 넓어지면(버터·장인) 양옆(맛있음·바삭)에서 똑같이 가져온다.
 * 전체 길이는 항상 100 이다.
 */
export function getGradeZones(perfectFactor = 1): GradeZone[] {
  const base = GRADES.map((grade) => grade.width)
  const perfectIndex = GRADES.findIndex((grade) => grade.id === 'perfect')
  const extra = base[perfectIndex] * (perfectFactor - 1)
  const widths = [...base]
  widths[perfectIndex] += extra
  widths[perfectIndex - 1] = Math.max(4, widths[perfectIndex - 1] - extra / 2)
  widths[perfectIndex + 1] = Math.max(4, widths[perfectIndex + 1] - extra / 2)

  let cursor = 0
  return GRADES.map((grade, index) => {
    const start = cursor
    cursor += widths[index]
    return { ...grade, width: widths[index], start, end: cursor }
  })
}

/** 게이지 위치(0~100)가 어느 구간인지. 100 이면 탔다 */
export function gradeAt(position: number, zones: GradeZone[]): GradeZone {
  const clamped = Math.max(0, Math.min(100, position))
  return zones.find((zone) => clamped < zone.end) ?? zones[zones.length - 1]
}

// ─── 붕어빵 속 ───
export type FillingId = 'redbean' | 'cream' | 'cheese' | 'choco' | 'twin' | 'golden'

export type FillingDef = {
  id: FillingId
  label: string
  shortLabel: string
  emoji: string
  rarity: '기본' | '조금 희귀' | '희귀' | '특별' | '잭팟'
  /** 점수 배율 (쌍둥이는 2개라서 ×2) */
  multiplier: number
  /** 판에 채워지는 개수 */
  count: number
  /** 황금을 뺀 나머지 가중치. 황금은 따로 확률을 굴린다 */
  weight: number
  description: string
}

export const FILLINGS: readonly FillingDef[] = [
  { id: 'redbean', label: '팥 붕어빵', shortLabel: '팥', emoji: '🫘', rarity: '기본', multiplier: 1, count: 1, weight: 50, description: '기본 붕어빵. 역시 팥이 진리!' },
  { id: 'cream', label: '슈크림 붕어빵', shortLabel: '슈크림', emoji: '💛', rarity: '조금 희귀', multiplier: 1.2, count: 1, weight: 22, description: '달콤한 슈크림! 점수 1.2배' },
  { id: 'cheese', label: '치즈 붕어빵', shortLabel: '치즈', emoji: '🧀', rarity: '희귀', multiplier: 1.5, count: 1, weight: 12, description: '쭉 늘어나는 치즈! 점수 1.5배' },
  { id: 'choco', label: '초코 붕어빵', shortLabel: '초코', emoji: '🍫', rarity: '특별', multiplier: 1, count: 1, weight: 9, description: '다음 붕어빵 게이지가 느려져요. 완벽 맞히기 쉬워짐!' },
  { id: 'twin', label: '쌍둥이 붕어빵', shortLabel: '쌍둥이', emoji: '🐟🐟', rarity: '희귀', multiplier: 2, count: 2, weight: 7, description: '한 번 구웠는데 2개! 점수도 2배, 판도 2칸' },
  { id: 'golden', label: '황금 붕어빵', shortLabel: '황금', emoji: '👑', rarity: '잭팟', multiplier: 3, count: 1, weight: 0, description: '✨ 황금 붕어빵!! ✨ 점수 3배' },
] as const

export const FILLING_BY_ID: Record<FillingId, FillingDef> = Object.fromEntries(
  FILLINGS.map((filling) => [filling.id, filling]),
) as Record<FillingId, FillingDef>

/** 황금 먼저 굴리고, 아니면 나머지를 가중치로 뽑는다 */
export function drawFilling(rand: () => number, goldenChance: number = BUNGEO.GOLDEN_BASE_CHANCE): FillingDef {
  if (rand() < goldenChance) return FILLING_BY_ID.golden
  const pool = FILLINGS.filter((filling) => filling.weight > 0)
  const total = pool.reduce((sum, filling) => sum + filling.weight, 0)
  let roll = rand() * total
  for (const filling of pool) {
    roll -= filling.weight
    if (roll < 0) return filling
  }
  return pool[0]
}

// ─── 버프 · 이벤트 · 아이템 ───
export type BungeoBuffs = {
  /** 게이지가 느린 굽기 남은 횟수 (초코·따뜻한 장갑) */
  slowBakes: number
  /** 게이지가 빠른 굽기 남은 횟수 (화력 폭주) */
  fastBakes: number
  /** 완벽 구간이 넓은 굽기 남은 횟수 (버터 타임·장인의 도움) */
  wideBakes: number
  /** 황금 확률 UP 남은 횟수 (황금 반죽) */
  goldenBakes: number
  /** 점수 +30% 남은 횟수 (한파주의보) */
  coldBakes: number
  /** 단골손님: 다음 굽기가 완벽이면 +500 */
  customer: boolean
  /** 불맛 모드: 다음 붕어빵 점수 2배 */
  fireMode: boolean
}

export const EMPTY_BUFFS: BungeoBuffs = {
  slowBakes: 0, fastBakes: 0, wideBakes: 0, goldenBakes: 0, coldBakes: 0, customer: false, fireMode: false,
}

export type EventId = 'cold_wave' | 'fire_surge' | 'butter_time' | 'golden_dough' | 'regular_customer'
export type HelpItemId = 'warm_gloves' | 'master_help'

/** 화면에 뜨는 알림 — 랜덤 이벤트와 (하위권) 도움 아이템이 똑같은 모양으로 나온다 */
export type BungeoNotice = {
  kind: 'event' | 'item' | 'filling'
  id: EventId | HelpItemId | FillingId
  emoji: string
  title: string
  description: string
  tone: 'cold' | 'fire' | 'butter' | 'gold' | 'dog' | 'item'
}

export const EVENTS: Record<EventId, Omit<BungeoNotice, 'kind' | 'id'>> = {
  cold_wave: { emoji: '❄️', title: '한파주의보', description: `오늘 너무 추워요! 다음 붕어빵 ${BUNGEO.COLD_WAVE_BAKES}개 점수 +${Math.round(BUNGEO.COLD_WAVE_BONUS * 100)}%`, tone: 'cold' },
  fire_surge: { emoji: '🔥', title: '화력 폭주', description: `불이 너무 세졌어요! 다음 붕어빵 ${BUNGEO.EFFECT_BAKES}개는 게이지가 ${BUNGEO.FAST_FACTOR}배 빨라요`, tone: 'fire' },
  butter_time: { emoji: '🧈', title: '버터 타임', description: `고소한 버터를 발랐어요! 다음 붕어빵 ${BUNGEO.EFFECT_BAKES}개는 완벽 구간이 넓어져요`, tone: 'butter' },
  golden_dough: { emoji: '🌟', title: '황금 반죽', description: `다음 붕어빵의 황금 확률 UP! ${Math.round(BUNGEO.GOLDEN_BASE_CHANCE * 100)}% → ${Math.round(BUNGEO.GOLDEN_BOOSTED_CHANCE * 100)}%`, tone: 'gold' },
  regular_customer: { emoji: '🐶', title: '단골손님 등장', description: `목도리 한 강아지: "완벽하게 구워주세요!" 다음 붕어빵이 완벽이면 +${BUNGEO.REGULAR_CUSTOMER_BONUS}`, tone: 'dog' },
}

export const HELP_ITEMS: Record<HelpItemId, Omit<BungeoNotice, 'kind' | 'id'>> = {
  warm_gloves: { emoji: '🧤', title: '따뜻한 장갑 획득!', description: `다음 붕어빵 ${BUNGEO.EFFECT_BAKES}개는 게이지가 느려져요 (속도 −${Math.round((1 - BUNGEO.SLOW_FACTOR) * 100)}%)`, tone: 'item' },
  master_help: { emoji: '👵', title: '붕어빵 장인의 도움!', description: `다음 붕어빵 ${BUNGEO.EFFECT_BAKES}개는 완벽 구간이 +${Math.round((BUNGEO.WIDE_PERFECT_FACTOR - 1) * 100)}% 넓어져요`, tone: 'item' },
}

const EVENT_IDS = Object.keys(EVENTS) as EventId[]
const HELP_IDS = Object.keys(HELP_ITEMS) as HelpItemId[]

export function makeEventNotice(id: EventId): BungeoNotice {
  return { kind: 'event', id, ...EVENTS[id] }
}

export function makeHelpNotice(id: HelpItemId): BungeoNotice {
  return { kind: 'item', id, ...HELP_ITEMS[id] }
}

/** 정답 때 이벤트 굴리기. 같은 종류 효과가 이미 걸려 있으면 그 이벤트는 뽑지 않는다 */
export function rollEvent(buffs: BungeoBuffs, rand: () => number): EventId | null {
  if (rand() >= BUNGEO.EVENT_CHANCE) return null
  const candidates = EVENT_IDS.filter((id) => {
    if (id === 'cold_wave') return buffs.coldBakes === 0
    if (id === 'fire_surge') return buffs.fastBakes === 0 && buffs.slowBakes === 0
    if (id === 'butter_time') return buffs.wideBakes === 0
    if (id === 'golden_dough') return buffs.goldenBakes === 0
    if (id === 'regular_customer') return !buffs.customer
    return true
  })
  if (candidates.length === 0) return null
  return candidates[Math.floor(rand() * candidates.length)]
}

/** 버프에 이벤트 적용 */
export function applyEvent(buffs: BungeoBuffs, id: EventId): BungeoBuffs {
  switch (id) {
    case 'cold_wave': return { ...buffs, coldBakes: BUNGEO.COLD_WAVE_BAKES }
    case 'fire_surge': return { ...buffs, fastBakes: BUNGEO.EFFECT_BAKES }
    case 'butter_time': return { ...buffs, wideBakes: BUNGEO.EFFECT_BAKES }
    case 'golden_dough': return { ...buffs, goldenBakes: 1 }
    case 'regular_customer': return { ...buffs, customer: true }
  }
}

export function applyHelpItem(buffs: BungeoBuffs, id: HelpItemId): BungeoBuffs {
  switch (id) {
    case 'warm_gloves': return { ...buffs, slowBakes: BUNGEO.EFFECT_BAKES, fastBakes: 0 }
    case 'master_help': return { ...buffs, wideBakes: BUNGEO.EFFECT_BAKES }
  }
}

type RankablePlayer = { id: string; score?: number | null; is_kicked?: boolean | null }

/**
 * 하위권 도움 대상인지. 4명 이상일 때 점수 순위가 뒤에서 30% 안이고 1등과 동점이 아니면 대상이다.
 * 화면에는 절대 "하위권"이라는 말이 나가지 않는다 — 결과는 그냥 랜덤 아이템으로 보인다.
 */
export function isHelpEligible(players: RankablePlayer[], playerId: string): boolean {
  const active = players.filter((player) => !player.is_kicked)
  if (active.length < BUNGEO.HELP_MIN_PLAYERS) return false
  const me = active.find((player) => player.id === playerId)
  if (!me) return false
  const myScore = me.score ?? 0
  const scores = active.map((player) => player.score ?? 0)
  const top = Math.max(...scores)
  if (myScore >= top) return false
  const ahead = scores.filter((score) => score > myScore).length
  const rank = ahead + 1
  const cutoff = Math.ceil(active.length * (1 - BUNGEO.HELP_RANK_RATIO))
  return rank > cutoff
}

/** 도움 아이템 굴리기 — 이미 같은 효과가 걸려 있으면 다른 쪽을, 둘 다 걸려 있으면 안 준다 */
export function rollHelpItem(buffs: BungeoBuffs, rand: () => number): HelpItemId | null {
  if (rand() >= BUNGEO.HELP_CHANCE) return null
  const candidates = HELP_IDS.filter((id) => (id === 'warm_gloves' ? buffs.slowBakes === 0 : buffs.wideBakes === 0))
  if (candidates.length === 0) return null
  return candidates[Math.floor(rand() * candidates.length)]
}

// ─── 굽기 설정(게이지 속도·완벽 구간) ───
export type BakeSetup = {
  durationMs: number
  zones: GradeZone[]
  goldenChance: number
  /** 화면 안내용 */
  slow: boolean
  fast: boolean
  wide: boolean
}

export function getBakeSetup(buffs: BungeoBuffs): BakeSetup {
  let speed = 1
  if (buffs.slowBakes > 0) speed *= BUNGEO.SLOW_FACTOR
  if (buffs.fastBakes > 0) speed *= BUNGEO.FAST_FACTOR
  return {
    durationMs: Math.round(BUNGEO.GAUGE_DURATION_MS / speed),
    zones: getGradeZones(buffs.wideBakes > 0 ? BUNGEO.WIDE_PERFECT_FACTOR : 1),
    goldenChance: buffs.goldenBakes > 0 ? BUNGEO.GOLDEN_BOOSTED_CHANCE : BUNGEO.GOLDEN_BASE_CHANCE,
    slow: buffs.slowBakes > 0,
    fast: buffs.fastBakes > 0,
    wide: buffs.wideBakes > 0,
  }
}

// ─── 학생 통계 (players.item_effects) ───
export type BungeoStats = {
  v: 1
  /** 구운 붕어빵 개수 (쌍둥이는 2) */
  baked: number
  /** 뒤집기 횟수 */
  flips: number
  perfect: number
  golden: number
  grades: Record<GradeId, number>
  fillings: Record<FillingId, number>
  /** 지금 판에 채운 칸 (0 ~ TRAY_SIZE-1) */
  tray: number
  traysDone: number
  perfectStreak: number
  bestPerfectStreak: number
  buffs: BungeoBuffs
}

export function createEmptyStats(): BungeoStats {
  return {
    v: 1,
    baked: 0,
    flips: 0,
    perfect: 0,
    golden: 0,
    grades: { underdone: 0, tasty: 0, perfect: 0, crispy: 0, burnt: 0 },
    fillings: { redbean: 0, cream: 0, cheese: 0, choco: 0, twin: 0, golden: 0 },
    tray: 0,
    traysDone: 0,
    perfectStreak: 0,
    bestPerfectStreak: 0,
    buffs: { ...EMPTY_BUFFS },
  }
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0

/** DB 의 item_effects 를 통계로. 모양이 다르면(다른 게임 흔적·null) 빈 통계 */
export function parseStats(raw: unknown): BungeoStats {
  const empty = createEmptyStats()
  if (!raw || typeof raw !== 'object' || (raw as { v?: unknown }).v !== 1) return empty
  const data = raw as Partial<BungeoStats> & { grades?: Partial<Record<GradeId, unknown>>; fillings?: Partial<Record<FillingId, unknown>>; buffs?: Partial<Record<keyof BungeoBuffs, unknown>> }
  const grades = { ...empty.grades }
  for (const key of Object.keys(grades) as GradeId[]) grades[key] = toCount(data.grades?.[key])
  const fillings = { ...empty.fillings }
  for (const key of Object.keys(fillings) as FillingId[]) fillings[key] = toCount(data.fillings?.[key])
  const buffs: BungeoBuffs = {
    slowBakes: toCount(data.buffs?.slowBakes),
    fastBakes: toCount(data.buffs?.fastBakes),
    wideBakes: toCount(data.buffs?.wideBakes),
    goldenBakes: toCount(data.buffs?.goldenBakes),
    coldBakes: toCount(data.buffs?.coldBakes),
    customer: data.buffs?.customer === true,
    fireMode: data.buffs?.fireMode === true,
  }
  return {
    v: 1,
    baked: toCount(data.baked),
    flips: toCount(data.flips),
    perfect: toCount(data.perfect),
    golden: toCount(data.golden),
    grades,
    fillings,
    tray: Math.min(BUNGEO.TRAY_SIZE - 1, toCount(data.tray)),
    traysDone: toCount(data.traysDone),
    perfectStreak: toCount(data.perfectStreak),
    bestPerfectStreak: toCount(data.bestPerfectStreak),
    buffs,
  }
}

// ─── 뒤집기 판정 ───
export type ScoreLine = { label: string; text: string }

export type BakeOutcome = {
  grade: GradeZone
  filling: FillingDef
  /** 게이지 위치 */
  position: number
  basePoints: number
  /** 배율·보너스 설명 (결과 카드에 한 줄씩) */
  lines: ScoreLine[]
  /** 이번 굽기 총 점수 (판 보너스 포함) */
  points: number
  trayBonus: number
  /** 이번에 완성한 판 수 (쌍둥이로 2개 채우면 1판 완성 + 새 판에 1개) */
  traysCompleted: number
  /** 완벽 연속 (이번 포함). 완벽이 아니면 0 */
  perfectStreak: number
  /** 이번 굽기로 불맛 모드가 켜졌는지 (다음 붕어빵 2배) */
  fireModeTriggered: boolean
  /** 이번 굽기에 불맛 2배가 쓰였는지 */
  fireModeUsed: boolean
  customerBonus: number
  stats: BungeoStats
}

/**
 * 「뒤집기!」 순간의 판정. 순수 함수 — rand 를 넣어 테스트·봇에서도 쓴다.
 * 점수 = 등급 점수 × 속 배율 × (불맛 2배) × (한파 1.3) + 단골 보너스 + 판 완성 보너스
 */
export function resolveBake(stats: BungeoStats, position: number, setup: BakeSetup, rand: () => number): BakeOutcome {
  const grade = gradeAt(position, setup.zones)
  const filling = drawFilling(rand, setup.goldenChance)
  const buffs = stats.buffs
  const lines: ScoreLine[] = []

  let points = grade.score
  lines.push({ label: `${grade.emoji} ${grade.label}`, text: `${grade.score}점` })

  if (filling.multiplier !== 1) {
    points *= filling.multiplier
    lines.push({ label: `${filling.emoji} ${filling.label}`, text: `×${filling.multiplier}` })
  } else {
    lines.push({ label: `${filling.emoji} ${filling.label}`, text: filling.id === 'choco' ? '다음 게이지 느려짐' : '×1' })
  }

  const fireModeUsed = buffs.fireMode
  if (fireModeUsed) {
    points *= BUNGEO.FIRE_MODE_MULTIPLIER
    lines.push({ label: '🔥 불맛 모드', text: `×${BUNGEO.FIRE_MODE_MULTIPLIER}` })
  }

  if (buffs.coldBakes > 0) {
    points *= 1 + BUNGEO.COLD_WAVE_BONUS
    lines.push({ label: '❄️ 한파주의보', text: `+${Math.round(BUNGEO.COLD_WAVE_BONUS * 100)}%` })
  }

  points = Math.round(points)

  let customerBonus = 0
  if (buffs.customer) {
    if (grade.id === 'perfect') {
      customerBonus = BUNGEO.REGULAR_CUSTOMER_BONUS
      lines.push({ label: '🐶 단골손님 대만족', text: `+${customerBonus}` })
    } else {
      lines.push({ label: '🐶 단골손님', text: '다음에 완벽하게…' })
    }
  }
  points += customerBonus

  // 판 채우기
  const filled = stats.tray + filling.count
  const traysCompleted = Math.floor(filled / BUNGEO.TRAY_SIZE)
  const tray = filled % BUNGEO.TRAY_SIZE
  const trayBonus = traysCompleted * BUNGEO.TRAY_BONUS
  if (trayBonus > 0) {
    lines.push({ label: '🍳 한 판 완성!', text: `+${trayBonus}` })
  }
  points += trayBonus

  // 완벽 콤보 → 불맛 모드
  const perfectStreak = grade.id === 'perfect' ? stats.perfectStreak + 1 : 0
  const fireModeTriggered = perfectStreak > 0 && perfectStreak % BUNGEO.FIRE_MODE_STREAK === 0

  const nextBuffs: BungeoBuffs = {
    slowBakes: Math.max(0, buffs.slowBakes - 1) + (filling.id === 'choco' ? 1 : 0),
    fastBakes: Math.max(0, buffs.fastBakes - 1),
    wideBakes: Math.max(0, buffs.wideBakes - 1),
    goldenBakes: Math.max(0, buffs.goldenBakes - 1),
    coldBakes: Math.max(0, buffs.coldBakes - 1),
    customer: false,
    fireMode: fireModeTriggered,
  }

  const nextStats: BungeoStats = {
    ...stats,
    baked: stats.baked + filling.count,
    flips: stats.flips + 1,
    perfect: stats.perfect + (grade.id === 'perfect' ? 1 : 0),
    golden: stats.golden + (filling.id === 'golden' ? 1 : 0),
    grades: { ...stats.grades, [grade.id]: stats.grades[grade.id] + 1 },
    fillings: { ...stats.fillings, [filling.id]: stats.fillings[filling.id] + 1 },
    tray,
    traysDone: stats.traysDone + traysCompleted,
    perfectStreak,
    bestPerfectStreak: Math.max(stats.bestPerfectStreak, perfectStreak),
    buffs: nextBuffs,
  }

  return {
    grade,
    filling,
    position,
    basePoints: grade.score,
    lines,
    points,
    trayBonus,
    traysCompleted,
    perfectStreak,
    fireModeTriggered,
    fireModeUsed,
    customerBonus,
    stats: nextStats,
  }
}

/** 완벽 콤보 배지 문구. 2연속부터 보인다 */
export function getPerfectComboLabel(streak: number): string | null {
  if (streak < 2) return null
  return `🔥 PERFECT ×${streak}`
}

// ─── 결과: 칭호 ───
export type BungeoTitleId =
  | 'fire_master' | 'rich' | 'golden_hand' | 'redbean_lover' | 'cream_fan' | 'cheese_fan'
  | 'crispy_king' | 'tray_master' | 'steady' | 'apprentice'

export type BungeoTitle = { id: BungeoTitleId; emoji: string; label: string; description: string }

export const TITLES: Record<BungeoTitleId, BungeoTitle> = {
  fire_master: { id: 'fire_master', emoji: '🔥', label: '불판의 지배자', description: '완벽 굽기를 가장 많이 했어요' },
  rich: { id: 'rich', emoji: '🐟', label: '붕어빵 부자', description: '붕어빵을 가장 많이 구웠어요' },
  golden_hand: { id: 'golden_hand', emoji: '👑', label: '황금손', description: '황금 붕어빵을 가장 많이 구웠어요' },
  redbean_lover: { id: 'redbean_lover', emoji: '🫘', label: '팥 러버', description: '팥 붕어빵을 가장 많이 구웠어요' },
  cream_fan: { id: 'cream_fan', emoji: '💛', label: '슈크림 수집가', description: '슈크림 붕어빵을 가장 많이 구웠어요' },
  cheese_fan: { id: 'cheese_fan', emoji: '🧀', label: '치즈 장인', description: '치즈 붕어빵을 가장 많이 구웠어요' },
  crispy_king: { id: 'crispy_king', emoji: '🥖', label: '바삭 마스터', description: '바삭하게 가장 많이 구웠어요' },
  tray_master: { id: 'tray_master', emoji: '🍳', label: '한 판 완성왕', description: '철판을 가장 많이 채웠어요' },
  steady: { id: 'steady', emoji: '🧣', label: '성실한 굽굽이', description: '끝까지 열심히 구웠어요' },
  apprentice: { id: 'apprentice', emoji: '🐾', label: '붕어빵 견습생', description: '다음엔 꼭 첫 붕어빵을 구워요' },
}

type TitlePlayer = { id: string; is_kicked?: boolean | null; item_effects?: unknown }

/** 통계값으로 "최다" 칭호를 주는 규칙. 공동 1등이면 모두 받는다 */
const MAX_TITLE_RULES: Array<{ id: BungeoTitleId; value: (stats: BungeoStats) => number }> = [
  { id: 'fire_master', value: (stats) => stats.perfect },
  { id: 'rich', value: (stats) => stats.baked },
  { id: 'golden_hand', value: (stats) => stats.golden },
  { id: 'tray_master', value: (stats) => stats.traysDone },
  { id: 'redbean_lover', value: (stats) => stats.fillings.redbean },
  { id: 'cream_fan', value: (stats) => stats.fillings.cream },
  { id: 'cheese_fan', value: (stats) => stats.fillings.cheese },
  { id: 'crispy_king', value: (stats) => stats.grades.crispy },
]

/**
 * 모든 참가자에게 칭호를 하나 이상 준다. 1등이 아니어도 뭔가 하나는 받는다.
 * 순서: 최다 칭호(공동 1등 포함) → 하나도 없으면 성실한 굽굽이(1개 이상 구움) / 견습생(0개).
 */
export function assignTitles(players: TitlePlayer[]): Map<string, BungeoTitle[]> {
  const active = players.filter((player) => !player.is_kicked)
  const statsById = new Map(active.map((player) => [player.id, parseStats(player.item_effects)]))
  const result = new Map<string, BungeoTitle[]>(active.map((player) => [player.id, []]))

  for (const rule of MAX_TITLE_RULES) {
    let best = 0
    for (const stats of statsById.values()) best = Math.max(best, rule.value(stats))
    if (best <= 0) continue
    for (const [id, stats] of statsById) {
      if (rule.value(stats) === best) result.get(id)!.push(TITLES[rule.id])
    }
  }

  for (const [id, titles] of result) {
    if (titles.length > 0) continue
    const stats = statsById.get(id)!
    titles.push(stats.baked > 0 ? TITLES.steady : TITLES.apprentice)
  }

  return result
}

/** 결과 화면 "오늘의 붕어빵 장인" 요약 줄 */
export function summarizeStats(stats: BungeoStats): Array<{ label: string; value: string }> {
  return [
    { label: '구운 붕어빵', value: `${stats.baked}개` },
    { label: '완벽 굽기', value: `${stats.perfect}회` },
    { label: '황금 붕어빵', value: `${stats.golden}개` },
    { label: '완성한 판', value: `${stats.traysDone}판` },
  ]
}
