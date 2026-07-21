'use client'

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Loader2, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminEmail } from '@/lib/admin/admins'
import { fetchAdmin } from '@/lib/admin/fetchAdmin'

type State = 'checking' | 'need-login' | 'not-admin' | 'need-password' | 'ok'

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<State>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      setError('')
      const res = await fetchAdmin('/api/admin/auth')
      const data = await res.json().catch(() => ({}))
      if (data.authenticated) {
        setState('ok')
      } else {
        setState('need-password')
      }
    } catch {
      setState('need-password')
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!user) {
      setState('need-login')
      return
    }
    if (!isAdminEmail(user.email)) {
      setState('not-admin')
      return
    }
    checkAuth()
  }, [loading, user, checkAuth])

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetchAdmin('/api/admin/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.authenticated || data.success) {
        setPassword('')
        setState('ok')
        return
      }
      setError(data.error || '인증에 실패했습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '인증 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || state === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (state === 'need-login') {
    return (
      <CenteredCard
        icon={<Lock className="h-7 w-7 text-slate-400" />}
        title="로그인이 필요합니다"
        desc="관리자 계정으로 로그인한 뒤 다시 접근해주세요."
        action={
          <button
            onClick={() => router.push('/login?redirect=/admin')}
            className="mt-4 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            로그인하러 가기
          </button>
        }
      />
    )
  }

  if (state === 'not-admin') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-7 w-7 text-red-500" />}
        title="관리자 권한이 없습니다"
        desc="이 페이지는 관리자 전용입니다."
        action={
          <button
            onClick={() => router.push('/teacher')}
            className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            대시보드로 돌아가기
          </button>
        }
      />
    )
  }

  if (state === 'need-password') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa] px-4">
        <form
          onSubmit={submitPassword}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Lock className="h-6 w-6 text-slate-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">관리자 2차 인증</h1>
            <p className="mt-1 text-sm text-slate-500">관리자 비밀번호를 입력하세요.</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="비밀번호"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : '인증하기'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}

function CenteredCard({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode
  title: string
  desc: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa] px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          {icon}
        </div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
        {action}
      </div>
    </div>
  )
}
