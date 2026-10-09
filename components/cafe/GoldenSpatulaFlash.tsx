'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { GoldenSpatulaBadge } from '@/components/cafe/GoldenSpatula'

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
          <GoldenSpatulaBadge />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
