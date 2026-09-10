'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { isAvatarPath, resolveAvatarSrc } from '@/lib/utils/playerDisplay'
import { DEFAULT_GAME_MODE, getGameModeUrl } from '@/lib/game/modes'
import PawBackgroundDecor from '@/components/PawBackgroundDecor'
import { gameAssets } from '@/assets/game-assets'

/* ─────────────────────────────────────────────────────────────
   퀴즈독 학생 입장 화면 UI 키트
   랜딩(하늘 #d9eef5 + 남색 #1E3A8A + 흰 카드 + 하늘 그라디언트 알약 버튼)과
   같은 언어를 쓴다. 학생이 코드를 넣고 게임에 들어가기까지 한 세트로 보이게.
───────────────────────────────────────────────────────────── */

export const NAVY = '#1E3A8A'
export const SKY_BG = '#d9eef5'

const SKY_GRADIENT = 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)'

/* ─────────────────────────────────────────────────────────────
   페이지 셸 — 하늘 배경 + 발자국 + 질감
───────────────────────────────────────────────────────────── */
export function LobbyShell({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      className={`relative min-h-dvh overflow-x-hidden font-bitbit ${className}`}
      style={{ background: SKY_BG }}
    >
      {/* 위쪽을 살짝 밝혀 하늘처럼 — 카드가 떠 보이게 하는 역할 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh]"
        style={{ background: 'radial-gradient(ellipse 90% 100% at 50% 0%, rgba(255,255,255,0.9), rgba(255,255,255,0) 72%)' }}
        aria-hidden
      />
      <PawBackgroundDecor />
      <div className="page-texture-overlay" aria-hidden />
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>
    </main>
  )
}

/* ─────────────────────────────────────────────────────────────
   단계 표시 — 코드 → 닉네임 → 캐릭터 → 대기
───────────────────────────────────────────────────────────── */
export function LobbyStepBar<Step extends string>({
  steps,
  current,
}: {
  steps: { key: Step; label: string }[]
  current: Step
}) {
  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === current))

  return (
    <div className="sticky top-0 z-30 flex justify-center px-3 py-3">
      <div
        className="flex items-center gap-1.5 rounded-full px-3 py-2"
        style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          border: '2px solid #BAE6FD',
          boxShadow: '0 4px 16px rgba(14,165,233,0.16), inset 0 1px 0 rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {steps.map((step, index) => {
          const isActive = index === currentIndex
          const isDone = index < currentIndex

          return (
            <React.Fragment key={step.key}>
              <span
                className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-black transition-all"
                style={
                  isActive
                    ? { background: SKY_GRADIENT, color: '#FFFFFF', boxShadow: '0 2px 0 #0b8fc4', textShadow: '0 1px 0 rgba(0,0,0,0.18)' }
                    : { backgroundColor: isDone ? 'rgba(186,230,253,0.6)' : 'rgba(226,232,240,0.7)', color: isDone ? '#0369A1' : '#94A3B8' }
                }
              >
                <span>{isDone ? '✓' : index + 1}</span>
                {/* 좁은 화면에서는 현재 단계 이름만 보여준다 */}
                <span className={isActive ? 'inline' : 'hidden sm:inline'}>{step.label}</span>
              </span>
              {index < steps.length - 1 && (
                <span
                  className="h-1 w-2.5 shrink-0 rounded-full sm:w-3"
                  style={{ backgroundColor: isDone ? '#7dd3fc' : '#E2E8F0' }}
                  aria-hidden
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   상태 바 — 닉네임 · 게임 모드 · 접속 인원
───────────────────────────────────────────────────────────── */
export function LobbyStatusBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-center gap-2 rounded-[22px] px-3 py-2.5 sm:justify-between sm:px-4 ${className}`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.88)',
        border: '2px solid rgba(186,230,253,0.9)',
        boxShadow: '0 6px 20px rgba(14,165,233,0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
    >
      {children}
    </div>
  )
}

const CHIP_TONES = {
  sky: { backgroundColor: '#E0F2FE', color: '#0369A1', border: '2px solid #BAE6FD' },
  mint: { backgroundColor: '#DCFCE7', color: '#15803D', border: '2px solid #BBF7D0' },
  sun: { backgroundColor: '#FEF3C7', color: '#B45309', border: '2px solid #FDE68A' },
  navy: { backgroundColor: '#EEF4FF', color: NAVY, border: '2px solid #C7D8FF' },
} as const

export function StatusChip({
  children,
  tone = 'sky',
  className = '',
}: {
  children: React.ReactNode
  tone?: keyof typeof CHIP_TONES
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black ${className}`}
      style={CHIP_TONES[tone]}
    >
      {children}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
   알림 박스 — 입장 완료 / 안내 / 오류
───────────────────────────────────────────────────────────── */
const NOTICE_TONES = {
  success: { backgroundColor: '#F0FDF4', border: '2px solid #BBF7D0', color: '#15803D' },
  info: { backgroundColor: '#F0F9FF', border: '2px solid #BAE6FD', color: '#0369A1' },
  error: { backgroundColor: '#FFF1F2', border: '2px solid #FECDD3', color: '#BE123C' },
} as const

export function LobbyNotice({
  children,
  tone = 'info',
  className = '',
  role,
}: {
  children: React.ReactNode
  tone?: keyof typeof NOTICE_TONES
  className?: string
  role?: string
}) {
  return (
    <div
      role={role}
      className={`rounded-2xl px-4 py-3 text-center text-sm font-black ${className}`}
      style={{ ...NOTICE_TONES[tone], boxShadow: '0 3px 0 rgba(14,165,233,0.08)' }}
    >
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   마스코트 — 랜딩과 같은 포메 · 시골이
───────────────────────────────────────────────────────────── */
export function MascotDuo({ size = 80, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={`flex items-end justify-center gap-2 ${className}`}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <Image
        src={gameAssets['mascot-pome'].tight}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="pixelated object-contain drop-shadow-md"
        style={{ width: size, height: size }}
      />
      <Image
        src={gameAssets.mascot_sigol.tight}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="pixelated object-contain drop-shadow-md"
        style={{ width: Math.round(size * 0.86), height: Math.round(size * 0.86) }}
      />
    </motion.div>
  )
}

export function MascotPome({ size = 96, className = '' }: { size?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <Image
        src={gameAssets['mascot-pome'].tight}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="pixelated object-contain drop-shadow-md"
        style={{ width: size, height: size }}
      />
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────────────────
   버튼 — 랜딩 CTA와 같은 하늘 그라디언트 알약
───────────────────────────────────────────────────────────── */
const BUTTON_TONES = {
  blue: { background: SKY_GRADIENT, hard: '#0b8fc4', glow: 'rgba(14,165,233,0.3)' },
  green: { background: 'linear-gradient(180deg, #86EFAC 0%, #4ADE80 45%, #22C55E 100%)', hard: '#15803D', glow: 'rgba(34,197,94,0.28)' },
  orange: { background: 'linear-gradient(180deg, #FED7AA 0%, #FB923C 45%, #F97316 100%)', hard: '#C2410C', glow: 'rgba(249,115,22,0.28)' },
  red: { background: 'linear-gradient(180deg, #FECACA 0%, #F87171 45%, #EF4444 100%)', hard: '#B91C1C', glow: 'rgba(239,68,68,0.28)' },
  purple: { background: 'linear-gradient(180deg, #DDD6FE 0%, #A78BFA 45%, #8B5CF6 100%)', hard: '#6D28D9', glow: 'rgba(139,92,246,0.28)' },
} as const

export function PixelBtn({
  children,
  color = 'blue',
  onClick,
  disabled = false,
  className = '',
}: {
  children: React.ReactNode
  /** white는 랜딩의 보조 버튼(흰 알약 + 하늘 테두리) */
  color?: keyof typeof BUTTON_TONES | 'white'
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const isGhost = color === 'white'
  const tone = isGhost ? null : BUTTON_TONES[color]

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { y: -3 }}
      whileTap={disabled ? {} : { y: 0, scale: 0.98 }}
      // shrink-0: 좁은 화면에서 버튼이 찌그러지거나 밀려나지 않도록 고정
      className={`relative shrink-0 whitespace-nowrap rounded-full px-5 py-3 font-black transition-opacity sm:px-7 ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className}`}
      style={
        isGhost
          ? {
              backgroundColor: '#FFFFFF',
              border: '2px solid #BAE6FD',
              color: '#0369A1',
              boxShadow: disabled ? 'none' : '0 5px 0 rgba(186,230,253,0.9), 0 10px 20px rgba(14,165,233,0.14)',
            }
          : {
              background: tone!.background,
              color: '#FFFFFF',
              boxShadow: disabled
                ? 'none'
                : `0 5px 0 ${tone!.hard}, 0 10px 20px ${tone!.glow}, inset 0 1px 0 rgba(255,255,255,0.45)`,
              textShadow: '0 1px 0 rgba(0,0,0,0.18)',
            }
      }
    >
      {children}
    </motion.button>
  )
}

/* ─────────────────────────────────────────────────────────────
   입력 필드
───────────────────────────────────────────────────────────── */
export function PixelInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      // min-w-0 필수: input은 기본 intrinsic 너비를 가지는데 flex 아이템의
      // min-width:auto 때문에 flex-1이어도 그 아래로 줄지 않아 형제 요소를
      // 컨테이너 밖으로 밀어낸다(모바일에서 버튼이 화면 밖으로 사라졌던 원인).
      className={`w-full min-w-0 rounded-2xl px-3 py-3 text-center font-black outline-none transition placeholder:text-slate-400 focus:border-sky-400 sm:px-5 sm:py-4 ${props.className ?? ''}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '2px solid #BAE6FD',
        color: '#0F172A',
        boxShadow: '0 4px 0 rgba(186,230,253,0.85), inset 0 1px 0 rgba(255,255,255,0.9)',
        fontSize: 'clamp(1.05rem, 4.5vw, 1.5rem)',
        ...props.style,
      }}
    />
  )
}

/* ─────────────────────────────────────────────────────────────
   패널 — 랜딩의 흰 카드 + 라벨 알약
───────────────────────────────────────────────────────────── */
export function PixelPanel({
  children,
  label,
  labelColor = '#4FC3F7',
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
          className="absolute -top-4 left-5 z-10 rounded-full px-4 py-1.5 text-sm font-black text-white"
          style={{
            backgroundColor: labelColor,
            border: '2px solid rgba(255,255,255,0.92)',
            boxShadow: '0 3px 0 rgba(12,32,77,0.14), 0 6px 14px rgba(14,165,233,0.2)',
            textShadow: '0 1px 0 rgba(0,0,0,0.18)',
          }}
        >
          {label}
        </div>
      )}
      <div
        className="toss-card texture-grain relative overflow-hidden rounded-[28px]"
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(226,232,240,0.9)',
          boxShadow: '0 8px 48px rgba(14,165,233,0.12), 0 2px 8px rgba(0,0,0,0.05)',
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
export function GameModeButton({
  roomCode,
  playerId,
  gameMode = DEFAULT_GAME_MODE,
}: {
  roomCode: string
  playerId: string | null
  gameMode?: string | null
}) {
  const router = useRouter()
  const gameUrl = getGameModeUrl(gameMode, roomCode, playerId || '')

  return (
    <PixelBtn color="green" className="w-full py-4 text-lg" onClick={() => router.push(gameUrl)}>
      🚀 게임 시작하기 →
    </PixelBtn>
  )
}

/* ─────────────────────────────────────────────────────────────
   플레이어 아바타
───────────────────────────────────────────────────────────── */
export function PlayerAvatar({ nickname, avatar, isReady = false }: { nickname: string; avatar: string; isReady?: boolean }) {
  const normalizedAvatar = avatar.trim()
  const hasImageAvatar = isAvatarPath(normalizedAvatar)
  const avatarSrc = resolveAvatarSrc(normalizedAvatar)

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
        style={{
          backgroundColor: isReady ? '#F0FDF4' : '#F0F9FF',
          border: `2px solid ${isReady ? '#4ADE80' : '#BAE6FD'}`,
          boxShadow: `0 3px 0 ${isReady ? 'rgba(74,222,128,0.55)' : 'rgba(186,230,253,0.9)'}`,
        }}
      >
        {hasImageAvatar ? (
          <Image
            src={avatarSrc}
            alt={nickname}
            fill
            className="scale-125 object-contain"
            sizes="56px"
          />
        ) : (
          normalizedAvatar || '🐶'
        )}
        {isReady && (
          <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-black text-white">
            ✓
          </div>
        )}
      </div>
      <span className="max-w-[56px] truncate text-xs font-black" style={{ color: NAVY }}>
        {nickname}
      </span>
    </motion.div>
  )
}
