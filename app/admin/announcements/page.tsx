'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Pencil, Eye, EyeOff, X } from 'lucide-react'
import { fetchAdminJson, fetchAdmin } from '@/lib/admin/fetchAdmin'
import { toast } from '@/components/ui/Toaster'

interface Announcement {
  id: string
  title: string
  body: string
  level: 'info' | 'warning' | 'critical'
  is_published: boolean
  created_at: string
}

const LEVEL_STYLE: Record<string, { label: string; cls: string }> = {
  info: { label: '안내', cls: 'bg-sky-50 text-sky-600' },
  warning: { label: '주의', cls: 'bg-amber-50 text-amber-600' },
  critical: { label: '긴급', cls: 'bg-red-50 text-red-600' },
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [showForm, setShowForm] = useState(false)

  const load = () => {
    setLoading(true)
    fetchAdminJson<{ announcements: Announcement[] }>('/api/admin/announcements')
      .then((d) => setItems(d.announcements))
      .catch((e) => toast.error(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const togglePublish = async (a: Announcement) => {
    await fetchAdmin('/api/admin/announcements', {
      method: 'PATCH',
      body: JSON.stringify({ id: a.id, is_published: !a.is_published }),
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('이 공지를 삭제할까요?')) return
    await fetchAdmin('/api/admin/announcements', { method: 'DELETE', body: JSON.stringify({ id }) })
    toast.success('삭제되었습니다.')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">공지사항</h1>
          <p className="mt-1 text-sm text-slate-500">공지 {items.length}개</p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setShowForm(true)
          }}
          className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          새 공지
        </button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          등록된 공지가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const lv = LEVEL_STYLE[a.level]
            return (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${lv.cls}`}>
                        {lv.label}
                      </span>
                      {!a.is_published && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          비공개
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatDate(a.created_at)}</span>
                    </div>
                    <h3 className="mt-1.5 font-semibold text-slate-900">{a.title}</h3>
                    {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconBtn onClick={() => togglePublish(a)} title={a.is_published ? '비공개' : '공개'}>
                      {a.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </IconBtn>
                    <IconBtn
                      onClick={() => {
                        setEditing(a)
                        setShowForm(true)
                      }}
                      title="수정"
                    >
                      <Pencil className="h-4 w-4" />
                    </IconBtn>
                    <IconBtn onClick={() => remove(a.id)} title="삭제" danger>
                      <Trash2 className="h-4 w-4" />
                    </IconBtn>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <AnnouncementForm
          initial={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  title: string
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 ${
        danger ? 'text-red-500 hover:border-red-200' : 'text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function AnnouncementForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Announcement | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [level, setLevel] = useState<Announcement['level']>(initial?.level ?? 'info')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      if (initial) {
        await fetchAdmin('/api/admin/announcements', {
          method: 'PATCH',
          body: JSON.stringify({ id: initial.id, title, body, level }),
        })
      } else {
        await fetchAdmin('/api/admin/announcements', {
          method: 'POST',
          body: JSON.stringify({ title, body, level }),
        })
      }
      toast.success('저장되었습니다.')
      onSaved()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{initial ? '공지 수정' : '새 공지'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">중요도</label>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as const).map((lv) => (
                <button
                  key={lv}
                  onClick={() => setLevel(lv)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    level === lv ? LEVEL_STYLE[lv].cls + ' ring-2 ring-offset-1' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {LEVEL_STYLE[lv].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">내용</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            취소
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
