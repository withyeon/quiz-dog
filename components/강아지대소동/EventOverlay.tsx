'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { PuppyChaosEvent } from '@/lib/services/강아지대소동Events'

type EventOverlayProps = {
  event: PuppyChaosEvent | null
}

export default function EventOverlay({ event }: EventOverlayProps) {
  if (!event) return null

  const isLegendary = event.type === 'legendary'
  const message = (() => {
    if (event.type === 'attack_poop') {
      return `${event.actor_nickname} → ${event.target_nickname ?? '1등'}에게 똥폭탄! 💣`
    }
    if (event.type === 'attack_steal') {
      return `${event.actor_nickname}이 ${event.target_nickname ?? '친구'}의 점수를 훔쳤다! 🦹`
    }
    if (event.type === 'legendary') {
      return `🎉 ${event.actor_nickname}이 황금 강아지를 발견했다! 🎉`
    }
    if (event.type === 'combo') {
      const combo = typeof event.payload === 'object' && event.payload && 'combo' in event.payload
        ? String(event.payload.combo)
        : ''
      return `${event.actor_nickname} ${combo}콤보 🔥`
    }
    if (event.type === 'rank_change') {
      return `새로운 1등: ${event.actor_nickname}!`
    }
    return event.actor_nickname
  })()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={event.id}
        initial={{ opacity: 0, scale: 0.7, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -20 }}
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-8"
      >
        <div className={`max-w-5xl rounded-[32px] border-4 border-slate-950 px-10 py-8 text-center font-black text-slate-950 shadow-[8px_8px_0_#0f172a] ${
          isLegendary ? 'bg-amber-200 text-6xl' : 'bg-white text-5xl'
        }`}>
          {message}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
