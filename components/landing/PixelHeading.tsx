'use client'

import React from 'react'

/* ─────────────────────────────────────────────────────────────
   픽셀 헤딩 — 퀴즈독 브랜드(하늘 + 남색) 게임풍 제목
   흰 글자 + 두꺼운 남색 외곽선 + 아래로 깔린 남색 블록 그림자.
   Navbar(.nav-outlined-text)와 같은 언어라 페이지 전체가 한 세트로 보인다.
   tone="ink" 는 외곽선·그림자 없는 검은 글자 (랜딩 첫 화면 제목).
───────────────────────────────────────────────────────────── */

const NAVY = '#1E3A8A'
const INK = '#111827'

// 외곽선 '아래'로만 얕게 깔아 입체감만 준다.
// 예전에는 획 6px + 그림자 5겹이었는데, 픽셀 폰트인데도 모서리가 뭉개지고
// '을·처·럼'의 속 구멍이 메워질 만큼 두꺼워서 획과 그림자를 함께 줄였다.
const NAVY_SHADOW = [
  '0 3px 0 #1B3378',
  '0 5px 6px rgba(12,32,77,0.22)',
].join(', ')

type Tone = 'navy' | 'ink'

const TONES: Record<Tone, { fill: string; stroke: string; strokeWidth: string; shadow: string }> = {
  navy: { fill: '#FFFFFF', stroke: NAVY, strokeWidth: '3px', shadow: NAVY_SHADOW },
  ink: { fill: INK, stroke: 'transparent', strokeWidth: '0', shadow: 'none' },
}

const ToneContext = React.createContext<Tone>('navy')

function baseStyle(tone: Tone): React.CSSProperties {
  return {
    fontFamily: "'DNFBitBitv2', sans-serif",
    WebkitTextStrokeWidth: TONES[tone].strokeWidth,
    WebkitTextStrokeColor: TONES[tone].stroke,
    paintOrder: 'stroke fill',
    letterSpacing: '0.04em',
    textShadow: TONES[tone].shadow,
  }
}

export function PixelHeading({
  children,
  className = '',
  tone = 'navy',
}: {
  children: React.ReactNode
  className?: string
  tone?: Tone
}) {
  return (
    <ToneContext.Provider value={tone}>
      <span
        className={`inline-block pb-3 pr-2 font-black leading-tight ${className}`}
        style={{ ...baseStyle(tone), color: TONES[tone].fill }}
      >
        {children}
      </span>
    </ToneContext.Provider>
  )
}

// 헤딩 안에서 일부 단어를 하늘색으로 강조할 때 사용
export function PixelAccent({ children }: { children: React.ReactNode }) {
  const tone = React.useContext(ToneContext)
  return <span style={{ ...baseStyle(tone), color: '#4FC3F7' }}>{children}</span>
}
