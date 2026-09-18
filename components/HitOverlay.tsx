'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface HitOverlayProps {
  attack: {
    attackerNickname: string
    damage: number
    isCritical: boolean
  } | null
}

export default function HitOverlay({ attack }: HitOverlayProps) {
  return (
    <AnimatePresence>
      {attack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-start bg-sky-500/15 pt-[14vh]"
          style={{ boxShadow: 'inset 0 0 120px 40px rgba(14, 165, 233, 0.6)' }}
        >
          {attack.isCritical && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.3, 1], opacity: [0, 1, 1] }}
              className="absolute inset-0 bg-cyan-400/20"
            />
          )}

          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="relative text-center"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: [0.5, 1.3, 1], rotate: [-10, 6, 0] }}
              transition={{ duration: 0.35 }}
              className="mb-2 text-5xl drop-shadow-lg"
            >
              ❄️
            </motion.div>
            <div className="rounded-full bg-slate-950/70 px-4 py-1.5 text-lg font-black text-white drop-shadow-lg sm:text-xl">
              {attack.attackerNickname}의 눈뭉치에 맞았다!
            </div>
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: [0.5, 1.4, 1] }}
              transition={{ delay: 0.05, duration: 0.4 }}
              className={`mt-2 text-5xl font-black drop-shadow-[0_3px_0_rgba(0,0,0,0.45)] ${attack.isCritical ? 'text-yellow-300' : 'text-white'}`}
            >
              -{attack.damage}°
            </motion.div>
            {attack.isCritical && (
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [-2, 2, -2, 0] }}
                transition={{ duration: 0.3, repeat: 2 }}
                className="mt-2 text-2xl font-black tracking-widest text-yellow-300"
              >
                💥 CRITICAL HIT!
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
