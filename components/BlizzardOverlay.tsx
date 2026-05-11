'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Snowflake, Wind } from 'lucide-react'

interface BlizzardOverlayProps {
  isActive: boolean
  duration?: number
}

export default function BlizzardOverlay({ isActive, duration = 5000 }: BlizzardOverlayProps) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isActive) {
      setShow(true)
      const timer = setTimeout(() => setShow(false), duration)
      return () => clearTimeout(timer)
    }
    setShow(false)
  }, [isActive, duration])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.8, 1] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="battle-blizzard-field fixed inset-0 z-50 flex items-center justify-center overflow-hidden backdrop-blur-sm pointer-events-none"
        >
          <motion.div
            animate={{
              y: [0, -6, 0],
            }}
            transition={{ duration: 1, repeat: Infinity }}
            className="relative z-10 flex items-center gap-4 rounded-[8px] border border-white/70 bg-white/[0.72] px-6 py-5 text-slate-900 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-slate-950 text-cyan-100">
              <Wind className="h-7 w-7" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-black text-teal-700">
                <Snowflake className="h-3.5 w-3.5" />
                BLIZZARD
              </div>
              <div className="text-2xl font-black">시야가 얼어붙었습니다</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
