'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface BetResultViewProps {
  isCorrect: boolean
  betAmount: number
  previousScore: number
  newScore: number
  consecutiveCorrect: number
  onContinue: () => void
  autoAdvanceDelay?: number
}

export default function BetResultView({
  isCorrect,
  betAmount,
  previousScore,
  newScore,
  consecutiveCorrect,
  onContinue,
  autoAdvanceDelay = 2500,
}: BetResultViewProps) {
  const [displayScore, setDisplayScore] = useState(previousScore)
  const [showDelta, setShowDelta] = useState(false)

  const delta = newScore - previousScore

  useEffect(() => {
    const showTimer = setTimeout(() => setShowDelta(true), 300)

    const steps = 20
    const stepDuration = 800 / steps
    const stepAmount = (newScore - previousScore) / steps
    let current = previousScore
    let step = 0

    const countTimer = setTimeout(() => {
      const interval = setInterval(() => {
        step++
        current += stepAmount
        if (step >= steps) {
          setDisplayScore(newScore)
          clearInterval(interval)
        } else {
          setDisplayScore(Math.round(current))
        }
      }, stepDuration)
      return () => clearInterval(interval)
    }, 500)

    const advanceTimer = setTimeout(onContinue, autoAdvanceDelay)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(countTimer)
      clearTimeout(advanceTimer)
    }
  }, [previousScore, newScore, onContinue, autoAdvanceDelay])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-2xl shadow-2xl p-8 sm:p-10 max-w-lg mx-auto text-center border-4 relative overflow-hidden ${
        isCorrect
          ? 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-400'
          : 'bg-gradient-to-br from-red-50 to-orange-100 border-red-400'
      }`}
    >
      {/* 배경 파티클 (정답) */}
      {isCorrect && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{
                x: '50%',
                y: '50%',
                opacity: 0,
                scale: 0,
              }}
              animate={{
                x: `${Math.random() * 100}%`,
                y: `${Math.random() * 100}%`,
                opacity: [0, 1, 0],
                scale: [0, 1.2, 0.5],
              }}
              transition={{
                duration: 1.5,
                delay: i * 0.08,
              }}
            >
              {['✨', '💰', '🎉', '⭐', '🪙', '💎'][i % 6]}
            </motion.div>
          ))}
        </div>
      )}

      <div className="relative">
        {/* 아이콘 */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="text-7xl sm:text-8xl mb-4"
        >
          {isCorrect ? (
            <motion.span
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              🎉
            </motion.span>
          ) : (
            <motion.span
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              😢
            </motion.span>
          )}
        </motion.div>

        {/* 결과 텍스트 */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`text-3xl sm:text-4xl font-black mb-2 ${
            isCorrect ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {isCorrect ? '정답!' : '아쉬워요!'}
        </motion.h2>

        {/* 점수 변동 */}
        <AnimatePresence>
          {showDelta && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`text-4xl sm:text-5xl font-black mb-4 ${
                isCorrect ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {delta > 0 ? '+' : ''}
              {delta.toLocaleString()}점
            </motion.div>
          )}
        </AnimatePresence>

        {/* 현재 점수 카운팅 */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 mb-4">
          <div className="text-sm text-gray-500 mb-1">내 점수</div>
          <motion.div className="text-3xl sm:text-4xl font-black text-gray-900">
            {displayScore.toLocaleString()}
            <span className="text-base font-bold text-gray-400 ml-1">점</span>
          </motion.div>
        </div>

        {/* 연속 정답 표시 */}
        {isCorrect && consecutiveCorrect >= 2 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="inline-flex items-center gap-1 px-4 py-2 bg-amber-100 text-amber-700 rounded-full font-bold"
          >
            🔥 {consecutiveCorrect}연속 정답!
            {consecutiveCorrect >= 3 && ' 다음 보상 1.5배!'}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
