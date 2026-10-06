// 이용 코드 서명 규칙 확인: node scripts/check-promo-code.mjs
// withyeon-manager·gpt-chatbot 과 같은 확인용 값을 쓴다. 세 곳의 규칙이 어긋나면 여기서 실패한다.
// (이 저장소에는 테스트 도구가 없어 Node 내장 TS 실행으로 lib/promoCode.ts 를 바로 불러온다. Node 22.18 이상)
import assert from 'node:assert/strict'
import { normalizePromoCode, verifyPromoCode } from '../lib/promoCode.ts'

const SECRET = 'test-secret-for-promo-codes'
const VECTOR = 'P123-4567-TB3T-ZP3F'

assert.equal(verifyPromoCode(SECRET, VECTOR)?.key, 'pro_1m')
assert.equal(verifyPromoCode(SECRET, ' p1234567tb3tzp3f ')?.key, 'pro_1m')
assert.equal(verifyPromoCode('another-secret-value', VECTOR), null)
assert.equal(verifyPromoCode(SECRET, 'P123-4567-TB3T-ZP3G'), null)
assert.equal(verifyPromoCode(SECRET, 'X123-4567-TB3T-ZP3F'), null)
assert.equal(verifyPromoCode(SECRET, 'P123-4567-TB3T-ZP3'), null)
assert.equal(verifyPromoCode(SECRET, null), null)
assert.equal(normalizePromoCode('pabc-oil0'), 'PABC0110')
console.log('promo code: ok')
