'use client'

import { motion } from 'framer-motion'
import { Sparkles, Wind, Zap } from 'lucide-react'
import { RAID, type RaidSkillState } from '@/lib/game/raid'
import { toSegments } from './stageTheme'

type SkillUiProps = {
  skill: RaidSkillState
  isLarge: boolean
  reduceMotion: boolean
}

/**
 * 이름표 오른쪽 아래의 작은 상태 칩.
 * idle: 다음 필살기까지 · groggy: 기절 보상 · blizzard: 못 끊은 뒤 다독이는 한 줄.
 * charging 은 아래 SkillTelegraph 가 무대 위를 크게 덮으므로 칩을 비워 둔다.
 */
export function SkillChip({ skill, isLarge, reduceMotion }: SkillUiProps) {
  const base = `inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-black ${isLarge ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-[11px]'}`
  const icon = isLarge ? 'h-4 w-4' : 'h-3 w-3'

  if (skill.phase === 'charging') return null

  if (skill.phase === 'groggy') {
    return (
      <motion.span
        className={`${base} bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950 shadow-lg shadow-amber-400/40`}
        animate={reduceMotion ? undefined : { scale: [1, 1.07, 1] }}
        transition={{ duration: 0.7, repeat: Infinity }}
      >
        <Sparkles className={icon} />
        기절! 데미지 ×{RAID.GROGGY_MULTIPLIER} · {skill.secondsLeft}초
      </motion.span>
    )
  }

  if (skill.phase === 'blizzard') {
    return (
      <span className={`${base} bg-sky-50 text-sky-900 shadow-md shadow-sky-200/40`}>
        <Wind className={icon} />
        눈보라! 다음엔 꼭 끊어요
      </span>
    )
  }

  // 10초 안으로 다가오면 눈에 띄게 — 친구들이 미리 마음의 준비를 하게
  const soon = skill.nextIn > 0 && skill.nextIn <= 10
  return (
    <span className={`${base} ring-1 ${soon ? 'bg-amber-400/20 text-amber-200 ring-amber-300/40' : 'bg-white/10 text-sky-100 ring-white/10'}`}>
      <Zap className={icon} />
      필살기까지 {skill.nextIn}초
    </span>
  )
}

/**
 * 필살기 예고 — 무대 맨 위를 덮는 붉은 경고 띠.
 * 이름 + 줄어드는 시간 막대 + 끊기 게이지(익명 칸) 순서로, 누가 기여했는지는 보여 주지 않고 "몇 명이 더"만 알린다.
 */
export function SkillTelegraph({ skill, isLarge, reduceMotion }: SkillUiProps) {
  const gauge = toSegments(skill.points, skill.required, isLarge ? 20 : 14)
  const urgent = skill.secondsLeft <= 5
  const drain = Math.max(0, Math.min(1, 1 - skill.chargeRatio))

  return (
    <motion.div
      className={`pointer-events-none absolute z-20 overflow-hidden rounded-xl border border-red-300/70 bg-gradient-to-b from-red-600/95 to-red-950/95 shadow-lg shadow-red-950/60 ${
        isLarge ? 'inset-x-6 top-28 px-5 pb-3 pt-4' : 'inset-x-2 top-1.5 px-2.5 pb-1.5 pt-2'
      }`}
      initial={{ opacity: 0, y: -14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      role="status"
    >
      {/* 위험 표시 사선 띠 */}
      <div
        className={`absolute inset-x-0 top-0 ${isLarge ? 'h-1.5' : 'h-1'}`}
        style={{ background: 'repeating-linear-gradient(135deg, #fbbf24 0 6px, #7f1d1d 6px 12px)' }}
      />

      <div className="flex items-center justify-between gap-2">
        <span className={`flex min-w-0 items-center gap-1 font-black leading-none text-white ${isLarge ? 'text-2xl' : 'text-sm'}`}>
          <motion.span
            className="inline-flex shrink-0"
            animate={reduceMotion ? undefined : { rotate: [-12, 12, -12], scale: [1, 1.15, 1] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            <Zap className={`fill-yellow-300 text-yellow-200 ${isLarge ? 'h-7 w-7' : 'h-4 w-4'}`} />
          </motion.span>
          <span className="truncate">{skill.skillName}</span>
          <span className={`shrink-0 font-bold text-red-100/80 ${isLarge ? 'text-base' : 'text-[10px]'}`}>필살기 예고</span>
        </span>
        <span className={`shrink-0 font-black tabular-nums leading-none ${urgent ? 'text-yellow-200' : 'text-white'} ${isLarge ? 'text-3xl' : 'text-sm'}`}>
          {skill.secondsLeft}초
        </span>
      </div>

      {/* 줄어드는 시간 막대 */}
      <div className={`mt-1 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10 ${isLarge ? 'h-3' : 'h-1.5'}`}>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-orange-400"
          initial={false}
          animate={{ width: `${drain * 100}%` }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </div>

      {/* 끊기 게이지 + 안내 */}
      <div className={`flex items-center ${isLarge ? 'mt-2 gap-3' : 'mt-1 gap-2'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-[2px]" role="img" aria-label={`끊기 ${skill.points} / ${skill.required}`}>
          {Array.from({ length: gauge.total }).map((_, i) => (
            <span
              key={i}
              className={`block flex-1 rounded-sm transition-colors duration-300 ${
                i < gauge.filled
                  ? 'bg-cyan-300 shadow-[0_0_5px_rgba(103,232,249,0.9)]'
                  : 'bg-black/35 ring-1 ring-inset ring-white/20'
              } ${isLarge ? 'h-3.5' : 'h-2'}`}
            />
          ))}
        </div>
        <span className={`shrink-0 whitespace-nowrap font-bold leading-none text-red-50 ${isLarge ? 'text-base' : 'text-[10px]'}`}>
          친구 {skill.remaining}명이 더 맞히면 끊어요
        </span>
      </div>
    </motion.div>
  )
}
