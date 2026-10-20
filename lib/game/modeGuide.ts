import { VISIBLE_GAME_MODES, type GameModeId } from '@/lib/game/modes'

/**
 * 게임별 "내 수업에 맞나" 안내 — 추천 학년·예상 시간·조작 난도·개인전/협동전과 상황별 추천 태그.
 * 랜딩·기능 소개 게임 카드와 선생님 게임 선택 화면이 같이 쓴다.
 *
 * 값은 2026-10-20 기준 개발자 추정치다. 실제 수업 테스트 결과에 맞춰 여기 숫자만 고치면
 * 세 화면이 한 번에 바뀐다.
 * 예상 시간은 게임 시간 선택지(GameDurationPicker)에 맞춰 최대 10분이다 — 10분을 넘는 값은 쓰지 않는다(2026-10-20 사용자 결정).
 */
export type ControlLevel = '쉬움' | '보통' | '어려움'
export type PlayStyle = '개인전' | '팀전' | '협동전' | '역할전'

/** 상황별 추천 태그 — 처음 사용하는 반 / 저학년 / 수업 마무리 / 학급 협동 */
export type RecommendationTag = 'first' | 'lower' | 'short' | 'coop'

export type GameModeGuide = {
  /** 추천 학년 (예: '초3~6') */
  grades: string
  /** 예상 진행 시간 (예: '5~10분'). 최대 10분 */
  minutes: string
  /** 조작 난도 */
  control: ControlLevel
  /** 개인전·팀전·협동전·역할전 */
  play: PlayStyle
  /** 상황별 추천에 들어가는 태그 */
  tags: readonly RecommendationTag[]
}

export const RECOMMENDATION_FILTERS: readonly { id: RecommendationTag; label: string; hint: string }[] = [
  { id: 'first', label: '처음 사용하는 반', hint: '규칙이 가장 간단해서 설명 1분이면 시작할 수 있어요' },
  { id: 'lower', label: '저학년 수업', hint: '읽을 글이 적고 조작이 쉬워 1~3학년도 할 수 있어요' },
  { id: 'short', label: '수업 마무리', hint: '5분 안팎으로 끝나서 정리 활동으로 좋아요' },
  { id: 'coop', label: '학급 협동 활동', hint: '반 전체가 함께 이기는 게임이에요' },
]

export const GAME_MODE_GUIDES: Record<GameModeId, GameModeGuide> = {
  gold_quest: { grades: '초3~6', minutes: '5~10분', control: '쉬움', play: '개인전', tags: ['first'] },
  battle_royale: { grades: '초4~6', minutes: '5~10분', control: '보통', play: '팀전', tags: ['coop'] },
  fishing: { grades: '초2~6', minutes: '5~10분', control: '보통', play: '개인전', tags: ['lower'] },
  factory: { grades: '초3~6', minutes: '5~10분', control: '쉬움', play: '개인전', tags: ['first'] },
  cafe: { grades: '초3~6', minutes: '5~10분', control: '보통', play: '개인전', tags: [] },
  mafia: { grades: '초4~중', minutes: '5~10분', control: '보통', play: '역할전', tags: [] },
  tower: { grades: '초4~6', minutes: '7~10분', control: '어려움', play: '개인전', tags: [] },
  dontlookdown: { grades: '초3~6', minutes: '5~10분', control: '보통', play: '개인전', tags: ['short'] },
  zombie: { grades: '초4~6', minutes: '5~10분', control: '보통', play: '역할전', tags: ['short'] },
  treat_rush: { grades: '초2~6', minutes: '5~10분', control: '보통', play: '개인전', tags: ['short', 'lower'] },
  poop_dodge: { grades: '초1~4', minutes: '5~10분', control: '쉬움', play: '개인전', tags: ['first', 'lower', 'short'] },
  raid: { grades: '초3~6', minutes: '5~10분', control: '보통', play: '협동전', tags: ['coop'] },
  bungeoppang: { grades: '초2~6', minutes: '5~10분', control: '보통', play: '개인전', tags: ['lower'] },
  ramen: { grades: '초3~6', minutes: '5~10분', control: '보통', play: '개인전', tags: [] },
  study: { grades: '전체', minutes: '자유', control: '쉬움', play: '개인전', tags: [] },
}

export function getGameModeGuide(mode: GameModeId): GameModeGuide {
  return GAME_MODE_GUIDES[mode]
}

export function matchesRecommendation(mode: GameModeId, tag: RecommendationTag | null): boolean {
  if (!tag) return true
  return GAME_MODE_GUIDES[mode].tags.includes(tag)
}

/** 선생님이 고를 수 있는 게임 중 태그에 맞는 것 */
export function listRecommendedModes(tag: RecommendationTag): GameModeId[] {
  return VISIBLE_GAME_MODES.filter((mode) => matchesRecommendation(mode.id, tag)).map((mode) => mode.id)
}
