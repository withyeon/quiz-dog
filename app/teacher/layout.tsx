'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuth } from '@/contexts/AuthContext'
import DisplayNamePrompt from '@/components/share/DisplayNamePrompt'

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname ?? '/teacher')}`)
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
      {/* 표시 이름이 없는 선생님에게 한 번만 물어본다 (공유 링크의 원작자 표시용) */}
      <DisplayNamePrompt />
    </DashboardLayout>
  )
}
