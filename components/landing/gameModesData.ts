import { isHiddenGameMode, type GameModeId } from '@/lib/game/modes'

/**
 * 랜딩 페이지와 기능 소개(/features)에서 함께 쓰는 게임 모드 목록.
 * 한 곳에서만 관리해서 두 페이지의 게임 수·설명이 어긋나지 않게 한다.
 *
 * 노출 여부는 lib/game/modes.ts의 HIDDEN_GAME_MODE_IDS 하나만 따른다.
 * (선생님 게임 선택 화면과 항상 같은 목록이 되도록)
 */
export type GameModeInfo = {
  /** lib/game/modes.ts의 GameModeConfig.id — 노출 여부를 여기에 맞춘다 */
  modeId: GameModeId
  name: string
  titleImage: string
  emoji: string
  color: string
  bg: string
  description: string
  /**
   * 호버 시 재생할 플레이 영상 (없으면 previewImage → 없으면 색 패널만).
   * webm(VP9)을 먼저 주고 mp4(H.264)로 폴백한다 — 크롬·엣지·파이어폭스는 webm을,
   * 사파리는 mp4를 받는다. 같은 화질에서 webm이 1/4 정도로 가볍다.
   */
  previewVideo?: { webm?: string; mp4: string }
  /** 호버 시 보여줄 플레이 화면 이미지 */
  previewImage?: string
}

export const gameModesData: GameModeInfo[] = [
  { modeId: 'gold_quest', name: '해적왕의 보물찾기', titleImage: '/title/gold-quest.webp', emoji: '🏴‍☠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', description: '황금을 모으며 보물을 찾는 모험', previewImage: '/background/gold-quest.webp' },
  { modeId: 'battle_royale', name: '눈싸움 대작전', titleImage: '/title/battle-royale.webp', emoji: '❄️', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', description: '눈덩이로 상대를 맞추는 배틀', previewImage: '/background/battle-royale.webp' },
  { modeId: 'fishing', name: '인형뽑기', titleImage: '/title/fishing.webp', emoji: '🕹️', color: '#EC4899', bg: 'rgba(236,72,153,0.15)', description: '희귀 아이템을 노려라!', previewVideo: { webm: '/main/mp4/fishing.webm', mp4: '/main/mp4/fishing.mp4' }, previewImage: '/background/fishing.webp' },
  { modeId: 'factory', name: '전설의 편의점', titleImage: '/title/factory.webp', emoji: '🏪', color: '#10B981', bg: 'rgba(16,185,129,0.15)', description: '편의점 경영 부자 되기', previewImage: '/background/factory.webp' },
  { modeId: 'cafe', name: '달콤 바삭 카페', titleImage: '/title/cafe.webp', emoji: '☕', color: '#F97316', bg: 'rgba(249,115,22,0.15)', description: '카페 운영 최고 점수 달성', previewImage: '/background/cafe.webp' },
  { modeId: 'mafia', name: '쉿! 마피아', titleImage: '/title/mafia.webp', emoji: '🕴️', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', description: '배신과 추리의 심리전', previewImage: '/background/mafia.webp' },
  { modeId: 'tower', name: '타워 디펜스', titleImage: '/title/tower-defense.webp', emoji: '🏰', color: '#6366F1', bg: 'rgba(99,102,241,0.15)', description: '타워로 적을 막아내기', previewVideo: { webm: '/main/mp4/tower-defense.webm', mp4: '/main/mp4/tower-defense.mp4' }, previewImage: '/background/tower-defense.webp' },
  { modeId: 'dontlookdown', name: '점프점프', titleImage: '/title/jump_jump.webp', emoji: '⛰️', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', description: '떨어지지 않고 정상 등반' },
  { modeId: 'zombie', name: '좀비를 피해라', titleImage: '/title/zombie.webp', emoji: '🧟', color: '#22C55E', bg: 'rgba(34,197,94,0.14)', description: '좀비를 피해 끝까지 살아남기', previewImage: '/zombie/background.png' },
  { modeId: 'treat_rush', name: '간식런', titleImage: '/title/gansik-run.webp', emoji: '🍪', color: '#A855F7', bg: 'rgba(168,85,247,0.14)', description: '간식을 모으며 달리는 스피드 런' },
  { modeId: 'poop_dodge', name: '강아지대소동', titleImage: '/title/puppy-chaos.webp', emoji: '🐾', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)', description: '강아지들과 함께하는 미니게임 대소동' },
]

/** 사이트에 노출하는 게임 (출시 전 숨김 처리된 게임 제외) */
export const visibleGameModes = gameModesData.filter((game) => !isHiddenGameMode(game.modeId))

export const visibleGameModeCount = visibleGameModes.length

/**
 * 히어로 영상 재생 순서 — 여기 적은 순서대로 나온다.
 * 목록에 없는 게임은 그 뒤에 gameModesData 순서로 이어서 재생.
 */
const HERO_VIDEO_ORDER: readonly GameModeId[] = ['tower', 'fishing']

function heroVideoRank(modeId: GameModeId): number {
  const index = HERO_VIDEO_ORDER.indexOf(modeId)
  return index === -1 ? HERO_VIDEO_ORDER.length : index
}

/** 히어로에서 자동 재생할 대표 게임 (실제 플레이 영상이 있는 것만) */
export const heroShowcaseGames = visibleGameModes
  .filter((game) => Boolean(game.previewVideo))
  .sort((a, b) => heroVideoRank(a.modeId) - heroVideoRank(b.modeId))
