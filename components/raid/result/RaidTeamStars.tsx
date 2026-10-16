'use client'

import { motion } from 'framer-motion'
import { Stamp, Star } from 'lucide-react'

type RaidTeamStarsProps = {
  stars: 0 | 1 | 2 | 3
  size?: 'md' | 'lg' | 'xl'
  className?: string
}

const STAR_PX = { md: 40, lg: 60, xl: 88 } as const

/**
 * 팀 별 3칸. 얻은 별이 차례로 통통 튀며 들어온다.
 * 별이 0개여도 빈손이 아니라 "도전 도장"을 찍어 준다 — 도전했다는 것 자체가 성과.
 */
export default function RaidTeamStars({ stars, size = 'lg', className = '' }: RaidTeamStarsProps) {
  const px = STAR_PX[size]
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-end justify-center gap-1.5" role="img" aria-label={`팀 별 ${stars}개`}>
        {[0, 1, 2].map((index) => {
          const earned = index < stars
          // 가운데 별을 조금 더 크고 높게 — 왕관처럼 보이게
          const scale = index === 1 ? 1.18 : 1
          return (
            <motion.span
              key={index}
              initial={{ scale: 0, rotate: -45, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 13, delay: 0.25 + index * 0.3 }}
              style={{ marginBottom: index === 1 ? px * 0.3 : 0 }}
            >
              <Star
                width={px * scale}
                height={px * scale}
                strokeWidth={earned ? 1.5 : 2}
                className={
                  earned
                    ? 'fill-amber-300 text-amber-100 drop-shadow-[0_0_14px_rgba(251,191,36,0.95)]'
                    : 'fill-white/5 text-white/25'
                }
              />
            </motion.span>
          )
        })}
      </div>
      {stars === 0 && (
        <motion.div
          initial={{ scale: 2.2, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 1 }}
          className="inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-sky-200/70 bg-sky-400/15 px-3 py-1 text-sm font-black text-sky-100"
        >
          <Stamp className="h-4 w-4" />
          도전 도장
        </motion.div>
      )}
    </div>
  )
}
