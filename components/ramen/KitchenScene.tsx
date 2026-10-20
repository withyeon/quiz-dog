'use client'

import type { ReactNode } from 'react'

type KitchenSceneProps = {
  children: ReactNode
  className?: string
}

/**
 * 분식집 주방 무대. 크림색 타일 벽·메뉴판·주황 전등·나무 카운터를 CSS 로만 그린다.
 * 고정 위치 모달을 안에 두므로 이 요소에는 backdrop-filter 를 쓰지 않는다.
 */
export default function KitchenScene({ children, className = '' }: KitchenSceneProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border-4 border-[#3b2a1a] bg-[#2a1a10] shadow-2xl ${className}`}>
      {/* 타일 벽 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-90"
        style={{
          backgroundColor: '#fde7c8',
          backgroundImage:
            'linear-gradient(rgba(120,80,40,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120,80,40,0.18) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
        aria-hidden
      />
      {/* 전등 */}
      <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center" aria-hidden>
        <span className="block h-6 w-1 bg-[#1c1917]" />
        <span className="block h-5 w-16 rounded-b-full bg-[#dc2626] shadow-[0_14px_40px_14px_rgba(253,224,71,0.35)]" />
      </div>
      {/* 메뉴판 */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-md border-2 border-[#1c1917] bg-[#14532d] px-2.5 py-1.5 text-[10px] font-black leading-tight text-[#fef3c7] shadow-md sm:right-5 sm:text-xs" aria-hidden>
        <div className="text-[#fde68a]">📋 메뉴</div>
        <div>라면 ····· 1,000원</div>
        <div className="opacity-80">파·계란 서비스</div>
      </div>
      {/* 가게 이름 */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border-2 border-[#1c1917] bg-[#fff7ed] px-2.5 py-1 text-xs font-black text-[#9a3412] shadow-md sm:left-5 sm:text-sm" aria-hidden>
        🍜 퀴즈독 라면가게
      </div>
      {/* 카운터 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-44 bg-[linear-gradient(180deg,#9a6b3f_0%,#7c4f2a_12%,#5b3a1e_100%)]" aria-hidden>
        <div className="h-3 w-full bg-[#c58b55]" />
      </div>

      <div className="relative px-3 pb-4 pt-14 sm:px-5 sm:pt-16">{children}</div>
    </div>
  )
}
