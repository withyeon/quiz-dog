/**
 * 단어장 화면에 쓰는 그림. 새로 그리지 않고 public 에 있는 픽셀 그림을 다시 쓴다.
 *  - 단어장 자체는 카드 모양 티켓, 공부 방법은 뜻이 가까운 아이템 그림
 *  - 결과는 점수대에 따라 트로피(금·은·동) / 박수 치는 포메
 */
export const VOCAB_ART = {
  set: '/icons/ticket.webp',
  flashcards: '/icons/flip.webp',
  learn: '/zombie/quiz.webp',
  write: '/zombie/log.webp',
  test: '/icons/correct.webp',
  correct: '/icons/correct.webp',
  wrong: '/icons/wrong.webp',
  keepGoing: '/icons/streak.webp',
  clap: '/assets/icons/mascot-pome-clap-320.webp',
  pome: '/assets/icons/mascot-pome-256.webp',
  trophy: '/trophy.webp',
  silver: '/silver.webp',
  bronze: '/bronze.webp',
} as const

/** 시험 점수(0~100)에 맞는 결과 그림 */
export function scoreArt(percent: number): string {
  if (percent >= 90) return VOCAB_ART.trophy
  if (percent >= 70) return VOCAB_ART.silver
  if (percent >= 50) return VOCAB_ART.bronze
  return VOCAB_ART.pome
}
