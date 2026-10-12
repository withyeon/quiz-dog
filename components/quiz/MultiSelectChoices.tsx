'use client'

/**
 * 숨겨진 구성치기(다중 선택) 문제의 보기 화면. QuizView 가 다중 선택 문제일 때만 그린다(lib/quiz/multiSelect.ts).
 *
 * - 보기를 누르면 바로 제출되지 않고 토글만 된다. 아래 [제출]을 눌러야 낸다.
 * - 보기가 최대 20개라 휴대폰 세로 화면에서도 스크롤 없이 보이도록 글자 길이에 맞춘 칩을 줄바꿈으로 늘어놓는다.
 * - 제출 뒤에는 맞게 고른 것(초록) / 잘못 고른 것(빨강) / 빠뜨린 정답(노랑 점선)을 색으로 나눠 보여준다.
 * - 칩마다 backdrop-filter 를 걸면 저사양 태블릿에서 버벅이므로 glass 변형도 반투명 색만 쓴다.
 */

import { Check, X } from 'lucide-react'
import type { MultiSelectOptionResult } from '@/lib/quiz/multiSelect'

type QuizVariant = 'default' | 'goldQuest' | 'battle' | 'fishing' | 'glass'
/** 결과가 나오기 전 상태까지 합친 칩 모양 */
type ChipState = 'idle' | 'selected' | 'dim' | MultiSelectOptionResult

interface MultiSelectChoicesProps {
  options: string[]
  selected: ReadonlySet<number>
  onToggle: (index: number) => void
  onSubmit: () => void
  /** 제출했거나 멈췄거나 시간이 다 됐으면 true — 더 고를 수 없다 */
  locked: boolean
  isSubmitting: boolean
  /** 정답 확인이 끝났으면 보기마다 결과, 아직이면 null */
  results: MultiSelectOptionResult[] | null
  variant: QuizVariant
}

const CHIP_BASE = 'inline-flex min-h-[2.75rem] items-center justify-center gap-1 rounded-full px-3.5 py-1.5 text-base font-bold leading-tight transition-all sm:text-lg [@media(max-height:760px)]:min-h-[2.25rem] [@media(max-height:760px)]:text-sm'

const GLASS_CHIP: Record<ChipState, string> = {
  idle: 'border border-white/40 bg-white/15 text-white hover:bg-white/25 active:scale-95',
  // 반투명 칩끼리는 고른 것이 잘 안 보여서 고른 칩은 진한 파랑으로 확실히 구분한다.
  // 글자는 흰색 그대로 — 패널의 검은 글자 외곽선(lg-ink-outline)이 진한 글자에 겹치면 뭉개진다.
  selected: 'border-2 border-white bg-sky-500/90 text-white shadow-lg active:scale-95',
  dim: 'border border-white/20 bg-white/10 text-white opacity-40',
  correct: 'border-2 border-emerald-200 bg-emerald-500/70 text-white shadow-lg',
  wrong: 'border-2 border-rose-200 bg-rose-500/70 text-white shadow-lg',
  missed: 'border-2 border-dashed border-amber-200 bg-amber-400/40 text-white',
}

// 결과 색은 모든 흰 바탕 변형이 같이 쓴다(QuizView 의 정답·오답 색과 같은 계열)
const LIGHT_RESULT_CHIP: Record<'dim' | MultiSelectOptionResult, string> = {
  dim: 'border-2 border-gray-200 bg-gray-50 text-gray-400 opacity-60',
  idle: 'border-2 border-gray-200 bg-gray-50 text-gray-400 opacity-60',
  correct: 'border-2 border-green-500 bg-green-50 text-green-800 shadow-md',
  wrong: 'border-2 border-red-500 bg-red-50 text-red-700 shadow-md',
  missed: 'border-2 border-dashed border-amber-500 bg-amber-50 text-amber-800',
}

