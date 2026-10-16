'use client'

import { type ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ExternalLink, LogOut, Menu, Shield, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ADMIN_NAV, findAdminNavItem } from '@/components/admin/nav'
import { useAdminSession } from './AdminGate'

function useRemaining(expiresAt: string | null) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!expiresAt) {
      setText('')
      return
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now()
      if (ms <= 0) return setText('만료')
      const h = Math.floor(ms / 3_600_000)
      const m = Math.floor((ms % 3_600_000) / 60_000)
      setText(h > 0 ? `${h}시간 ${m}분 남음` : `${m}분 남음`)
    }
    tick()
    const t = setInterval(tick, 30_000)
    return () => clearInterval(t)
  }, [expiresAt])
  return text
}

/**
 * 관리자 화면 틀. 왼쪽 어두운 사이드바(접기 가능) + 위 헤더(지금 페이지 이름·설명, 관리자 이메일, 인증 남은 시간).
 * 초피티 관리자(AdminShell)와 같은 모양.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const { email, expiresAt, endSession } = useAdminSession()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const current = findAdminNavItem(pathname)
  const remaining = useRemaining(expiresAt)

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('admin:sidebar') === 'collapsed')
    } catch {
      // 저장소를 못 읽으면 펼친 상태로 둔다.
    }
  }, [])
  useEffect(() => {
    setDrawer(false)
  }, [pathname])

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try {
        localStorage.setItem('admin:sidebar', v ? 'expanded' : 'collapsed')
      } catch {
        // 무시
      }
      return !v
    })
  }

  const nav = (
    <nav className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center gap-2 border-b border-slate-800 px-4', collapsed && 'justify-center px-2')}>
        <Shield className="h-5 w-5 shrink-0 text-emerald-400" />
        {!collapsed && <span className="text-sm font-semibold text-white">퀴즈독 관리자</span>}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {ADMIN_NAV.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{group.label}</div>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        active ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
                        collapsed && 'justify-center px-2',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-emerald-400' : 'text-slate-400')} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-800 p-2">
        <Link
          href="/teacher"
          className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white', collapsed && 'justify-center px-2')}
          title="교사 화면"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
          {!collapsed && <span>교사 화면으로</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn('mt-1 hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/60 hover:text-white lg:flex', collapsed && 'justify-center px-2')}
          aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
        >
          <ChevronLeft className={cn('h-4 w-4 shrink-0 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>메뉴 접기</span>}
        </button>
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 데스크톱 사이드바 */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden bg-slate-900 transition-[width] lg:block', collapsed ? 'w-16' : 'w-60')}>{nav}</aside>

      {/* 모바일 드로어 */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900 shadow-xl">
            <button type="button" onClick={() => setDrawer(false)} className="absolute right-2 top-3 rounded p-1 text-slate-400 hover:text-white" aria-label="메뉴 닫기">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className={cn('flex min-h-screen flex-col transition-[padding]', collapsed ? 'lg:pl-16' : 'lg:pl-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="메뉴 열기">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{current?.label ?? '관리자'}</div>
            {current?.description && <div className="hidden truncate text-xs text-slate-500 sm:block">{current.description}</div>}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-slate-700">{email}</div>
              {remaining && <div className="text-[11px] text-slate-400">인증 {remaining}</div>}
            </div>
            <button
              type="button"
              onClick={endSession}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="관리자 2차 인증을 종료합니다"
            >
              <LogOut className="h-3.5 w-3.5" />
              인증 종료
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
