'use client'

import { Check } from 'lucide-react'

/**
 * 게임 시작 화면 상단의 진행 단계 표시.
 * 문제집 고르기 → 방 만들기 → 학생 입장 → 게임 진행이 한 화면에서 순차적으로 일어나는데,
 * 지금 어디까지 왔는지 알 수 없어서 처음 쓰는 선생님이 헤매던 문제를 해결한다.
 */

export type PlayStepState = {
  hasRoom: boolean
  roomStatus?: string | null
  requiresQuestionSet: boolean
  hasSelectedSet: boolean
  playerCount: number
}

type Step = { label: string; hint: string }

export function getPlaySteps(state: PlayStepState): { steps: Step[]; currentIndex: number } {
  const steps: Step[] = [{ label: '게임 고르기', hint: '수업에 맞는 게임 선택' }]

  if (state.requiresQuestionSet) {
    steps.push({ label: '문제집 고르기', hint: '학생이 풀 문제' })
  }

  steps.push(
    { label: '방 만들기', hint: '새 게임 만들기 누르기' },
    { label: '학생 입장', hint: '코드·QR 공유' },
    { label: '게임 진행', hint: '시작 후 진행 상황 확인' },
  )

  const setStepIndex = state.requiresQuestionSet ? 1 : -1
  const createStepIndex = steps.length - 3
  const joinStepIndex = steps.length - 2
  const playStepIndex = steps.length - 1

  // 방이 만들어지기 전에는 문제집 선택 여부로, 만들어진 뒤에는 방 상태로 현재 단계를 정한다.
  // (게임 모드는 기본값이 항상 골라져 있어 첫 단계는 완료로 본다)
  let currentIndex: number
  if (!state.hasRoom) {
    currentIndex = setStepIndex >= 0 && !state.hasSelectedSet ? setStepIndex : createStepIndex
  } else if (state.roomStatus === 'waiting') {
    currentIndex = joinStepIndex
  } else {
    currentIndex = playStepIndex
  }

  return { steps, currentIndex }
}

export default function PlaySteps(state: PlayStepState) {
  const { steps, currentIndex } = getPlaySteps(state)

  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      {steps.map((step, index) => {
        const done = index < currentIndex
        const current = index === currentIndex

        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <span
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-black transition ${
                done
                  ? 'bg-sky-100 text-sky-600'
                  : current
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-200'
                    : 'bg-slate-100 text-slate-400'
              }`}
              aria-hidden
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}
            </span>

            <span className="min-w-0">
              <span
                className={`block truncate text-sm font-black ${
                  current ? 'text-slate-900' : done ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {step.label}
                {current && <span className="sr-only"> (현재 단계)</span>}
              </span>
              {current && (
                <span className="hidden truncate text-xs font-semibold text-slate-400 sm:block">{step.hint}</span>
              )}
            </span>

            {index < steps.length - 1 && (
              <span
                className={`ml-auto hidden h-px flex-1 sm:block ${done ? 'bg-sky-200' : 'bg-slate-200'}`}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
