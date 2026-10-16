'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { cn } from '@/lib/utils'
import { Button, ConfirmDialog, type ConfirmRequest, DataTable, FIELD, Panel, Pill, formatDate, useNotice } from '@/components/admin/ui'

/**
 * 요금제 미리 적용. 아직 가입하지 않은 이메일에 프로 기간을 걸어 두면, 그 이메일로 가입한 때부터 시작한다
 * (DB 트리거 apply_pending_plan_grant, sql/20261016_pending_plan_grants.sql).
 * 납품 목록을 통째로 붙여 넣으면 이메일만 뽑아 한꺼번에 등록하고, 이미 가입한 계정에는 바로 적용한다.
 */

const TRIAL_DAYS = 14

interface Grant {
  email: string
  months: number
  bonusDays: number
  note: string | null
  createdAt: string
  appliedAt: string | null
  appliedUserId: string | null
  status: 'waiting' | 'claimed' | 'unapplied'
}

interface Draft {
  emailsText: string
  months: string
  /** 체험 14일을 개월 수 앞에 더한다(단체 구매 기본). */
  withTrial: boolean
  applyExisting: boolean
  note: string
}

type Outcome = { email: string; result: 'waiting' | 'applied' | 'skipped'; message?: string }

interface BulkResult {
  outcomes: Outcome[]
  duplicates: number
}

const MONTH_PRESETS = [1, 3, 6, 12] as const
const emptyDraft = (): Draft => ({ emailsText: '', months: '12', withTrial: true, applyExisting: true, note: '' })

function periodLabel(g: { months: number; bonusDays?: number }) {
  return g.bonusDays ? `${g.months}개월 + ${g.bonusDays}일` : `${g.months}개월`
}

