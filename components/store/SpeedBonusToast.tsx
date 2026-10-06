'use client'

import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { formatMoney } from '@/lib/game/convenienceStore'

/** 빠른 정답에 붙는 속도 보너스 플로팅 표시. 1.5초 동안 떠올랐다 사라진다. */
export default function SpeedBonusToast({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.5, 1.2, 1, 0.8] }}
      transition={{ duration: 1.5 }}
      className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="bg-yellow-400 text-gray-900 font-black text-3xl px-6 py-3 rounded-2xl shadow-2xl border-4 border-yellow-600 flex items-center gap-2">
        <Zap size={28} className="fill-current" />
        +{formatMoney(amount)} 속도 보너스!
      </div>
    </motion.div>
  )
}
