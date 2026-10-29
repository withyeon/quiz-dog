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
  // 협동 보스 레이드. 영상·캡처 모두 테스트 방의 아레나 화면 녹화 (/dev/raid-preview 는 개편 전 화면이라 못 쓴다)
  { modeId: 'raid', name: '황제 펭귄을 막아라', titleImage: '/title/raid.webp', icon: '/raid/penguin-emperor.webp', color: '#0EA5E9', bg: 'rgba(14,165,233,0.14)', previewVideo: { webm: '/main/mp4/games/raid.webm', mp4: '/main/mp4/games/raid.mp4' }, previewImage: '/main/games/raid.webp' },
  // 붕어빵 굽굽!
  { modeId: 'bungeoppang', name: '붕어빵 굽굽!', titleImage: '/title/bungeoppang.webp', icon: '/bungeoppang/baked.webp', color: '#F59E0B', bg: 'rgba(245,158,11,0.16)', previewVideo: { webm: '/main/mp4/games/bungeoppang.webm', mp4: '/main/mp4/games/bungeoppang.mp4' }, previewImage: '/main/games/bungeoppang.webp' },
  // 퀴즈독의 라면가게. 캡처는 /dev/ramen-preview 주방 화면
  { modeId: 'ramen', name: '퀴즈독의 라면가게', titleImage: '/title/ramen.webp', icon: '/ramen/icon-bowl.webp', color: '#7C3AED', bg: 'rgba(124,58,237,0.14)', previewVideo: { webm: '/main/mp4/games/ramen.webm', mp4: '/main/mp4/games/ramen.mp4' }, previewImage: '/main/games/ramen.webp' },
  // 블록 텃밭 키우기. 캡처는 /dev/garden-preview?preset=rich&view0=garden&bare=1 밭 화면(1280×800)
  { modeId: 'garden', name: '블록 텃밭 키우기', titleImage: '/title/garden.webp', icon: '/garden/crop-carrot.webp', color: '#65A30D', bg: 'rgba(101,163,13,0.15)', previewVideo: { webm: '/main/mp4/games/garden.webm', mp4: '/main/mp4/games/garden.mp4' }, previewImage: '/main/games/garden.webp' },
  // 멍멍 서바이벌. 영상은 /dev/survivor-preview 전투·스킬 카드 녹화, 캡처는 ?preset=strong&boss=1&bare=1 전투 화면(1280×800)
  { modeId: 'survivor', name: '멍멍 서바이벌', titleImage: '/title/survivor.webp', icon: '/survivor/skill-bone.webp', color: '#F97316', bg: 'rgba(249,115,22,0.14)', previewVideo: { webm: '/main/mp4/games/survivor.webm', mp4: '/main/mp4/games/survivor.mp4' }, previewImage: '/main/games/survivor.webp' },
  // 퀴즈팡팡. 영상은 /dev/quizpang-preview?items=all&realquiz=1 녹화(스왑·멍멍 폭탄·문제·아이템 카드), 캡처는 ?bare=1 보드 화면(1280×800)
  { modeId: 'quizpang', name: '퀴즈팡팡', titleImage: '/title/quizpang.webp', icon: '/quizpang/item-bomb.webp', color: '#EC4899', bg: 'rgba(236,72,153,0.14)', previewVideo: { webm: '/main/mp4/games/quizpang.webm', mp4: '/main/mp4/games/quizpang.mp4' }, previewImage: '/main/games/quizpang.webp' },
  // 뼈다귀 쟁탈전. 영상은 /dev/bone-rush-preview 녹화(뼈다귀 줍기→상자→카드·친구 고르기→고양이 피하기, 가짜 문제는 잘라냄), 캡처는 ?preset=rich&bare=1 마당 화면(1280×800)
  { modeId: 'bone_rush', name: '뼈다귀 쟁탈전', titleImage: '/title/bone-rush.webp', icon: '/survivor/skill-bone.webp', color: '#D97706', bg: 'rgba(217,119,6,0.14)', previewVideo: { webm: '/main/mp4/games/bone-rush.webm', mp4: '/main/mp4/games/bone-rush.mp4' }, previewImage: '/main/games/bone-rush.webp' },
]

export const gameModesData: GameModeInfo[] = GAME_MODE_CARDS.map((game) => ({
  ...game,
  description: getGameModeConfig(game.modeId).description,
}))

/** 사이트에 노출하는 게임 (출시 전 숨김 처리된 게임 제외) */
export const visibleGameModes = gameModesData.filter((game) => !isHiddenGameMode(game.modeId))

export const visibleGameModeCount = visibleGameModes.length
