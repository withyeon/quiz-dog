export const ZOMBIE_ICON = {
  zombie: '/zombie/zombie.svg',
  human: '/zombie/human.svg',
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

/** SVG 준비 전까지 이모지로 대체 */
export const ZOMBIE_ICON_EMOJI_FALLBACK: Partial<Record<ZombieIconName, string>> = {
  zombie: '🧟',
  human: '🧑',
}
