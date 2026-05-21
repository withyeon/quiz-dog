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

export function isQuizAnswerMatch(submittedAnswer: string, correctAnswer: string): boolean {
  const submitted = normalizeQuizAnswer(submittedAnswer)
  const correct = normalizeQuizAnswer(correctAnswer)

  return submitted !== '' && correct !== '' && submitted === correct
}
