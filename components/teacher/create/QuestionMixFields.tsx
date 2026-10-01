'use client'

import { Minus, Plus } from 'lucide-react'
import { QUESTION_TYPE_HINT, QUESTION_TYPE_LABEL, type QuestionType } from '@/lib/quiz/questionQuality'

export type TypeCounts = Record<QuestionType, number>

export const MAX_AI_QUESTION_COUNT = 20
export const AI_TYPE_ORDER: QuestionType[] = ['CHOICE', 'OX', 'SHORT', 'BLANK']
// 한 판 게임에 알맞은 10문제. 빈칸은 자료에 따라 어색할 수 있어 기본은 0.
export const DEFAULT_TYPE_COUNTS: TypeCounts = { CHOICE: 6, OX: 2, SHORT: 2, BLANK: 0 }

const PRESETS: Array<{ label: string; counts: TypeCounts }> = [
  { label: '빠르게 5', counts: { CHOICE: 3, OX: 1, SHORT: 1, BLANK: 0 } },
  { label: '골고루 10', counts: { CHOICE: 6, OX: 2, SHORT: 2, BLANK: 0 } },
  { label: '객관식만 10', counts: { CHOICE: 10, OX: 0, SHORT: 0, BLANK: 0 } },
  { label: 'OX 퀴즈 10', counts: { CHOICE: 0, OX: 10, SHORT: 0, BLANK: 0 } },
  { label: '넉넉하게 15', counts: { CHOICE: 9, OX: 3, SHORT: 2, BLANK: 1 } },
]

export function sumTypeCounts(counts: TypeCounts): number {
  return AI_TYPE_ORDER.reduce((sum, type) => sum + counts[type], 0)
}

export function describeTypeCounts(counts: TypeCounts): string {
  return AI_TYPE_ORDER.filter((type) => counts[type] > 0)
    .map((type) => `${QUESTION_TYPE_LABEL[type]} ${counts[type]}`)
    .join(' · ')
}

function sameCounts(a: TypeCounts, b: TypeCounts): boolean {
  return AI_TYPE_ORDER.every((type) => a[type] === b[type])
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
    >
      {children}
    </button>
  )
}

interface QuestionMixFieldsProps {
  /** 시험지 추출은 유형을 고를 수 없어 최대 개수만 정한다 */
  mode: 'mix' | 'exam'
  typeCounts: TypeCounts
  onTypeCountsChange: (next: TypeCounts) => void
  examCount: number
  onExamCountChange: (next: number) => void
  disabled?: boolean
}

/**
 * 3단계 — 몇 문제를 어떤 유형으로 만들지. 유형별 개수의 합이 총 문항 수다.
 * 자주 쓰는 구성은 프리셋 칩으로 한 번에 고른다.
 */
export default function QuestionMixFields({
  mode,
  typeCounts,
  onTypeCountsChange,
  examCount,
  onExamCountChange,
  disabled = false,
}: QuestionMixFieldsProps) {
  const total = sumTypeCounts(typeCounts)

  const adjust = (type: QuestionType, delta: number) => {
    const nextValue = Math.max(0, typeCounts[type] + delta)
    const others = total - typeCounts[type]
    if (others + nextValue > MAX_AI_QUESTION_COUNT) return
    onTypeCountsChange({ ...typeCounts, [type]: nextValue })
  }

  if (mode === 'exam') {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate-700">최대 문제 수</span>
          <div className="flex items-center gap-1.5">
            <StepperButton onClick={() => onExamCountChange(Math.max(1, examCount - 1))} disabled={disabled || examCount <= 1} label="줄이기">
              <Minus className="h-4 w-4" />
            </StepperButton>
            <span className="w-12 text-center text-xl font-black tabular-nums text-slate-900">{examCount}</span>
            <StepperButton onClick={() => onExamCountChange(Math.min(MAX_AI_QUESTION_COUNT, examCount + 1))} disabled={disabled || examCount >= MAX_AI_QUESTION_COUNT} label="늘리기">
              <Plus className="h-4 w-4" />
            </StepperButton>
          </div>
        </div>
        <p className="mt-2 break-keep text-xs font-medium leading-5 text-slate-500">
          시험지에 있는 문제를 앞에서부터 최대 {examCount}개까지 옮겨요. 유형은 시험지에 적힌 대로 따라가요.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const active = sameCounts(preset.counts, typeCounts)
          return (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              onClick={() => onTypeCountsChange(preset.counts)}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                active
                  ? 'border-sky-400 bg-sky-100 text-sky-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {AI_TYPE_ORDER.map((type) => {
          const count = typeCounts[type]
          return (
            <div key={type} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className={`text-sm font-black ${count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                  {QUESTION_TYPE_LABEL[type]}
                </div>
                <div className="break-keep text-xs font-medium text-slate-400">{QUESTION_TYPE_HINT[type]}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <StepperButton onClick={() => adjust(type, -1)} disabled={disabled || count <= 0} label={`${QUESTION_TYPE_LABEL[type]} 줄이기`}>
                  <Minus className="h-4 w-4" />
                </StepperButton>
                <span className={`w-9 text-center text-lg font-black tabular-nums ${count > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                  {count}
                </span>
                <StepperButton onClick={() => adjust(type, 1)} disabled={disabled || total >= MAX_AI_QUESTION_COUNT} label={`${QUESTION_TYPE_LABEL[type]} 늘리기`}>
                  <Plus className="h-4 w-4" />
                </StepperButton>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
        <span className="break-keep">한 번에 최대 {MAX_AI_QUESTION_COUNT}문제 · 만든 뒤에도 더 추가할 수 있어요</span>
        <span className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-black ${total > 0 ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
          총 {total}문항
        </span>
      </div>
    </div>
  )
}
