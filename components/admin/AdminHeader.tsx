'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ShieldCheck, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { fetchAdmin } from '@/lib/admin/fetchAdmin'
import { ADMIN_MENUS } from './AdminNav'

export function AdminHeader() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [menuOpen, setMenuOpen] = useState(false)

  const lockAdmin = async () => {
    // 2차 인증 쿠키 제거 후 교사 페이지로
    await fetchAdmin('/api/admin/auth', { method: 'DELETE' }).catch(() => {})
    router.push('/teacher')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="메뉴"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-900" />
            <span className="font-bold text-slate-900">퀴즈독 관리자</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
          <button
            onClick={lockAdmin}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            잠금
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <nav className="border-t border-slate-100 bg-white p-3 md:hidden">
          {ADMIN_MENUS.map((menu) => {
            const Icon = menu.icon
            const active = pathname === menu.href || pathname.startsWith(menu.href + '/')
            return (
              <Link
                key={menu.href}
                href={menu.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {menu.label}
              </Link>
            )
          })}
          <Link
            href="/teacher"
            onClick={() => setMenuOpen(false)}
            className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            교사 페이지로
          </Link>
        </nav>
      )}
    </header>
  )
}
