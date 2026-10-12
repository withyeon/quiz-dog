'use client'

/**
 * 구성치기 문제집의 객관식 보기·정답 편집칸. 검수 화면(QuestionReviewEditor)과 세트 편집 화면이 같이 쓴다.
 *
 * - 정답을 여러 개 토글로 고른다. 저장할 때는 고른 보기를 보기 순서대로 쉼표로 이어 answer 에 넣는다
 *   ("마황, 계지, 행인, 감초"). 2개 이상 고르면 다중 선택 문제가 되고(lib/quiz/multiSelect.ts),
 *   하나만 고르면 지금처럼 일반 객관식이다.
 * - 보기는 4~20개 범위에서 더하고 뺄 수 있다.
 * - 보기 칸에 "마황, 계지, 행인"처럼 쉼표로 붙여 넣으면 보기 여러 개로 나눠 준다(쉼표는 보기 글자로 쓸 수 없다).
 *
 * 구성치기 문제집이 아니면 이 컴포넌트를 쓰지 않는다. 일반 문제집의 보기 편집은 그대로다.
 */

import { Check, X } from 'lucide-react'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import {
  MULTI_SELECT_MAX_OPTIONS,
  MULTI_SELECT_MIN_OPTIONS,
  joinMultiSelectAnswer,
  splitMultiSelectAnswer,
} from '@/lib/quiz/multiSelect'

interface MultiSelectChoiceFieldsProps {
  options: string[]
  answer: string
  onChange: (patch: { options?: string[]; answer?: string }) => void
}

/** 정답 항목을 보기 순서대로 다시 이어 붙인다. 보기에 없는 항목(직접 고친 옛 정답 등)은 뒤에 그대로 둔다. */
function buildAnswer(options: string[], picked: Set<string>): string {
  const inOrder = options.map((o) => o.trim()).filter((o) => o && picked.has(o))
  const leftovers = [...picked].filter((item) => !inOrder.includes(item))
  return joinMultiSelectAnswer([...new Set([...inOrder, ...leftovers])])
}

export default function MultiSelectChoiceFields({ options, answer, onChange }: MultiSelectChoiceFieldsProps) {
  const picked = new Set(splitMultiSelectAnswer(answer))
  const pickedCount = options.filter((o) => o.trim() && picked.has(o.trim())).length

  const toggleAnswer = (optIndex: number) => {
    const value = options[optIndex]?.trim()
    if (!value) return
    const next = new Set(picked)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange({ answer: buildAnswer(options, next) })
  }

  const setOption = (optIndex: number, value: string) => {
    const previous = options[optIndex]?.trim() ?? ''
    const wasAnswer = previous !== '' && picked.has(previous)

    // 쉼표가 들어오면 보기 여러 개로 나눈다. 첫 조각은 이 칸에, 나머지는 바로 뒤에 끼워 넣는다(최대 개수까지).
    const pieces = value.includes(',') ? value.split(',').map((piece) => piece.trim()) : [value]
    const room = MULTI_SELECT_MAX_OPTIONS - options.length
    const inserted = pieces.slice(1).filter(Boolean).slice(0, Math.max(0, room))
    const next = [...options.slice(0, optIndex), pieces[0], ...inserted, ...options.slice(optIndex + 1)]

    // 정답으로 고른 보기의 글자를 고치면 정답도 같이 따라간다
    if (wasAnswer) {
      const nextPicked = new Set(picked)
      nextPicked.delete(previous)
      if (pieces[0].trim()) nextPicked.add(pieces[0].trim())
      onChange({ options: next, answer: buildAnswer(next, nextPicked) })
      return
    }
    onChange({ options: next })
  }

  const removeOption = (optIndex: number) => {
    const removed = options[optIndex]?.trim() ?? ''
    const next = options.filter((_, i) => i !== optIndex)
    if (removed && picked.has(removed)) {
      const nextPicked = new Set(picked)
      nextPicked.delete(removed)
      onChange({ options: next, answer: buildAnswer(next, nextPicked) })
      return
    }
    onChange({ options: next })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-700">보기</span>
        <span className="text-right text-xs font-semibold text-slate-400">
          정답을 모두 눌러 고르세요 · 정답 {pickedCount}개
        </span>
      </div>
      <div className="space-y-2">
        {options.map((opt, optIdx) => {
          const isAnswer = opt.trim() !== '' && picked.has(opt.trim())
          return (
            <div
              key={optIdx}
              className={`flex items-center gap-2 rounded-xl border pl-1.5 pr-1.5 transition ${
                isAnswer ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleAnswer(optIdx)}
                disabled={!opt.trim()}
                aria-label={isAnswer ? `${optIdx + 1}번 보기를 정답에서 빼기` : `${optIdx + 1}번 보기를 정답에 넣기`}
                aria-pressed={isAnswer}
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black transition ${
                  isAnswer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isAnswer ? <Check className="h-4 w-4" strokeWidth={3} /> : getOptionLabel(optIdx)}
              </button>
              <input
                type="text"
                value={opt}
                onChange={(e) => setOption(optIdx, e.target.value)}
                placeholder={`보기 ${optIdx + 1}`}
                aria-label={`보기 ${optIdx + 1}`}
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
              {options.length > MULTI_SELECT_MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => removeOption(optIdx)}
                  aria-label="보기 삭제"
                  className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )
        })}
        {options.length < MULTI_SELECT_MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => onChange({ options: [...options, ''] })}
            className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-black text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            + 보기 추가 ({options.length}/{MULTI_SELECT_MAX_OPTIONS})
          </button>
        )}
      </div>
      <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
        정답을 2개 이상 고르면 학생은 여러 개를 골라 제출해요(순서 상관없이 전부 맞혀야 정답). 보기 칸에 쉼표로 이어 붙여 넣으면 여러 보기로 나눠져요.
      </p>
    </div>
  )
}
