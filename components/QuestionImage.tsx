'use client'

import { useState } from 'react'

interface QuestionImageProps {
  src: string
  alt?: string
  className?: string
  /** 기본 max-h-48 md:max-h-64. 화면이 좁은 게임 패널에서는 더 작게 넘긴다. */
  maxHeightClass?: string
}

/**
 * 게임·결과 화면에서 문제 그림을 보여준다.
 * - 높이를 제한해 보기 버튼을 밀어내지 않는다 (가로는 컨테이너에 맞춤).
 * - 누르면 크게 본다 (태블릿에서 지도·도형의 세부를 봐야 할 때).
 * - 불러오기에 실패하면 자리를 차지하지 않고 사라진다.
 */
export default function QuestionImage({
  src,
  alt = '문제 그림',
  className = '',
  maxHeightClass = 'max-h-48 md:max-h-64',
}: QuestionImageProps) {
  const [failed, setFailed] = useState(false)
  const [enlarged, setEnlarged] = useState(false)

  if (failed) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        className={`block w-full overflow-hidden rounded-xl border border-black/10 bg-white/60 ${className}`}
        aria-label="그림 크게 보기"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          decoding="async"
          onError={() => setFailed(true)}
          className={`mx-auto ${maxHeightClass} w-auto max-w-full object-contain`}
        />
      </button>

      {enlarged && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setEnlarged(false)}
          role="dialog"
          aria-label="문제 그림 크게 보기"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[92vh] max-w-full rounded-lg object-contain" />
          <span className="pointer-events-none absolute bottom-6 rounded-full bg-white/15 px-4 py-1.5 text-sm font-bold text-white">
            탭해서 닫기
          </span>
        </div>
      )}
    </>
  )
}
