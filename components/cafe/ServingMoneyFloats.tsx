'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { formatCafeMoneyDelta } from '@/lib/game/cafe'

type Float = { id: string; x: number; y: number; amount: number; isGolden?: boolean }

/** 손님을 서빙한 자리에서 떠오르는 수익 숫자. 황금 뒤집개가 적용되면 금색이다. */
export default function ServingMoneyFloats({ animations }: { animations: Float[] }) {
  return (
    <AnimatePresence>
      {animations.map((anim) => (
        <motion.div
          key={anim.id}
          initial={{ opacity: 1, x: anim.x, y: anim.y, scale: 1 }}
          animate={{ opacity: 0, y: anim.y - 100, scale: 1.5 }}
          exit={{ opacity: 0 }}
          className="fixed pointer-events-none z-50"
          style={{ left: anim.x, top: anim.y }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`text-4xl font-bold drop-shadow-2xl ${anim.isGolden ? 'text-amber-300' : 'text-green-400'}`}
            style={{ textShadow: anim.isGolden ? '0 0 14px rgba(251, 191, 36, 0.9)' : '0 0 10px rgba(34, 197, 94, 0.8)' }}
          >
            {formatCafeMoneyDelta(anim.amount)}
          </motion.div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}
