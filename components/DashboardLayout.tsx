'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Home,
  Library,
  PlayCircle,
  Plus,
  Settings,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: '/teacher', label: '홈', icon: Home, id: 'home' },
  { href: '/teacher/library', label: '자료실', icon: Library, id: 'library' },
  { href: '/teacher/analytics', label: '히스토리', icon: BarChart3, id: 'history' },
  { href: '/teacher/dashboard', label: '게임 시작', icon: PlayCircle, id: 'play' },
  { href: '/teacher/settings', label: '설정', icon: Settings, id: 'settings' },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const currentItem = navItems.find((item) => {
    if (item.id === 'home') return pathname === '/teacher'
    return pathname?.startsWith(item.href)
  }) ?? navItems[0]

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/" className="flex items-center">
            <Image
              src="/header-logo.svg"
              alt="퀴즈독"
              width={240}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </Link>
        </div>

        <div className="px-4 pb-4">
          <Link
            href="/teacher/create"
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            새 퀴즈 만들기
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const active = item.id === 'home'
              ? pathname === '/teacher'
              : Boolean(pathname?.startsWith(item.href))

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition ${
                  active
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-4 w-4 text-slate-400" />}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-slate-700 ring-1 ring-slate-200">
                T
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-slate-900">선생님</div>
                <div className="mt-0.5 text-xs font-medium text-slate-500">Free 플랜</div>
              </div>
            </div>
            <Link
              href="/pricing"
              className="mt-4 flex h-9 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
            >
              플랜 보기
            </Link>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-xs font-black text-white lg:hidden">
                QD
              </Link>
              <div>
                <div className="text-sm font-medium text-slate-400">Teacher</div>
                <h1 className="text-lg font-black tracking-normal text-slate-950">{currentItem.label}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/teacher"
                className="hidden h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 sm:flex"
              >
                <BookOpen className="h-4 w-4" />
                문제집
              </Link>
              <Link
                href="/teacher/dashboard"
                className="flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <PlayCircle className="h-4 w-4" />
                게임 시작
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
