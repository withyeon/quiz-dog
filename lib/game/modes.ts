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
    description: '퀴즈를 맞히고 보물 상자를 열어 골드를 모아요. 골드가 많은 사람이 승리!',
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
    description: '퀴즈를 맞히고 눈뭉치를 던져 상대를 맞혀요. 상대 팀이 모두 눈사람이 되면 승리!',
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
    description: '퀴즈를 맞히고 집게를 조준해 좋은 인형을 뽑아요. 점수가 많은 사람이 승리!',
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
    description: '퀴즈를 맞혀서 좋은 상품을 판매해요. 돈을 많이 번 사람이 승리!',
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
    description: '퀴즈를 맞히고 음식을 만들어 손님에게 서빙해요. 돈을 많이 번 사람이 승리!',
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
    description: '퀴즈를 맞히고 금고를 열어 돈을 모아요. 돈을 많이 번 사람이 승리!',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    id: 'dontlookdown',
    route: '/dontlookdown',
    label: '점프점프!',
    shortLabel: '돈룩다운',
    emoji: '⛰️',
    image: '/title/jump_jump.webp',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Chiptune 1B2',
      src: '/audio/bgm/dontlookdown.mp3',
    },
    description: '퀴즈를 맞히고 에너지로 발판을 올라요. 가장 높이 오른 사람이 승리!',
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
    description: '퀴즈를 맞히고 타워를 세워 적을 막아요. 골드가 많은 사람이 승리!',
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
    description: '퀴즈를 맞히고 좀비를 피해 살아남아요. 인간이 끝까지 남으면 인간 승리!',
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
    description: '달리며 퀴즈를 풀고 아이템을 모아요. 점수가 많은 사람이 승리!',
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
    description: '똥을 피하고 뼈다귀를 모아요. 퀴즈를 풀어서 좋은 아이템을 얻어요. 점수가 많은 사람이 승리!',
    leaderboardSort: 'score',
    requiresQuestionSet: true,
  },
  {
    // 게임이 아니라 공부 화면이다. 과제로 내기의 첫 번째 선택지이고, 실시간 수업에서도 열 수 있다.
    // 옵션(피드백 시점·다시 풀기·재도전 횟수·문제 순서)은 lib/game/studySettings.ts, 화면은 app/study.
    id: 'study',
    route: '/study',
    label: '공부 모드',
    shortLabel: '공부',
    emoji: '📖',
    fontFamily: GAME_FONT_FAMILY,
    bgm: {
      title: 'Flowerbed Fields',
      src: '/audio/bgm/cafe.mp3',
    },
    description: '게임 없이 문제만 차근차근 풀어요. 바로 정답과 해설을 확인하고, 틀린 문제는 다 맞힐 때까지 다시 풀어요.',
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
 * 과제(혼자 풀기)로 낼 수 있는 모드. 공부 모드가 첫 번째다.
 * 눈싸움(팀전)·마피아·좀비(역할 배정)는 여럿이 있어야 성립하므로 뺀다.
 */
export const HOMEWORK_GAME_MODES: readonly GameModeId[] = [
  'study', 'treat_rush', 'poop_dodge', 'dontlookdown', 'fishing', 'gold_quest', 'factory', 'cafe', 'tower',
]

/** 과제로 낼 수 있는 "게임" (공부 모드 제외) */
export const HOMEWORK_PLAY_MODES: readonly GameModeId[] = HOMEWORK_GAME_MODES.filter((id) => id !== 'study')
