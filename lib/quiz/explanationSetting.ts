import type { Json } from '@/types/database.types'

/**
 * 방 옵션 "틀리면 해설 보여주기" — rooms.settings.showExplanation (true/false).
 *
 * 선생님이 방을 만들 때(CreateRoomPanel) 정한다. 기본값은 문제집 제목 규칙(구성치기·탕치기면 켬,
 * lib/quiz/multiSelect.ts 의 isWrongAnswerExplanationSet)이고, 선생님이 바꾸면 그 값이 이긴다.
 * 이 키가 없는 방(이전에 만든 방)은 제목 규칙 그대로다.
 *
 * 학생 화면에서는 게임 훅(useGameBase·useConvenienceStoreGame)이 이 값을 아래 전역 값에 올리고,
 * 해설 표시(components/quiz/WrongAnswerExplanation.tsx)와 오답 화면 시간(getWrongScreenMs)이 읽는다.
 * 공부 모드는 원래 해설을 늘 보여 주므로 이 옵션과 상관없다.
 */

export const SHOW_EXPLANATION_SETTING_KEY = 'showExplanation'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** rooms.settings 에서 읽는다. 선생님이 정하지 않은 방이면 null(제목 규칙을 따른다). */
export function parseShowExplanationSetting(settings: Json | null | undefined): boolean | null {
  if (!isRecord(settings)) return null
  const value = settings[SHOW_EXPLANATION_SETTING_KEY]
  return typeof value === 'boolean' ? value : null
}

/** 기존 rooms.settings 를 보존한 채 해설 옵션만 덮어쓴 값 */
export function buildShowExplanationSettings(showExplanation: boolean, existing: Json | null | undefined): Json {
  return {
    ...(isRecord(existing) ? existing : {}),
    [SHOW_EXPLANATION_SETTING_KEY]: showExplanation,
  }
}

// ─── 학생 화면: 지금 방의 값 (hooks/useQuestionSetTitle.ts 의 제목 스토어와 같은 방식) ───

let currentSetting: boolean | null = null
const listeners = new Set<() => void>()

export function setRoomShowExplanation(next: boolean | null) {
  if (currentSetting === next) return
  currentSetting = next
  listeners.forEach((listener) => listener())
}

export function getRoomShowExplanation(): boolean | null {
  return currentSetting
}

export function subscribeRoomShowExplanation(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
