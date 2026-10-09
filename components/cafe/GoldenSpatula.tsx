'use client'

import { motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
import { CAFE_ITEMS, GOLDEN_SPATULA_MULTIPLIER } from '@/lib/game/cafeItems'

const SPATULA = CAFE_ITEMS.GOLDEN_SPATULA

/**
 * 상단 정보 줄의 "황금 뒤집개 N배" 칩. 다음 서빙 한 번에 적용된다.
 * 루트가 motion.div 라서 AnimatePresence 아래에 key 를 주고 두면 나타나고 사라지는 애니메이션이 돈다.
 */
export function GoldenSpatulaChip() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      className="flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-1 text-sm font-black text-amber-950"
    >
      <CafeImage
        src={SPATULA.image}
        alt={SPATULA.name}
        width={20}
        height={20}
        className="h-5 w-5 object-contain"
        fallbackEmoji={SPATULA.emoji}
        fallbackClassName="h-5 w-5 text-sm"
      />
      {GOLDEN_SPATULA_MULTIPLIER}배
    </motion.div>
  )
}

/** 황금 뒤집개로 서빙한 순간 가운데 뜨는 "N배 수익!" 배지. 크기(여백·글자)는 className 으로 준다. */
export function GoldenSpatulaBadge({ className = 'px-8 py-5 text-3xl' }: { className?: string }) {
  return (
    <div className={`rounded-lg bg-amber-400 font-black text-amber-950 shadow-2xl ${className}`}>
      <span className="inline-flex items-center gap-2">
        <CafeImage
          src={SPATULA.image}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 object-contain"
          fallbackEmoji={SPATULA.emoji}
          fallbackClassName="h-10 w-10 text-3xl"
        />
        {SPATULA.name} {GOLDEN_SPATULA_MULTIPLIER}배 수익!
      </span>
    </div>
  )
}
