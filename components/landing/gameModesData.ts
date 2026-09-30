import { getGameModeConfig, isHiddenGameMode, type GameModeId } from '@/lib/game/modes'

/**
 * 랜딩 페이지와 기능 소개(/features)에서 함께 쓰는 게임 모드 목록.
 * 한 곳에서만 관리해서 두 페이지의 게임 수·설명이 어긋나지 않게 한다.
 *
 * 노출 여부는 lib/game/modes.ts의 HIDDEN_GAME_MODE_IDS 하나만 따른다.
 * 설명 문구는 선생님 게임 선택 화면과 같게 getGameModeConfig 것을 쓴다.
 */
export type GameModeInfo = {
  /** lib/game/modes.ts의 GameModeConfig.id — 노출 여부를 여기에 맞춘다 */
  modeId: GameModeId
  name: string
  titleImage: string
  /** 카드 이름 앞 작은 아이콘 (public 안의 게임 에셋) */
  icon: string
  color: string
  bg: string
  description: string
  /**
   * 호버 시 재생할 플레이 영상 (없으면 previewImage → 없으면 색 패널만).
   * public/main/mp4/games/*: 튜토리얼 데모(/dev/tutorial-preview)를 2배 해상도로 녹화해 퀴즈 → 게임 행동 장면
   * 2~3개를 이어 붙인 4~7초 반복 영상(800×500, 16:10 카드 비율, 무음).
   * webm(VP9)을 먼저 주고 mp4(H.264)로 폴백한다 — 크롬·엣지·파이어폭스는 webm을, 사파리는 mp4를 받는다.
   */
  previewVideo?: { webm?: string; mp4: string }
  /**
   * 호버 시 보여줄 플레이 화면 이미지.
   * 배경 아트가 있는 게임은 /background/*.webp, 캔버스 게임(점프점프·간식런·강아지대소동)은
   * /dev로 방을 만들어 실제 플레이 화면을 1280×800(16:10)으로 찍은 public/main/games/*.webp
   */
  previewImage?: string
}

type GameModeCardDef = Omit<GameModeInfo, 'description'>

const GAME_MODE_CARDS: GameModeCardDef[] = [
  { modeId: 'gold_quest', name: '해적왕의 보물찾기', titleImage: '/title/gold-quest.webp', icon: '/gold-quest/treasure-chest.webp', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', previewVideo: { webm: '/main/mp4/games/gold-quest.webm', mp4: '/main/mp4/games/gold-quest.mp4' }, previewImage: '/background/gold-quest.webp' },
  { modeId: 'battle_royale', name: '눈싸움 대작전', titleImage: '/title/battle-royale.webp', icon: '/tower/projectile/ice_shard.webp', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', previewVideo: { webm: '/main/mp4/games/battle-royale.webm', mp4: '/main/mp4/games/battle-royale.mp4' }, previewImage: '/background/battle-royale.webp' },
  { modeId: 'fishing', name: '인형뽑기', titleImage: '/title/fishing.webp', icon: '/fishing/machine/claw-open.webp', color: '#EC4899', bg: 'rgba(236,72,153,0.15)', previewVideo: { webm: '/main/mp4/games/fishing.webm', mp4: '/main/mp4/games/fishing.mp4' }, previewImage: '/background/fishing.webp' },
  { modeId: 'factory', name: '전설의 편의점', titleImage: '/title/factory.webp', icon: '/store/store.webp', color: '#10B981', bg: 'rgba(16,185,129,0.15)', previewVideo: { webm: '/main/mp4/games/factory.webm', mp4: '/main/mp4/games/factory.mp4' }, previewImage: '/background/factory.webp' },
  { modeId: 'cafe', name: '달콤 바삭 카페', titleImage: '/title/cafe.webp', icon: '/cafe/webp/coffee.webp', color: '#F97316', bg: 'rgba(249,115,22,0.15)', previewVideo: { webm: '/main/mp4/games/cafe.webm', mp4: '/main/mp4/games/cafe.mp4' }, previewImage: '/background/cafe.webp' },
  { modeId: 'mafia', name: '쉿! 마피아', titleImage: '/title/mafia.webp', icon: '/icons/steal.webp', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', previewVideo: { webm: '/main/mp4/games/mafia.webm', mp4: '/main/mp4/games/mafia.mp4' }, previewImage: '/background/mafia.webp' },
  { modeId: 'tower', name: '타워 디펜스', titleImage: '/title/tower-defense.webp', icon: '/tower/basic.webp', color: '#6366F1', bg: 'rgba(99,102,241,0.15)', previewVideo: { webm: '/main/mp4/games/tower-defense.webm', mp4: '/main/mp4/games/tower-defense.mp4' }, previewImage: '/background/tower-defense.webp' },
  { modeId: 'dontlookdown', name: '점프점프', titleImage: '/title/jump_jump.webp', icon: '/dontlookdown/powerup/rocket.webp', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', previewVideo: { webm: '/main/mp4/games/dontlookdown.webm', mp4: '/main/mp4/games/dontlookdown.mp4' }, previewImage: '/main/games/dontlookdown.webp' },
  { modeId: 'zombie', name: '좀비를 피해라', titleImage: '/title/zombie.webp', icon: '/zombie/virus-mutation.webp', color: '#22C55E', bg: 'rgba(34,197,94,0.14)', previewVideo: { webm: '/main/mp4/games/zombie.webm', mp4: '/main/mp4/games/zombie.mp4' }, previewImage: '/zombie/background.png' },
  { modeId: 'treat_rush', name: '간식런', titleImage: '/title/gansik-run.webp', icon: '/gansik-run/bone.webp', color: '#A855F7', bg: 'rgba(168,85,247,0.14)', previewVideo: { webm: '/main/mp4/games/gansik-run.webm', mp4: '/main/mp4/games/gansik-run.mp4' }, previewImage: '/main/games/gansik-run.webp' },
  { modeId: 'poop_dodge', name: '강아지대소동', titleImage: '/title/puppy-chaos.webp', icon: '/puppy-chaos/poop.webp', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)', previewVideo: { webm: '/main/mp4/games/puppy-chaos.webm', mp4: '/main/mp4/games/puppy-chaos.mp4' }, previewImage: '/main/games/puppy-chaos.webp' },
]

export const gameModesData: GameModeInfo[] = GAME_MODE_CARDS.map((game) => ({
  ...game,
  description: getGameModeConfig(game.modeId).description,
}))

/** 사이트에 노출하는 게임 (출시 전 숨김 처리된 게임 제외) */
export const visibleGameModes = gameModesData.filter((game) => !isHiddenGameMode(game.modeId))

export const visibleGameModeCount = visibleGameModes.length
