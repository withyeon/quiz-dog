'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface AttackAlertProps {
  attack: {
    attackerNickname: string
    itemName: string
    itemEmoji: string
  } | null
}

export default function AttackAlert({ attack }: AttackAlertProps) {
  return (
    <AnimatePresence>
      {attack && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border-4 border-rose-800 bg-rose-600 px-6 py-3 text-white shadow-2xl"
        >
          <span className="text-3xl">{attack.itemEmoji}</span>
          <div>
            <div className="text-base font-black">{attack.attackerNickname}의 공격!</div>
            <div className="text-sm font-bold text-rose-200">{attack.itemName} 발동!</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
