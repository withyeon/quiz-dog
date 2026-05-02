'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { getGameModeUrl } from '@/hooks/useGameBase'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'

/* ─────────────────────────────────────────────────────────────
   픽셀 버튼
───────────────────────────────────────────────────────────── */
export function PixelBtn({
  children,
  color = 'blue',
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const colors = {
    blue:   { bg: '#2E7BD4', border: '#1A4F9C', shadow: '#0D2E6B' },
    green:  { bg: '#2D9E5E', border: '#1A6B3A', shadow: '#0D4022' },
    orange: { bg: '#E87A1A', border: '#A85210', shadow: '#6B3008' },
    red:    { bg: '#D43030', border: '#9C1A1A', shadow: '#6B0D0D' },
    purple: { bg: '#7B4FCC', border: '#4F2F9A', shadow: '#2D1860' },
  }
  const c = colors[color]
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -2, scale: 1.02 }}
      whileTap={disabled ? {} : { y: 3, scale: 0.98 }}
      className={`relative font-black text-white rounded-xl px-6 py-3 transition-opacity ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{
        background: c.bg,
        border: `3px solid ${c.border}`,
        boxShadow: disabled ? 'none' : `0 5px 0 ${c.shadow}, 0 8px 20px rgba(0,0,0,0.2)`,
        fontFamily: "'BMJUA', sans-serif",
        textShadow: `0 2px 0 ${c.shadow}`,
      }}
    >
      {children}
    </motion.button>
  )
}

/* ─────────────────────────────────────────────────────────────
   픽셀 입력 필드
───────────────────────────────────────────────────────────── */
export function PixelInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`px-5 py-4 rounded-xl font-black text-center outline-none text-gray-800 ${props.className ?? ''}`}
      style={{
        background: '#FFFBF2',
        border: '3px solid #C17B3A',
        boxShadow: '0 4px 0 rgba(91,58,26,0.25), inset 0 2px 4px rgba(91,58,26,0.08)',
        fontFamily: "'BMJUA', sans-serif",
        fontSize: '1.5rem',
        ...props.style,
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   픽셀 패널
───────────────────────────────────────────────────────────── */
export function PixelPanel({
  children,
  label,
  labelColor = '#C17B3A',
  className = '',
}: {
  children: React.ReactNode
  label?: string
  labelColor?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <div
          className="absolute -top-5 left-5 px-4 py-1.5 rounded-lg font-black text-sm text-white z-10"
          style={{
            background: labelColor,
            border: '3px solid rgba(0,0,0,0.2)',
            boxShadow: '0 3px 0 rgba(0,0,0,0.2)',
            fontFamily: "'BMJUA', sans-serif",
          }}
        >
          {label}
        </div>
      )}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,250,240,0.95)',
          border: '3px solid rgba(193,123,58,0.4)',
          boxShadow: '0 6px 0 rgba(91,58,26,0.2), 0 12px 32px rgba(91,58,26,0.12)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   게임 모드 버튼 컴포넌트
───────────────────────────────────────────────────────────── */
export function GameModeButton({ roomCode, playerId }: { roomCode: string; playerId: string | null }) {
  const { room } = useRoomRealtime({ roomCode })
  const gameMode = room?.game_mode || 'gold_quest'
  const gameUrl = getGameModeUrl(gameMode, roomCode, playerId || '')

  return (
    <a href={gameUrl} className="block">
      <PixelBtn color="green" className="w-full text-lg py-4">
        🚀 게임 시작하기 →
      </PixelBtn>
    </a>
  )
}

/* ─────────────────────────────────────────────────────────────
   플레이어 아바타
───────────────────────────────────────────────────────────── */
export function PlayerAvatar({ nickname, avatar, isReady = false }: { nickname: string; avatar: string; isReady?: boolean }) {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl relative"
        style={{
          background: 'rgba(193,123,58,0.15)',
          border: `3px solid ${isReady ? '#2D9E5E' : '#C17B3A'}`,
          boxShadow: `0 3px 0 ${isReady ? '#1A6B3A' : 'rgba(91,58,26,0.3)'}`,
        }}
      >
        {avatar}
        {isReady && (
          <div className="absolute -top-2 -right-2 text-xs bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-black">
            ✓
          </div>
        )}
      </div>
      <span className="text-xs font-black truncate max-w-[56px]" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
        {nickname}
      </span>
    </motion.div>
  )
}
