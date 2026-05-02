'use client'

import React from 'react'

export function LobbyClassroomBg() {
  return (
    <svg
      viewBox="0 0 1200 800"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="1200" height="800" fill="#F2E4C8" />
      {[120, 240, 360, 480, 600].map((y) => (
        <line key={y} x1="0" y1={y} x2="1200" y2={y} stroke="#DDD0B0" strokeWidth="2" />
      ))}
      <rect y="620" width="1200" height="180" fill="#C4923A" />
      {[0, 200, 400, 600, 800, 1000, 1200].map((x) => (
        <line key={x} x1={x} y1="620" x2={x} y2="800" stroke="#A87020" strokeWidth="2" />
      ))}
      {/* 칠판 */}
      <rect x="280" y="40" width="640" height="240" rx="4" fill="#2A2A18" />
      <rect x="292" y="52" width="616" height="216" rx="2" fill="#1E5C3A" />
      <rect x="292" y="52" width="616" height="8" fill="rgba(255,255,255,0.06)" />
      <text x="330" y="120" fill="rgba(255,255,255,0.22)" fontSize="20" fontFamily="monospace">오늘의 퀴즈: 게임 코드를 입력하세요 🐶</text>
      <text x="380" y="200" fill="rgba(255,255,255,0.14)" fontSize="16" fontFamily="monospace">틀려도 괜찮아! 함께 배우자!</text>
      <rect x="280" y="278" width="640" height="14" rx="3" fill="#1E1008" />
      {[300, 335, 370, 405].map((x, i) => (
        <rect key={i} x={x} y={280} width={24} height={9} rx="2"
          fill={['#FEF9F0', '#FFB0B0', '#B8D8FF', '#FFFE90'][i]} />
      ))}
      {/* 창문 */}
      {[30, 1080].map((x) => (
        <g key={x}>
          <rect x={x} y="60" width="130" height="180" rx="4" fill="#87CEEB" opacity="0.85" />
          <rect x={x} y="60" width="130" height="180" rx="4" fill="none" stroke="#6A501A" strokeWidth="5" />
          <line x1={x + 65} y1="60" x2={x + 65} y2="240" stroke="#6A501A" strokeWidth="4" />
          <line x1={x} y1="150" x2={x + 130} y2="150" stroke="#6A501A" strokeWidth="4" />
          <rect x={x + 5} y="65" width="56" height="80" fill="rgba(255,255,255,0.28)" rx="2" />
        </g>
      ))}
      {/* 책상들 (배경 장식) */}
      {[60, 340, 620, 900].map((x) => (
        <g key={x} opacity="0.7">
          <rect x={x} y="600" width="160" height="22" rx="4" fill="#B07030" />
          <rect x={x + 20} y="622" width="12" height="32" rx="2" fill="#8B5A1A" />
          <rect x={x + 128} y="622" width="12" height="32" rx="2" fill="#8B5A1A" />
        </g>
      ))}
    </svg>
  )
}
