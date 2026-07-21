'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('페이지 오류:', error)
  }, [error])

  return (
    <div
      className="min-h-dvh flex items-center justify-center p-6 font-bitbit bg-[#d9eef5]"
    >
      <div className="w-full max-w-md rounded-2xl border-4 border-[#0c3b42]/15 bg-white/85 p-8 text-center shadow-2xl backdrop-blur-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascot_pome.png"
          alt=""
          width={120}
          height={120}
          className="mx-auto mb-5 h-28 w-28 object-contain drop-shadow-lg"
        />
        <h1 className="mb-3 text-3xl font-black text-[#17262a]">앗, 문제가 생겼어요</h1>
        <p className="mb-7 text-base font-bold leading-relaxed text-slate-600">
          예상치 못한 오류가 발생했어요.
          <br />
          다시 시도하거나 처음 화면으로 돌아가 주세요.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#0c3b42] px-6 py-3 text-lg font-black text-white shadow-lg transition-colors hover:bg-[#0a2f35]"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="rounded-xl border-2 border-[#0c3b42]/20 bg-white px-6 py-3 text-lg font-black text-[#0c3b42] shadow-lg transition-colors hover:bg-slate-50"
          >
            처음으로
          </Link>
        </div>
      </div>
    </div>
  )
}
