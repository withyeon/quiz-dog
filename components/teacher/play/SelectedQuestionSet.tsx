'use client'

import Link from 'next/link'
import { BookOpen, Library } from 'lucide-react'
import type { QuestionSetSummary } from '@/lib/services/questionSets'

/**
 * 게임 시작 화면에서 "지금 어떤 문제집으로 게임을 만드는지" 보여준다.
 *
 * 예전에는 여기에 문제집 선택 드롭다운이 있었다. 그런데 선생님은 이미 자료실에서
 * 문제집을 고르고 이 화면으로 넘어오기 때문에(?set=), 같은 선택을 두 번 하게 되고
 * 목록에서 엉뚱한 문제집을 다시 고를 위험도 있었다. 이제 고르는 곳은 자료실 한 곳이고,
 * 이 화면은 결과만 보여준다.
 */
export default function SelectedQuestionSet({
  set,
  loading,
  error,
}: {
  set: QuestionSetSummary | null
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <div className="mx-auto mb-8 max-w-xl rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500">
        문제집을 불러오는 중
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto mb-8 max-w-xl rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        문제집을 불러오지 못했어요: {error}
      </div>
    )
  }

  if (!set) {
    return (
      <div className="mx-auto mb-8 max-w-xl rounded-xl border-2 border-amber-200 bg-amber-50 px-5 py-5 text-center">
        <p className="text-base font-black text-amber-900">아직 문제집을 고르지 않았어요</p>
        <p className="mt-1 text-sm font-semibold text-amber-800">
          자료실에서 문제집을 고르면 바로 게임을 만들 수 있어요.
        </p>
        <Link
          href="/teacher/library"
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-amber-600"
        >
          <Library className="h-4 w-4" />
          자료실에서 문제집 고르기
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto mb-8 flex max-w-xl flex-col gap-3 rounded-xl border-2 border-slate-200 bg-white px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
          <BookOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-400">이 문제집으로 게임을 만들어요</p>
          <p className="truncate text-base font-black text-slate-900">{set.title}</p>
          <p className="text-sm font-semibold text-slate-500">{set.question_count}문제</p>
        </div>
      </div>
      <Link
        href="/teacher/library"
        className="shrink-0 rounded-lg border-2 border-slate-200 px-4 py-2 text-center text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      >
        다른 문제집 고르기
      </Link>
    </div>
  )
}
