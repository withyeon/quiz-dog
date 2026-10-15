'use client'

/**
 * 방금 낸 구성치기(다중 선택) 답을 오답 화면(AnswerReveal)이 페이지를 거치지 않고 읽게 하는 전역 스토어.
 * hooks/useQuestionSetTitle.ts 와 같은 방식이다.
 *
 * - QuizView 가 답을 낼 때마다 publishSubmittedMultiSelectAnswer 로 올린다. 다중 선택이면 낸 답(시간 초과면 ''),
 *   아니면 null 을 올려서 앞 문제의 답이 다음 오답 화면에 남지 않게 한다.
 * - AnswerReveal 이 useSubmittedMultiSelectAnswer 로 읽어 잘못 고른 것·골라야 할 것을 보여 준다
 *   (components/quiz/MultiSelectMistakes.tsx). 오답 화면을 그리는 게임이 열 군데 가까이라 일일이 내려보내지 않으려는 것이다.
 */

import { useSyncExternalStore } from 'react'

let submitted: string | null = null
const listeners = new Set<() => void>()

export function publishSubmittedMultiSelectAnswer(next: string | null) {
  if (submitted === next) return
  submitted = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => submitted
const getServerSnapshot = () => null

/** 마지막으로 낸 다중 선택 답. 마지막 답이 다중 선택이 아니었으면 null. */
export function useSubmittedMultiSelectAnswer(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
