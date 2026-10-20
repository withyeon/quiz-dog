'use client'

/**
 * 지금 플레이 중인 문제집 제목을 문제 렌더러(QuizView)가 페이지를 거치지 않고 읽게 하는 전역 스토어.
 * hooks/usePlayFlags.ts 의 닉네임 스토어와 같은 방식이다.
 *
 * - 게임 훅(useGameBase·useConvenienceStoreGame)이 useRegisterQuestionSetTitle 로 제목을 올린다.
 * - QuizView 가 useCurrentQuestionSetTitle 로 읽어 구성치기 문제집인지 본다(lib/quiz/multiSelect.ts 의 isGusungchigiSet).
 *   QuizView 를 그리는 게임 화면이 열 군데가 넘어 제목을 일일이 내려보내지 않으려는 것이다.
 */

import { useEffect, useSyncExternalStore } from 'react'
import type { Json } from '@/types/database.types'
import {
  getRoomShowExplanation,
  parseShowExplanationSetting,
  setRoomShowExplanation,
  subscribeRoomShowExplanation,
} from '@/lib/quiz/explanationSetting'

let currentTitle: string | null = null
const listeners = new Set<() => void>()

function setCurrentTitle(next: string | null) {
  if (currentTitle === next) return
  currentTitle = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => currentTitle
const getServerSnapshot = () => null

/**
 * 게임 훅에서 호출. 제목이 바뀔 때마다(아직 못 읽은 null 포함) 올린다.
 * null 도 올리는 이유: 같은 탭에서 다른 방으로 옮겼을 때 앞 문제집 제목이 남아 있지 않게.
 * 한 화면에 훅이 둘 떠 있어도(페이지 + 뷰 컴포넌트) 둘 다 같은 방의 제목을 읽어 곧 같은 값이 된다.
 */
export function useRegisterQuestionSetTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title === undefined) return
    setCurrentTitle(title)
  }, [title])
}

/** 문제 렌더러에서 호출. 지금 문제집 제목(모르면 null). */
export function useCurrentQuestionSetTitle(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * 게임 훅에서 호출. 방 옵션 "틀리면 해설 보여주기"(rooms.settings.showExplanation)를 올린다.
 * 방을 아직 못 읽었거나(undefined) 선생님이 정하지 않은 방이면 null — 제목 규칙을 따른다(lib/quiz/explanationSetting.ts).
 */
export function useRegisterRoomShowExplanation(roomSettings: Json | null | undefined) {
  const value = parseShowExplanationSetting(roomSettings)
  useEffect(() => {
    setRoomShowExplanation(value)
  }, [value])
}

/** 해설 표시 쪽에서 호출. 선생님이 정한 값(정하지 않았으면 null). */
export function useCurrentRoomShowExplanation(): boolean | null {
  return useSyncExternalStore(subscribeRoomShowExplanation, getRoomShowExplanation, () => null)
}
