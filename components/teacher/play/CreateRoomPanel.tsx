'use client'

import SelectedQuestionSet from '@/components/teacher/play/SelectedQuestionSet'
import type { QuestionSetSummary } from '@/lib/services/questionSets'

type Props = {
  requiresQuestionSet: boolean
  selectedSet: QuestionSetSummary | null
  hasSelectedSet: boolean
  setsLoading: boolean
  setsError: string | null
  onCreate: () => void
}

/** 방을 만들기 전: 자료실에서 고른 문제집 확인과 "시작하기" 버튼. */
export default function CreateRoomPanel({
  requiresQuestionSet,
  selectedSet,
  hasSelectedSet,
  setsLoading,
  setsError,
  onCreate,
}: Props) {
  return (
    <div className="py-12">
      {/* 문제집은 자료실에서 이미 고른 상태로 넘어온다. 여기서는 확인만 한다. */}
      {requiresQuestionSet && (
        <SelectedQuestionSet
          set={selectedSet}
          loading={setsLoading}
          error={setsError}
        />
      )}

      <div className="text-center">
        <p className="mb-6 text-lg font-medium text-slate-500">
          {requiresQuestionSet && !hasSelectedSet
            ? '자료실에서 문제집을 고르면 게임을 시작할 수 있어요'
            : '모드를 고르고 시작하기'}
        </p>
        <button
          onClick={onCreate}
          disabled={requiresQuestionSet && !hasSelectedSet}
          className="rounded-2xl bg-sky-500 px-9 py-4 text-lg font-bold text-white shadow-sm shadow-sky-200 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none disabled:hover:translate-y-0"
        >
          시작하기
        </button>
      </div>
    </div>
  )
}
