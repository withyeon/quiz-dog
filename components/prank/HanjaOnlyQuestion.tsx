'use client'

/**
 * 특정 닉네임에게만 문제 지문에서 한글을 지워 한자만 보이게 하는 장난 기능.
 *
 * 켜고 끄기: 아래 HANJA_ONLY_ENABLED 만 바꾸면 된다. false 면 어떤 화면도 건드리지 않는다.
 * 대상 추가: HANJA_ONLY_NICKNAMES 에 닉네임을 추가한다(정확히 일치해야 함, 앞뒤 공백 무시).
 *
 * 동작 범위
 * - 학생 화면의 "문제 지문"(question_text)만 바꾼다. 보기·정답·결과 화면·선생님 화면은 그대로다.
 * - 한글(완성형 음절 + 자모)만 지우고, 지워진 자리는 빈칸으로 남기지 않고 서로 붙인다.
 *   예) "다음 漢字의 뜻은? 學校" → "漢字? 學校"
 * - 닉네임은 useGameBase 가 현재 플레이어를 알게 될 때 registerHanjaOnlyNickname 으로
 *   전역 스토어에 올리고, QuizView 등 렌더러는 useQuestionTextFilter 로 변환 함수를 받아 쓴다.
 *   그래서 게임 페이지들은 손대지 않아도 된다.
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react'

// ─── 스위치 ───────────────────────────────────────────────────────────
export const HANJA_ONLY_ENABLED = true
export const HANJA_ONLY_NICKNAMES: readonly string[] = ['떠영남친혀니']
// ─────────────────────────────────────────────────────────────────────

const HANGUL_PATTERN = /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/g

export function isHanjaOnlyTarget(nickname: string | null | undefined): boolean {
  if (!HANJA_ONLY_ENABLED || !nickname) return false
  return HANJA_ONLY_NICKNAMES.includes(nickname.trim())
}

/** 한글만 지우고 나머지는 그대로 붙인다. 지운 자리 때문에 생긴 연속 공백은 하나로 줄인다. */
export function stripHangul(text: string): string {
  return text
    .replace(HANGUL_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
}

export function applyHanjaOnly(text: string, nickname: string | null | undefined): string {
  return isHanjaOnlyTarget(nickname) ? stripHangul(text) : text
}

// ─── 전역 닉네임 스토어 (페이지를 안 거치고 렌더러가 현재 플레이어를 알기 위함) ───
let currentNickname: string | null = null
const listeners = new Set<() => void>()

function setCurrentNickname(next: string | null) {
  if (currentNickname === next) return
  currentNickname = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => currentNickname
const getServerSnapshot = () => null

/** useGameBase 에서 호출. 현재 플레이어 닉네임을 전역 스토어에 올린다. */
export function useRegisterHanjaOnlyNickname(nickname: string | null | undefined) {
  // 한 화면에 useGameBase 가 둘 이상 떠 있을 수 있어(페이지 + 뷰 컴포넌트) 언마운트 때 비우지 않는다.
  // 다음 게임에 들어가면 그쪽 useGameBase 가 새 닉네임으로 덮어쓴다.
  useEffect(() => {
    if (!HANJA_ONLY_ENABLED || nickname === undefined) return
    setCurrentNickname(nickname)
  }, [nickname])
}

/** 문제 렌더러에서 호출. 현재 플레이어가 대상이면 한글을 지우는 변환 함수를 돌려준다. */
export function useQuestionTextFilter(): (text: string) => string {
  const nickname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const active = isHanjaOnlyTarget(nickname)
  return useCallback((text: string) => (active ? stripHangul(text) : text), [active])
}
