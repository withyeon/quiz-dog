'use client'

import { motion, AnimatePresence } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
import { CAFE_ITEMS, GOLDEN_SPATULA_MULTIPLIER } from '@/lib/game/cafeItems'

/** 황금 뒤집개로 서빙했을 때 1초 동안 화면 가운데 뜨는 배수 안내. */
export default function GoldenSpatulaFlash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-amber-300/15"
        >
          <div className="rounded-lg bg-amber-400 px-8 py-5 text-3xl font-black text-amber-950 shadow-2xl">
            <span className="inline-flex items-center gap-2">
              <CafeImage
                src={CAFE_ITEMS.GOLDEN_SPATULA.image}
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                fallbackEmoji={CAFE_ITEMS.GOLDEN_SPATULA.emoji}
                fallbackClassName="h-10 w-10 text-3xl"
              />
              {CAFE_ITEMS.GOLDEN_SPATULA.name} {GOLDEN_SPATULA_MULTIPLIER}배 수익!
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
