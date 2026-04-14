'use client'

import { ReactNode, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  BarChart3,
  Settings,
  TrendingUp,
  Compass,
  Star,
  History,
  FileText,
  Play,
  ChevronDown,
  Plus,
  Library,
} from 'lucide-react'
import { motion } from 'framer-motion'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const navItems = [
    { href: '/teacher', label: '내 문제집', icon: Compass, id: 'discover' },
    { href: '/teacher/library', label: '라이브러리', icon: Star, id: 'library' },
    { href: '/teacher/analytics', label: '히스토리', icon: History, id: 'history' },
    { href: '/teacher/dashboard', label: '게임 시작', icon: Play, id: 'play' },
    { href: '/teacher/settings', label: '설정', icon: Settings, id: 'settings' },
  ]

  // 현재 활성 페이지 확인
  const isActive = (item: typeof navItems[0]) => {
    if (item.id === 'discover') {
      return pathname === '/teacher' && !pathname.includes('create')
    }
    return pathname?.startsWith(item.href) && item.href !== '/teacher'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar - 깔끔한 디자인 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6">
          {/* Logo */}
          <Link href="/" className="flex items-center mb-8">
            <Image
              src="/header-logo.svg"
              alt="퀴즈독"
              width={200}
              height={70}
              className="h-16 w-auto object-contain"
              priority
            />
          </Link>

          {/* Create Button - 하늘색 */}
          <Link
            href="/teacher/create"
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 mb-6 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5" />
            퀴즈 만들기
          </Link>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section */}
        <div className="mt-auto p-6 space-y-4 border-t border-gray-200">
          {/* Quick Access Icons */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: '📊', label: '통계' },
              { icon: '💼', label: '포트폴리오' },
              { icon: '🏠', label: '홈' },
              { icon: '📄', label: '문서' },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gray-100 hover:bg-gray-200 rounded-lg p-2 cursor-pointer transition-colors flex items-center justify-center"
                title={item.label}
              >
                <span className="text-xl">{item.icon}</span>
              </div>
            ))}
          </div>

          {/* Upgrade Button */}
          <Link
            href="/pricing"
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-sm shadow-sm text-center block"
          >
            Pro로 업그레이드하기
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64">
        {/* Top Bar - 헤더 (깔끔한 흰색) */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
          {/* 내 퀴즈함 링크 */}
          <Link
            href="/teacher"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${pathname === '/teacher' || pathname === '/teacher/'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-700 hover:bg-gray-50'
              }`}
          >
            <Library className="h-5 w-5" />
            <span className="font-medium">내 퀴즈함</span>
          </Link>

          {/* 사용자 정보 */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-lg text-white font-semibold">
                🦝
              </div>
              <span className="text-sm font-medium text-gray-700">선생님</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {/* User Menu Dropdown */}
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50"
              >
                <Link
                  href="/teacher/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  설정
                </Link>
                <Link
                  href="/"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  onClick={() => setShowUserMenu(false)}
                >
                  로그아웃
                </Link>
              </motion.div>
            )}
          </div>
        </div>

        {/* Content */}
        <main className="bg-gray-50 min-h-[calc(100vh-64px)] p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
