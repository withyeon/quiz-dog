'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'

type RoundPipsProps = {
  total: number
  /** 쓰러뜨린 펭귄 수 — 앞에서부터 채운다 */
  filled: number
  /** 지금 싸우는 펭귄 순번 (장면 전환 중에는 -1) */
  current: number
  isLarge: boolean
  reduceMotion: boolean
}

/** 펭귄 군단 진행 점 — 처치한 만큼 채워지고, 마지막(황제)은 마름모로 구분한다 */
function RoundPips({ total, filled, current, isLarge, reduceMotion }: RoundPipsProps) {
  const size = isLarge ? 13 : 8
  return (
    <div className="flex items-center" style={{ gap: isLarge ? 6 : 4 }} role="img" aria-label={`${filled} / ${total}마리 처치`}>
      {Array.from({ length: total }).map((_, i) => {
        const isFinalPip = i === total - 1
        const done = i < filled
        const isCurrent = i === current
        return (
          <motion.span
            key={i}
            className={`block ${isFinalPip ? 'rotate-45 rounded-[2px]' : 'rounded-full'} ${
              done
                ? 'bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.85)]'
                : isCurrent
                  ? 'bg-white/25 ring-2 ring-white/90'
                  : 'bg-white/20 ring-1 ring-white/30'
            }`}
            style={{ width: isFinalPip ? size - 1 : size, height: isFinalPip ? size - 1 : size }}
            animate={isCurrent && !reduceMotion ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={isCurrent && !reduceMotion ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
          />
        )
      })}
    </div>
  )
}

type BossNameplateProps = {
  /** "1 / 3번째 펭귄" 같은 순번 문구 */
  label: string
  name: string
  isFinal: boolean
  bossCount: number
  filledCount: number
  currentIndex: number
  /** 오른쪽 아래 칸(필살기 칩) */
  chip?: ReactNode
  /** 필살기 예고 띠가 위를 덮는 동안 숨긴다 (자리는 그대로 두어 높이가 변하지 않게) */
  covered?: boolean
  isLarge: boolean
  reduceMotion: boolean
}

/**
 * MMO 보스 프레임 같은 이름표 — 위줄: 순번·최종 보스 배지·군단 진행 점, 아랫줄: 이름·필살기 칩.
 * 어두운 반투명 판 위에 올려 어떤 배경에서도 글씨가 읽힌다.
 */
export default function BossNameplate({
  label,
  name,
  isFinal,
  bossCount,
  filledCount,
  currentIndex,
  chip,
  covered = false,
  isLarge,
  reduceMotion,
}: BossNameplateProps) {
  return (
    <div
      className={`rounded-xl bg-slate-950/50 ring-1 ring-white/10 backdrop-blur-[2px] transition-opacity duration-200 ${
        isLarge ? 'px-4 py-2.5' : 'px-2.5 py-1'
      } ${covered ? 'opacity-0' : 'opacity-100'}`}
      aria-hidden={covered}
    >
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <div className={`flex min-w-0 items-center gap-1.5 font-black leading-none text-sky-100/80 ${isLarge ? 'text-sm' : 'text-[11px]'}`}>
          <span className="truncate">{label}</span>
          {isFinal && (
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 font-black leading-none text-amber-950 ${
                isLarge ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-[3px] text-[10px]'
              }`}
            >
              <Crown className={isLarge ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'} />
              최종 보스
            </span>
          )}
        </div>
        <RoundPips total={bossCount} filled={filledCount} current={currentIndex} isLarge={isLarge} reduceMotion={reduceMotion} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <h2
          className={`min-w-0 truncate font-black leading-tight text-white [text-shadow:0_2px_0_rgba(0,0,0,0.55)] ${isLarge ? 'text-3xl sm:text-4xl' : 'text-base'}`}
        >
          {name}
        </h2>
        {chip}
      </div>
    </div>
  )
}