/** 붙여 넣은 글에 든 이메일 수(화면 미리보기용. 실제 추출·검사는 서버가 한다). */
function countEmails(text: string): number {
  const found = text.match(/[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+/g) ?? []
  return new Set(found.map((e) => e.toLowerCase())).size
}

export function PlanGrantsPanel({ onApplied }: { onApplied?: () => void }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<BulkResult | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const notice = useNotice()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAdminJson<{ grants: Grant[] }>('/api/admin/plan-grants')
      setGrants(data.grants)
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    setSaving(true)
    try {
      const result = await fetchAdminJson<BulkResult>('/api/admin/plan-grants', adminJson('POST', {
        emailsText: draft.emailsText,
        months: Number(draft.months),
        bonusDays: draft.withTrial ? TRIAL_DAYS : 0,
        applyExisting: draft.applyExisting,
        note: draft.note.trim() || undefined,
      }))
      setLastResult(result)
      const waiting = result.outcomes.filter((o) => o.result === 'waiting').length
      const applied = result.outcomes.filter((o) => o.result === 'applied').length
      const skipped = result.outcomes.length - waiting - applied
      notice.success(`가입 대기 ${waiting}건, 바로 적용 ${applied}건${skipped ? `, 건너뜀 ${skipped}건` : ''}`)
      if (!skipped) setDraft((d) => ({ ...emptyDraft(), months: d.months, withTrial: d.withTrial, note: d.note }))
      await load()
      if (applied) onApplied?.()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const askCancel = (g: Grant) =>
    setConfirm({
      title: '미리 적용을 취소합니다',
      destructive: true,
      confirmLabel: '등록 취소',
      description: (
        <p>
          <span className="font-medium text-slate-900">{g.email}</span>에 걸어 둔 프로 {periodLabel(g)}을 지웁니다.{' '}
          {g.status === 'unapplied' ? '이미 가입한 계정입니다. 등록만 지우고 지금 요금제는 바꾸지 않습니다.' : '이 이메일로 가입해도 프로가 붙지 않습니다.'}
        </p>
      ),
      run: async () => {
        await fetchAdminJson(`/api/admin/plan-grants?email=${encodeURIComponent(g.email)}`, { method: 'DELETE' })
        notice.success(`${g.email} 등록을 취소했습니다.`)
        await load()
      },
    })

  const askApply = (g: Grant) =>
    setConfirm({
      title: '지금 적용합니다',
      confirmLabel: '지금 적용',
      description: (
        <>
          <p><span className="font-medium text-slate-900">{g.email}</span> 계정에 프로 {periodLabel(g)}을 오늘부터 적용합니다. 프로가 남아 있으면 그 뒤에 잇습니다.</p>
          <p className="mt-2 text-xs text-slate-500">자동으로 적용되지 않은 이유: 등록보다 가입이 먼저였습니다. 계정 주인이 맞는지 확인한 뒤 적용합니다.</p>
        </>
      ),
      run: async () => {
        await fetchAdminJson('/api/admin/plan-grants', adminJson('PATCH', { email: g.email, action: 'apply' }))
        notice.success(`${g.email} 계정에 적용했습니다.`)
        await load()
        onApplied?.()
      },
    })

  const waiting = grants.filter((g) => g.status !== 'claimed').length

  return (
    <Panel
      title={`요금제 미리 적용${waiting ? ` · 대기 ${waiting}` : ''}`}
      description="아직 가입하지 않은 이메일에 프로를 걸어 둡니다. 그 이메일로 가입(이메일 가입·구글 로그인 모두)하면 가입한 날부터 기간이 시작됩니다. 등록보다 가입이 먼저였던 계정은 미적용으로 남아 직접 적용합니다."
    >
      {notice.element}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="col-span-2 row-span-2 text-xs text-slate-600">
          이메일(여러 개면 줄바꿈·쉼표로. 납품 목록을 통째로 붙여도 이메일만 뽑습니다)
          <textarea
            value={draft.emailsText}
            onChange={(e) => setDraft({ ...draft, emailsText: e.target.value })}
            placeholder={'teacher1@school.es.kr\nteacher2@school.es.kr'}
            rows={5}
            autoComplete="off"
            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
          />
          <span className="mt-1 block text-slate-500">{countEmails(draft.emailsText)}개 이메일</span>
        </label>
        <div className="col-span-2 text-xs text-slate-600">
          <label htmlFor="plan-grant-months">개월 수(가입일부터)</label>
          <div className="mt-1 flex items-center gap-1">
            <input id="plan-grant-months" type="number" min={0} max={60} value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value })} className={cn(FIELD, 'mt-0 w-16')} />
            <div role="group" aria-label="개월 수 빠른 선택" className="flex gap-1">
              {MONTH_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-label={`${m}개월`}
                  aria-pressed={draft.months === String(m)}
                  onClick={() => setDraft({ ...draft, months: String(m) })}
                  className={cn('h-9 rounded-md border px-2 text-xs', draft.months === String(m) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <label className="col-span-2 text-xs text-slate-600">
          메모
          <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={200} placeholder="예: 교동초등학교 2026-10-16 주문" className={FIELD} />
        </label>
        <div className="col-span-2 flex flex-col justify-center gap-1.5 text-sm text-slate-700 md:col-span-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.withTrial} onChange={(e) => setDraft({ ...draft, withTrial: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            무료 체험 {TRIAL_DAYS}일도 더하기(가입일 + {TRIAL_DAYS}일 + 개월 수)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={draft.applyExisting} onChange={(e) => setDraft({ ...draft, applyExisting: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            이미 가입한 계정에는 오늘부터 바로 적용
          </label>
        </div>
        <div className="col-span-2 flex items-end md:col-span-1">
          <Button size="sm" onClick={submit} disabled={saving || countEmails(draft.emailsText) === 0} className="h-9 w-full">
            {saving ? '등록 중…' : '미리 적용'}
          </Button>
        </div>
      </div>

      {lastResult && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <div className="font-medium text-slate-900">
            가입 대기 {lastResult.outcomes.filter((o) => o.result === 'waiting').length}건 · 바로 적용 {lastResult.outcomes.filter((o) => o.result === 'applied').length}건
            {lastResult.duplicates > 0 && ` · 겹친 이메일 ${lastResult.duplicates}건 한 번만 등록`}
          </div>
          {lastResult.outcomes.some((o) => o.result === 'skipped') && (
            <ul className="mt-2 space-y-0.5 text-rose-700">
              {lastResult.outcomes.map((o) => (o.result === 'skipped' ? <li key={o.email}>{o.email}: {o.message}</li> : null))}
            </ul>
          )}
        </div>
      )}

      <div className="-mx-5 mt-5 border-t border-slate-100">
        <DataTable<Grant>
          rows={grants}
          rowKey={(g) => g.email}
          loading={loading}
          empty="걸어 둔 요금제가 없습니다."
          columns={[
            { key: 'email', header: '이메일', render: (g) => <span className="font-medium text-slate-900">{g.email}</span> },
            { key: 'plan', header: '요금제', render: (g) => `프로 ${periodLabel(g)}` },
            {
              key: 'status',
              header: '상태',
              render: (g) =>
                g.status === 'claimed' ? (
                  <Pill tone="emerald">{formatDate(g.appliedAt)} 적용</Pill>
                ) : g.status === 'unapplied' ? (
                  <Pill tone="amber">가입함 · 미적용</Pill>
                ) : (
                  <Pill tone="sky">가입 대기</Pill>
                ),
            },
            { key: 'note', header: '메모', render: (g) => <span className="text-xs text-slate-600">{g.note || '-'}</span> },
            { key: 'created', header: '등록', render: (g) => <span className="text-xs text-slate-500">{formatDate(g.createdAt)}</span> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (g) =>
                g.status === 'claimed' ? null : (
                  <div className="flex justify-end gap-1">
                    {g.status === 'unapplied' && (
                      <Button size="sm" variant="outline" onClick={() => askApply(g)}>지금 적용</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => askCancel(g)}>취소</Button>
                  </div>
                ),
            },
          ]}
        />
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Panel>
  )
}
