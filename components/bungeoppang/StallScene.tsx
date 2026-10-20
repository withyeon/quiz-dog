'use client'

import type { ReactNode } from 'react'

type StallSceneProps = {
  children: ReactNode
  className?: string
}

/**
 * 겨울 밤 포장마차 무대. 어두운 밤하늘·별·살짝 내리는 눈·주황 천막·가로등.
 * 그림 파일 없이 CSS 로만 그린다 (애니메이션 키프레임은 app/bungeoppang/page.tsx 의 style jsx).
 * 고정 위치 모달을 안에 두므로 이 요소에는 backdrop-filter 를 쓰지 않는다.
 */
export default function StallScene({ children, className = '' }: StallSceneProps) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border-4 border-[#2b1f1a] bg-[linear-gradient(180deg,#0f172a_0%,#1e1b4b_55%,#312e81_100%)] shadow-2xl ${className}`}>
      {/* 별 */}
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        {[...Array(14)].map((_, index) => (
          <span
            key={index}
            className="bungeo-star absolute h-1 w-1 rounded-full bg-white"
            style={{ left: `${(index * 37) % 100}%`, top: `${(index * 23) % 45}%`, animationDelay: `${(index % 5) * 0.4}s` }}
          />
        ))}
      </div>
      {/* 눈 */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {[...Array(18)].map((_, index) => (
          <span
            key={index}
            className="bungeo-snow absolute text-white/80"
            style={{
              left: `${(index * 53) % 100}%`,
              fontSize: index % 3 === 0 ? 10 : 7,
              animationDuration: `${6 + (index % 4) * 1.6}s`,
              animationDelay: `${-(index % 7) * 1.1}s`,
            }}
          >
            ❄
          </span>
        ))}
      </div>
      {/* 가로등 */}
      <div className="pointer-events-none absolute right-3 top-2 flex flex-col items-center sm:right-6" aria-hidden>
        <span className="block h-5 w-5 rounded-full bg-[#fde68a] shadow-[0_0_28px_12px_rgba(253,230,138,0.45)]" />
        <span className="block h-20 w-1.5 bg-[#1c1917] sm:h-28" />
      </div>
      {/* 천막 */}
      <div className="pointer-events-none absolute inset-x-0 top-0" aria-hidden>
        <div className="h-6 w-full bg-[repeating-linear-gradient(90deg,#f97316_0_28px,#fff7ed_28px_56px)] shadow-md" />
        <div className="flex">
          {[...Array(12)].map((_, index) => (
            <span key={index} className={`block h-4 flex-1 ${index % 2 === 0 ? 'bg-[#f97316]' : 'bg-[#fff7ed]'} [clip-path:polygon(0_0,100%_0,50%_100%)]`} />
          ))}
        </div>
      </div>
      {/* 눈더미 */}
      <div className="pointer-events-none absolute -bottom-4 left-2 h-12 w-28 rounded-[50%] bg-white/90" aria-hidden />
      <div className="pointer-events-none absolute -bottom-6 right-10 h-14 w-40 rounded-[50%] bg-white/80" aria-hidden />

      <div className="relative px-3 pb-5 pt-12 sm:px-6 sm:pt-14">{children}</div>
    </div>
  )
}
