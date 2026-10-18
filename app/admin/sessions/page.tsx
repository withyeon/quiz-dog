'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrushCleaning, Square, Trash2 } from 'lucide-react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { getGameModeConfig } from '@/lib/game/modes'
import {
  Banner,
  Button,
  ConfirmDialog,
  type ConfirmRequest,
  DataTable,
  FilterChips,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  SearchInput,
  SortButton,
  StatCard,
  StatGrid,
  type TableSort,
  Toolbar,
  formatDateTime,
  formatNumber,
  timeAgo,
  useNotice,
} from '@/components/admin/ui'

type Filter = 'open' | 'waiting' | 'playing' | 'ended' | 'all'

interface AdminSession {
  roomCode: string
  status: string
  gameMode: string | null
  setTitle: string | null
  playerCount: number
  isHomework: boolean
  dueAt: string | null
  createdAt: string
  startedAt: string | null
  lastActivity: string
}

interface SessionsResponse {
  sessions: AdminSession[]
  counts: { waiting: number; playing: number; paused: number; open: number; ended: number; total: number }
  timestamp: string
}

const STATUS: Record<string, { label: string; tone: 'emerald' | 'sky' | 'amber' | 'slate' }> = {
  playing: { label: '진행', tone: 'emerald' },
  waiting: { label: '대기', tone: 'sky' },
  paused: { label: '일시정지', tone: 'amber' },
  finished: { label: '종료', tone: 'slate' },
  ended: { label: '종료', tone: 'slate' },
}
const OPEN = new Set(['waiting', 'playing', 'paused'])
const DEFAULT_SORT: TableSort = { key: 'created', dir: 'desc' }
const ASC_FIRST = new Set(['title', 'status'])

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([])
  const [counts, setCounts] = useState<SessionsResponse['counts']>({ waiting: 0, playing: 0, paused: 0, open: 0, ended: 0, total: 0 })
  const [filter, setFilter] = useState<Filter>('open')
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [sweeping, setSweeping] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const notice = useNotice()

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const query = useMemo(() => {
    const p = new URLSearchParams({ status: filter })
    if (debounced) p.set('q', debounced)
    return p.toString()
  }, [filter, debounced])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminJson<SessionsResponse>(`/api/admin/sessions?${query}`)
      setSessions(data.sessions)
      setCounts(data.counts)
      setUpdatedAt(data.timestamp)
    } catch (e) {
      setError(e instanceof Error ? e.message : '세션 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const toggleSort = (key: string) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: ASC_FIRST.has(key) ? 'asc' : 'desc' }))

  const rows = useMemo(() => {
    const time = (v?: string | null) => (v ? new Date(v).getTime() : 0)
    const dir = sort.dir === 'asc' ? 1 : -1
    const label = (s: AdminSession) => s.setTitle ?? ''
    return [...sessions].sort((a, b) => {
      switch (sort.key) {
        case 'title': return dir * label(a).localeCompare(label(b), 'ko')
        case 'status': return dir * a.status.localeCompare(b.status)
        case 'players': return dir * (a.playerCount - b.playerCount)
        case 'activity': return dir * (time(a.lastActivity) - time(b.lastActivity))
        default: return dir * (time(a.createdAt) - time(b.createdAt))
      }
    })
  }, [sessions, sort])

  // 선생님이 종료를 안 누르고 탭을 닫은 방을 즉시 정리한다(목록을 열 때도 자동으로 돌지만 결과를 보고 싶을 때 쓴다).
  const sweepStale = async () => {
    setSweeping(true)
    try {
      const data = await fetchAdminJson<{ expiredCount: number; reportedCount?: number; skippedLive: string[] }>('/api/cron/expire-rooms', { method: 'POST' })
      notice.success(data.expiredCount > 0 ? `방치된 방 ${data.expiredCount}개를 종료 처리했습니다. (기록 저장 ${data.reportedCount ?? 0}개)` : '정리할 방치된 방이 없습니다.')
      await load()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '정리하지 못했습니다.')
    } finally {
      setSweeping(false)
    }
  }

  const askEnd = (s: AdminSession) =>
    setConfirm({
      title: '게임을 종료합니다',
      destructive: true,
      confirmLabel: '종료',
      description: (
        <p>
          <span className="font-mono font-medium text-slate-900">{s.roomCode}</span> 방을 지금 종료합니다. 참여 중인 학생 {s.playerCount}명은 결과 화면으로 넘어갑니다.
        </p>
      ),
      run: async () => {
        setBusy(`${s.roomCode}:end`)
        try {
          await fetchAdminJson('/api/admin/sessions', adminJson('PATCH', { roomCode: s.roomCode, action: 'end' }))
          notice.success(`${s.roomCode} 방을 종료했습니다.`)
          await load()
        } finally {
          setBusy(null)
        }
      },
    })

  const askDelete = (s: AdminSession) =>
    setConfirm({
      title: '방 기록을 삭제합니다',
      destructive: true,
      confirmLabel: '삭제',
      description: (
        <p>
          <span className="font-mono font-medium text-slate-900">{s.roomCode}</span> 방과 참여자 {s.playerCount}명의 기록을 지웁니다. 되돌릴 수 없습니다.
          {OPEN.has(s.status) && ' 아직 열린 방입니다. 먼저 종료하는 편이 안전합니다.'}
        </p>
      ),
      run: async () => {
        setBusy(`${s.roomCode}:delete`)
        try {
          await fetchAdminJson('/api/admin/sessions', adminJson('DELETE', { roomCode: s.roomCode }))
          notice.success(`${s.roomCode} 방을 삭제했습니다.`)
          await load()
        } finally {
          setBusy(null)
        }
      },
    })

  return (
    <>
      <PageHeader
        title="게임 / 세션"
        description="열린 게임 방을 찾아 종료하거나 기록을 정리합니다. 목록을 열 때 방치된 방은 자동으로 종료 처리됩니다."
        updatedAt={updatedAt}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={sweepStale}
              disabled={sweeping}
              className="bg-white"
              title="만든 지 2시간이 지난 방을 종료 처리합니다(과제 방은 마감 뒤). 최근 5분 안에 학생이 활동한 방은 다음 정리로 미루고, 시작됐던 방은 선생님 기록에 결과를 남깁니다."
            >
              <BrushCleaning className="mr-1.5 h-4 w-4" />
              {sweeping ? '정리 중…' : '방치된 방 정리'}
            </Button>
            <RefreshButton onClick={load} loading={loading} />
          </>
        }
      />
      {notice.element}
      {error && <Banner tone="error" action={<RefreshButton onClick={load} loading={loading} label="다시 시도" />}>{error}</Banner>}

      <StatGrid columns={5}>
        <StatCard label="진행" value={formatNumber(counts.playing)} tone="success" />
        <StatCard label="대기" value={formatNumber(counts.waiting)} tone="info" />
        <StatCard label="일시정지" value={formatNumber(counts.paused)} tone={counts.paused > 0 ? 'warning' : 'default'} />
        <StatCard label="종료" value={formatNumber(counts.ended)} />
        <StatCard label="전체" value={formatNumber(counts.total)} />
      </StatGrid>

      <Panel padded={false}>
        <div className="border-b border-slate-100 px-5 py-3">
          <Toolbar>
            <FilterChips<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'open', label: '열린 방', count: counts.open },
                { value: 'playing', label: '진행', count: counts.playing },
                { value: 'waiting', label: '대기', count: counts.waiting },
                { value: 'ended', label: '종료', count: counts.ended },
                { value: 'all', label: '전체', count: counts.total },
              ]}
            />
            <SearchInput value={search} onChange={setSearch} placeholder="방 코드, 문제 세트" className="w-full md:w-72" />
          </Toolbar>
        </div>
        <DataTable<AdminSession>
          rows={rows}
          rowKey={(s) => s.roomCode}
          loading={loading}
          empty="표시할 게임 방이 없습니다."
          sort={sort}
          onSort={toggleSort}
          columns={[
            {
              key: 'room',
              header: '방',
              sortKey: 'title',
              render: (s) => {
                const mode = s.gameMode ? getGameModeConfig(s.gameMode) : null
                return (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-base font-semibold tracking-wider text-slate-900">{s.roomCode}</span>
                      {s.isHomework && <Pill tone="indigo">과제</Pill>}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {mode?.label ?? '게임 모드 미지정'}{s.setTitle ? ` · ${s.setTitle}` : ''}
                    </div>
                  </div>
                )
              },
            },
            {
              key: 'status',
              header: '상태',
              sortKey: 'status',
              width: '8rem',
              render: (s) => {
                const st = STATUS[s.status] ?? { label: s.status, tone: 'slate' as const }
                return <Pill tone={st.tone} dot={s.status === 'playing'}>{st.label}</Pill>
              },
            },
            {
              key: 'players',
              header: '학생',
              sortKey: 'players',
              align: 'right',
              width: '6rem',
              render: (s) => <span className="tabular-nums">{formatNumber(s.playerCount)}명</span>,
            },
            {
              key: 'time',
              header: (
                <span className="inline-flex items-center gap-1">
                  <SortButton label="생성" sortKey="created" sort={sort} onSort={toggleSort} />
                  <span className="text-slate-300">/</span>
                  <SortButton label="활동" sortKey="activity" sort={sort} onSort={toggleSort} />
                </span>
              ),
              render: (s) => (
                <div className="text-xs text-slate-600">
                  <div>{formatDateTime(s.createdAt)}</div>
                  <div className="text-slate-400">활동 {timeAgo(s.lastActivity)}{s.isHomework && s.dueAt ? ` · 마감 ${formatDateTime(s.dueAt)}` : ''}</div>
                </div>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              width: '9rem',
              render: (s) => (
                <div className="flex justify-end gap-1">
                  {OPEN.has(s.status) && (
                    <Button size="sm" variant="outline" className="bg-white" disabled={busy === `${s.roomCode}:end`} onClick={() => askEnd(s)}>
                      <Square className="mr-1 h-3.5 w-3.5" />종료
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={busy === `${s.roomCode}:delete`} onClick={() => askDelete(s)} aria-label={`${s.roomCode} 삭제`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
