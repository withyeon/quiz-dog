'use client'

import { splitAcceptableAnswers } from '@/lib/quiz/answerMatching'

/**
 * 오답 화면에서 정답을 보여주는 공통 컴포넌트(학습용).
 * 복수 정답이면 " / " 로 묶어 표시한다. 정답이 없으면 아무것도 렌더하지 않는다.
 */
export default function AnswerReveal({
  answer,
  className,
}: {
  answer: string | null | undefined
  className?: string
}) {
  const answers = splitAcceptableAnswers(answer ?? '')
  if (answers.length === 0) return null

  return (
    <div
      className={`mx-auto my-3 max-w-xl rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-3 ${className ?? ''}`}
    >
      <p className="mb-1 text-sm font-bold text-emerald-700">정답</p>
      <p className="break-keep text-xl font-black text-emerald-900 sm:text-2xl">
        {answers.join(' / ')}
      </p>
    </div>
  )
}
