'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { copyQuestionSetFromQuestionsOnly } from '@/lib/services/questionSets'

/**
 * 공유받은 문제집을 "내 문제집"으로 복사하고 편집기로 보낸다.
 *
 * 원본은 절대 건드리지 않는다. 받은 선생님이 수정하면 자기 사본만 바뀐다.
 * /teacher 아래에 있으므로 레이아웃이 로그인을 이미 강제한다 — 비로그인으로 들어오면
 * 로그인 화면을 거쳐 이 주소로 되돌아온다.
 */
function ImportRunner() {
  const router = useRouter()
  const params = useSearchParams()
  const sourceSetId = params?.get('from') ?? ''
  const [error, setError] = useState<string | null>(null)
  // React 18 StrictMode 는 effect 를 두 번 실행한다. 그대로 두면 사본이 두 개 생긴다.
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    if (!sourceSetId) {
      setError('가져올 문제집을 찾을 수 없어요.')
      return
    }
    startedRef.current = true

    void (async () => {
      try {
        const newSetId = await copyQuestionSetFromQuestionsOnly(sourceSetId)
        router.replace(`/teacher/sets/${newSetId}/edit?imported=1`)
      } catch (err) {
        console.error('문제집 가져오기 실패:', err)
        setError(err instanceof Error ? err.message : '문제집을 가져오지 못했어요.')
      }
    })()
  }, [router, sourceSetId])

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-slate-800">{error}</p>
        <Link
          href="/teacher/library"
          className="rounded-xl bg-sky-500 px-5 py-3 font-black text-white"
        >
          자료실로 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      <p className="text-lg font-bold text-slate-700">내 문제집으로 가져오는 중이에요…</p>
      <p className="text-sm font-medium text-slate-500">
        원본은 그대로 두고 수정할 수 있는 사본을 만들고 있어요.
      </p>
    </div>
  )
}

export default function ImportQuestionSetPage() {
  return (
    <Suspense fallback={null}>
      <ImportRunner />
    </Suspense>
  )
}
