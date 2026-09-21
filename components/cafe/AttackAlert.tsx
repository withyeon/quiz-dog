'use client'

import { AnimatePresence, motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'

interface AttackAlertProps {
  attack: {
    attackerNickname: string
    itemName: string
    itemEmoji: string
    itemImage: string
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
          <CafeImage
            src={attack.itemImage}
            alt={attack.itemName}
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            fallbackEmoji={attack.itemEmoji}
            fallbackClassName="h-10 w-10 text-3xl"
          />
          <div>
            <div className="text-base font-black">{attack.attackerNickname}의 공격!</div>
            <div className="text-sm font-bold text-rose-200">{attack.itemName} 발동!</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
