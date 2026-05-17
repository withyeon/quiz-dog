'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Sparkles, Menu, X, HelpCircle } from 'lucide-react'
import { gameAssets } from '@/assets/game-assets'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])



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
              className="relative flex items-center gap-2"
            >
              <Image
                src="/header-logo.svg"
                alt="퀴즈독"
                width={200}
                height={60}
                className="h-32 w-auto object-contain"
                priority
              />
              <Image
                src={gameAssets['mascot-pome'].tight}
                alt="포메 마스코트"
                width={64}
                height={64}
                unoptimized
                className="hidden h-16 w-16 object-contain pixelated sm:block"
              />
              <Image
                src={gameAssets.mascot_sigol.tight}
                alt="시골 마스코트"
                width={64}
                height={64}
                unoptimized
                className="hidden h-16 w-16 object-contain pixelated sm:block"
              />
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
              <Link href="/teacher">
                <Button variant="outline" size="lg" className="sparkle-button text-lg relative z-10">
                  시작하기
                </Button>
              </Link>
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
              <Link href="/teacher" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="lg" className="sparkle-button w-full text-lg relative z-10">
                  시작하기
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
