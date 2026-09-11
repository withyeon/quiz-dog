'use client'

import type { QuestionSetSummary } from '@/lib/services/questionSets'

/**
 * 게임 시작 화면의 문제집 선택.
 * (예전에는 URL의 ?set= 으로만 지정할 수 있어서 이 화면에서 고를 방법이 없었다)
 */
export default function QuestionSetPicker({
  questionSets,
  selectedSetId,
  loading,
  error,
  onSelect,
  onCreateQuestionSet,
}: {
  questionSets: QuestionSetSummary[]
  selectedSetId: string
  loading: boolean
  error: string | null
  onSelect: (setId: string) => void
  onCreateQuestionSet: () => void
}) {
  return (
    <div className="mx-auto mb-8 max-w-xl text-left">
      <label htmlFor="play-set-select" className="mb-2 block text-sm font-black text-gray-700">
        문제집 선택
      </label>

      {loading ? (
        <div className="rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-500">
          문제집을 불러오는 중...
        </div>
      ) : error ? (
        <div className="rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          문제집을 불러오지 못했어요: {error}
        </div>
      ) : questionSets.length === 0 ? (
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-4 text-sm font-semibold text-amber-900">
          <p className="mb-3">아직 문항이 있는 문제집이 없어요. 먼저 문제집을 만들어주세요.</p>
          <button
            onClick={onCreateQuestionSet}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-600"
          >
            문제집 만들러 가기
          </button>
        </div>
      ) : (
        <select
          id="play-set-select"
          value={selectedSetId}
          onChange={(event) => onSelect(event.target.value)}
          className="w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-base font-bold text-gray-900 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-100"
        >
          {questionSets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.title} ({set.question_count}문제)
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
