/**
 * 랜딩 페이지와 기능 소개(/features)에서 함께 쓰는 게임 모드 목록.
 * 한 곳에서만 관리해서 두 페이지의 게임 수·설명이 어긋나지 않게 한다.
 */
export type GameModeInfo = {
  name: string
  titleImage: string
  emoji: string
  color: string
  bg: string
  description: string
}

export const gameModesData: GameModeInfo[] = [
  { name: '해적왕의 보물찾기', titleImage: '/title/gold-quest.svg', emoji: '🏴‍☠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', description: '황금을 모으며 보물을 찾는 모험' },
  { name: '눈싸움 대작전', titleImage: '/title/battle-royale.svg', emoji: '❄️', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', description: '눈덩이로 상대를 맞추는 배틀' },
  { name: '인형뽑기', titleImage: '/title/fishing.svg', emoji: '🕹️', color: '#EC4899', bg: 'rgba(236,72,153,0.15)', description: '희귀 아이템을 노려라!' },
  { name: '전설의 편의점', titleImage: '/title/factory.svg', emoji: '🏪', color: '#10B981', bg: 'rgba(16,185,129,0.15)', description: '편의점 경영 부자 되기' },
  { name: '달콤 바삭 카페', titleImage: '/title/cafe.svg', emoji: '☕', color: '#F97316', bg: 'rgba(249,115,22,0.15)', description: '카페 운영 최고 점수 달성' },
  { name: '쉿! 마피아', titleImage: '/title/mafia.svg', emoji: '🕴️', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', description: '배신과 추리의 심리전' },
  { name: '타워 디펜스', titleImage: '/title/tower-defense.svg', emoji: '🏰', color: '#6366F1', bg: 'rgba(99,102,241,0.15)', description: '타워로 적을 막아내기' },
  { name: '점프점프', titleImage: '/title/jump_jump.svg', emoji: '⛰️', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', description: '떨어지지 않고 정상 등반' },
  { name: '좀비를 피해라', titleImage: '/title/zombie.svg', emoji: '🧟', color: '#22C55E', bg: 'rgba(34,197,94,0.14)', description: '좀비를 피해 끝까지 살아남기' },
  { name: '간식런', titleImage: '/title/gansik-run.svg', emoji: '🍪', color: '#A855F7', bg: 'rgba(168,85,247,0.14)', description: '간식을 모으며 달리는 스피드 런' },
  { name: '강아지대소동', titleImage: '/title/puppy-chaos.svg', emoji: '🐾', color: '#F43F5E', bg: 'rgba(244,63,94,0.14)', description: '강아지들과 함께하는 미니게임 대소동' },
]

export const visibleGameModeCount = gameModesData.length
