'use client'

import { motion, AnimatePresence } from 'framer-motion'

/**
 * 체온이 떨어질수록 화면 가장자리가 얼어붙는다. 30° 이하면 덜덜 떨린다.
 * pointer-events 없음 — 순수 연출.
 */
export default function FrostVignette({ healthPercent }: { healthPercent: number }) {
  const pct = Math.max(0, Math.min(100, healthPercent))
  const show = pct < 60
  const strength = show ? (60 - pct) / 60 : 0
  const shiver = pct <= 30 && pct > 0

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="frost"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 + strength * 0.65 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={`battle-frost-vignette pointer-events-none fixed inset-0 z-[45] ${shiver ? 'battle-frost-vignette--shiver' : ''}`}
          style={{ ['--frost' as string]: strength }}
          aria-hidden
        />
      )}
    </AnimatePresence>
  )
}
