import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * 위드현 이용 코드(초피티·퀴즈독 공용, 프로 1개월) 확인. 서버 전용.
 *
 * 위드현 매니저가 학교 납품 때 계정마다 1개씩 발급해 납품정보서에 적어 보낸다(2026-10-06).
 * 코드는 HMAC 서명형이라 매니저 DB를 보지 않고 같은 비밀값(WITHYEON_PROMO_CODE_SECRET)으로 여기서 확인한다.
 * 코드 하나를 퀴즈독·초피티에서 한 번씩 쓸 수 있고, 사용 기록은 각자 DB(promo_code_redemptions)에 남긴다.
 *
 * 형식: Crockford Base32 16자 `PXXX-XXXX-XXXX-XXXX`
 *  - 1자 종류(P = 프로 1개월), 7자 무작위, 8자 = HMAC-SHA256(비밀값, "withyeon-promo:v1:" + 앞 8자)의 앞 40비트
 * 같은 규칙이 withyeon-manager `src/lib/promoCode.ts`, gpt-chatbot `lib/promo-code.ts`에 있다. 바꾸면 셋을 함께 바꾼다.
 * 확인용 값: 비밀값 'test-secret-for-promo-codes' → 'P123-4567-TB3T-ZP3F' 가 맞는 코드다(scripts/check-promo-code.mjs).
 */
export const PROMO_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const PROMO_CODE_LENGTH = 16
const BODY_LENGTH = 8
const SIGNATURE_BYTES = 5
const SIGNATURE_DOMAIN = 'withyeon-promo:v1:'

export const PROMO_CODE_KINDS = {
  P: { key: 'pro_1m', plan: 'pro', months: 1, label: '프로 1개월' },
} as const

export type PromoCodeKind = (typeof PROMO_CODE_KINDS)[keyof typeof PROMO_CODE_KINDS]

function sign(secret: string, body: string): string {
  const digest = createHmac('sha256', secret).update(SIGNATURE_DOMAIN + body).digest()
  let value = 0
  for (let i = 0; i < SIGNATURE_BYTES; i++) value = value * 256 + digest[i]
  let out = ''
  for (let i = SIGNATURE_BYTES * 8 - 5; i >= 0; i -= 5) {
    out += PROMO_CODE_ALPHABET[Math.floor(value / 2 ** i) % 32]
  }
  return out
}

/** 입력을 저장 형식(하이픈 없는 대문자 16자)으로. 옮겨 적다 헷갈리는 O/I/L은 0/1로 읽는다. */
export function normalizePromoCode(input: unknown): string {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[\s\-‐-―]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
}

/** 서명이 맞으면 코드 종류, 아니면 null. 이미 썼는지는 DB에서 따로 본다. */
export function verifyPromoCode(secret: string, input: unknown): PromoCodeKind | null {
  const code = normalizePromoCode(input)
  if (code.length !== PROMO_CODE_LENGTH) return null
  if ([...code].some((ch) => !PROMO_CODE_ALPHABET.includes(ch))) return null
  const kind = PROMO_CODE_KINDS[code[0] as keyof typeof PROMO_CODE_KINDS]
  if (!kind) return null
  const expected = Buffer.from(sign(secret, code.slice(0, BODY_LENGTH)))
  const actual = Buffer.from(code.slice(BODY_LENGTH))
  return timingSafeEqual(expected, actual) ? kind : null
}
