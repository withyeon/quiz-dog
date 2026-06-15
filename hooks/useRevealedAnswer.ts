'use client'

import { useCallback, useState } from 'react'
import { getQuestionAnswer } from '@/lib/services/questions'

/**
 * 오답 시 보여줄 정답을 서버에서 조회해 보관하는 공통 훅.
 * 게임마다 오답 화면이 달라도 이 훅 + <AnswerReveal /> 로 정답 노출을 통일한다.
 *
 * - reveal(questionId): 해당 문제의 정답을 조회해 revealedAnswer 에 채운다.
 * - clearRevealedAnswer(): 다음 문제로 넘어갈 때 초기화.
 */
export function useRevealedAnswer() {
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null)

  const reveal = useCallback((questionId: string | null | undefined) => {
    setRevealedAnswer(null)
    if (!questionId) return
    void getQuestionAnswer(questionId).then(setRevealedAnswer)
  }, [])

  const clearRevealedAnswer = useCallback(() => {
    setRevealedAnswer(null)
  }, [])

  return { revealedAnswer, reveal, clearRevealedAnswer }
}
