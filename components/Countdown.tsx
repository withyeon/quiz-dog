'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAudioContext } from './AudioProvider'

interface CountdownProps {
  onComplete: () => void
  duration?: number
}

export default function Countdown({ onComplete, duration = 3 }: CountdownProps) {
  const [count, setCount] = useState(duration)
  const [showStart, setShowStart] = useState(false)
  const { playSFX } = useAudioContext()
  const outlineTextStyle = {
    WebkitTextStroke: '4px #000',
    paintOrder: 'stroke fill',
    textShadow: '0 4px 0 #000',
  }

  useEffect(() => {
    if (count > 0) {
      playSFX('click')
      const timer = setTimeout(() => setCount(count - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      playSFX('correct')
      setShowStart(true)
      setTimeout(() => {
        onComplete()
      }, 1000)
    }
  }, [count, onComplete, playSFX])

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <AnimatePresence mode="wait">
        {!showStart ? (
          <motion.div
            key={count}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className="text-9xl font-bold text-white mb-4" style={outlineTextStyle}>{count}</div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className="text-7xl font-bold text-green-400 mb-4 animate-pulse" style={outlineTextStyle}>
              시작!
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
