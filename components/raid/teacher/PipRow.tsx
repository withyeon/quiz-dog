'use client'

import { motion } from 'framer-motion'

type PipTone = 'rose' | 'cyan'

const ON: Record<PipTone, string> = {
  rose: 'border-rose-100 bg-gradient-to-b from-rose-300 to-rose-500 shadow-[0_0_10px_rgba(251,113,133,0.85)]',
  cyan: 'border-cyan-100 bg-gradient-to-b from-cyan-200 to-cyan-400 shadow-[0_0_10px_rgba(103,232,249,0.85)]',
}
const BAR: Record<PipTone, string> = {
  rose: 'bg-gradient-to-r from-rose-400 to-rose-300',
  cyan: 'bg-gradient-to-r from-cyan-400 to-cyan-200',
}

/** 칸이 이 수를 넘으면 칸 대신 막대로 그린다 (큰 반에서도 한 줄에 읽히게) */
const MAX_PIPS = 24

type PipRowProps = {
  filled: number
  total: number
  tone: PipTone
  /** 아직 시작 전이라 흐릿하게 보여 줄 때 */
  dim?: boolean
}

/**
 * 익명 게이지 — 몇 칸 찼는지만 보인다. 누가 채웠는지는 어디에도 없다.
 */
export default function PipRow({ filled, total, tone, dim = false }: PipRowProps) {
  const label = `${Math.min(filled, total)}/${total}`
  if (total > MAX_PIPS) {
    return (
      <div className={`h-4 overflow-hidden rounded-full border border-white/20 bg-black/30 ${dim ? 'opacity-40' : ''}`} role="img" aria-label={label}>
        <div className={`h-full rounded-full transition-[width] duration-500 ${BAR[tone]}`} style={{ width: `${Math.min(100, (filled / total) * 100)}%` }} />
      </div>
    )
  }
  return (
    <div className={`flex flex-wrap gap-1.5 ${dim ? 'opacity-40' : ''}`} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => {
        const on = index < filled
        return (
          <motion.span
            key={index}
            initial={false}
            animate={on ? { scale: [1, 1.4, 1] } : { scale: 1 }}
            transition={{ duration: 0.35 }}
            className={`h-4 w-4 rounded-[5px] border 2xl:h-5 2xl:w-5 ${on ? ON[tone] : 'border-white/20 bg-black/30'}`}
          />
        )
      })}
    </div>
  )
}
