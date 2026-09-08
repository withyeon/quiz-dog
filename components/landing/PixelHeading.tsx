'use client'

import React from 'react'

/* ─────────────────────────────────────────────────────────────
   픽셀 헤딩 — 퀴즈독 브랜드(하늘 + 남색) 게임풍 제목
   흰 글자 + 두꺼운 남색 외곽선 + 아래로 깔린 남색 블록 그림자.
   Navbar(.nav-outlined-text)와 같은 언어라 페이지 전체가 한 세트로 보인다.
───────────────────────────────────────────────────────────── */

const NAVY = '#1E3A8A'

// 두꺼운 외곽선 '아래'로 그림자를 얕게 깔아 입체감만 준다(너무 깊으면 글자가 무거워진다).
const NAVY_SHADOW = [
  '0 2px 0 #1E3A8A',
  '1px 4px 0 #1B3378',
  '1px 6px 0 #172A63',
  '2px 8px 0 #12204D',
  '2px 10px 10px rgba(12,32,77,0.30)',
].join(', ')

const BASE: React.CSSProperties = {
  fontFamily: "'DNFBitBitv2', sans-serif",
  WebkitTextStrokeWidth: '6px',
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
