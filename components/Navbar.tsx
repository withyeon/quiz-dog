'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Menu, X, LogIn, LogOut, ChevronDown } from 'lucide-react'
import { gameAssets } from '@/assets/game-assets'
import { useAuth } from '@/contexts/AuthContext'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, loading: authLoading } = useAuth()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 유저 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    await signOut()
    router.push('/')
  }

  const userEmail = user?.email ?? ''
  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'T'



  const isDashboard = pathname?.startsWith('/dashboard') || pathname?.startsWith('/teacher')

  if (isDashboard) {
    return null // 대시보드에서는 Navbar 숨김
  }

  return (
    <nav
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 font-bitbit ${
        isScrolled
          ? 'bg-sky-50/95 shadow-lg border-b-2 border-sky-200'
          : 'bg-sky-50/30 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="relative flex items-center gap-0"
            >
              <Image
                src="/header-logo.webp"
                alt="퀴즈독"
                width={200}
                height={60}
                className="h-32 w-auto object-contain"
                priority
              />
              <div className="hidden sm:flex items-center -ml-2 gap-0.5 translate-y-5">
              <Image
                src={gameAssets['mascot-pome'].tight}
                alt="포메 마스코트"
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 object-contain pixelated"
              />
              <Image
                src={gameAssets.mascot_sigol.tight}
                alt="시골 마스코트"
                width={48}
                height={48}
                unoptimized
                className="h-12 w-12 object-contain pixelated"
              />
              </div>
            </motion.div>
          </Link>

          {/* 오른쪽 묶음: 데스크톱 메뉴 + 햄버거 */}
          <div className="flex items-center gap-3 shrink-0">
          {/* Desktop Menu — 텍스트 링크는 xl(1280px)부터, 버튼류는 lg(1024px)부터 */}
          <div className="hidden lg:flex items-center gap-6 shrink-0">
            <div className="hidden xl:flex items-center gap-6">
              <Link
                href="/teacher/library"
                className="flex items-center gap-2 whitespace-nowrap transition-colors font-bold text-xl nav-outlined-text"
              >
                자료실
              </Link>
              <Link
                href="/features"
                className="flex items-center gap-2 whitespace-nowrap transition-colors font-bold text-xl nav-outlined-text"
              >
                기능 소개
              </Link>
              <Link
                href="/pricing"
                className="flex items-center gap-2 whitespace-nowrap transition-colors font-bold text-xl nav-outlined-text"
              >
                요금제
              </Link>
            </div>
            <div className="flex items-center gap-3">
              {/* 코드로 입장은 하늘색 채움, 선생님 대시보드는 흰 바탕 외곽선 — 나란히 놓여도 구분되게 */}
              <Link href="/lobby">
                <Button size="lg" className="whitespace-nowrap text-lg relative z-10 bg-sky-500 hover:bg-sky-600 text-white hover:text-white border-2 border-sky-600 font-bold shadow-[0_3px_0_#0369a1] btn-sky-outlined">
                  코드로 입장
                </Button>
              </Link>
              {!authLoading && user ? (
                <>
                <Link href="/teacher">
                  <Button variant="outline" size="lg" className="whitespace-nowrap text-lg relative z-10 bg-white/90 hover:bg-white text-white hover:text-white border-2 border-sky-300 font-bold btn-sky-outlined">
                    선생님 대시보드
                  </Button>
                </Link>
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/90 border-2 border-sky-300 px-4 py-2 text-sm font-black text-black transition hover:bg-white"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">
                      {userInitial}
                    </span>
                    <span className="max-w-[100px] truncate">{userEmail}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden z-50">
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 px-4 py-3 text-sm font-black text-red-500 hover:bg-red-50 transition"
                      >
                        <LogOut className="h-4 w-4" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-neutral-800"
                >
                  <LogIn className="h-4 w-4" />
                  선생님 로그인
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Button — xl 미만에서 표시 (lg~xl 구간은 텍스트 링크만 여기로) */}
          <button
            className="xl:hidden p-2 shrink-0"
            aria-label={isMobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="xl:hidden bg-sky-50/95 border-t border-sky-200">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/teacher/library"
              className="flex items-center gap-2 py-2 font-bold text-xl nav-outlined-text"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              자료실
            </Link>
            <Link
              href="/features"
              className="flex items-center gap-2 py-2 font-bold text-xl nav-outlined-text"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              기능 소개
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 py-2 font-bold text-xl nav-outlined-text"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              요금제
            </Link>

            {/* lg 이상에서는 헤더에 이미 버튼이 있으므로 아래 블록은 lg 미만에서만 */}
            <div className="lg:hidden border-t pt-3 mt-3 space-y-3">
              <div className="space-y-3">
              <Link href="/lobby" onClick={() => setIsMobileMenuOpen(false)}>
                <Button size="lg" className="w-full text-lg relative z-10 bg-sky-500 hover:bg-sky-600 text-white hover:text-white border-2 border-sky-600 font-bold mb-3 shadow-[0_3px_0_#0369a1] btn-sky-outlined">
                  코드로 입장
                </Button>
              </Link>
              {!authLoading && user ? (
                <div className="space-y-2">
                  <Link
                    href="/teacher"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 font-black text-black transition hover:bg-slate-50"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">
                      {userInitial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">선생님 대시보드</span>
                      <span className="block truncate text-xs font-bold text-slate-400">{userEmail}</span>
                    </span>
                  </Link>
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); void handleSignOut() }}
                    className="flex w-full items-center gap-2 rounded-lg border border-red-200 px-4 py-3 text-sm font-black text-red-500 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-neutral-800"
                >
                  <LogIn className="h-4 w-4" />
                  선생님 로그인
                </Link>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
