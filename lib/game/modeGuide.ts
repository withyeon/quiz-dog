import type { GameModeId } from '@/lib/game/modes'

/**
 * 게임별 "내 수업에 맞나" 안내 — 추천 학년·조작 난도·개인전/협동전과 학년군 필터.
 * 랜딩·기능 소개 게임 카드와 선생님 게임 선택 화면이 같이 쓴다.
 *
 * 추천 학년·조작 난도는 2026-10-29 사용자가 정한 세 단계다 — 쉬움(초1~고)·보통(초3~고)·어려움(초5~고).
 * 학년 구분: 저학년=초1~2, 중학년=초3~4, 고학년=초5~6. 학년군 필터는 grades 의 시작 학년으로 거른다.
 * 여기 값만 고치면 세 화면이 한 번에 바뀐다.
 * 예상 시간은 2026-10-29 사용자 결정으로 뺐다.
 */
export type ControlLevel = '쉬움' | '보통' | '어려움'
export type PlayStyle = '개인전' | '팀전' | '협동전' | '역할전'

/** 학년군 필터 — 저학년(초1~2) / 중학년(초3~4) / 고학년(초5~6) / 중고등 */
export type RecommendationTag = 'lower' | 'middle' | 'upper' | 'secondary'

export type GameModeGuide = {
  /** 추천 학년 (예: '초3~6') */
  grades: string
  /** 조작 난도 */
  control: ControlLevel
  /** 개인전·팀전·협동전·역할전 */
  play: PlayStyle
}

export const RECOMMENDATION_FILTERS: readonly { id: RecommendationTag; label: string; hint: string; startGrade: number }[] = [
  { id: 'lower', label: '저학년 수업', hint: '초1~2 — 읽을 글이 적고 조작이 쉬운 게임이에요', startGrade: 1 },
  { id: 'middle', label: '중학년 수업', hint: '초3~4 — 조작이 간단하고 재미있어요', startGrade: 3 },
  { id: 'upper', label: '고학년 수업', hint: '초5~6 — 모든 게임을 즐길 수 있어요', startGrade: 5 },
  { id: 'secondary', label: '중고등학교', hint: '모든 게임을 즐길 수 있어요', startGrade: 7 },
]

export const GAME_MODE_GUIDES: Record<GameModeId, GameModeGuide> = {
  gold_quest: { grades: '초1~고', control: '쉬움', play: '개인전' },
  battle_royale: { grades: '초3~고', control: '보통', play: '팀전' },
  fishing: { grades: '초3~고', control: '보통', play: '개인전' },
  factory: { grades: '초3~고', control: '보통', play: '개인전' },
  cafe: { grades: '초5~고', control: '보통', play: '개인전' },
  mafia: { grades: '초5~고', control: '보통', play: '역할전' },
  tower: { grades: '초5~고', control: '보통', play: '개인전' },
  dontlookdown: { grades: '초3~고', control: '보통', play: '개인전' },
  zombie: { grades: '초3~고', control: '보통', play: '역할전' },
  treat_rush: { grades: '초3~고', control: '보통', play: '개인전' },
  poop_dodge: { grades: '초1~고', control: '쉬움', play: '개인전' },
  raid: { grades: '초3~고', control: '보통', play: '협동전' },
  bungeoppang: { grades: '초3~고', control: '보통', play: '개인전' },
  ramen: { grades: '초3~고', control: '보통', play: '개인전' },
  garden: { grades: '초3~고', control: '보통', play: '개인전' },
  survivor: { grades: '초3~고', control: '보통', play: '개인전' },
  bone_rush: { grades: '초3~고', control: '보통', play: '개인전' },
  quizpang: { grades: '초1~고', control: '쉬움', play: '개인전' },
  study: { grades: '전체', control: '쉬움', play: '개인전' },
}

export function getGameModeGuide(mode: GameModeId): GameModeGuide {
  return GAME_MODE_GUIDES[mode]
}

/** 추천 학년 문자열의 시작 학년 ('초3~고' → 3, '전체' → 1) */
function startGradeOf(grades: string): number {
  const match = grades.match(/초(\d)/)
  return match ? Number(match[1]) : 1
}

/** 고른 학년군에서 시작 학년이 그 학년군 첫 학년 이하인 게임이면 맞는다 */
export function matchesRecommendation(mode: GameModeId, tag: RecommendationTag | null): boolean {
  if (!tag) return true
  const band = RECOMMENDATION_FILTERS.find((filter) => filter.id === tag)
  if (!band) return true
  return startGradeOf(GAME_MODE_GUIDES[mode].grades) <= band.startGrade
}
