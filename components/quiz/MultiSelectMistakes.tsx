'use client'

/**
 * 구성치기(다중 선택) 문제를 틀렸을 때 해설 아래에 보여 주는 "잘못 고른 것 / 골라야 할 것".
 * 다중 선택 문제는 구성치기 문제집에서만 생기므로(lib/quiz/multiSelect.ts) 다른 문제집에는 보이지 않는다.
 *
 * 쓰는 곳은 해설(WrongAnswerExplanation)과 같다. QuizView 의 오답 배너, AnswerReveal 의 정답 상자.
 */

import { getMultiSelectMistakes } from '@/lib/quiz/multiSelect'

const TONE_STYLE = {
  // 빨간 오답 배너(흰 글자) 위
  onDark: { label: 'font-black opacity-80', wrong: 'font-black text-yellow-200', missed: 'font-black text-white' },
  // 연두색 정답 상자 위
  onLight: { label: 'font-black text-slate-500', wrong: 'font-black text-red-600', missed: 'font-black text-emerald-800' },
} as const

export default function MultiSelectMistakes({
  submittedAnswer,
  correctAnswer,
  tone,
  className = '',
}: {
  submittedAnswer: string
  correctAnswer: string
  tone: keyof typeof TONE_STYLE
  className?: string
}) {
  const { wrongPicks, missed } = getMultiSelectMistakes(submittedAnswer, correctAnswer)
  if (wrongPicks.length === 0 && missed.length === 0) return null
  const style = TONE_STYLE[tone]

  return (
    <div className={`w-full space-y-1 break-keep text-left text-sm leading-relaxed sm:text-base ${className}`}>
      {wrongPicks.length > 0 && (
        <div>
          <span className={style.label}>잘못 고른 것 </span>
          <span className={style.wrong}>{wrongPicks.join(', ')}</span>
        </div>
      )}
      {missed.length > 0 && (
        <div>
          <span className={style.label}>골라야 할 것 </span>
          <span className={style.missed}>{missed.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
