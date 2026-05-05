import type { Database } from '@/types/database.types'

export type GameModeId = NonNullable<Database['public']['Tables']['rooms']['Row']['game_mode']>

export type GameModeConfig = {
  id: GameModeId
  route: string
  label: string
  shortLabel: string
  emoji: string
  description: string
  image?: string
  fontFamily?: string
  leaderboardSort: 'score' | 'gold' | 'position' | 'health' | 'factory_money' | 'claw_points'
  requiresQuestionSet: boolean
}

export const GAME_MODES: readonly GameModeConfig[] = [
  {
    id: 'gold_quest',
    route: '/game',
    label: '해적왕의 보물찾기',
    shortLabel: '골드 퀘스트',
    emoji: '🏴‍☠️',
    image: '/gold-quest.png',
    fontFamily: 'DNFBitBitv2, sans-serif',
    description: '황금빛 보물이 잠든 섬, 지도를 따라 모험을 떠나는 해적 어드벤처',
    leaderboardSort: 'gold',
    requiresQuestionSet: true,
  },
  {
    id: 'battle_royale',
    route: '/battle',
    label: '눈싸움 대작전',
    shortLabel: '배틀로얄',
    emoji: '❄️',
    image: '/battle-royale.png',
    fontFamily: 'DNFBitBitv2, sans-serif',
    description: '던지고 피하고 명중시키는 설원 위 스노우 액션',
    leaderboardSort: 'health',
    requiresQuestionSet: true,
  },
  {
    id: 'fishing',
    route: '/fishing',
    label: '두근두근 인형뽑기',
    shortLabel: '인형뽑기',
    emoji: '🕹️',
    image: '/fishing.png',
    fontFamily: 'OkDanDan, sans-serif',
    description: '손끝에 집중해 희귀 인형을 노리는 행운의 뽑기 한판',
    leaderboardSort: 'claw_points',
    requiresQuestionSet: true,
  },
  {
    id: 'factory',
    route: '/factory',
    label: '전설의 편의점',
    shortLabel: '편의점',
    emoji: '🏪',
    image: '/factory.png',
    fontFamily: 'BMJUA, sans-serif',
    description: '진열부터 계산까지 운영하며 최고의 매장을 만드는 경영 게임',
    leaderboardSort: 'factory_money',
    requiresQuestionSet: true,
  },
  {
    id: 'cafe',
    route: '/cafe',
    label: '달콤 바삭 카페',
    shortLabel: '카페',
    emoji: '☕',
    image: '/cafe.png',
    fontFamily: 'DNFBitBitv2, sans-serif',
    description: '손님에게 음식을 서빙하고 카페를 성장시키는 경영 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'mafia',
    route: '/mafia',
    label: '쉿! 마피아',
    shortLabel: '마피아',
    emoji: '🕴️',
    image: '/mafia.png',
    fontFamily: 'BMKkubulim, sans-serif',
    description: '금고를 털고 배신과 조사를 오가는 심리전 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'dontlookdown',
    route: '/dontlookdown',
    label: "Don't Look Down",
    shortLabel: '돈룩다운',
    emoji: '⛰️',
    description: '플랫폼을 점프하며 정상까지 오르는 등반 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'tower',
    route: '/tower',
    label: '타워 디펜스',
    shortLabel: '타워',
    emoji: '🏰',
    description: '퀴즈를 풀어 타워를 설치하고 몰려오는 적을 막는 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
] as const

export const DEFAULT_GAME_MODE: GameModeId = 'gold_quest'

export function isGameModeId(value: unknown): value is GameModeId {
  return typeof value === 'string' && GAME_MODES.some((mode) => mode.id === value)
}

export function getGameModeConfig(mode: string | null | undefined): GameModeConfig {
  return GAME_MODES.find((item) => item.id === mode) ?? GAME_MODES[0]
}

export function getGameModeUrl(gameMode: string | null | undefined, roomCode: string, playerId: string): string {
  const mode = getGameModeConfig(gameMode)
  const params = new URLSearchParams({ room: roomCode, playerId })
  return `${mode.route}?${params.toString()}`
}

export function getModeInitialPlayerState(mode: string | null | undefined) {
  const gameMode = getGameModeConfig(mode).id

  if (gameMode === 'battle_royale') {
    return { health: 100 }
  }

  return {}
}
