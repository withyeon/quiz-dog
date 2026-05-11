'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface SnowEffectProps {
  isActive: boolean
  duration?: number
}

export default function SnowEffect({ isActive, duration = 2000 }: SnowEffectProps) {
  const [particles, setParticles] = useState<Array<{
    id: number
    x: number
    y: number
    size: number
    drift: number
    fall: number
    motionDuration: number
  }>>([])

  useEffect(() => {
    if (!isActive) {
      setParticles([])
      return
    }

    const newParticles = Array.from({ length: 42 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 6 + Math.random() * 14,
      drift: (Math.random() - 0.5) * 120,
      fall: 120 + Math.random() * 180,
      motionDuration: 0.55 + Math.random() * 0.45,
    }))
    setParticles(newParticles)

    const timer = setTimeout(() => {
      setParticles([])
    }, duration)

    return () => clearTimeout(timer)
  }, [isActive, duration])

  return (
    <AnimatePresence>
      {isActive && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              className="battle-snow-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.6, 1, 1.7],
                y: [0, particle.fall],
                x: [0, particle.drift],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: particle.motionDuration, ease: 'easeOut' }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}
