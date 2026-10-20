'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { readTrialSession, type TrialSession } from '@/lib/trial/trialSession'

/**
 * 체험으로 연 게임 화면 위에 떠 있는 작은 띠. 루트 레이아웃에 한 번만 둔다(게임 페이지가 열 군데라 페이지마다 안 붙인다).
 * 이 탭에 체험 정보(sessionStorage)가 있고 지금 주소의 room 이 그 방일 때만 보인다.
 * 게임이 끝나 결과 화면이 떠도 그대로 남아, "체험 마치기"로 수업 만들기 안내(/try?done=1)로 이어진다.
 */
export default function TrialGameBanner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const room = searchParams?.get('room') ?? null
  const [session, setSession] = useState<TrialSession | null>(null)

  useEffect(() => {
    setSession(readTrialSession())
  }, [pathname])

  if (!session || !room || session.roomCode !== room) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[90] flex justify-center px-3 font-bitbit">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-sky-200 bg-white/95 py-1.5 pl-4 pr-1.5 text-xs font-black text-slate-700 shadow-lg shadow-sky-900/10 sm:text-sm">
        <span>가입 없이 체험 중 · 최대 2분</span>
        <Link
          href="/try?done=1"
          className="flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1.5 text-white transition hover:bg-sky-600"
        >
          체험 마치기
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
