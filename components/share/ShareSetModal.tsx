'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Eye, Link2, Loader2, Play, X } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
import { supabase } from '@/lib/supabase/client'
import { buildShareUrl, setLibraryListing, setLinkSharing } from '@/lib/services/sharing'

type ShareState = {
  shareCode: string | null
  isShared: boolean
  isPublic: boolean
  viewCount: number
  playCount: number
}

/**
 * 문제집 공유 설정.
 *
 * "링크 공유"와 "자료실 등재"는 서로 독립이다.
 *  · 링크만 켜면 주소를 아는 사람만 볼 수 있다 (인디스쿨에 올리는 용도)
 *  · 자료실까지 켜면 퀴즈독 안에서 검색·탐색으로도 발견된다
 */
export default function ShareSetModal({
  setId,
  title,
  onClose,
}: {
  setId: string
  title: string
  onClose: () => void
}) {
  const [state, setState] = useState<ShareState | null>(null)
  const [busy, setBusy] = useState<'link' | 'library' | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await (supabase
      .from('question_sets') as any)
      .select('share_code, is_shared, is_public, view_count, play_count')
      .eq('id', setId)
      .maybeSingle()

    if (error || !data) {
      toast.error('공유 정보를 불러오지 못했어요.')
      onClose()
      return
    }

    setState({
      shareCode: data.share_code ?? null,
      isShared: Boolean(data.is_shared),
      isPublic: Boolean(data.is_public),
      viewCount: data.view_count ?? 0,
      playCount: data.play_count ?? 0,
    })
  }, [setId, onClose])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shareUrl = state?.shareCode ? buildShareUrl(state.shareCode) : ''

  const toggleLink = async () => {
    if (!state || busy) return
    setBusy('link')
    try {
      const nextEnabled = !state.isShared
      const code = await setLinkSharing(setId, nextEnabled)
      setState({ ...state, isShared: nextEnabled, shareCode: code ?? state.shareCode })
      toast.success(nextEnabled ? '공유 링크가 켜졌어요.' : '공유 링크를 껐어요.')
    } catch (error) {
      console.error('공유 설정 실패:', error)
      toast.error('공유 설정을 바꾸지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  const toggleLibrary = async () => {
    if (!state || busy) return
    setBusy('library')
    try {
      const next = !state.isPublic
      await setLibraryListing(setId, next)
      setState({ ...state, isPublic: next })
      toast.success(next ? '자료실에 등재했어요.' : '자료실에서 내렸어요.')
    } catch (error) {
      console.error('자료실 설정 실패:', error)
      toast.error('자료실 설정을 바꾸지 못했어요.')
    } finally {
      setBusy(null)
    }
  }

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/[0.6] p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="문제집 공유"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900">문제집 공유</h2>
            <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!state ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* 링크 공유 */}
            <div className="rounded-2xl border-2 border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 font-black text-slate-900">
                    <Link2 className="h-4 w-4 text-sky-500" />
                    링크로 공유
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    주소를 아는 선생님만 볼 수 있어요.
                  </p>
                </div>
                <Toggle on={state.isShared} busy={busy === 'link'} onClick={toggleLink} label="링크 공유" />
              </div>

              {state.isShared && shareUrl && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                  <span className="flex-1 truncate px-2 text-sm font-semibold text-slate-700">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-black text-white transition hover:bg-sky-600"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>
              )}
            </div>

            {/* 자료실 등재 */}
            <div className="rounded-2xl border-2 border-slate-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black text-slate-900">자료실에도 올리기</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    퀴즈독 자료실에서 다른 선생님이 검색해 찾을 수 있어요.
                  </p>
                </div>
                <Toggle on={state.isPublic} busy={busy === 'library'} onClick={toggleLibrary} label="자료실 등재" />
              </div>
            </div>

            {/* 유입 현황 */}
            {state.isShared && (
              <div className="flex gap-3">
                <Stat icon={<Eye className="h-4 w-4" />} label="열어본 횟수" value={state.viewCount} />
                <Stat icon={<Play className="h-4 w-4" />} label="수업에 쓴 횟수" value={state.playCount} />
              </div>
            )}

            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              이 링크는 <b>선생님용</b>이에요. 아이들에게는 게임 시작 후 나오는{' '}
              <b>6자리 입장 코드</b>를 알려주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({
  on,
  busy,
  onClick,
  label,
}: {
  on: boolean
  busy: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        on ? 'bg-sky-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition-all ${
          on ? 'left-7' : 'left-1'
        }`}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
      </span>
    </button>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex-1 rounded-2xl bg-slate-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value.toLocaleString()}</p>
    </div>
  )
}
