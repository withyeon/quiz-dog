'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Trash2, Mail, Hash, ExternalLink } from 'lucide-react'
import { fetchAdminJson, fetchAdmin } from '@/lib/admin/fetchAdmin'
import { toast } from '@/components/ui/Toaster'

interface Feedback {
  id: string
  category: string
  message: string
  contact: string | null
  room_code: string | null
  page_url: string | null
  user_email: string | null
  status: string
  admin_note: string | null
  created_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  general: '일반 문의',
  bug: '오류/버그',
  question_error: '문제 오류',
  payment: '결제',
  suggestion: '제안',
  other: '기타',
}

const STATUS_TABS = [
  { key: '', label: '전체' },
  { key: 'open', label: '미처리' },
  { key: 'in_progress', label: '처리 중' },
  { key: 'resolved', label: '완료' },
  { key: 'archived', label: '보관' },
]

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-orange-50 text-orange-600',
  in_progress: 'bg-sky-50 text-sky-600',
  resolved: 'bg-emerald-50 text-emerald-600',
  archived: 'bg-slate-100 text-slate-400',
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetchAdminJson<{ feedback: Feedback[] }>(`/api/admin/feedback${tab ? `?status=${tab}` : ''}`)
      .then((d) => setItems(d.feedback))
      .catch((e) => toast.error(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (id: string, status: string) => {
    await fetchAdmin('/api/admin/feedback', { method: 'PATCH', body: JSON.stringify({ id, status }) })
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
  }

  const remove = async (id: string) => {
    if (!confirm('이 신고를 삭제할까요?')) return
    await fetchAdmin('/api/admin/feedback', { method: 'DELETE', body: JSON.stringify({ id }) })
    setItems((prev) => prev.filter((f) => f.id !== id))
    toast.success('삭제되었습니다.')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">문제 신고 / 문의</h1>
        <p className="mt-1 text-sm text-slate-500">사용자가 보낸 문의·오류 신고</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          접수된 신고가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
                  {CATEGORY_LABEL[f.category] ?? f.category}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[f.status]}`}>
                  {STATUS_TABS.find((t) => t.key === f.status)?.label ?? f.status}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(f.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{f.message}</p>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {f.contact && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {f.contact}
                  </span>
                )}
                {f.user_email && <span>로그인: {f.user_email}</span>}
                {f.room_code && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    {f.room_code}
                  </span>
                )}
                {f.page_url && (
                  <a href={f.page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-500 hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    페이지
                  </a>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-50 pt-3">
                <select
                  value={f.status}
                  onChange={(e) => updateStatus(f.id, e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 outline-none focus:border-slate-400"
                >
                  <option value="open">미처리</option>
                  <option value="in_progress">처리 중</option>
                  <option value="resolved">완료</option>
                  <option value="archived">보관</option>
                </select>
                <button
                  onClick={() => remove(f.id)}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
