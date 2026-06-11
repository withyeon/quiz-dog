'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Menu, X, LogIn, LogOut, User, ChevronDown } from 'lucide-react'
import { gameAssets } from '@/assets/game-assets'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/auth/AuthModal'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
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
          ? 'bg-sky-50/95 backdrop-blur-md shadow-lg border-b-2 border-sky-200'
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
                src="/header-logo.svg"
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

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-6">
            <Link
              href="/teacher/library"
              className="flex items-center gap-2 transition-colors font-bold text-xl nav-outlined-text"
            >
              자료실
            </Link>
            <Link
              href="/#features"
              className="flex items-center gap-2 transition-colors font-bold text-xl nav-outlined-text"
            >
              기능 소개
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 transition-colors font-bold text-xl nav-outlined-text"
            >
              요금제
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/lobby">
                <Button variant="outline" size="lg" className="text-lg relative z-10 bg-white/90 hover:bg-white text-white hover:text-white border-2 border-sky-300 font-bold btn-sky-outlined">
                  코드로 입장
                </Button>
              </Link>
              {!authLoading && user ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-xl bg-white/90 border-2 border-sky-300 px-4 py-2 text-sm font-black text-black transition hover:bg-white"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-xs font-black text-white">
                      {userInitial}
                    </span>
                    <span className="max-w-[100px] truncate">{userEmail}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden z-50">
                      <Link
                        href="/teacher"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-3 text-sm font-black text-black hover:bg-slate-50 transition"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        선생님 대시보드
                      </Link>
                      <div className="h-px bg-slate-100" />
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
              ) : (
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-black text-white transition hover:bg-neutral-800"
                >
                  <LogIn className="h-4 w-4" />
                  선생님 로그인
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
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

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        redirectTo="/teacher"
      />

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-sky-50/95 backdrop-blur-md border-t border-sky-200">
          <div className="px-4 py-4 space-y-3">
            <Link
              href="/teacher/library"
              className="flex items-center gap-2 py-2 font-bold text-xl nav-outlined-text"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              자료실
            </Link>
            
            <div className="border-t pt-3 mt-3 space-y-3">
              <Link
                href="/#features"
                className="flex items-center gap-2 font-bold text-xl nav-outlined-text"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                기능 소개
              </Link>
              <Link
                href="/pricing"
                className="flex items-center gap-2 font-bold text-xl nav-outlined-text"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                요금제
              </Link>
              <Link href="/lobby" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="lg" className="w-full text-lg relative z-10 bg-white/90 hover:bg-white text-white hover:text-white border-2 border-sky-300 font-bold mb-3 btn-sky-outlined">
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
                    <span className="min-w-0 flex-1 truncate text-sm">{userEmail}</span>
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
                <button
                  onClick={() => { setIsMobileMenuOpen(false); setAuthModalOpen(true) }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-3 text-sm font-black text-white transition hover:bg-neutral-800"
                >
                  <LogIn className="h-4 w-4" />
                  선생님 로그인
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
