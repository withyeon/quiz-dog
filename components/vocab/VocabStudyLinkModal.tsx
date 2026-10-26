'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCodeSVG from 'react-qr-code'
import { Check, Copy, ExternalLink, Loader2, X } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { supabase } from '@/lib/supabase/client'
import { buildVocabStudyUrl, setLinkSharing } from '@/lib/services/sharing'
import { formatServiceError } from '@/lib/services/errors'

/**
 * 학생에게 단어장 공부 링크를 주는 창.
 * 공부 화면은 공유 링크와 같은 코드(share_code)로 열리고, 링크 공유가 켜져 있거나 자료실에 공개된
 * 단어장만 열린다(lib/services/sharing.ts 의 getSharedSetByCode). 그래서 처음엔 "링크 만들기"로 공유를 켠다.
 */
export default function VocabStudyLinkModal({
  setId,
  title,
  onClose,
}: {
  setId: string
  title: string
  onClose: () => void
}) {
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  // 부모가 매번 새로 만드는 onClose 를 의존성에 넣으면 불러오기가 계속 다시 돈다 → ref 로 읽는다
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const load = useCallback(async () => {
    const { data, error } = await (supabase.from('question_sets') as any)
      .select('share_code, is_shared, is_public')
      .eq('id', setId)
      .maybeSingle()
    if (error || !data) {
      toast.error('단어장 정보를 불러오지 못했어요.')
      onCloseRef.current()
      return
    }
    const open = Boolean(data.is_shared) || Boolean(data.is_public)
    setShareCode(open ? data.share_code ?? null : null)
    setLoading(false)
  }, [setId])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createLink = async () => {
    setBusy(true)
    try {
      const code = await setLinkSharing(setId, true)
      setShareCode(code)
    } catch (error) {
      toast.error('링크를 만들지 못했어요: ' + formatServiceError(error))
    } finally {
      setBusy(false)
    }
  }

  const url = shareCode ? buildVocabStudyUrl(shareCode) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('링크를 복사했어요.')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="학생 공부 링크"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-slate-900">학생 공부 링크</h2>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="grid h-48 place-items-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : shareCode ? (
          <div className="mt-4">
            <p className="break-keep text-sm font-medium leading-6 text-slate-600">
              학생은 로그인 없이 이 링크에서 카드 뒤집기·익히기·쓰기·시험 보기로 공부해요. 공부 기록은 학생 기기에 남아요.
            </p>
            <div className="mt-4 flex justify-center rounded-2xl bg-slate-50 p-4">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG value={url} size={168} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none"
                aria-label="공부 링크 주소"
              />
              <button
                type="button"
                onClick={copy}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                복사
              </button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              학생 화면 열어 보기
            </a>
          </div>
        ) : (
          <div className="mt-4">
            <p className="break-keep text-sm font-medium leading-6 text-slate-600">
              링크를 만들면 링크를 아는 사람은 누구나 이 단어장을 볼 수 있어요. 나중에 공유 설정에서 언제든 끌 수 있어요.
            </p>
            <button
              type="button"
              onClick={createLink}
              disabled={busy}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 text-base font-black text-white transition hover:bg-sky-600 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              공부 링크 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
