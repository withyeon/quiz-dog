'use client'

/**
 * 문제 지문에서 한글을 지워 한자만 보이게 하는 기능.
 *
 * 언제 켜지는지는 hooks/usePlayFlags.ts 가 정한다(/dev '한글 없애기' 토글, 또는 '한의대우등생'·'한의대최강'
 * 으로 시작하는 닉네임). 여기서는 켜졌을 때 지문을 어떻게 바꾸는지만 다룬다.
 *
 * 동작 범위
 * - 학생 화면의 "문제 지문"(question_text)만 바꾼다. 보기·정답·결과 화면·선생님 화면은 그대로다.
 * - 한글(완성형 음절 + 자모)만 지우고, 지워진 자리는 빈칸으로 남기지 않고 서로 붙인다.
 *   예) "다음 漢字의 뜻은? 學校" → "漢字? 學校"
 * - QuizView 등 렌더러는 useQuestionTextFilter 로 변환 함수를 받아 쓰므로 게임 페이지들은 손대지 않아도 된다.
 */

import { useCallback } from 'react'
import { usePlayFlags } from '@/hooks/usePlayFlags'

const HANGUL_PATTERN = /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿]/g

/** 한글만 지우고 나머지는 그대로 붙인다. 지운 자리 때문에 생긴 연속 공백은 하나로 줄인다. */
export function stripHangul(text: string): string {
  return text
    .replace(HANGUL_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
}

/** 문제 렌더러에서 호출. 한글 없애기가 켜져 있으면 한글을 지우는 변환 함수를 돌려준다. */
export function useQuestionTextFilter(): (text: string) => string {
  const { hanjaOnly } = usePlayFlags()
  return useCallback((text: string) => (hanjaOnly ? stripHangul(text) : text), [hanjaOnly])
}
