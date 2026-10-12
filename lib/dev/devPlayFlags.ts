/**
 * /dev 페이지에서 켜는 "플레이 테스트용 스위치".
 *
 * - hanjaOnly: 문제 지문에서 한글을 지워 한자만 보이게 한다.
 * - forceShortAnswer: 객관식(CHOICE)·OX 문제를 전부 단답형(SHORT)으로 바꿔 직접 입력해서 풀게 한다.
 *
 * /dev 에서 게임 시작을 누른 탭의 sessionStorage 에 저장되므로, 같은 탭에서 로비→게임으로 넘어가도
 * 유지되고 탭을 닫으면 사라진다. 다른 학생·다른 탭에는 영향이 없다.
 *
 * 게임 화면은 이 값을 직접 읽지 않고 hooks/usePlayFlags.ts 를 거친다. 거기서 닉네임 장난과 합쳐진다.
 */

import { useSyncExternalStore } from 'react'
import { isMultiSelectGameQuestion } from '@/lib/quiz/multiSelect'

export const DEV_PLAY_FLAGS_STORAGE_KEY = 'quizdog:devPlayFlags'

export type DevPlayFlags = {
  hanjaOnly: boolean
  forceShortAnswer: boolean
}

export const DEFAULT_DEV_PLAY_FLAGS: DevPlayFlags = {
  hanjaOnly: false,
  forceShortAnswer: false,
}

let cached: DevPlayFlags | null = null
const listeners = new Set<() => void>()

function parseFlags(raw: string | null): DevPlayFlags {
  if (!raw) return DEFAULT_DEV_PLAY_FLAGS
  try {
    const parsed = JSON.parse(raw) as Partial<DevPlayFlags> | null
    return {
      hanjaOnly: parsed?.hanjaOnly === true,
      forceShortAnswer: parsed?.forceShortAnswer === true,
    }
  } catch {
    return DEFAULT_DEV_PLAY_FLAGS
  }
}

/** 어디서든(서버 포함) 안전하게 읽는다. 브라우저가 아니면 기본값. */
export function readDevPlayFlags(): DevPlayFlags {
  if (typeof window === 'undefined') return DEFAULT_DEV_PLAY_FLAGS
  if (cached) return cached
  try {
    cached = parseFlags(window.sessionStorage.getItem(DEV_PLAY_FLAGS_STORAGE_KEY))
  } catch {
    cached = DEFAULT_DEV_PLAY_FLAGS
  }
  return cached
}

export function writeDevPlayFlags(next: Partial<DevPlayFlags>): DevPlayFlags {
  const merged: DevPlayFlags = { ...readDevPlayFlags(), ...next }
  cached = merged
  if (typeof window !== 'undefined') {
    try {
      const isDefault = !merged.hanjaOnly && !merged.forceShortAnswer
      if (isDefault) window.sessionStorage.removeItem(DEV_PLAY_FLAGS_STORAGE_KEY)
      else window.sessionStorage.setItem(DEV_PLAY_FLAGS_STORAGE_KEY, JSON.stringify(merged))
    } catch {
      // 시크릿 모드 등에서 저장이 막혀도 이 탭 안에서는 메모리 값으로 동작한다.
    }
  }
  listeners.forEach((listener) => listener())
  return merged
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getServerSnapshot = () => DEFAULT_DEV_PLAY_FLAGS

/** React 에서 플래그를 구독한다. 서버 렌더에서는 기본값(모두 꺼짐)이라 hydration 이 어긋나지 않는다. */
export function useDevPlayFlags(): DevPlayFlags {
  return useSyncExternalStore(subscribe, readDevPlayFlags, getServerSnapshot)
}

/**
 * 객관식·OX 를 단답형으로 바꾼다. 보기는 비우고 type 만 SHORT 로 둔다.
 * 정답은 서버 RPC(check_question_answer)가 보기 글자 그대로(OX 는 'O'/'X')와 비교하므로 채점은 그대로 맞는다.
 * BLANK 는 이미 직접 입력형이라 손대지 않는다.
 * 구성치기(다중 선택) 문제는 약재 여러 개를 직접 타이핑하게 되면 외우기 연습이 아니라 받아쓰기가 되므로
 * 단답형으로 바꾸지 않고 다중 선택 그대로 둔다(lib/quiz/multiSelect.ts).
 */
export function toShortAnswerQuestions<T extends { type: string; options: string[]; multiSelect?: boolean }>(questions: T[]): T[] {
  return questions.map((question) =>
    (question.type === 'CHOICE' || question.type === 'OX') && !isMultiSelectGameQuestion(question)
      ? { ...question, type: 'SHORT', options: [] }
      : question,
  )
}
