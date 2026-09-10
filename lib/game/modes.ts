import type { Database } from '@/types/database.types'
import { GAME_FONT_FAMILY } from '@/lib/game/fonts'

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
  bgm: {
    title: string
    src: string
  }
  leaderboardSort: 'score' | 'gold' | 'position' | 'health' | 'factory_money' | 'claw_points' | 'zombie_survived' | 'treat_rush_score'
  requiresQuestionSet: boolean
}

export const GAME_MODES: readonly GameModeConfig[] = [
  {
    id: 'gold_quest',
    route: '/game',
    label: '해적왕의 보물찾기',
    shortLabel: '골드 퀘스트',
    emoji: '🏴‍☠️',
    image: '/title/gold-quest.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Chiptune: Exploration',
      src: '/audio/bgm/gold-quest.mp3',
    },
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
    image: '/title/battle-royale.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Battle',
      src: '/audio/bgm/battle-royale.mp3',
    },
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
    image: '/title/fishing.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Chiptune 2',
      src: '/audio/bgm/fishing.mp3',
    },
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
    image: '/title/factory.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Action A',
      src: '/audio/bgm/factory.mp3',
    },
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
    image: '/title/cafe.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Flowerbed Fields',
      src: '/audio/bgm/cafe.mp3',
    },
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
    image: '/title/mafia.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Horror B',
      src: '/audio/bgm/mafia.mp3',
    },
    description: '금고를 털고 배신과 조사를 오가는 심리전 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'dontlookdown',
    route: '/dontlookdown',
    label: '점프점프',
    shortLabel: '돈룩다운',
    emoji: '⛰️',
    image: '/title/jump_jump.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Chiptune 1B2',
      src: '/audio/bgm/dontlookdown.mp3',
    },
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
    image: '/title/tower-defense.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: "Chiptune Medieval: The Bard's Tale",
      src: '/audio/bgm/tower.mp3',
    },
    description: '퀴즈를 풀어 타워를 설치하고 몰려오는 적을 막는 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'zombie',
    route: '/zombie',
    label: '좀비를 피해라!',
    shortLabel: '좀비',
    emoji: '🧟',
    image: '/title/zombie.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Horror',
      src: '/audio/bgm/zombie.mp3',
    },
    // 제한 시간은 선생님이 시작할 때 고른다(기본 5분). 설명에 특정 시간을 박아두지 않는다.
    description: '몰래 정해진 좀비를 피해 제한 시간까지 살아남는 정체 숨김 퀴즈 게임',
    leaderboardSort: 'zombie_survived',
    requiresQuestionSet: true,
  },
  {
    id: 'treat_rush',
    route: '/gansik-run',
    label: '간식런',
    shortLabel: '간식런',
    emoji: '🐕',
    image: '/title/gansik-run.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Chiptune 1C2',
      src: '/audio/bgm/treat-rush.mp3',
    },
    description: '달리며 퀴즈 풀고 아이템 박스 획득!',
    leaderboardSort: 'treat_rush_score',
    requiresQuestionSet: true,
  },
  {
    id: 'poop_dodge',
    route: '/puppy-chaos',
    label: '강아지 대소동',
    shortLabel: '대소동',
    emoji: '☂️',
    image: '/title/puppy-chaos.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: '8-bit Battle Loop',
      src: '/audio/bgm/poop-dodge.mp3',
    },
    description: '퀴즈를 풀고 카드를 뽑아 강아지들의 대소동을 버티는 라이브 교실 게임',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
] as const

/**
 * 출시 시점에 아직 다듬는 중이라 목록에서 잠시 감추는 게임.
 * 선생님 게임 선택 화면·랜딩·기능 소개에서만 빠지고,
 * 라우트와 getGameModeConfig는 그대로 동작하므로 이미 만들어진 방은 문제없이 진행된다.
 * 공개할 때는 여기서 id만 빼면 모든 목록에 한 번에 다시 나온다.
 */
export const HIDDEN_GAME_MODE_IDS: readonly GameModeId[] = [
  'battle_royale',
  'mafia',
  'dontlookdown',
  'zombie',
  'treat_rush',
]

export function isHiddenGameMode(mode: string | null | undefined): boolean {
  return HIDDEN_GAME_MODE_IDS.includes(mode as GameModeId)
}

/** 선생님이 고를 수 있는 게임 (숨김 처리된 게임 제외) */
export const VISIBLE_GAME_MODES: readonly GameModeConfig[] = GAME_MODES.filter(
  (mode) => !isHiddenGameMode(mode.id)
)

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

  if (gameMode === 'poop_dodge') {
    return {
      current_question_index: 0,
      combo_count: 0,
      has_umbrella: false,
      pending_attacks: [],
      is_kicked: false,
    }
  }

  return {}
}

/**
 * 과제(혼자 풀기)로 낼 수 있는 모드.
 * 눈싸움(팀전)·마피아·좀비(역할 배정)는 여럿이 있어야 성립하므로 뺀다.
 */
export const HOMEWORK_GAME_MODES: readonly GameModeId[] = [
  'treat_rush', 'poop_dodge', 'dontlookdown', 'fishing', 'gold_quest', 'factory', 'cafe', 'tower',
]
