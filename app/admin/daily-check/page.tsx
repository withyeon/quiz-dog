'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bug, ChevronLeft, ChevronRight, Gamepad2, Sparkles, Users, Wand2 } from 'lucide-react'
import { fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { getGameModeConfig } from '@/lib/game/modes'
import {
  Banner,
  Button,
  DataTable,
  EmptyState,
  FilterChips,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  StatCard,
  StatGrid,
  Toolbar,
  formatDateTime,
  formatNumber,
} from '@/components/admin/ui'
import type { DailyCheckRoom } from '@/app/api/admin/daily-check/route'

interface ErrorGroup {
  key: string
  kind: string
  message: string
  path: string | null
  stack: string | null
  count: number
  firstAt: string
  lastAt: string
  roomCodes: string[]
  who: string[]
  userAgents: string[]
}

interface DailyCheck {
  date: string
  summary: {
    rooms: number
    startedRooms: number
    students: number
    teachers: number
    anonymousRooms: number
    flaggedRooms: number
    aiGenerations: number
    aiQuestions: number
    errorEvents: number
    errorGroups: number
  }
  byMode: Array<{ mode: string; rooms: number; started: number; students: number }>
  rooms: DailyCheckRoom[]
  ai: Array<{ createdAt: string; sourceType: string; questionCount: number; userName: string | null }>
  aiAvailable: boolean
  errors: ErrorGroup[]
  errorsAvailable: boolean
  timestamp: string
}

type RoomFilter = 'all' | 'flagged' | 'class' | 'started'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function todayKst(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10)
}
function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
function timeKst(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(11, 16)
}
function weekdayLabel(date: string): string {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00Z`).getUTCDay()]
}

const AI_SOURCE: Record<string, string> = { topic: '주제', youtube: '유튜브', text: '글', file: '파일', pdf: 'PDF', exam: '시험지' }
const ERROR_KIND: Record<string, string> = {
  error: '스크립트 오류', unhandledrejection: '처리 안 된 Promise', page_error: '페이지 오류 화면', global_error: '치명적 오류 화면', console_error: '콘솔 오류',
}

export default function AdminDailyCheckPage() {
  const [date, setDate] = useState(todayKst)
  const [data, setData] = useState<DailyCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<RoomFilter>('all')
  const [openError, setOpenError] = useState<string | null>(null)

  const load = useCallback(async (target: string) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchAdminJson<DailyCheck>(`/api/admin/daily-check?date=${target}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : '수업 점검 자료를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [date, load])

  const rooms = useMemo(() => {
    const list = data?.rooms ?? []
    const filtered = filter === 'flagged' ? list.filter((r) => r.flags.length > 0)
      : filter === 'class' ? list.filter((r) => r.playerCount >= 5)
      : filter === 'started' ? list.filter((r) => Boolean(r.startedAt))
      : list
    return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data, filter])

  const counts = useMemo(() => {
    const list = data?.rooms ?? []
    return {
      all: list.length,
      flagged: list.filter((r) => r.flags.length > 0).length,
      class: list.filter((r) => r.playerCount >= 5).length,
      started: list.filter((r) => Boolean(r.startedAt)).length,
    }
  }, [data])

  const skeleton = loading && !data
  const isToday = date === todayKst()

  return (
    <>
      <PageHeader
        title="수업 점검"
        description="하루 동안 선생님들이 어떤 게임을 몇 명과 했는지, 기록이 제대로 남았는지, 화면 오류가 있었는지 돌아봅니다. 날짜는 한국 시간 기준입니다."
        updatedAt={data?.timestamp}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
              <Button size="sm" variant="ghost" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="전날">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={date}
                max={todayKst()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="h-8 rounded border-0 bg-transparent px-1 text-sm text-slate-800 focus:outline-none"
              />
              <span className="pr-1 text-xs text-slate-500">({weekdayLabel(date)})</span>
              <Button size="sm" variant="ghost" onClick={() => setDate((d) => shiftDate(d, 1))} disabled={isToday} aria-label="다음날">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {!isToday && (
              <Button size="sm" variant="outline" className="bg-white" onClick={() => setDate(todayKst())}>오늘</Button>
            )}
            <RefreshButton onClick={() => load(date)} loading={loading} />
          </>
        }
      />
      {error && <Banner tone="error" action={<RefreshButton onClick={() => load(date)} loading={loading} label="다시 시도" />}>{error}</Banner>}

      <StatGrid columns={6}>
        <StatCard label="만든 방" value={formatNumber(data?.summary.rooms)} icon={<Gamepad2 className="h-4 w-4" />} hint={data ? `시작한 방 ${formatNumber(data.summary.startedRooms)}개` : undefined} loading={skeleton} />
        <StatCard label="들어온 학생" value={formatNumber(data?.summary.students)} icon={<Users className="h-4 w-4" />} hint="방마다 따로 센 수" loading={skeleton} />
        <StatCard label="수업한 선생님" value={formatNumber(data?.summary.teachers)} icon={<Users className="h-4 w-4" />} tone="info" hint={data ? `로그인 없이 만든 방 ${formatNumber(data.summary.anonymousRooms)}개` : undefined} loading={skeleton} />
        <StatCard label="AI 문제 생성" value={formatNumber(data?.summary.aiGenerations)} icon={<Wand2 className="h-4 w-4" />} hint={data ? `${formatNumber(data.summary.aiQuestions)}문제` : undefined} loading={skeleton} />
        <StatCard label="살펴볼 방" value={formatNumber(data?.summary.flaggedRooms)} icon={<AlertTriangle className="h-4 w-4" />} tone={(data?.summary.flaggedRooms ?? 0) > 0 ? 'warning' : 'success'} hint="기록 누락·시작 안 함 등" loading={skeleton} />
        <StatCard label="화면 오류" value={data && !data.errorsAvailable ? '—' : formatNumber(data?.summary.errorEvents)} icon={<Bug className="h-4 w-4" />} tone={(data?.summary.errorEvents ?? 0) > 0 ? 'danger' : 'success'} hint={data ? data.errorsAvailable ? `${formatNumber(data.summary.errorGroups)}종류` : '오류 표가 아직 없음' : undefined} loading={skeleton} />
      </StatGrid>

      {data && data.byMode.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {data.byMode.map((m) => (
            <Pill key={m.mode} tone="slate">
              {getGameModeConfig(m.mode).id === m.mode ? getGameModeConfig(m.mode).label : m.mode} {m.rooms}방 · {m.students}명
            </Pill>
          ))}
        </div>
      )}

      <Panel
        title="화면 오류"
        description={data?.errorsAvailable === false
          ? 'sql/20261020_client_error_logs.sql 을 아직 실행하지 않아 오류가 쌓이지 않습니다.'
          : '학생·선생님 브라우저에서 잡힌 오류입니다. 같은 문구끼리 묶었습니다.'}
        padded={false}
      >
        {data && data.errors.length === 0 ? (
          <div className="p-5">
            <EmptyState title={data.errorsAvailable ? '이 날 기록된 화면 오류가 없습니다.' : '오류 표가 아직 없습니다.'} icon={<Bug className="h-5 w-5" />} />
          </div>
        ) : (
          <DataTable<ErrorGroup>
            rows={data?.errors ?? []}
            rowKey={(g) => g.key}
            loading={skeleton}
            onRowClick={(g) => setOpenError((cur) => (cur === g.key ? null : g.key))}
            expanded={(g) => (openError === g.key ? (
              <div className="space-y-2 text-xs text-slate-600">
                {g.stack && <pre className="max-h-64 overflow-auto rounded bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">{g.stack}</pre>}
                {g.userAgents.length > 0 && <div><span className="font-medium text-slate-500">브라우저</span> {g.userAgents.join(' / ')}</div>}
                {g.roomCodes.length > 0 && <div><span className="font-medium text-slate-500">방</span> {g.roomCodes.join(', ')}</div>}
              </div>
            ) : null)}
            columns={[
              { key: 'count', header: '횟수', align: 'right', width: '5rem', render: (g) => <span className="tabular-nums font-semibold text-rose-600">{g.count}</span> },
              {
                key: 'message', header: '오류', render: (g) => (
                  <div className="min-w-0">
                    <div className="line-clamp-2 break-all font-medium text-slate-900">{g.message}</div>
                    <div className="truncate text-xs text-slate-500">{ERROR_KIND[g.kind] ?? g.kind}{g.path ? ` · ${g.path}` : ''}</div>
                  </div>
                ),
              },
              { key: 'who', header: '누가', width: '12rem', render: (g) => <span className="text-xs text-slate-600">{g.who.length > 0 ? g.who.join(', ') : '—'}</span> },
              { key: 'when', header: '시각', width: '8rem', render: (g) => <span className="text-xs tabular-nums text-slate-600">{timeKst(g.firstAt)}{g.count > 1 ? ` ~ ${timeKst(g.lastAt)}` : ''}</span> },
            ]}
          />
        )}
      </Panel>

      <Panel padded={false} title="게임 방" description="방마다 학생 수, 풀이 기록이 남은 학생 수, 게임 기록 저장 여부를 봅니다.">
        <div className="border-b border-slate-100 px-5 py-3">
          <Toolbar>
            <FilterChips<RoomFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: '전체', count: counts.all },
                { value: 'flagged', label: '살펴볼 방', count: counts.flagged },
                { value: 'class', label: '5명 이상', count: counts.class },
                { value: 'started', label: '시작한 방', count: counts.started },
              ]}
            />
          </Toolbar>
        </div>
        <DataTable<DailyCheckRoom>
          rows={rooms}
          rowKey={(r) => r.roomCode}
          loading={skeleton}
          empty="이 날 만든 방이 없습니다."
          rowClassName={(r) => (r.flags.length > 0 ? 'bg-amber-50/60' : undefined)}
          columns={[
            { key: 'time', header: '시각', width: '5rem', render: (r) => <span className="tabular-nums text-slate-700">{timeKst(r.createdAt)}</span> },
            {
              key: 'room', header: '방', render: (r) => {
                const mode = r.gameMode ? getGameModeConfig(r.gameMode) : null
                return (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/teacher/report/${r.roomCode}`} target="_blank" className="font-mono text-sm font-semibold tracking-wider text-slate-900 hover:underline">{r.roomCode}</Link>
                      <span className="text-xs text-slate-600">{mode?.label ?? r.gameMode ?? '모드 없음'}</span>
                      {r.isHomework && <Pill tone="indigo">과제</Pill>}
                    </div>
                    <div className="truncate text-xs text-slate-500">{r.setTitle ?? '문제집 없음'}</div>
                  </div>
                )
              },
            },
            { key: 'owner', header: '선생님', width: '10rem', render: (r) => <span className="text-xs text-slate-700">{r.ownerName ?? <span className="text-slate-400">로그인 없음</span>}</span> },
            {
              key: 'players', header: '학생', align: 'right', width: '7rem', render: (r) => (
                <div className="text-xs tabular-nums">
                  <div className="text-sm font-medium text-slate-900">{r.playerCount}명</div>
                  {r.playerCount > 0 && r.startedAt && <div className="text-slate-500">풀이 기록 {r.answeredCount}명</div>}
                </div>
              ),
            },
            {
              key: 'state', header: '상태', width: '9rem', render: (r) => (
                <div className="flex flex-wrap gap-1">
                  {!r.startedAt ? <Pill tone="slate">시작 안 함</Pill> : r.status === 'playing' || r.status === 'paused' ? <Pill tone="emerald" dot>진행 중</Pill> : <Pill tone="sky">끝남</Pill>}
                  {r.startedAt && (r.reportSaved ? <Pill tone="emerald">기록 저장</Pill> : <Pill tone="amber">기록 없음</Pill>)}
                </div>
              ),
            },
            {
              key: 'flags', header: '살펴볼 점', render: (r) => r.flags.length === 0
                ? <span className="text-xs text-slate-300">—</span>
                : <ul className="space-y-0.5 text-xs text-amber-800">{r.flags.map((f) => <li key={f}>· {f}</li>)}</ul>,
            },
          ]}
        />
      </Panel>

      <Panel title="AI 문제 생성" description={data?.aiAvailable === false ? 'ai_generation_logs 표가 아직 없습니다.' : '이 날 AI 로 문제를 만든 기록입니다.'} padded={false}>
        {data && data.ai.length === 0 ? (
          <div className="p-5"><EmptyState title="이 날 AI 문제 생성이 없습니다." icon={<Sparkles className="h-5 w-5" />} /></div>
        ) : (
          <DataTable<DailyCheck['ai'][number]>
            rows={data?.ai ?? []}
            rowKey={(a, ) => `${a.createdAt}|${a.userName}|${a.questionCount}`}
            loading={skeleton}
            columns={[
              { key: 'time', header: '시각', width: '5rem', render: (a) => <span className="tabular-nums text-slate-700">{timeKst(a.createdAt)}</span> },
              { key: 'who', header: '선생님', render: (a) => <span className="text-sm text-slate-800">{a.userName ?? '—'}</span> },
              { key: 'source', header: '출처', width: '8rem', render: (a) => <Pill tone="violet">{AI_SOURCE[a.sourceType] ?? a.sourceType}</Pill> },
              { key: 'count', header: '문제 수', align: 'right', width: '6rem', render: (a) => <span className="tabular-nums">{a.questionCount}문제</span> },
            ]}
          />
        )}
      </Panel>

      {data && (
        <p className="text-xs text-slate-400">
          {formatDateTime(data.timestamp)} 기준. 방은 만든 시각으로 날짜를 나누므로 자정을 넘긴 수업은 전날에 보입니다.
        </p>
      )}
    </>
  )
}
