'use client'

import React from 'react'

/* ─────────────────────────────────────────────────────────────
   픽셀 헤딩 — 레퍼런스(게임풍 두꺼운 대각선 입체 그림자) 스타일
   밝은 보라 글자 + 또렷한 외곽선 + 오른쪽 아래로 두껍게 깔린 블록 그림자.
   퀴즈독 공식색(보라 #7B4FCC, 골드) 기반.
───────────────────────────────────────────────────────────── */

// 두꺼운 외곽선 '아래'로 그림자가 또렷이 깔리도록 세로로 더 떨어뜨린다.
const PURPLE_SHADOW = [
  '0 4px 0 #5B36A6',
  '1px 6px 0 #4F2F9A',
  '1px 8px 0 #4F2F9A',
  '2px 10px 0 #3A2475',
  '2px 12px 0 #3A2475',
  '3px 14px 0 #2D1860',
  '3px 16px 0 #2D1860',
  '3px 20px 18px rgba(45,24,96,0.5)',
].join(', ')

const GOLD_SHADOW = [
  '0 4px 0 #E08600',
  '1px 6px 0 #C2410C',
  '1px 8px 0 #C2410C',
  '2px 10px 0 #9A3412',
  '2px 12px 0 #9A3412',
  '3px 14px 0 #7C2D12',
  '3px 16px 0 #7C2D12',
  '3px 20px 18px rgba(124,45,18,0.5)',
].join(', ')

const BASE: React.CSSProperties = {
  fontFamily: "'DNFBitBitv2', sans-serif",
  // 두꺼운 연보라 외곽선을 글자 바깥쪽에만 남겨 배경에서 톡 튀게 한다.
  WebkitTextStrokeWidth: '6px',
  WebkitTextStrokeColor: '#D6C7F5',
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
      className={`inline-block pb-5 pr-2 font-black leading-tight ${className}`}
      style={{
        ...BASE,
        color: '#9D74E0',
        textShadow: PURPLE_SHADOW,
      }}
    >
      {children}
    </span>
  )
}

// 헤딩 안에서 일부 단어를 골드로 강조할 때 사용
export function PixelAccent({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        ...BASE,
        color: '#FFD24A',
        textShadow: GOLD_SHADOW,
      }}
    >
      {children}
    </span>
  )
}
