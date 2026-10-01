'use client'

import { AlertCircle, Sparkles } from 'lucide-react'

export type SummaryRow = { label: string; value: string; muted?: boolean }

interface GenerationSummaryProps {
  rows: SummaryRow[]
  /** 아직 채우지 않아 생성을 막는 것들 */
  missing: string[]
  actionLabel: string
  isGenerating: boolean
  onGenerate: () => void
}

/**
 * 설정 요약 + 만들기 버튼. 데스크톱에서는 오른쪽에 따라다니는 카드,
 * 폰에서는 화면 아래 고정 바로 보여서 어느 화면 크기에서도 버튼을 찾으러 스크롤하지 않는다.
 */
export default function GenerationSummary({ rows, missing, actionLabel, isGenerating, onGenerate }: GenerationSummaryProps) {
  const blocked = missing.length > 0 || isGenerating

  const button = (
    <button
      type="button"
      onClick={onGenerate}
      disabled={blocked}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 text-base font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
    >
      <Sparkles className="h-5 w-5" />
      {isGenerating ? '만드는 중' : missing.length > 0 ? missing[0] : actionLabel}
    </button>
  )

  return (
    <>
      {/* 데스크톱: 오른쪽 따라다니는 카드 */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900">이렇게 만들어요</h2>
          <dl className="mt-4 space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3">
                <dt className="shrink-0 text-sm font-semibold text-slate-500">{row.label}</dt>
                <dd className={`min-w-0 break-keep text-right text-sm font-bold ${row.muted ? 'text-slate-400' : 'text-slate-900'}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          {missing.length > 0 && (
            <ul className="mt-4 space-y-1.5 rounded-xl bg-amber-50 px-3.5 py-3">
              {missing.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs font-bold text-amber-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5">{button}</div>
          <p className="mt-3 text-center text-xs font-medium leading-5 text-slate-400">
            보통 10~30초 걸려요. 만든 뒤 검수 화면에서 자유롭게 고칠 수 있어요.
          </p>
        </div>
      </aside>

      {/* 폰·태블릿: 아래 고정 바 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">{rows[rows.length - 1]?.value}</p>
            <p className={`truncate text-xs font-bold ${missing.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              {missing.length > 1
                ? `${missing.length}가지를 더 채워 주세요`
                : missing.length === 1
                  ? '거의 다 됐어요'
                  : rows.slice(0, -1).map((row) => row.value).join(' · ')}
            </p>
          </div>
          <div className="shrink-0 [&>button]:h-11 [&>button]:whitespace-nowrap [&>button]:px-4 [&>button]:text-sm">{button}</div>
        </div>
      </div>
    </>
  )
}
