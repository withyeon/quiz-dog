'use client'

/**
 * 오답 때 보여 주는 해설. 구성치기 문제집에서만 보인다(lib/quiz/multiSelect.ts 의 isGusungchigiSet).
 * 그 외 문제집은 지금처럼 정답만 보인다.
 *
 * 쓰는 곳
 * - QuizView 의 오답 배너(어두운 바탕) — 문제 화면이 오답 뒤에도 남아 있는 모드(타워·탈락자 화면·시작 전 퀴즈)
 * - AnswerReveal(밝은 정답 상자) — 오답이면 곧바로 오답 화면으로 넘어가는 모드(골드퀘스트·인형뽑기·눈싸움·
 *   레이드·마피아·좀비·카페·편의점). 예전에는 여기에 정답만 있어서 해설을 볼 수 없었다.
 *
 * 줄바꿈을 그대로 살리고, 첫 줄이 '말야마:'로 시작하면 그 줄만 굵게·다른 색으로 보여 준다.
 */

import { useCurrentQuestionSetTitle } from '@/hooks/useQuestionSetTitle'
import { isGusungchigiSet } from '@/lib/quiz/multiSelect'

// 첫 줄이 이 말로 시작하면 그 줄만 눈에 띄게 보여준다(구성치기 해설에서 쓰는 외우기용 한 줄)
const EXPLANATION_HIGHLIGHT_PREFIX = '말야마:'

/** 지금 문제집이 구성치기면 보여 줄 해설, 아니면 빈 문자열. 제목은 게임 훅이 올린 값을 읽는다(hooks/useQuestionSetTitle.ts). */
export function useWrongAnswerExplanation(explanation: string | null | undefined): string {
  const questionSetTitle = useCurrentQuestionSetTitle()
  return isGusungchigiSet(questionSetTitle) ? explanation?.trim() ?? '' : ''
}

const TONE_STYLE = {
  // 빨간 오답 배너(흰 글자) 위
  onDark: { box: 'opacity-95', highlight: 'font-black text-yellow-200' },
  // 연두색 정답 상자 위
  onLight: { box: 'text-slate-700', highlight: 'font-black text-amber-700' },
} as const

export default function WrongAnswerExplanation({
  text,
  tone,
  className = '',
}: {
  text: string
  tone: keyof typeof TONE_STYLE
  className?: string
}) {
  const [firstLine, ...restLines] = text.split('\n')
  const highlightFirst = firstLine.trimStart().startsWith(EXPLANATION_HIGHLIGHT_PREFIX)
  const rest = restLines.join('\n')
  const style = TONE_STYLE[tone]

  return (
    <div className={`w-full whitespace-pre-wrap break-keep text-left text-sm font-medium leading-relaxed sm:text-base ${style.box} ${className}`}>
      {highlightFirst ? (
        <>
          <div className={style.highlight}>{firstLine}</div>
          {rest && <div>{rest}</div>}
        </>
      ) : (
        text
      )}
    </div>
  )
}
