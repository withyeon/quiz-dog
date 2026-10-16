'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CalendarClock, ChevronDown, ChevronUp, Copy, UserPlus, Users } from 'lucide-react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { cn } from '@/lib/utils'
import { PlanGrantsPanel } from '@/components/admin/users/PlanGrantsPanel'
import {
  Banner,
  Button,
  DataTable,
  FIELD,
  FilterChips,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  SearchInput,
  StatCard,
  StatGrid,
  Toolbar,
  formatDate,
  formatNumber,
  useNotice,
} from '@/components/admin/ui'

interface Teacher {
  id: string
  email: string
  name: string | null
  provider: string
  createdAt: string
  lastSignInAt: string | null
  setCount: number
  plan: 'free' | 'pro'
  proUntil: string | null
}

type PlanFilter = 'all' | 'pro' | 'free'
type SortKey = 'recent' | 'active' | 'sets' | 'expire'

const PROVIDER_LABEL: Record<string, string> = { email: '이메일', google: '구글' }
const PLAN_LABEL: Record<string, string> = { pro: '프로', free: '무료' }
const PLAN_TONE: Record<string, 'violet' | 'slate'> = { pro: 'violet', free: 'slate' }
const MONTH_PRESETS = [1, 3, 6, 12] as const
const TRIAL_DAYS = 14

/** 계정 생성 폼. 기간은 개월 수로 정하거나 만료일을 직접 적는다. */
interface CreateDraft {
  email: string
  displayName: string
  password: string
  plan: 'free' | 'pro'
  startAt: string
  durationMode: 'months' | 'expire'
  months: string
  withTrial: boolean
  proUntil: string
}

interface CreateResult {
  email: string
  displayName: string | null
  plan: string
  proUntil: string | null
  password: string
  generatedPassword: boolean
}

function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

function emptyCreateDraft(): CreateDraft {
  return { email: '', displayName: '', password: '', plan: 'pro', startAt: todayKst(), durationMode: 'months', months: '12', withTrial: true, proUntil: '' }
}

/** ISO → 날짜 입력값(KST 날짜). 만료 시각이 KST 0시면 그 전날이 마지막 사용일이라 하루를 뺀다. */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const kst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {})
  const date = new Date(`${kst.year}-${kst.month}-${kst.day}T00:00:00+09:00`)
  if (kst.hour === '00' || kst.hour === '24') date.setDate(date.getDate() - 1)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date)
}

