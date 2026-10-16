'use client'

/**
 * 공지사항 관리. 목록(표 + 행 펼침)과 편집기를 한 페이지에서 오간다.
 * 초피티 운영 공지 화면과 같은 흐름이되, 퀴즈독 공지는 제목·본문·중요도·게시 여부만 가진다.
 */
import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Plus } from 'lucide-react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { cn } from '@/lib/utils'
import {
  Banner,
  Button,
  ConfirmDialog,
  type ConfirmRequest,
  DataTable,
  EmptyState,
  FilterChips,
  Input,
  KeyValue,
  PageHeader,
  Panel,
  Pill,
  type PillTone,
  RefreshButton,
  Toolbar,
  formatDateTime,
  useNotice,
} from '@/components/admin/ui'

type Level = 'info' | 'warning' | 'critical'

interface Announcement {
  id: string
  title: string
  body: string
  level: Level
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

type Filter = 'all' | 'published' | 'draft'
type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; item: Announcement }

const LEVEL: Record<Level, { label: string; tone: PillTone; box: string }> = {
  info: { label: '안내', tone: 'sky', box: 'border-sky-200 bg-sky-50 text-sky-900' },
  warning: { label: '주의', tone: 'amber', box: 'border-amber-200 bg-amber-50 text-amber-900' },
  critical: { label: '긴급', tone: 'rose', box: 'border-rose-200 bg-rose-50 text-rose-900' },
}
const LIMITS = { title: 80, body: 2000 }

/** 교사에게 보이는 모습. 목록 펼침과 편집기 미리보기가 같은 부품을 쓴다. */
function AnnouncementPreview({ title, body, level, date }: { title: string; body: string; level: Level; date: string }) {
  return (
    <article className={cn('rounded-lg border p-4', LEVEL[level].box)}>
      <div className="flex items-center gap-2">
        <Pill tone={LEVEL[level].tone}>{LEVEL[level].label}</Pill>
        <span className="text-xs opacity-70">{formatDateTime(date)}</span>
      </div>
      <h3 className="mt-2 text-base font-semibold">{title || '(제목 없음)'}</h3>
      {body ? <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{body}</p> : <p className="mt-1 text-sm opacity-60">본문이 비어 있습니다.</p>}
    </article>
  )
}

function Counter({ length, max }: { length: number; max: number }) {
  return <span className={cn('text-xs tabular-nums', length > max ? 'text-rose-600' : 'text-slate-400')}>{length}/{max}</span>
}

