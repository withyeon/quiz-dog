'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface SnowEffectProps {
  isActive: boolean
  duration?: number
  intensity?: 'normal' | 'blizzard'
}

export default function SnowEffect({ isActive, duration, intensity = 'normal' }: SnowEffectProps) {
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

    const isBlizzard = intensity === 'blizzard'
    const particleCount = isBlizzard ? 120 : 42
    const effectDuration = duration ?? (isBlizzard ? 3000 : 2000)
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: isBlizzard ? 10 + Math.random() * 20 : 6 + Math.random() * 14,
      drift: (Math.random() - 0.5) * (isBlizzard ? 220 : 120),
      fall: (isBlizzard ? 180 : 120) + Math.random() * (isBlizzard ? 260 : 180),
      motionDuration: (isBlizzard ? 1.15 : 0.55) + Math.random() * (isBlizzard ? 0.85 : 0.45),
    }))
    setParticles(newParticles)

    const timer = setTimeout(() => {
      setParticles([])
    }, effectDuration)

    return () => clearTimeout(timer)
  }, [isActive, duration, intensity])

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
