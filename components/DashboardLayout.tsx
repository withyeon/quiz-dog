'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Home,
  Library,
  LogOut,
  Menu,
  PlayCircle,
  Plus,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface DashboardLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: '/teacher', label: '홈', icon: Home, id: 'home' },
  { href: '/teacher/library', label: '자료실', icon: Library, id: 'library' },
  { href: '/teacher/analytics', label: '게임 기록', icon: BarChart3, id: 'history' },
  { href: '/teacher/dashboard', label: '게임 시작', icon: PlayCircle, id: 'play' },
  { href: '/teacher/settings', label: '설정', icon: Settings, id: 'settings' },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const userEmail = user?.email ?? ''
  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'T'
  const displayName = userEmail ? userEmail.split('@')[0] : '선생님'

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }
  const currentItem = navItems.find((item) => {
    if (item.id === 'home') return pathname === '/teacher'
    return pathname?.startsWith(item.href)
  }) ?? navItems[0]

  // 라우트가 바뀌면 모바일 메뉴 닫기
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // 메뉴가 열렸을 때 본문 스크롤 잠금
  useEffect(() => {
    if (!mobileNavOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileNavOpen])

  return (
    <div className="min-h-dvh bg-[#f7f8fa] text-black">
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
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
          >
            <Plus className="h-4 w-4" />
            문제집 만들기
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
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                  active
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-black'
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
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">
                {userInitial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-black">{displayName}</div>
                <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{userEmail}</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href="/pricing"
                className="flex h-9 flex-1 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
              >
                플랜 보기
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-500"
                aria-label="로그아웃"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 모바일/태블릿 내비게이션 드로어 */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-slate-200 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between px-4">
              <Link href="/" className="flex items-center" onClick={() => setMobileNavOpen(false)}>
                <Image
                  src="/header-logo.svg"
                  alt="퀴즈독"
                  width={200}
                  height={66}
                  className="h-14 w-auto"
                  priority
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-black"
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-4">
              <Link
                href="/teacher/create"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
              >
                <Plus className="h-4 w-4" />
                새 퀴즈 만들기
              </Link>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {navItems.map((item) => {
                const active = item.id === 'home'
                  ? pathname === '/teacher'
                  : Boolean(pathname?.startsWith(item.href))

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${
                      active
                        ? 'bg-sky-50 text-sky-700'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-black'
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
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-black text-white">
                    {userInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-black">{displayName}</div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{userEmail}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/pricing"
                    onClick={() => setMobileNavOpen(false)}
                    className="flex h-9 flex-1 items-center justify-center rounded-lg bg-white text-xs font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  >
                    플랜 보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => { setMobileNavOpen(false); void handleSignOut() }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-500"
                    aria-label="로그아웃"
                    title="로그아웃"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-black lg:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link href="/" className="flex items-center lg:hidden">
                <Image
                  src="/header-logo.svg"
                  alt="퀴즈독"
                  width={180}
                  height={60}
                  className="h-12 w-auto sm:h-[54px]"
                  priority
                />
              </Link>
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-base font-extrabold text-slate-800">{currentItem.label}</span>
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
                className="flex h-10 items-center gap-2 rounded-2xl bg-sky-500 px-5 text-sm font-black text-white shadow-lg shadow-sky-200 transition-all hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-sky-200"
              >
                게임 시작
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100dvh-64px)] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
