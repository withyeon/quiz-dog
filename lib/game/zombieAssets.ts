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
} as const

export type ZombieIconName = keyof typeof ZOMBIE_ICON
