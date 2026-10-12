'use client'

/**
 * 게임 화면에 적용할 플레이 스위치(한글 없애기·객관식→단답식)를 한 곳에서 정하는 공통 훅.
 *
 * 켜지는 경우는 두 가지이고, 둘 중 하나라도 켜져 있으면 켜진다.
 * - /dev 페이지 토글: 그 탭에서 시작한 게임에만 적용된다(lib/dev/devPlayFlags.ts).
 * - 닉네임 장난: 닉네임 앞에 아래 NICKNAME_PRANKS 의 접두어를 붙이고 들어온 학생에게만 적용된다.
 *     한의대우등생고동현 → 한글 없애기
 *     한의대최강고동현   → 한글 없애기 + 객관식→단답식
 *
 * 켜고 끄기: NICKNAME_PRANK_ENABLED 만 바꾸면 된다. false 면 닉네임 장난만 꺼지고 /dev 토글은 그대로 동작한다.
 *
 * 쓰는 곳
 * - useGameBase·useConvenienceStoreGame: useRegisterPlayerNickname 으로 현재 플레이어 닉네임을 올리고,
 *   usePlayQuestions 로 화면에 쓸 문제 목록을 받는다(forceShortAnswer).
 * - QuizView 등 문제 렌더러: components/prank/HanjaOnlyQuestion.tsx 의 useQuestionTextFilter(hanjaOnly).
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { toShortAnswerQuestions, useDevPlayFlags, type DevPlayFlags } from '@/lib/dev/devPlayFlags'

// ─── 스위치 ───────────────────────────────────────────────────────────
export const NICKNAME_PRANK_ENABLED = true
const NICKNAME_PRANKS: ReadonlyArray<{ prefix: string; flags: Partial<DevPlayFlags> }> = [
  { prefix: '한의대우등생', flags: { hanjaOnly: true } },
  { prefix: '한의대최강', flags: { hanjaOnly: true, forceShortAnswer: true } },
]
// ─────────────────────────────────────────────────────────────────────

const NO_FLAGS: DevPlayFlags = { hanjaOnly: false, forceShortAnswer: false }

/** 닉네임 접두어로 켜지는 스위치. 공백은 무시한다('한의대 최강 고동현'도 대상). */
export function getNicknamePlayFlags(nickname: string | null | undefined): DevPlayFlags {
  if (!NICKNAME_PRANK_ENABLED || !nickname) return NO_FLAGS
  const compact = nickname.replace(/\s+/g, '')
  const prank = NICKNAME_PRANKS.find(({ prefix }) => compact.startsWith(prefix))
  return prank ? { ...NO_FLAGS, ...prank.flags } : NO_FLAGS
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

/** 게임 훅에서 호출. 현재 플레이어 닉네임을 전역 스토어에 올린다. */
export function useRegisterPlayerNickname(nickname: string | null | undefined) {
  // 한 화면에 useGameBase 가 둘 이상 떠 있을 수 있어(페이지 + 뷰 컴포넌트) 언마운트 때 비우지 않는다.
  // 다음 게임에 들어가면 그쪽 훅이 새 닉네임으로 덮어쓴다.
  useEffect(() => {
    if (nickname === undefined) return
    setCurrentNickname(nickname)
  }, [nickname])
}

/** /dev 토글과 현재 플레이어의 닉네임 장난을 합친 스위치. */
export function usePlayFlags(): DevPlayFlags {
  const nickname = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const devFlags = useDevPlayFlags()
  const { hanjaOnly, forceShortAnswer } = getNicknamePlayFlags(nickname)
  return useMemo(
    () => ({
      hanjaOnly: devFlags.hanjaOnly || hanjaOnly,
      forceShortAnswer: devFlags.forceShortAnswer || forceShortAnswer,
    }),
    [devFlags.hanjaOnly, devFlags.forceShortAnswer, hanjaOnly, forceShortAnswer],
  )
}

/** forceShortAnswer 가 켜져 있으면 객관식·OX 를 단답형으로 바꾼 목록을, 아니면 받은 목록을 그대로 돌려준다. */
export function usePlayQuestions<T extends { type: string; options: string[] }>(questions: T[]): T[] {
  const { forceShortAnswer } = usePlayFlags()
  return useMemo(
    () => (forceShortAnswer ? toShortAnswerQuestions(questions) : questions),
    [forceShortAnswer, questions],
  )
}
