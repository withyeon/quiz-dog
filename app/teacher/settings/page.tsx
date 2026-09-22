'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, UserCircle, KeyRound, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/components/ui/Toaster'
import { DISPLAY_NAME_MAX, saveMyDisplayName } from '@/lib/services/profiles'
import { useMyDisplayName } from '@/hooks/useMyDisplayName'

function SettingsContent() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const isPasswordReset = searchParams?.get('reset') === '1'

  // 프로필 이름 (DB 조회 전에는 가입 이름·이메일로 만든 기본값이 먼저 들어온다)
  const currentName = useMyDisplayName()
  const [displayName, setDisplayName] = useState(currentName)
  const [savedName, setSavedName] = useState(currentName)
  const [nameSaving, setNameSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    setDisplayName(currentName)
    setSavedName(currentName)
  }, [currentName])

  const providers: string[] = (user?.app_metadata?.providers as string[] | undefined) ?? []
  const hasEmailLogin = providers.includes('email') || user?.app_metadata?.provider === 'email'
  const email = user?.email ?? ''

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      toast.error('이름을 입력해 주세요.')
      return
    }
    setNameSaving(true)
    try {
      await saveMyDisplayName(trimmed)
      setSavedName(trimmed)
      toast.success('이름을 저장했어요.')
    } catch (error) {
      console.error('표시 이름 저장 실패:', error)
      toast.error('저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setNameSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }
    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      toast.success('비밀번호를 바꿨어요.')
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      toast.error(
        msg.includes('same password')
          ? '이전과 다른 비밀번호를 입력해 주세요.'
          : '비밀번호를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setPasswordSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-black placeholder-slate-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">내 정보</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          표시 이름과 비밀번호를 여기서 바꿀 수 있어요.
        </p>
      </section>

      {isPasswordReset && (
        <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 ring-1 ring-sky-200">
          비밀번호 재설정 링크로 들어오셨어요. 아래에서 새 비밀번호를 정해 주세요.
        </div>
      )}

      {/* 표시 이름 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-black text-slate-900">표시 이름</h2>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-500">
          문제집을 공유하면 &quot;원작: {savedName || 'OO'}{' '}선생님&quot;으로 표시돼요.
        </p>
        <form onSubmit={handleSaveName} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX))}
            placeholder="예: 위드현"
            maxLength={DISPLAY_NAME_MAX}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={nameSaving || displayName.trim() === savedName}
            className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {nameSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            저장
          </button>
        </form>
      </section>

      {/* 이메일 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-black text-slate-900">로그인 계정</h2>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          {email || '이메일 없음'}
          {providers.length > 0 && (
            <span className="ml-2 text-xs font-medium text-slate-400">
              ({providers.map((p) => (p === 'email' ? '이메일' : p === 'google' ? 'Google' : p === 'kakao' ? '카카오' : p)).join(' · ')})
            </span>
          )}
        </div>
      </section>

      {/* 비밀번호 */}
      {(hasEmailLogin || isPasswordReset) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-black text-slate-900">비밀번호 변경</h2>
          </div>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                autoComplete="new-password"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-black"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={passwordSaving || !newPassword}
              className="flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-2.5 text-sm font-black text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {passwordSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              비밀번호 바꾸기
            </button>
          </form>
        </section>
      )}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  )
}
