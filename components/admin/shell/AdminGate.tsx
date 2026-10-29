'use client'

import { createContext, type FormEvent, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { checkIsAdmin } from '@/lib/admin/useIsAdmin'
import { ADMIN_RELOCK_EVENT, adminJson, fetchAdminJson } from '@/lib/admin/fetchAdmin'
import { Button, Input } from '@/components/admin/ui'

interface AdminSessionContextValue {
  email: string
  expiresAt: string | null
  /** 2차 인증을 풀고 비밀번호 입력으로 돌아간다(서버 쿠키도 폐기). */
  endSession: () => Promise<void>
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null)

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext)
  if (!ctx) throw new Error('useAdminSession은 AdminGate 안에서만 쓸 수 있습니다.')
  return ctx
}

type State = 'checking' | 'need-login' | 'not-admin' | 'need-password' | 'ok'

/**
 * 관리자 관문. 퀴즈독은 브라우저 세션(localStorage)이라 서버 레이아웃이 아닌 여기서
 * 로그인 → 관리자 이메일 → 2차 비밀번호 순서로 확인한다. 통과하면 이메일·만료 시각을 컨텍스트로 넘긴다.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<State>('checking')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const checkAuth = useCallback(async () => {
    try {
      setError('')
      const data = await fetchAdminJson<{ authenticated: boolean; expiresAt?: string }>('/api/admin/auth')
      if (data.authenticated) {
        setExpiresAt(data.expiresAt ?? null)
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
    let alive = true
    setState('checking')
    checkIsAdmin(user).then((isAdmin) => {
      if (!alive) return
      if (!isAdmin) setState('not-admin')
      else void checkAuth()
    })
    return () => {
      alive = false
    }
  }, [loading, user, checkAuth])

  // API가 2차 인증 만료 401을 돌려주면 비밀번호 입력으로 되돌린다.
  useEffect(() => {
    const onRelock = () => {
      setState((s) => (s === 'ok' ? 'need-password' : s))
      setExpiresAt(null)
      setError('관리자 인증이 만료되었습니다. 비밀번호를 다시 입력하세요.')
    }
    window.addEventListener(ADMIN_RELOCK_EVENT, onRelock)
    return () => window.removeEventListener(ADMIN_RELOCK_EVENT, onRelock)
  }, [])

  // 만료 시각이 지나면 스스로 잠근다.
  useEffect(() => {
    if (state !== 'ok' || !expiresAt) return
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) {
      setState('need-password')
      return
    }
    const t = setTimeout(() => setState('need-password'), ms)
    return () => clearTimeout(t)
  }, [state, expiresAt])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await fetchAdminJson<{ authenticated: boolean; expiresAt?: string }>('/api/admin/auth', adminJson('POST', { password }))
      if (data.authenticated) {
        setExpiresAt(data.expiresAt ?? null)
        setPassword('')
        setState('ok')
        return
      }
      setError('인증하지 못했습니다.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const endSession = useCallback(async () => {
    try {
      await fetchAdminJson('/api/admin/auth', { method: 'DELETE' })
    } catch {
      // 서버 폐기에 실패해도 화면은 잠근다. 쿠키는 만료 시각에 죽는다.
    }
    setExpiresAt(null)
    setError('')
    setState('need-password')
  }, [])

  if (loading || state === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (state === 'need-login') {
    return (
      <CenteredCard
        icon={<Lock className="h-5 w-5" />}
        title="로그인이 필요합니다"
        desc="관리자 계정으로 로그인한 뒤 다시 접근합니다."
        action={
          <Button onClick={() => router.push('/login?redirect=/admin')} className="mt-6 h-11 w-full">
            로그인하러 가기
          </Button>
        }
      />
    )
  }

  if (state === 'not-admin') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-5 w-5" />}
        title="관리자 권한이 없습니다"
        desc={`${user?.email ?? ''} 계정은 관리자가 아닙니다.`}
        action={
          <Button variant="outline" onClick={() => router.push('/teacher')} className="mt-6 h-11 w-full">
            교사 화면으로 돌아가기
          </Button>
        }
      />
    )
  }

  if (state === 'need-password') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-center text-lg font-semibold text-slate-900">관리자 2차 인증</h1>
            <p className="mt-1 text-center text-sm text-slate-500">
              <span className="font-medium text-slate-700">{user?.email}</span> 계정으로 로그인했습니다. 관리자 비밀번호를 입력합니다.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <Input
                type="password"
                autoComplete="one-time-code"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={64}
                required
                autoFocus
                disabled={busy}
                className="h-11 text-center text-lg tracking-[0.3em]"
              />
              {error && <p className="text-center text-sm text-rose-600" role="alert">{error}</p>}
              <Button type="submit" className="h-11 w-full" disabled={busy || !password}>
                {busy ? '확인 중…' : '인증'}
              </Button>
            </form>
            <p className="mt-4 flex items-center justify-center gap-1 text-xs text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" /> 인증은 24시간 뒤 만료됩니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AdminSessionContext.Provider value={{ email: user?.email ?? '', expiresAt, endSession }}>
      {children}
    </AdminSessionContext.Provider>
  )
}

function CenteredCard({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">{icon}</div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{desc}</p>
        {action}
      </div>
    </div>
  )
}
