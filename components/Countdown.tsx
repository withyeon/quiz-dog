'use client'

import { useState, useEffect, useRef } from 'react'
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

  // 부모들이 onComplete를 매 렌더마다 새로 만들어 넘기는 경우가 있어서 ref로 받는다.
  // 의존성에 그대로 두면 (1) 카운트다운 setTimeout이 1초를 못 채우고 계속 리셋돼
  // 숫자가 안 줄어들고, (2) count가 0일 때는 정리되지 않는 setTimeout이 쌓여
  // onComplete가 여러 번 호출된다.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const firedRef = useRef(false)
  const outlineTextStyle = {
    WebkitTextStroke: '4px #000',
    paintOrder: 'stroke fill',
    textShadow: '0 4px 0 #000',
  }

  useEffect(() => {
    if (count > 0) {
      playSFX('click')
      const timer = setTimeout(() => setCount((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }

    playSFX('correct')
    setShowStart(true)
    const timer = setTimeout(() => {
      // 어떤 이유로 effect가 다시 돌아도 onComplete는 한 번만 나가게 한다.
      // (가드를 effect 본문에 두면 정리 함수가 타이머만 지우고 다시 걸지 않아
      //  게임이 시작되지 않는다 — 반드시 타이머 안에서 검사한다.)
      if (firedRef.current) return
      firedRef.current = true
      onCompleteRef.current()
    }, 1000)
    return () => clearTimeout(timer)
  }, [count, playSFX])

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
