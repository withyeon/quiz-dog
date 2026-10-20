'use client'

import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import LibraryBrowser from '@/components/library/LibraryBrowser'

/** 공개 자료실 셸 — 랜딩과 같은 Navbar·Footer 사이에 자료실 본문을 둔다 */
export default function PublicLibraryContent() {
  return (
    <div className="min-h-dvh break-keep" style={{ background: 'linear-gradient(180deg, #E6F1F7 0%, #F4F8FB 40%, #F8FAFC 100%)' }}>
      <Navbar />
      {/* Navbar 가 fixed(h-24)라 본문을 그만큼 내린다 */}
      <main className="px-4 pb-16 pt-32 sm:px-6 lg:px-8">
        <LibraryBrowser mode="public" />
      </main>
      <Footer />
    </div>
  )
}
