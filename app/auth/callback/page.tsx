'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams?.get('code')
      const type = searchParams?.get('type')
      const redirect = searchParams?.get('redirect') ?? '/teacher'

      if (code) {
        await supabase.auth.exchangeCodeForSession(code)
      }

      if (type === 'recovery') {
        // 비밀번호 재설정 플로우: 설정 페이지로 이동
        router.replace('/teacher/settings?reset=1')
        return
      }

      // 세션 확인 후 리다이렉트
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace(redirect)
      } else {
        router.replace('/login')
      }
    }

    void handleCallback()
  }, [router, searchParams])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#f7f8fa]">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      <p className="text-sm font-bold text-slate-500">로그인 처리 중...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  )
}
