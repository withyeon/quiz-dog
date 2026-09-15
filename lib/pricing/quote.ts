/**
 * 견적서 계산 — 요금제 페이지의 "견적서 발행"이 쓰는 단일 소스.
 *
 * 가격 정책은 전부 이 파일의 상수로만 정한다(화면·문서는 계산 결과만 그린다).
 * 지금은 베타 기간이라 실제 결제는 없지만, 학교는 예산 편성·품의를 위해 견적서가 필요하므로
 * 정가 기준으로 발행한다.
 */

export type QuotePlanId = 'pro'

export type QuoteTier = {
  /** 이 인원 이상이면 적용 */
  minSeats: number
  /** 정가 대비 할인율 (0.4 = 40%) */
  discountRate: number
}

/** Pro 정가 (원/인/월). 요금제 페이지의 4,900원과 같은 값이어야 한다. */
export const PRO_MONTHLY_LIST_PRICE = 4900

/** 12개월 이상 계약하면 2개월분을 빼 준다 (요금제 페이지의 "연간 = 2개월치 절약"과 동일). */
export const FREE_MONTHS_PER_YEAR = 2

/**
 * 단체 할인 구간. 개인·단체를 따로 나누지 않는다 — 어차피 전부 선생님 대상이라
 * 계정 수가 GROUP_TIERS[0].minSeats 이상이면 자동으로 단체 할인이 붙는다. minSeats 오름차순.
 */
export const GROUP_TIERS: readonly QuoteTier[] = [
  { minSeats: 5, discountRate: 0.4 },
  { minSeats: 30, discountRate: 0.45 },
  { minSeats: 100, discountRate: 0.5 },
]

/** 이 인원부터 단체 할인 */
export const GROUP_MIN_SEATS = GROUP_TIERS[0].minSeats
export const MIN_SEATS = 1
export const MIN_MONTHS = 1
export const MAX_SEATS = 5000
export const MAX_MONTHS = 36

export const VAT_RATE = 0.1
/** 견적 유효기간 (발행일 포함, 일) */
export const QUOTE_VALID_DAYS = 30

export const MONTH_OPTIONS = [1, 3, 6, 12, 24] as const

export type QuoteInput = {
  seats: number
  months: number
}

export type QuoteBreakdown = {
  planLabel: string
  seats: number
  months: number
  /** 정가 (원/인/월) */
  listUnitPrice: number
  /** 적용 단체 할인율 (0~1). 인원이 GROUP_MIN_SEATS 미만이면 0 */
  discountRate: number
  /** 할인 적용 단가 (원/인/월) */
  unitPrice: number
  /** 실제 과금 개월 수 (12개월마다 2개월 무료 차감) */
  billableMonths: number
  /** 무료로 빠진 개월 수 */
  freeMonths: number
  /** 공급가액 (부가세 별도) */
  supplyAmount: number
  vatAmount: number
  totalAmount: number
  /** 할인 전 정가 총액 (정가 × 인원 × 개월) */
  listTotal: number
}

export function getGroupDiscountRate(seats: number): number {
  let rate = 0
  for (const tier of GROUP_TIERS) {
    if (seats >= tier.minSeats) rate = tier.discountRate
  }
  return rate
}

/** 12개월마다 FREE_MONTHS_PER_YEAR 개월을 뺀 과금 개월 수 */
export function getBillableMonths(months: number): number {
  const years = Math.floor(months / 12)
  return months - years * FREE_MONTHS_PER_YEAR
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export function normalizeQuoteInput(input: QuoteInput): QuoteInput {
  return {
    seats: clampInt(input.seats, MIN_SEATS, MAX_SEATS),
    months: clampInt(input.months, MIN_MONTHS, MAX_MONTHS),
  }
}

export function calculateQuote(rawInput: QuoteInput): QuoteBreakdown {
  const { seats, months } = normalizeQuoteInput(rawInput)
  const discountRate = getGroupDiscountRate(seats)
  // 단가는 10원 단위로 내림해 견적서 숫자를 깔끔하게 만든다
  const unitPrice = Math.floor((PRO_MONTHLY_LIST_PRICE * (1 - discountRate)) / 10) * 10
  const billableMonths = getBillableMonths(months)
  const supplyAmount = unitPrice * seats * billableMonths
  const vatAmount = Math.round(supplyAmount * VAT_RATE)

  return {
    planLabel: discountRate > 0 ? '퀴즈독 Pro (단체)' : '퀴즈독 Pro',
    seats,
    months,
    listUnitPrice: PRO_MONTHLY_LIST_PRICE,
    discountRate,
    unitPrice,
    billableMonths,
    freeMonths: months - billableMonths,
    supplyAmount,
    vatAmount,
    totalAmount: supplyAmount + vatAmount,
    listTotal: PRO_MONTHLY_LIST_PRICE * seats * months,
  }
}

/**
 * "조금만 더 하면 더 싸져요" 힌트.
 * 인원을 1명 늘리면 다음 구간 할인이 적용되거나, 개월을 1개월 늘리면 무료 개월이 생겨
 * 총액이 오히려 줄어드는 경우에만 돌려준다.
 */
export function getQuoteHints(input: QuoteInput): string[] {
  const base = calculateQuote(input)
  const hints: string[] = []

  const plusOne = calculateQuote({ ...input, seats: base.seats + 1 })
  if (plusOne.discountRate > base.discountRate) {
    hints.push(`1명만 추가하면 단체 할인 ${Math.round(plusOne.discountRate * 100)}%가 적용돼 인당 요금이 더 저렴해져요.`)
  }

  const plusMonth = calculateQuote({ ...input, months: base.months + 1 })
  if (plusMonth.totalAmount < base.totalAmount) {
    hints.push('1개월만 늘리면 2개월이 무료라 총액이 더 저렴해져요.')
  }

  return hints
}

export function formatKrw(amount: number): string {
  return `${Math.round(amount).toLocaleString('ko-KR')}원`
}

export function formatDateKo(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}. ${m}. ${d}.`
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

/** 시작일 + n개월 − 1일 = 사용 종료일 */
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  next.setDate(next.getDate() - 1)
  return next
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** 견적번호: QD-YYYYMMDD-XXXX. 같은 날 여러 장을 발행해도 겹치지 않게 뒤 4자리는 무작위. */
export function generateQuoteNumber(issuedAt: Date): string {
  const y = issuedAt.getFullYear()
  const m = String(issuedAt.getMonth() + 1).padStart(2, '0')
  const d = String(issuedAt.getDate()).padStart(2, '0')
  const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `QD-${y}${m}${d}-${suffix}`
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, '')
  return digits.length >= 9 && digits.length <= 11
}
