'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="bg-transparent text-[#1e3a8a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/header-logo.svg"
                alt="퀴즈독"
                width={200}
                height={60}
                className="h-[100px] w-auto object-contain"
                priority
              />
            </Link>
            <p className="text-sm text-[#1e3a8a]/80 max-w-md">
              강아지와 함께하는 재미있는 퀴즈 게임! 교실을 게임으로 바꿔보세요 🐕
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-[#1e3a8a] font-semibold mb-4">제품</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#features" className="hover:text-[#1e3a8a]/70 transition-colors">
                  기능 소개
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[#1e3a8a]/70 transition-colors">
                  요금제
                </Link>
              </li>
              <li>
                <Link href="/teacher" className="hover:text-[#1e3a8a]/70 transition-colors">
                  시작하기
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-[#1e3a8a] font-semibold mb-4">법적 고지</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="hover:text-[#1e3a8a]/70 transition-colors">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#1e3a8a]/70 transition-colors">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#1e3a8a]/70 transition-colors">
                  문의하기
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[#1e3a8a]/20 text-center text-sm text-[#1e3a8a]/70">
          <p>&copy; 2026 퀴즈독. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
