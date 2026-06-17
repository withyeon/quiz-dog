const KOREAN_DIGIT_MAP: Record<string, string> = {
  영: '0',
  공: '0',
  일: '1',
  한: '1',
  이: '2',
  둘: '2',
  삼: '3',
  셋: '3',
  사: '4',
  넷: '4',
  오: '5',
  다섯: '5',
  육: '6',
  륙: '6',
  여섯: '6',
  칠: '7',
  일곱: '7',
  팔: '8',
  여덟: '8',
  구: '9',
  아홉: '9',
}

export function normalizeQuizAnswer(value: string | number | null | undefined): string {
  let normalized = String(value ?? '').normalize('NFKC').toLowerCase()

  for (const [korean, digit] of Object.entries(KOREAN_DIGIT_MAP)) {
    normalized = normalized.replaceAll(korean, digit)
  }

  return normalized.replace(/[^0-9a-z가-힣]/g, '')
}

/**
 * 하나의 정답 필드에 여러 정답을 담을 수 있다.
 * 줄바꿈(\n) 또는 파이프(|)로 구분한다. (예: "답1|답2", 또는 줄바꿈으로 여러 줄)
 * 기존 단일 정답은 구분자가 없으므로 1개짜리 배열로 그대로 동작한다.
 */
export function splitAcceptableAnswers(correctAnswer: string | null | undefined): string[] {
  return String(correctAnswer ?? '')
    .split(/[\n|]/)
    .map((answer) => answer.trim())
    .filter(Boolean)
}

export function isQuizAnswerMatch(submittedAnswer: string, correctAnswer: string): boolean {
  const submitted = normalizeQuizAnswer(submittedAnswer)
  if (submitted === '') return false

  return splitAcceptableAnswers(correctAnswer).some(
    (candidate) => normalizeQuizAnswer(candidate) === submitted,
  )
}
