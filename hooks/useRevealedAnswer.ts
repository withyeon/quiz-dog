'use client'

import { useCallback, useState } from 'react'
import { getQuestionAnswer } from '@/lib/services/questions'

/**
 * 오답 시 보여줄 정답을 서버에서 조회해 보관하는 공통 훅.
 * 게임마다 오답 화면이 달라도 이 훅 + <AnswerReveal /> 로 정답 노출을 통일한다.
 *
 * - reveal(question): 해당 문제의 정답을 조회해 revealedAnswer 에 채운다.
 *   해설은 정답과 달리 학생 화면의 문제 객체에 이미 있으니 그대로 revealedExplanation 에 둔다
 *   (AnswerReveal 이 구성치기 문제집에서만 보여 준다).
 * - clearRevealedAnswer(): 다음 문제로 넘어갈 때 초기화.
 */
export function useRevealedAnswer() {
  const [revealedAnswer, setRevealedAnswer] = useState<string | null>(null)
  const [revealedExplanation, setRevealedExplanation] = useState<string | null>(null)

  const reveal = useCallback((question: { id: string; explanation?: string | null } | null | undefined) => {
    setRevealedAnswer(null)
    setRevealedExplanation(question?.explanation ?? null)
    if (!question?.id) return
    void getQuestionAnswer(question.id).then(setRevealedAnswer)
  }, [])

  const clearRevealedAnswer = useCallback(() => {
    setRevealedAnswer(null)
    setRevealedExplanation(null)
  }, [])

  return { revealedAnswer, revealedExplanation, reveal, clearRevealedAnswer }
}