/** 날짜 입력값(마지막 사용일) → 그 다음날 KST 0시 ISO. */
function fromDateInput(value: string): string | null {
  if (!value) return null
  const d = new Date(`${value}T00:00:00+09:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

/** 만료 시각(ISO)을 "~ 2027년 10월 29일"처럼 마지막 사용일로 보여 준다. */
function lastUsableDate(iso: string | null): string {
  const v = toDateInput(iso)
  return v ? formatDate(`${v}T12:00:00+09:00`) : '-'
}

export default function AdminUsersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PlanFilter>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [openId, setOpenId] = useState<string | null>(null)
  const [draftUntil, setDraftUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [grantsOpen, setGrantsOpen] = useState(false)
  const [create, setCreate] = useState<CreateDraft>(emptyCreateDraft)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreateResult | null>(null)
  const notice = useNotice()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminJson<{ teachers: Teacher[]; timestamp: string }>('/api/admin/users')
      setTeachers(data.teachers)
      setUpdatedAt(data.timestamp)
    } catch (e) {
      setError(e instanceof Error ? e.message : '교사 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const counts = useMemo(
    () => ({
      all: teachers.length,
      pro: teachers.filter((t) => t.plan === 'pro').length,
      free: teachers.filter((t) => t.plan === 'free').length,
      sets: teachers.reduce((sum, t) => sum + t.setCount, 0),
    }),
    [teachers],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = teachers.filter((t) => {
      if (filter !== 'all' && t.plan !== filter) return false
      if (!q) return true
      return t.email.toLowerCase().includes(q) || (t.name ?? '').toLowerCase().includes(q)
    })
    const time = (v?: string | null) => (v ? new Date(v).getTime() : 0)
    return list.sort((a, b) => {
      if (sort === 'active') return time(b.lastSignInAt) - time(a.lastSignInAt)
      if (sort === 'sets') return b.setCount - a.setCount
      if (sort === 'expire') return (a.plan === 'pro' ? time(a.proUntil) : Infinity) - (b.plan === 'pro' ? time(b.proUntil) : Infinity)
      return time(b.createdAt) - time(a.createdAt)
    })
  }, [teachers, search, filter, sort])

  const toggleEdit = (t: Teacher) => {
    if (openId === t.id) {
      setOpenId(null)
      return
    }
    setOpenId(t.id)
    setDraftUntil(toDateInput(t.proUntil))
  }

  const save = async (t: Teacher) => {
    setSaving(true)
    try {
      await fetchAdminJson('/api/admin/users', adminJson('PATCH', { id: t.id, proUntil: fromDateInput(draftUntil) }))
      notice.success(`${t.email} 요금제를 저장했습니다.`)
      setOpenId(null)
      await load()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const addMonths = (months: number) => {
    const base = draftUntil ? new Date(`${draftUntil}T00:00:00+09:00`) : new Date()
    const from = base.getTime() > Date.now() ? base : new Date()
    from.setMonth(from.getMonth() + months)
    setDraftUntil(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(from))
  }

  const submitCreate = async () => {
    const email = create.email.trim().toLowerCase()
    if (!email) {
      notice.error('이메일을 입력해야 합니다.')
      return
    }
    setCreating(true)
    try {
      const result = await fetchAdminJson<CreateResult>('/api/admin/users', adminJson('POST', {
        email,
        displayName: create.displayName.trim() || undefined,
        password: create.password || undefined,
        plan: create.plan,
        startAt: create.startAt || undefined,
        ...(create.plan === 'pro'
          ? create.durationMode === 'months'
            ? { months: Number(create.months), bonusDays: create.withTrial ? TRIAL_DAYS : 0 }
            : { proUntil: create.proUntil || undefined }
          : {}),
      }))
      setCreated(result)
      setCreate(emptyCreateDraft())
      notice.success(`${result.email} 계정을 만들었습니다.`)
      await load()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '계정을 만들지 못했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const copyCreated = async () => {
    if (!created) return
    const lines = [`아이디: ${created.email}`, `비밀번호: ${created.password}`]
    if (created.proUntil) lines.push(`퀴즈독 프로: ~ ${lastUsableDate(created.proUntil)}`)
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      notice.info('계정 정보를 복사했습니다.')
    } catch {
      notice.error('복사하지 못했습니다. 직접 선택해 복사합니다.')
    }
  }

  return (
    <>
      <PageHeader
        title="교사 관리"
        description="교사 계정, 프로 기간, 가입 전 요금제 예약을 관리합니다."
        updatedAt={updatedAt}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setGrantsOpen((v) => !v)} className={cn(grantsOpen && 'bg-slate-100')}>
              <CalendarClock className="mr-1 h-3.5 w-3.5" />
              {grantsOpen ? '미리 적용 닫기' : '요금제 미리 적용'}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen((v) => !v)} className={cn(createOpen && 'bg-slate-700')}>
              <UserPlus className="mr-1 h-3.5 w-3.5" />
              {createOpen ? '계정 만들기 닫기' : '계정 만들기'}
            </Button>
            <RefreshButton onClick={load} loading={loading} />
          </>
        }
      />
      {notice.element}
      {error && <Banner tone="error" action={<RefreshButton onClick={load} loading={loading} label="다시 시도" />}>{error}</Banner>}

      {grantsOpen && <PlanGrantsPanel onApplied={load} />}

      {createOpen && (
        <Panel title="계정 만들기" description="납품 때 웹메일 계정을 미리 만들어 전달합니다. 이메일 인증은 건너뛰고 바로 로그인할 수 있습니다. 비밀번호를 비우면 임의로 만들어 한 번만 보여 줍니다.">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="col-span-2 text-xs text-slate-600">
              이메일
              <input value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} placeholder="예: gyodong@hyeonedu.com" autoComplete="off" className={FIELD} />
            </label>
            <label className="text-xs text-slate-600">
              표시 이름
              <input value={create.displayName} onChange={(e) => setCreate({ ...create, displayName: e.target.value })} placeholder="비우면 아이디를 씁니다" maxLength={20} className={FIELD} />
            </label>
            <label className="text-xs text-slate-600">
              비밀번호
              <input value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} placeholder="비우면 자동 생성" autoComplete="new-password" className={cn(FIELD, 'font-mono')} />
            </label>
            <label className="text-xs text-slate-600">
              요금제
              <select value={create.plan} onChange={(e) => setCreate({ ...create, plan: e.target.value as CreateDraft['plan'] })} className={FIELD}>
                <option value="pro">프로</option>
                <option value="free">무료</option>
              </select>
            </label>
            {create.plan === 'pro' && (
              <>
                <label className="text-xs text-slate-600">
                  시작일
                  <input type="date" value={create.startAt} onChange={(e) => setCreate({ ...create, startAt: e.target.value })} className={FIELD} />
                </label>
                <label className="text-xs text-slate-600">
                  기간 방식
                  <select value={create.durationMode} onChange={(e) => setCreate({ ...create, durationMode: e.target.value as CreateDraft['durationMode'] })} className={FIELD}>
                    <option value="months">개월 수</option>
                    <option value="expire">만료일 직접 입력</option>
                  </select>
                </label>
                {create.durationMode === 'months' ? (
                  <div className="text-xs text-slate-600">
                    개월 수
                    <div className="mt-1 flex items-center gap-1">
                      <input type="number" min={0} max={60} value={create.months} onChange={(e) => setCreate({ ...create, months: e.target.value })} className={cn(FIELD, 'mt-0 w-16')} />
                      <div className="flex gap-1">
                        {MONTH_PRESETS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCreate({ ...create, months: String(m) })}
                            className={cn('h-9 rounded-md border px-2 text-xs', create.months === String(m) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="text-xs text-slate-600">
                    마지막 사용일
                    <input type="date" value={create.proUntil} onChange={(e) => setCreate({ ...create, proUntil: e.target.value })} className={FIELD} />
                  </label>
                )}
                {create.durationMode === 'months' && (
                  <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700 md:col-span-4">
                    <input type="checkbox" checked={create.withTrial} onChange={(e) => setCreate({ ...create, withTrial: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    무료 체험 {TRIAL_DAYS}일도 더하기(시작일 + {TRIAL_DAYS}일 + 개월 수)
                  </label>
                )}
              </>
            )}
            <div className="col-span-2 flex items-center gap-2 md:col-span-4">
              <Button size="sm" onClick={submitCreate} disabled={creating}>{creating ? '만드는 중…' : '계정 만들기'}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setCreate(emptyCreateDraft()); setCreated(null) }} disabled={creating}>초기화</Button>
              <span className="text-xs text-slate-500">같은 이메일에 걸어 둔 예약이 있으면 여기서 정한 기간이 우선이고, 예약은 적용됨으로 표시됩니다.</span>
            </div>
          </div>
          {created && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">계정을 만들었습니다. 아래 정보를 전달하세요. 비밀번호는 다시 볼 수 없습니다.</div>
                <Button size="sm" variant="outline" onClick={copyCreated} className="bg-white"><Copy className="mr-1 h-3.5 w-3.5" />복사</Button>
              </div>
              <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-emerald-700">이메일</dt>
                <dd className="font-mono text-emerald-900">{created.email}</dd>
                <dt className="text-emerald-700">비밀번호</dt>
                <dd className="font-mono text-emerald-900">{created.password}{created.generatedPassword && <span className="ml-2 font-sans text-emerald-700">(자동 생성)</span>}</dd>
                <dt className="text-emerald-700">요금제</dt>
                <dd>{PLAN_LABEL[created.plan] ?? created.plan}{created.proUntil && ` · ~ ${lastUsableDate(created.proUntil)}`}</dd>
              </dl>
            </div>
          )}
        </Panel>
      )}

      <StatGrid columns={4}>
        <StatCard label="총 교사" value={formatNumber(counts.all)} icon={<Users className="h-4 w-4" />} loading={loading && teachers.length === 0} />
        <StatCard label="프로" value={formatNumber(counts.pro)} icon={<BadgeCheck className="h-4 w-4" />} tone="info" loading={loading && teachers.length === 0} />
        <StatCard label="무료" value={formatNumber(counts.free)} loading={loading && teachers.length === 0} />
        <StatCard label="문제 세트" value={formatNumber(counts.sets)} hint="모든 교사의 합" loading={loading && teachers.length === 0} />
      </StatGrid>

      <Panel padded={false}>
        <div className="border-b border-slate-100 px-5 py-3">
          <Toolbar>
            <FilterChips<PlanFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: '전체', count: counts.all },
                { value: 'pro', label: '프로', count: counts.pro },
                { value: 'free', label: '무료', count: counts.free },
              ]}
            />
            <div className="flex items-center gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700" aria-label="정렬">
                <option value="recent">가입 최신순</option>
                <option value="active">최근 로그인순</option>
                <option value="sets">문제 세트 많은 순</option>
                <option value="expire">만료 임박순</option>
              </select>
              <SearchInput value={search} onChange={setSearch} placeholder="이메일 또는 이름" className="w-full md:w-72" />
            </div>
          </Toolbar>
        </div>
        <DataTable<Teacher>
          rows={rows}
          rowKey={(t) => t.id}
          loading={loading}
          empty={search ? '검색 결과가 없습니다.' : '등록된 교사가 없습니다.'}
          rowClassName={(t) => (openId === t.id ? 'bg-slate-50' : undefined)}
          columns={[
            {
              key: 'teacher',
              header: '교사',
              render: (t) => (
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{t.email}</div>
                  <div className="text-xs text-slate-500">{t.name || '이름 없음'} · {PROVIDER_LABEL[t.provider] ?? t.provider} · 가입 {formatDate(t.createdAt)}</div>
                </div>
              ),
            },
            {
              key: 'plan',
              header: '요금제',
              render: (t) => (
                <div className="space-y-0.5">
                  <Pill tone={PLAN_TONE[t.plan] ?? 'slate'}>{PLAN_LABEL[t.plan] ?? t.plan}</Pill>
                  {t.plan === 'pro' && <div className="text-xs text-slate-500">~ {lastUsableDate(t.proUntil)}</div>}
                  {t.plan === 'free' && t.proUntil && <div className="text-xs text-slate-400">{lastUsableDate(t.proUntil)} 만료됨</div>}
                </div>
              ),
            },
            { key: 'sets', header: '문제 세트', align: 'right', width: '7rem', render: (t) => <span className="tabular-nums text-slate-800">{formatNumber(t.setCount)}</span> },
            { key: 'last', header: '최근 로그인', width: '10rem', render: (t) => <span className="text-xs text-slate-600">{t.lastSignInAt ? formatDate(t.lastSignInAt) : '-'}</span> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              width: '6rem',
              render: (t) => (
                <Button size="sm" variant="outline" onClick={() => toggleEdit(t)} className="bg-white">
                  {openId === t.id ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                  {openId === t.id ? '닫기' : '편집'}
                </Button>
              ),
            },
          ]}
          expanded={(t) =>
            openId === t.id ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_18rem]">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label className="col-span-2 text-xs text-slate-600">
                    프로 마지막 사용일(비우면 무료)
                    <input type="date" value={draftUntil} onChange={(e) => setDraftUntil(e.target.value)} className={FIELD} />
                  </label>
                  <div className="col-span-2 text-xs text-slate-600">
                    기간 더하기
                    <div className="mt-1 flex flex-wrap gap-1">
                      {MONTH_PRESETS.map((m) => (
                        <button key={m} type="button" onClick={() => addMonths(m)} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50">
                          +{m}개월
                        </button>
                      ))}
                      <button type="button" onClick={() => setDraftUntil('')} className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-rose-600 hover:bg-rose-50">
                        무료로
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 md:col-span-4">
                    <Button size="sm" onClick={() => save(t)} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleEdit(t)} disabled={saving}>취소</Button>
                    <span className="text-xs text-slate-500">프로가 남아 있으면 더하기는 그 뒤에 잇습니다.</span>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 lg:grid-cols-1">
                  <dt className="text-slate-400">계정 ID</dt>
                  <dd className="font-mono text-[11px]">{t.id}</dd>
                  <dt className="text-slate-400">가입</dt>
                  <dd>{formatDate(t.createdAt)} · {PROVIDER_LABEL[t.provider] ?? t.provider}</dd>
                  <dt className="text-slate-400">최근 로그인</dt>
                  <dd>{t.lastSignInAt ? formatDate(t.lastSignInAt) : '-'}</dd>
                  <dt className="text-slate-400">프로 만료 시각</dt>
                  <dd>{t.proUntil ? new Date(t.proUntil).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-'}</dd>
                </dl>
              </div>
            ) : null
          }
        />
      </Panel>
    </>
  )
}