function chipClass(state: ChipState, variant: QuizVariant): string {
  if (variant === 'glass') return GLASS_CHIP[state]
  if (state === 'idle') {
    if (variant === 'goldQuest') return 'border border-[#d7bd78]/80 bg-white/[0.78] text-gray-800 shadow-sm hover:border-[#b7791f] hover:bg-[#fff5dc] active:scale-95'
    if (variant === 'battle') return 'border border-slate-200 bg-white/[0.74] text-slate-800 shadow-sm hover:border-teal-400 hover:bg-white active:scale-95'
    return 'border-2 border-gray-300 bg-white text-gray-800 shadow-sm hover:border-blue-500 hover:bg-blue-50 active:scale-95'
  }
  if (state === 'selected') {
    if (variant === 'goldQuest') return 'border-2 border-[#b7791f] bg-[#b7791f] text-white shadow-md active:scale-95'
    if (variant === 'battle') return 'border-2 border-teal-500 bg-teal-500 text-white shadow-md active:scale-95'
    return 'border-2 border-blue-500 bg-blue-500 text-white shadow-md active:scale-95'
  }
  return LIGHT_RESULT_CHIP[state]
}

function submitButtonClass(variant: QuizVariant): string {
  if (variant === 'glass') return 'lg-button text-white drop-shadow'
  const color = variant === 'goldQuest'
    ? 'bg-[#b7791f] hover:bg-[#9a6219]'
    : variant === 'battle'
      ? 'bg-[#13202b] hover:bg-[#223848]'
      : 'bg-blue-600 hover:bg-blue-700'
  return `text-white rounded-lg shadow-lg ${color}`
}

export default function MultiSelectChoices({
  options,
  selected,
  onToggle,
  onSubmit,
  locked,
  isSubmitting,
  results,
  variant,
}: MultiSelectChoicesProps) {
  const isGlass = variant === 'glass'
  const mutedText = isGlass ? 'text-white/80' : 'text-gray-500'
  const showLegend = results !== null && results.some((result) => result === 'wrong' || result === 'missed')

  return (
    <div className="space-y-3 [@media(max-height:760px)]:space-y-2">
      <p className={`text-sm font-bold ${mutedText}`}>정답을 모두 골라 제출하세요</p>

      <div className="flex flex-wrap gap-2 [@media(max-height:760px)]:gap-1.5" role="group" aria-label="보기 여러 개 고르기">
        {options.map((option, index) => {
          const isSelected = selected.has(index)
          const state: ChipState = results
            ? (results[index] === 'idle' ? 'dim' : results[index])
            : locked
              ? (isSelected ? 'selected' : 'dim')
              : (isSelected ? 'selected' : 'idle')
          return (
            <button
              key={index}
              type="button"
              onClick={() => onToggle(index)}
              disabled={locked}
              aria-pressed={isSelected}
              className={`${CHIP_BASE} ${chipClass(state, variant)} disabled:cursor-default`}
            >
              {state === 'correct' && <Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-label="맞게 고름" />}
              {state === 'wrong' && <X className="h-4 w-4 shrink-0" strokeWidth={3} aria-label="잘못 고름" />}
              <span>{option}</span>
              {state === 'missed' && <span className="text-xs font-black opacity-90">빠짐</span>}
            </button>
          )
        })}
      </div>

      {results !== null ? (
        showLegend && (
          <p className={`text-xs font-bold sm:text-sm ${mutedText}`}>
            초록 = 맞게 고름 · 빨강 = 잘못 고름 · 노랑 점선 = 빠뜨린 정답
          </p>
        )
      ) : (
        <div className="flex items-center gap-3">
          <span className={`shrink-0 text-base font-black tabular-nums ${isGlass ? 'text-white drop-shadow' : 'text-gray-700'}`}>
            선택 {selected.size}개
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={locked || isSubmitting || selected.size === 0}
            className={`flex-1 px-6 py-3.5 text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:760px)]:py-2.5 ${submitButtonClass(variant)}`}
          >
            제출
          </button>
        </div>
      )}
    </div>
  )
}
