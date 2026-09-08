'use client'

import Image from 'next/image'
import type { LucideIcon } from 'lucide-react'

/**
 * 선생님 화면에서 공통으로 쓰는 로딩·빈 상태 표시.
 * 페이지마다 스피너 크기와 문구 톤이 달라 어수선했던 것을 한 곳으로 모았다.
 */

export function LoadingState({
  label = '불러오는 중',
  minHeight = 'min-h-[320px]',
  card = true,
}: {
  label?: string
  /** 화면 안에서 차지할 최소 높이 (레이아웃이 튀지 않게) */
  minHeight?: string
  /** 흰 카드 배경 위에 표시할지 */
  card?: boolean
}) {
  return (
    <div
      className={`flex ${minHeight} flex-col items-center justify-center gap-3 ${
        card ? 'rounded-2xl border border-slate-200 bg-white' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      <p className="text-sm font-bold text-slate-400">{label}</p>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  mascot = false,
  title,
  description,
  action,
  card = true,
}: {
  icon?: LucideIcon
  /** 마스코트를 띄울지 — 처음 들어온 화면처럼 환영이 필요한 곳에만 */
  mascot?: boolean
  title: string
  description?: string
  action?: React.ReactNode
  card?: boolean
}) {
  return (
    <div
      className={`px-6 py-12 text-center ${
        card ? 'rounded-2xl border border-slate-200 bg-white shadow-sm' : ''
      }`}
    >
      {mascot ? (
        <Image
          src="/mascot_pome.png"
          alt=""
          width={72}
          height={72}
          className="mx-auto mb-4 h-16 w-16 object-contain"
        />
      ) : (
        Icon && (
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50">
            <Icon className="h-6 w-6 text-sky-400" />
          </span>
        )
      )}
      <h2 className="text-lg font-extrabold text-slate-800">{title}</h2>
      {description && <p className="mt-2 text-sm font-medium text-slate-500">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
