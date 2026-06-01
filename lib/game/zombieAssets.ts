export const ZOMBIE_ICON = {
  zombie: '/zombie/virus-mutation.svg',
  human: '/zombie/player.svg',
  heal: '/zombie/heal.svg',
  shield: '/zombie/shield.svg',
  scan: '/zombie/scan.svg',
  attack: '/zombie/attack.svg',
  correct: '/zombie/correct.svg',
  wrong: '/zombie/wrong.svg',
  quiz: '/zombie/quiz.svg',
  virusMutation: '/zombie/virus-mutation.svg',
  timer: '/zombie/timer.svg',
  log: '/zombie/log.svg',
  player: '/zombie/player.svg',
} as const

export type ZombieIconName = keyof typeof ZOMBIE_ICON
