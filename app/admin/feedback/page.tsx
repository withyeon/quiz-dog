'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import {
  Banner,
  Button,
  ConfirmDialog,
  type ConfirmRequest,
  DataTable,
  FIELD,
  FilterChips,
  PageHeader,
  Panel,
  Pill,
  type PillTone,
  RefreshButton,
  SearchInput,
  StatCard,
  StatGrid,
  Toolbar,
  formatDateTime,
  formatNumber,
  useNotice,
} from '@/components/admin/ui'

type Status = 'open' | 'in_progress' | 'resolved' | 'archived'
type Filter = 'all' | Status

interface Feedback {
  id: string
  category: string
  message: string
  contact: string | null
  room_code: string | null
  page_url: string | null
  user_email: string | null
  status: Status
  admin_note: string | null
  created_at: string
}

const CATEGORY_LABEL: Record<string, string> = {
  general: '일반 문의',
  bug: '오류/버그',
  question_error: '문제 오류',
  payment: '결제',
  quote: '견적 발행',
  suggestion: '제안',
  other: '기타',
}

const STATUS: Record<Status, { label: string; tone: PillTone }> = {
  open: { label: '미처리', tone: 'rose' },
  in_progress: { label: '처리 중', tone: 'sky' },
  resolved: { label: '완료', tone: 'emerald' },
  archived: { label: '보관', tone: 'slate' },
}
const STATUS_ORDER: Status[] = ['open', 'in_progress', 'resolved', 'archived']

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const notice = useNotice()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminJson<{ feedback: Feedback[] }>('/api/admin/feedback')
      setItems(data.feedback ?? [])
      setUpdatedAt(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : '문제 신고를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: items.length, open: 0, in_progress: 0, resolved: 0, archived: 0 }
    for (const f of items) c[f.status] = (c[f.status] ?? 0) + 1
    return c
  }, [items])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((f) => {
      if (filter !== 'all' && f.status !== filter) return false
      if (!q) return true
      return [f.message, f.contact, f.user_email, f.room_code, CATEGORY_LABEL[f.category]].some((v) => (v ?? '').toLowerCase().includes(q))
    })
  }, [items, filter, search])

  const toggle = (f: Feedback) => {
    if (openId === f.id) {
      setOpenId(null)
      return
    }
    setOpenId(f.id)
    setNoteDraft(f.admin_note ?? '')
  }

  const patch = async (f: Feedback, body: Partial<Pick<Feedback, 'status' | 'admin_note'>>, message: string) => {
    setSaving(true)
    try {
      await fetchAdminJson('/api/admin/feedback', adminJson('PATCH', { id: f.id, ...body }))
      setItems((prev) => prev.map((x) => (x.id === f.id ? { ...x, ...body } : x)))
      notice.success(message)
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const askDelete = (f: Feedback) =>
    setConfirm({
      title: '신고를 삭제합니다',
      destructive: true,
      confirmLabel: '삭제',
      description: <p>이 {CATEGORY_LABEL[f.category] ?? f.category} 신고를 지웁니다. 되돌릴 수 없습니다. 기록을 남기려면 ‘보관’으로 바꿉니다.</p>,
      run: async () => {
        await fetchAdminJson('/api/admin/feedback', adminJson('DELETE', { id: f.id }))
        setItems((prev) => prev.filter((x) => x.id !== f.id))
        if (openId === f.id) setOpenId(null)
        notice.success('신고를 삭제했습니다.')
      },
    })

  return (
    <>
      <PageHeader title="문제 신고" description="문의 페이지와 게임 화면에서 보낸 문의·오류 신고입니다. 행을 누르면 전체 내용을 봅니다." updatedAt={updatedAt} actions={<RefreshButton onClick={load} loading={loading} />} />
      {notice.element}
      {error && <Banner tone="error" action={<RefreshButton onClick={load} loading={loading} label="다시 시도" />}>{error}</Banner>}

      <StatGrid columns={4}>
        <StatCard label="전체 신고" value={formatNumber(counts.all)} icon={<MessageSquare className="h-4 w-4" />} loading={loading && items.length === 0} />
        <StatCard label="미처리" value={formatNumber(counts.open)} tone={counts.open > 0 ? 'danger' : 'default'} loading={loading && items.length === 0} />
        <StatCard label="처리 중" value={formatNumber(counts.in_progress)} tone="info" loading={loading && items.length === 0} />
        <StatCard label="완료" value={formatNumber(counts.resolved)} tone="success" loading={loading && items.length === 0} />
      </StatGrid>

      <Panel padded={false}>
        <div className="border-b border-slate-100 px-5 py-3">
          <Toolbar>
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: '미처리', count: counts.open },
                { value: 'in_progress', label: '처리 중', count: counts.in_progress },
                { value: 'resolved', label: '완료', count: counts.resolved },
                { value: 'archived', label: '보관', count: counts.archived },
                { value: 'all', label: '전체', count: counts.all },
              ]}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="내용, 연락처, 방 코드" className="w-full md:w-72" />
          </Toolbar>
        </div>
        <DataTable<Feedback>
          rows={rows}
          rowKey={(f) => f.id}
          loading={loading}
          empty={search ? '검색 결과가 없습니다.' : '접수된 신고가 없습니다.'}
          onRowClick={toggle}
          rowClassName={(f) => (openId === f.id ? 'bg-slate-50' : undefined)}
          columns={[
            {
              key: 'sender',
              header: '보낸 사람',
              width: '14rem',
              render: (f) => (
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{f.user_email || f.contact || '익명'}</div>
                  <div className="truncate text-xs text-slate-500">{f.user_email && f.contact ? f.contact : CATEGORY_LABEL[f.category] ?? f.category}</div>
                </div>
              ),
            },
            { key: 'category', header: '분류', width: '7rem', render: (f) => <Pill tone="indigo">{CATEGORY_LABEL[f.category] ?? f.category}</Pill> },
            { key: 'content', header: '내용', render: (f) => <span className="line-clamp-2 max-w-lg text-sm text-slate-700">{f.message}</span> },
            { key: 'status', header: '상태', width: '7rem', render: (f) => <Pill tone={STATUS[f.status]?.tone ?? 'slate'} dot={f.status === 'open'}>{STATUS[f.status]?.label ?? f.status}</Pill> },
            { key: 'date', header: '접수', width: '9rem', render: (f) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(f.created_at)}</span> },
          ]}
          expanded={(f) =>
            openId === f.id ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-3">
                  <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-800">{f.message}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {f.contact && <span>연락처 {f.contact}</span>}
                    {f.user_email && <span>로그인 {f.user_email}</span>}
                    {f.room_code && <span>방 <span className="font-mono">{f.room_code}</span></span>}
                    {f.page_url && (
                      <a href={f.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />페이지 열기
                      </a>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-xs text-slate-600">
                    상태
                    <select value={f.status} onChange={(e) => patch(f, { status: e.target.value as Status }, '상태를 바꿨습니다.')} disabled={saving} className={FIELD}>
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{STATUS[s].label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-slate-600">
                    처리 메모
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      rows={4}
                      placeholder="어떻게 처리했는지 적어 둡니다."
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => patch(f, { admin_note: noteDraft.trim() }, '메모를 저장했습니다.')} disabled={saving || noteDraft.trim() === (f.admin_note ?? '')}>
                      메모 저장
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(f)}>삭제</Button>
                  </div>
                </div>
              </div>
            ) : null
          }
        />
      </Panel>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
