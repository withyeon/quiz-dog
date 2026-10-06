'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      // 쿼리도 함께 넘긴다: quizdog.kr/redeem?code=… 처럼 링크로 들어온 값이 로그인 뒤에도 남게
      const target = `${pathname ?? '/teacher'}${window.location.search}`
      router.replace(`/login?redirect=${encodeURIComponent(target)}`)
    }
  }, [loading, user, router, pathname])

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7f8fa]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}