function AnnouncementEditor({ initial, onCancel, onSaved }: { initial: Announcement | null; onCancel: () => void; onSaved: (message: string) => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [level, setLevel] = useState<Level>(initial?.level ?? 'info')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (publish: boolean) => {
    if (!title.trim()) {
      setError('제목을 입력합니다.')
      return
    }
    if (title.length > LIMITS.title || body.length > LIMITS.body) {
      setError('글자 수 제한을 넘었습니다.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { title: title.trim(), body: body.trim(), level, is_published: publish }
      if (initial) await fetchAdminJson('/api/admin/announcements', adminJson('PATCH', { id: initial.id, ...payload }))
      else await fetchAdminJson('/api/admin/announcements', adminJson('POST', payload))
      onSaved(publish ? '공지를 게시했습니다.' : initial ? '저장했습니다.' : '비공개로 저장했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title={initial ? '공지 수정' : '새 공지'} description="비공개 공지는 교사에게 보이지 않습니다. 게시하면 바로 보입니다." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <Panel title="내용">
          <div className="space-y-5">
            <div>
              <span className="block text-xs font-medium text-slate-600">중요도</span>
              <div className="mt-1 flex gap-1.5">
                {(Object.keys(LEVEL) as Level[]).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setLevel(lv)}
                    className={cn('rounded-full border px-3 py-1 text-sm', level === lv ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                  >
                    {LEVEL[lv].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="announcement-title" className="block text-xs font-medium text-slate-600">제목</label>
                <Counter length={title.length} max={LIMITS.title} />
              </div>
              <Input id="announcement-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 10월 점검 안내" className="mt-1" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="announcement-body" className="block text-xs font-medium text-slate-600">본문</label>
                <Counter length={body.length} max={LIMITS.body} />
              </div>
              <textarea
                id="announcement-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
              <p className="mt-1 text-xs text-slate-400">줄바꿈은 그대로 보입니다.</p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={onCancel} disabled={saving}>취소</Button>
              {initial?.is_published ? (
                <Button onClick={() => submit(true)} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
              ) : (
                <>
                  <Button variant="outline" className="bg-white" onClick={() => submit(false)} disabled={saving}>{saving ? '저장 중…' : '비공개 저장'}</Button>
                  <Button onClick={() => submit(true)} disabled={saving}>{saving ? '저장 중…' : '게시'}</Button>
                </>
              )}
            </div>
          </div>
        </Panel>
        <Panel title="미리보기" description="교사에게 보이는 모습입니다.">
          <AnnouncementPreview title={title} body={body} level={level} date={initial?.created_at ?? new Date().toISOString()} />
        </Panel>
      </div>
    </>
  )
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const notice = useNotice()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminJson<{ announcements: Announcement[] }>('/api/admin/announcements')
      setItems(data.announcements ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = filter === 'all' ? items : items.filter((a) => (filter === 'published' ? a.is_published : !a.is_published))
  const chips: Array<{ value: Filter; label: string; count: number }> = [
    { value: 'all', label: '전체', count: items.length },
    { value: 'published', label: '게시 중', count: items.filter((a) => a.is_published).length },
    { value: 'draft', label: '비공개', count: items.filter((a) => !a.is_published).length },
  ]

  const setPublished = async (item: Announcement, is_published: boolean) => {
    try {
      await fetchAdminJson('/api/admin/announcements', adminJson('PATCH', { id: item.id, is_published }))
      notice.success(is_published ? '공지를 게시했습니다.' : '게시를 내렸습니다.')
      await load()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '저장하지 못했습니다.')
    }
  }

  const askUnpublish = (item: Announcement) =>
    setConfirm({
      title: '게시를 내립니다',
      confirmLabel: '게시 내리기',
      description: <p>“{item.title}” 공지를 교사 화면에서 내리고 비공개로 돌립니다. 다시 게시할 수 있습니다.</p>,
      run: () => setPublished(item, false),
    })

  const askDelete = (item: Announcement) =>
    setConfirm({
      title: '공지를 삭제합니다',
      destructive: true,
      confirmLabel: '삭제',
      description: (
        <div className="space-y-2">
          <p>“{item.title}” 공지를 지웁니다. 되돌릴 수 없습니다. 게시만 멈추려면 ‘게시 내리기’를 씁니다.</p>
          {item.is_published && <p>지금 게시 중입니다. 교사 화면에서 바로 사라집니다.</p>}
        </div>
      ),
      run: async () => {
        await fetchAdminJson('/api/admin/announcements', adminJson('DELETE', { id: item.id }))
        notice.success('공지를 삭제했습니다.')
        await load()
      },
    })

  if (mode.kind !== 'list') {
    return (
      <AnnouncementEditor
        initial={mode.kind === 'edit' ? mode.item : null}
        onCancel={() => setMode({ kind: 'list' })}
        onSaved={(message) => {
          setMode({ kind: 'list' })
          notice.success(message)
          void load()
        }}
      />
    )
  }

  const newButton = (
    <Button size="sm" onClick={() => setMode({ kind: 'create' })}>
      <Plus className="mr-1.5 h-4 w-4" />새 공지
    </Button>
  )

  return (
    <>
      <PageHeader
        title="공지사항"
        description="게시 중인 공지는 교사 화면에 보입니다. 행을 누르면 내용을 봅니다."
        actions={
          <>
            <RefreshButton onClick={load} loading={loading} />
            {newButton}
          </>
        }
      />
      {notice.element}
      {error && <Banner tone="error" action={<RefreshButton onClick={load} loading={loading} label="다시 시도" />}>{error}</Banner>}

      {!loading && !error && items.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-8 w-8" />} title="공지가 없습니다." description="새 공지를 눌러 작성합니다." action={newButton} />
      ) : (
        <>
          <Toolbar>
            <FilterChips value={filter} onChange={setFilter} options={chips} />
          </Toolbar>
          <Panel padded={false}>
            <DataTable<Announcement>
              rows={filtered}
              rowKey={(a) => a.id}
              loading={loading}
              empty="해당 상태의 공지가 없습니다."
              onRowClick={(a) => setExpandedId((cur) => (cur === a.id ? null : a.id))}
              rowClassName={(a) => (expandedId === a.id ? 'bg-slate-50' : undefined)}
              columns={[
                {
                  key: 'title',
                  header: '제목',
                  render: (a) => (
                    <div className="flex min-w-0 items-center gap-2">
                      <Pill tone={LEVEL[a.level].tone}>{LEVEL[a.level].label}</Pill>
                      <span className="truncate font-medium text-slate-900">{a.title || '(제목 없음)'}</span>
                    </div>
                  ),
                },
                {
                  key: 'state',
                  header: '상태',
                  width: '7rem',
                  render: (a) => (a.is_published ? <Pill tone="emerald" dot>게시 중</Pill> : <Pill tone="slate">비공개</Pill>),
                },
                { key: 'author', header: '작성자', width: '12rem', render: (a) => <span className="text-xs text-slate-600">{a.created_by || '-'}</span> },
                { key: 'created', header: '만든 때', width: '9rem', render: (a) => <span className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(a.created_at)}</span> },
              ]}
              expanded={(a) =>
                expandedId === a.id ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div>
                      <div className="mb-2 text-xs font-medium text-slate-500">교사에게 보이는 모습</div>
                      <AnnouncementPreview title={a.title} body={a.body} level={a.level} date={a.created_at} />
                    </div>
                    <div className="space-y-4">
                      <KeyValue
                        items={[
                          { label: '작성자', value: a.created_by || '-' },
                          { label: '만든 때', value: formatDateTime(a.created_at) },
                          { label: '마지막 수정', value: formatDateTime(a.updated_at) },
                          { label: '중요도', value: LEVEL[a.level].label },
                        ]}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="bg-white" onClick={() => setMode({ kind: 'edit', item: a })}>수정</Button>
                        {a.is_published ? (
                          <Button size="sm" variant="outline" className="bg-white" onClick={() => askUnpublish(a)}>게시 내리기</Button>
                        ) : (
                          <Button size="sm" onClick={() => setPublished(a, true)}>게시</Button>
                        )}
                        <Button size="sm" variant="ghost" className="ml-auto text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => askDelete(a)}>삭제</Button>
                      </div>
                    </div>
                  </div>
                ) : null
              }
            />
          </Panel>
        </>
      )}

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
