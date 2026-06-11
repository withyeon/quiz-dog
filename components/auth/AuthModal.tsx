'use client'

import { useState } from 'react'
import { X, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'signin' | 'signup'
  redirectTo?: string
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultTab = 'signin',
  redirectTo = '/teacher',
}: AuthModalProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'kakao' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const handleTabChange = (t: 'signin' | 'signup') => {
    setTab(t)
    setError(null)
    setMessage(null)
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    try {
      if (tab === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
        window.location.href = redirectTo
      } else {
        if (password !== confirmPassword) throw new Error('비밀번호가 일치하지 않습니다.')
        if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.')
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteUrl}/auth/callback` },
        })
        if (error) throw error
        setMessage('인증 이메일을 보냈습니다. 이메일을 확인해 로그인해주세요.')
      }
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : '오류가 발생했습니다.'))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError('이메일을 먼저 입력해주세요.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?type=recovery`,
      })
      if (error) throw error
      setMessage('비밀번호 재설정 링크를 이메일로 보냈습니다.')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    setError(null)
    setSocialLoading(provider)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl}/auth/callback?redirect=${encodeURIComponent(redirectTo)}` },
    })
    if (error) {
      setError(error.message)
      setSocialLoading(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-black">퀴즈독</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">
              선생님
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-black"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Tabs */}
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleTabChange(t)}
                className={`flex-1 rounded-md py-2 text-sm font-black transition ${
                  tab === t
                    ? 'bg-white text-black shadow-sm'
                    : 'text-slate-500 hover:text-black'
                }`}
              >
                {t === 'signin' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          {/* Feedback */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-bold text-red-600">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-bold text-green-700">
              {message}
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-black placeholder-slate-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  required
                  autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm font-medium text-black placeholder-slate-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
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
            </div>

            {tab === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">
                  비밀번호 확인
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 재입력"
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-black placeholder-slate-400 outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-black text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === 'signin' ? '이메일로 로그인' : '회원가입'}
            </button>
          </form>

          {tab === 'signin' && (
            <div className="mt-2.5 text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs font-bold text-slate-400 transition hover:text-black"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold text-slate-400">또는 소셜로 계속하기</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Social Buttons */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!socialLoading}
              className="flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-black text-black transition hover:bg-slate-50 disabled:opacity-50"
            >
              {socialLoading === 'google' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Google로 계속하기
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('kakao')}
              disabled={!!socialLoading}
              className="flex w-full items-center gap-3 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-black text-[#191919] transition hover:bg-[#FCDC00] disabled:opacity-50"
            >
              {socialLoading === 'kakao' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KakaoIcon />
              )}
              카카오로 계속하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (msg.includes('Email not confirmed')) return '이메일 인증을 완료해주세요. 받은 편지함을 확인해주세요.'
  if (msg.includes('User already registered')) return '이미 가입된 이메일입니다. 로그인을 시도해주세요.'
  if (msg.includes('Password should be at least 6')) return '비밀번호는 6자 이상이어야 합니다.'
  if (msg.includes('For security purposes')) return '잠시 후 다시 시도해주세요.'
  return msg
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.705 17.64 9.2z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.009 9.009 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9 1C4.582 1 1 3.925 1 7.5c0 2.326 1.511 4.373 3.797 5.534L3.9 16.45c-.065.244.22.436.426.294L8.64 13.97c.118.01.238.015.36.015 4.418 0 8-2.925 8-6.485C17 3.925 13.418 1 9 1z"
        fill="#191919"
      />
    </svg>
  )
}
