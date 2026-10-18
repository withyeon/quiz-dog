'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useTeacherPlan } from '@/hooks/useTeacherPlan'
import { withJosa } from '@/lib/utils/korean'

interface ProGateProps {
  /** 잠금 카드에 보여 줄 기능 이름(예: "문항별 정답률") */
  feature: string
  /** 한 줄 설명(선택) */
  description?: string
  children: React.ReactNode
  className?: string
}

/**
 * 프로 전용 구역. 무료 선생님에게는 내용을 흐리게 깔고 그 위에 요금제 안내를 띄운다.
 * 요금제를 아직 확인 중이면 흐림만 두고 안내 문구는 띄우지 않는다(프로 선생님 화면이 깜빡이지 않게).
 * 화면 잠금일 뿐이라 진짜 막아야 하는 것(엑셀 내보내기)은 서버에서도 요금제를 본다.
 */
export default function ProGate({ feature, description, children, className = '' }: ProGateProps) {
  const { plan, loading } = useTeacherPlan()
  if (plan === 'pro') return <>{children}</>

  return (
    <div className={`relative min-h-[300px] overflow-hidden rounded-xl ${className}`}>
      <div aria-hidden className="pointer-events-none select-none blur-[6px] opacity-60">
        {children}
      </div>
      {!loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 p-6">
          <div className="w-full max-w-sm rounded-2xl border border-blue-200 bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-base font-black text-slate-900">{withJosa(feature, '은/는')} Pro에서 볼 수 있어요</p>
            <p className="mt-1.5 break-keep text-sm font-medium leading-5 text-slate-500">
              {description ?? '어느 문항에서 막혔는지, 어떤 오답을 골랐는지까지 자세히 보여 드려요.'}
            </p>
            <Link
              href="/pricing"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
            >
              Pro 알아보기
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
