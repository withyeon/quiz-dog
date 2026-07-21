'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Radio,
  Megaphone,
  MessageSquare,
  Home,
} from 'lucide-react'

export const ADMIN_MENUS = [
  { label: '대시보드', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: '교사 관리', href: '/admin/users', icon: Users },
  { label: '게임/세션', href: '/admin/sessions', icon: Radio },
  { label: '공지사항', href: '/admin/announcements', icon: Megaphone },
  { label: '문제 신고', href: '/admin/feedback', icon: MessageSquare },
]

export function AdminNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 md:flex">
      <div className="mb-4 px-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          관리자 메뉴
        </span>
      </div>
      {ADMIN_MENUS.map((menu) => {
        const Icon = menu.icon
        const active = pathname === menu.href || pathname.startsWith(menu.href + '/')
        return (
          <Link
            key={menu.href}
            href={menu.href}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {menu.label}
          </Link>
        )
      })}
      <div className="my-2 border-t border-slate-100" />
      <Link
        href="/teacher"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <Home className="h-[18px] w-[18px]" />
        교사 페이지로
      </Link>
    </nav>
  )
}
