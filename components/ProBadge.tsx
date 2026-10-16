'use client'

import { useTeacherPlan } from '@/hooks/useTeacherPlan'

/**
 * 프로 선생님의 프로필 옆에 붙는 작은 "PRO" 표시. 무료거나 아직 확인 전이면 아무것도 그리지 않는다.
 * 사이드바·상단 메뉴의 아바타 옆에 둔다.
 */
export default function ProBadge({ size = 'sm', className = '' }: { size?: 'xs' | 'sm'; className?: string }) {
  const { plan, proUntil } = useTeacherPlan()
  if (plan !== 'pro') return null
  const until = proUntil ? new Date(proUntil).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : null
  return (
    <span
      title={until ? `Pro · ${until}까지` : 'Pro'}
      className={`inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 font-black uppercase leading-none tracking-wide text-white shadow-sm ring-1 ring-white/70 ${
        size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      } ${className}`}
    >
      Pro
    </span>
  )
}
