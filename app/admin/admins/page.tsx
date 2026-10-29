'use client'

/**
 * 관리자 계정 관리. 목록은 Supabase public.admin_users 표에 있다(sql/20261029_admin_users.sql).
 * 여기서 추가한 계정은 로그인 후 관리자 메뉴가 보이고, 관리자 화면은 2차 비밀번호를 따로 요구한다.
 */
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import {
  Banner,
  Button,
  ConfirmDialog,
  type ConfirmRequest,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  formatDateTime,
  useNotice,
} from '@/components/admin/ui'

interface AdminRow {
  email: string
  note: string | null
  added_by: string | null
  created_at: string
}

interface AdminsResponse {
  available: boolean
  admins: AdminRow[]
  me: string
}

export default function AdminAccountsPage() {
  const [data, setData] = useState<AdminsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const notice = useNotice()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchAdminJson<AdminsResponse>('/api/admin/admins'))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '관리자 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const target = email.trim().toLowerCase()
    if (!target) return
    setBusy(true)
    try {
      await fetchAdminJson('/api/admin/admins', adminJson('POST', { email: target, note }))
      notice.success(`${target} 계정을 관리자로 추가했습니다.`)
      setEmail('')
      setNote('')
      await load()
    } catch (e) {
      notice.error(e instanceof Error ? e.message : '관리자를 추가하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const askRemove = (row: AdminRow) =>
    setConfirm({
      title: '관리자에서 뺍니다',
      destructive: true,
      confirmLabel: '관리자에서 빼기',
      description: <p>{row.email} 계정은 관리자 메뉴와 관리자 화면에 더 이상 들어올 수 없습니다. 교사 계정은 그대로 남습니다.</p>,
      run: async () => {
        try {
          await fetchAdminJson(`/api/admin/admins?email=${encodeURIComponent(row.email)}`, { method: 'DELETE' })
          notice.success(`${row.email} 계정을 관리자에서 뺐습니다.`)
          await load()
        } catch (e) {
          notice.error(e instanceof Error ? e.message : '관리자를 지우지 못했습니다.')
        }
      },
    })

  const available = data?.available ?? true

  return (
    <>
      <PageHeader
        title="관리자 계정"
        description="관리자 목록은 Supabase admin_users 표 한 곳에서 관리합니다."
        actions={<RefreshButton onClick={() => void load()} loading={loading} />}
      />
      {notice.element}
      {error && <Banner tone="error">{error}</Banner>}
      {data && !available && (
        <Banner tone="warning">
          admin_users 표가 아직 없어 예전 목록(환경변수)으로 판단하고 있습니다. Supabase SQL 편집기에서 sql/20261029_admin_users.sql 을 실행하면 이 목록이 기준이 되고, 여기서 추가·삭제할 수 있습니다.
        </Banner>
      )}

      <Panel title="관리자 추가" description="그 이메일로 가입·로그인한 계정이 관리자가 됩니다. 관리자 화면은 2차 비밀번호도 필요합니다.">
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!available || busy}
            required
            className="sm:max-w-xs"
          />
          <Input
            placeholder="메모 (선택)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!available || busy}
            maxLength={200}
            className="sm:flex-1"
          />
          <Button type="submit" disabled={!available || busy || !email.trim()}>
            <UserPlus className="mr-2 h-4 w-4" />
            추가
          </Button>
        </form>
      </Panel>

      <Panel title={`관리자 ${data?.admins.length ?? 0}명`} padded={false}>
        <DataTable
          rows={data?.admins ?? []}
          rowKey={(row) => row.email}
          loading={loading && !data}
          empty={<EmptyState title="관리자가 없습니다" icon={<ShieldCheck className="h-5 w-5" />} />}
          columns={[
            {
              key: 'email',
              header: '이메일',
              render: (row) => (
                <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                  {row.email}
                  {row.email === data?.me && <Pill tone="sky">나</Pill>}
                </span>
              ),
            },
            { key: 'note', header: '메모', render: (row) => <span className="text-slate-600">{row.note ?? '-'}</span> },
            { key: 'added_by', header: '추가한 사람', render: (row) => <span className="text-slate-500">{row.added_by ?? '-'}</span> },
            { key: 'created_at', header: '추가한 날', render: (row) => (row.created_at ? formatDateTime(row.created_at) : '-') },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (row) =>
                available && row.email !== data?.me ? (
                  <Button variant="outline" size="sm" onClick={() => askRemove(row)}>
                    관리자에서 빼기
                  </Button>
                ) : null,
            },
          ]}
        />
      </Panel>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
