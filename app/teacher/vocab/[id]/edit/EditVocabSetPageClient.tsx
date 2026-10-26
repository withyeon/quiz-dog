'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import VocabEditor, { type VocabEditorInitial } from '@/components/vocab/VocabEditor'
import { LoadingState } from '@/components/ui/StateViews'
import { toast } from '@/components/ui/Toaster'
import { formatServiceError } from '@/lib/services/errors'
import { getVocabSet } from '@/lib/services/vocabSets'

export default function EditVocabSetPageClient({ setId }: { setId: string }) {
  const router = useRouter()
  const [initial, setInitial] = useState<VocabEditorInitial | null>(null)

  useEffect(() => {
    let cancelled = false
    getVocabSet(setId)
      .then((set) => {
        if (cancelled) return
        if (!set) {
          toast.error('단어장을 찾을 수 없어요.')
          router.replace('/teacher')
          return
        }
        // 보통 문제집이 이 주소로 오면 문제집 편집기로 돌려보낸다
        if (!set.isVocab) {
          router.replace(`/teacher/sets/${encodeURIComponent(setId)}/edit`)
          return
        }
        setInitial({ setId: set.id, title: set.title, subject: set.subject, grade: set.grade, isPublic: set.isPublic, cards: set.cards })
      })
      .catch((error) => {
        if (!cancelled) toast.error('단어장을 불러오지 못했어요: ' + formatServiceError(error))
      })
    return () => { cancelled = true }
  }, [setId, router])

  if (!initial) return <LoadingState label="단어장을 불러오는 중" minHeight="min-h-[520px]" card={false} />
  return <VocabEditor initial={initial} />
}
