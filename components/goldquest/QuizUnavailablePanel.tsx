'use client'

import { AlertTriangle } from 'lucide-react'

type Props = {
  questionsLoading: boolean
  message: string | null
}

/** 퀴즈 화면인데 보여줄 문제가 없을 때: 불러오는 중이거나 문제집이 비어 있는 경우. */
export default function QuizUnavailablePanel({ questionsLoading, message }: Props) {
  return (
    <div className="gold-quest-panel p-8 sm:p-12 text-center">
      {questionsLoading ? (
        <>
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
          <h2 className="gold-quest-title text-3xl font-black text-[#17262a]">문제 불러오는 중</h2>
        </>
      ) : (
        <>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/70 bg-amber-100/70">
            <AlertTriangle className="h-8 w-8 text-amber-700" />
          </div>
          <h2 className="gold-quest-title text-3xl font-black text-[#17262a]">퀴즈를 시작할 수 없습니다</h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-relaxed text-slate-600">
            {message || '문제 정보를 찾지 못했습니다. 선생님이 게임을 다시 시작해야 합니다.'}
          </p>
        </>
      )}
    </div>
  )
}
