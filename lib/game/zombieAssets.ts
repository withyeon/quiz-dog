export const ZOMBIE_ICON = {
  zombie: '/zombie/virus-mutation.webp',
  human: '/zombie/player.webp',
  heal: '/zombie/heal.webp',
  shield: '/zombie/shield.webp',
  scan: '/icons/scan.webp',
  attack: '/zombie/attack.webp',
  correct: '/icons/correct.webp',
  wrong: '/icons/wrong.webp',
  quiz: '/zombie/quiz.webp',
  virusMutation: '/zombie/virus-mutation.webp',
  timer: '/zombie/timer.webp',
  log: '/zombie/log.webp',
  player: '/zombie/player.webp',
  // 2026-10-21 B안 개편 — Codex 이미지 생성으로 기존 아이콘과 같은 픽셀아트로 만들었다
  heli: '/zombie/heli.webp',
  radio: '/zombie/radio.webp',
  repair: '/zombie/repair.webp',
  vaccine: '/zombie/vaccine.webp',
  sabotage: '/zombie/sabotage.webp',
} as const

export type ZombieIconName = keyof typeof ZOMBIE_ICON
