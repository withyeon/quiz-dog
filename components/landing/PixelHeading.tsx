'use client'

import React from 'react'

/* ─────────────────────────────────────────────────────────────
   픽셀 헤딩 — 퀴즈독 브랜드(하늘 + 남색) 게임풍 제목
   흰 글자 + 두꺼운 남색 외곽선 + 아래로 깔린 남색 블록 그림자.
   Navbar(.nav-outlined-text)와 같은 언어라 페이지 전체가 한 세트로 보인다.
───────────────────────────────────────────────────────────── */

const NAVY = '#1E3A8A'

// 외곽선 '아래'로만 얕게 깔아 입체감만 준다.
// 예전에는 획 6px + 그림자 5겹이었는데, 픽셀 폰트인데도 모서리가 뭉개지고
// '을·처·럼'의 속 구멍이 메워질 만큼 두꺼워서 획과 그림자를 함께 줄였다.
const NAVY_SHADOW = [
  '0 3px 0 #1B3378',
  '0 5px 6px rgba(12,32,77,0.22)',
].join(', ')

const BASE: React.CSSProperties = {
  fontFamily: "'DNFBitBitv2', sans-serif",
  WebkitTextStrokeWidth: '3px',
  WebkitTextStrokeColor: NAVY,
  paintOrder: 'stroke fill',
  letterSpacing: '0.04em',
}

export function PixelHeading({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-block pb-3 pr-2 font-black leading-tight ${className}`}
      style={{
        ...BASE,
        color: '#FFFFFF',
        textShadow: NAVY_SHADOW,
      }}
    >
      {children}
    </span>
  )
}

// 헤딩 안에서 일부 단어를 하늘색으로 강조할 때 사용
export function PixelAccent({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        ...BASE,
        color: '#4FC3F7',
        textShadow: NAVY_SHADOW,
      }}
    >
      {children}
    </span>
  )
}
