'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Play, Settings, History, Star, Compass, Plus } from 'lucide-react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()

  const navItems = [
    { href: '/teacher',           label: '내 문제집',   icon: '📚', id: 'discover' },
    { href: '/teacher/library',   label: '라이브러리',  icon: '🌟', id: 'library' },
    { href: '/teacher/analytics', label: '히스토리',    icon: '📊', id: 'history' },
    { href: '/teacher/dashboard', label: '게임 시작',   icon: '▶️', id: 'play' },
    { href: '/teacher/settings',  label: '설정',        icon: '⚙️', id: 'settings' },
  ]

  const isActive = (item: typeof navItems[0]) => {
    if (item.id === 'discover') return pathname === '/teacher'
    return pathname?.startsWith(item.href) && item.href !== '/teacher'
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'Noto Sans KR', sans-serif", background: '#F0F9FF' }}
    >
      {/* ── SIDEBAR ── */}
      <aside
        className="fixed left-0 top-0 h-full flex flex-col"
        style={{
          width: 240,
          background: '#0C2340',
          borderRight: '3px solid #0C2340',
          zIndex: 50,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 no-underline"
          style={{
            padding: '22px 20px 18px',
            borderBottom: '2px solid rgba(255,255,255,.08)',
          }}
        >
          <div
            style={{
              width: 38, height: 38,
              background: '#FFD93D',
              border: '2px solid rgba(255,255,255,.3)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
              boxShadow: '2px 2px 0 rgba(0,0,0,.3)',
              flexShrink: 0,
            }}
          >🐕</div>
          <span style={{ fontFamily: "'BMJUA', monospace", fontSize: 20, color: '#fff' }}>퀴즈독</span>
        </Link>

        {/* Create Button */}
        <Link
          href="/teacher/create"
          className="flex items-center justify-center gap-2 no-underline"
          style={{
            margin: '16px 16px 8px',
            padding: '12px',
            background: '#FFD93D',
            border: '2px solid rgba(255,255,255,.2)',
            boxShadow: '2px 2px 0 rgba(0,0,0,.3)',
            borderRadius: 10,
            fontFamily: "'BMJUA', monospace",
            fontSize: 14,
            color: '#0C2340',
          }}
        >
          ＋ 퀴즈 만들기
        </Link>

        {/* Nav */}
        <nav className="flex-1" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 no-underline"
              style={{
                padding: '11px 12px',
                borderRadius: 8,
                fontFamily: "'BMJUA', monospace",
                fontSize: 13,
                color: isActive(item) ? '#fff' : 'rgba(255,255,255,.55)',
                background: isActive(item) ? 'rgba(14,165,233,.2)' : 'transparent',
                border: isActive(item) ? '2px solid rgba(14,165,233,.4)' : '2px solid transparent',
                boxShadow: isActive(item) ? '2px 2px 0 rgba(0,0,0,.2)' : 'none',
                transition: 'all .12s',
              }}
            >
              <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'discover' && (
                <span style={{
                  marginLeft: 'auto', width: 8, height: 8,
                  borderRadius: '50%', background: '#0EA5E9', flexShrink: 0,
                }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '14px 16px', borderTop: '2px solid rgba(255,255,255,.08)' }}>
          <div className="flex items-center gap-3" style={{ padding: '10px 0 12px' }}>
            <div style={{
              width: 34, height: 34,
              background: '#0EA5E9',
              border: '2px solid rgba(255,255,255,.2)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17, flexShrink: 0,
            }}>🦝</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'BMJUA', monospace", fontSize: 13, color: '#fff' }}>선생님</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>Free 플랜</div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 no-underline"
            style={{
              padding: '10px',
              background: 'rgba(14,165,233,.15)',
              border: '2px solid rgba(14,165,233,.35)',
              borderRadius: 8,
              fontFamily: "'BMJUA', monospace",
              fontSize: 12,
              color: '#BAE6FD',
            }}
          >
            ⚡ Pro로 업그레이드
          </Link>
        </div>
      </aside>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-col" style={{ marginLeft: 240, flex: 1, minHeight: '100vh' }}>
        {/* Topbar */}
        <div
          className="flex items-center justify-between"
          style={{
            height: 60, flexShrink: 0,
            background: '#fff',
            borderBottom: '3px solid #0C2340',
            padding: '0 28px',
          }}
        >
          <span style={{ fontFamily: "'BMJUA', monospace", fontSize: 18 }}>
            📚 내 문제집
          </span>
          <div className="flex items-center gap-3">
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px',
              background: '#F0F9FF',
              border: '2px solid rgba(14,165,233,.3)',
              borderRadius: 8, fontSize: 13, color: '#888',
            }}>🔍 검색...</div>
            <Link
              href="/teacher/dashboard"
              className="no-underline"
              style={{
                padding: '7px 16px',
                background: '#E0F2FE',
                border: '2px solid #0C2340',
                boxShadow: '2px 2px 0 #0C2340',
                borderRadius: 8,
                fontFamily: "'BMJUA', monospace",
                fontSize: 12,
                color: '#0C2340',
              }}
            >🎮 게임 시작</Link>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex: 1, padding: 28, background: '#F0F9FF' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
