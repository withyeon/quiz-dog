'use client'

import { splitAcceptableAnswers } from '@/lib/quiz/answerMatching'
import WrongAnswerExplanation, { useWrongAnswerExplanation } from '@/components/quiz/WrongAnswerExplanation'
import MultiSelectMistakes from '@/components/quiz/MultiSelectMistakes'
import { useSubmittedMultiSelectAnswer } from '@/hooks/useSubmittedMultiSelectAnswer'

/**
 * 오답 화면에서 정답을 보여주는 공통 컴포넌트(학습용).
 * 복수 정답이면 " / " 로 묶어 표시한다. 정답이 없으면 아무것도 렌더하지 않는다.
 * 구성치기 문제집이면 정답 아래에 해설도 보여 준다(components/quiz/WrongAnswerExplanation.tsx).
 * 다중 선택 문제였으면 그 아래에 잘못 고른 것·골라야 할 것도 보여 준다(components/quiz/MultiSelectMistakes.tsx).
 */
export default function AnswerReveal({
  answer,
  explanation,
  className,
}: {
  answer: string | null | undefined
  /** 틀린 문제의 해설(useRevealedAnswer 의 revealedExplanation). 구성치기 문제집에서만 보인다 */
  explanation?: string | null
  className?: string
}) {
  const answers = splitAcceptableAnswers(answer ?? '')
  const explanationText = useWrongAnswerExplanation(explanation)
  // 방금 낸 다중 선택 답(QuizView 가 올린다). 다중 선택이 아니었으면 null
  const submittedMultiSelect = useSubmittedMultiSelectAnswer()
  if (answers.length === 0 && !explanationText) return null

  return (
    <div
      className={`mx-auto my-3 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 ${className ?? ''}`}
    >
      {answers.length > 0 && (
        <>
          <p className="mb-1 text-sm font-bold text-emerald-700">정답</p>
          <p className="break-keep text-xl font-black text-emerald-900 sm:text-2xl">
            {answers.join(' / ')}
          </p>
        </>
      )}
      {explanationText && (
        <WrongAnswerExplanation
          text={explanationText}
          tone="onLight"
          className={answers.length > 0 ? 'mt-2 border-t border-emerald-200 pt-2' : ''}
        />
      )}
      {submittedMultiSelect !== null && answer && (
        <MultiSelectMistakes
          submittedAnswer={submittedMultiSelect}
          correctAnswer={answer}
          tone="onLight"
          className="mt-2 border-t border-emerald-200 pt-2"
        />
      )}
    </div>
  )
}
