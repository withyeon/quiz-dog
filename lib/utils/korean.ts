/** 조사 짝 — 앞이 받침으로 끝나면 앞 글자, 아니면 뒤 글자를 씁니다. */
export type JosaPair = '이/가' | '은/는' | '을/를' | '과/와'

const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3

/** 마지막 글자에 받침이 있는지 (한글이 아니면 없는 것으로 봅니다) */
function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1)
  if (!last) return false
  const code = last.charCodeAt(0)
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return false
  return (code - HANGUL_FIRST) % 28 !== 0
}

/**
 * 낱말 뒤에 조사를 받침에 맞게 붙여 줍니다.
 * 카드 이름·메뉴 이름처럼 나중에 바뀔 수 있는 낱말에 씁니다.
 *   withJosa('황금 강아지', '이/가') → '황금 강아지가'
 *   withJosa('똥폭탄', '은/는')     → '똥폭탄은'
 */
export function withJosa(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split('/')
  return `${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`
}
