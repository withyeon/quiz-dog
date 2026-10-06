'use client'

import { motion } from 'framer-motion'
import { Anchor } from 'lucide-react'

/** 선생님이 시작하기 전 대기 패널. */
export default function GoldQuestLobbyPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="gold-quest-panel p-8 sm:p-12 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/70 bg-amber-100/70"
      >
        <Anchor className="h-8 w-8 text-[#0c3b42]" />
      </motion.div>
      <h2 className="gold-quest-title text-4xl font-black text-[#17262a] mb-4">
        게임 대기 중
      </h2>
      <p className="text-gray-600 text-lg mb-6">선생님이 게임을 시작할 때까지 기다려주세요.</p>
      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-[#0c3b42] rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
