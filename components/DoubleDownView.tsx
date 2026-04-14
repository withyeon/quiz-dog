'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DOUBLE_DOWN_TIME_LIMIT } from '@/lib/game/allinQuiz'

interface DoubleDownViewProps {
  originalReward: number
  onAccept: () => void
  onDecline: () => void
}

export default function DoubleDownView({
  originalReward,
  onAccept,
  onDecline,
}: DoubleDownViewProps) {
  const [timeLeft, setTimeLeft] = useState(DOUBLE_DOWN_TIME_LIMIT)
  const [chosen, setChosen] = useState(false)

  useEffect(() => {
    if (chosen) return
    if (timeLeft <= 0) {
      setChosen(true)
      onDecline()
      return
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, chosen, onDecline])

  const handleAccept = () => {
    if (chosen) return
    setChosen(true)
    onAccept()
  }

  const handleDecline = () => {
    if (chosen) return
    setChosen(true)
    onDecline()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-yellow-100 rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg mx-auto border-4 border-amber-400 relative overflow-hidden"
    >
      {/* 반짝이 배경 */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-xl"
            animate={{
              y: [-20, -60],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
            style={{
              left: `${15 + i * 14}%`,
              top: '80%',
            }}
          >
            ✨
          </motion.div>
        ))}
      </div>

      <div className="relative text-center">
        {/* 타이머 */}
        <div className="flex justify-center mb-4">
          <motion.div
            animate={timeLeft <= 2 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.4, repeat: Infinity }}
            className={`text-3xl font-black ${timeLeft <= 2 ? 'text-red-600' : 'text-amber-700'}`}
          >
            {timeLeft}초
          </motion.div>
        </div>

        {/* 아이콘 */}
        <motion.div
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-6xl sm:text-7xl mb-4"
        >
          🎲
        </motion.div>

        {/* 제목 */}
        <h2 className="text-2xl sm:text-3xl font-black text-amber-800 mb-2">
          더블 찬스!
        </h2>
        <p className="text-base sm:text-lg text-amber-700 mb-6">
          보너스 문제에 도전하면
          <span className="font-black text-amber-900 mx-1">
            +{(originalReward * 2).toLocaleString()}점
          </span>
          <br />
          실패하면{' '}
          <span className="font-black text-red-600">
            -{originalReward.toLocaleString()}점
          </span>
        </p>

        {/* 선택 버튼 */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            whileHover={!chosen ? { scale: 1.05 } : {}}
            whileTap={!chosen ? { scale: 0.95 } : {}}
            onClick={handleAccept}
            disabled={chosen}
            className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black text-lg sm:text-xl shadow-lg border-2 border-amber-300 disabled:opacity-50 transition-all"
          >
            <div className="text-3xl mb-1">🔥</div>
            도전!
          </motion.button>
          <motion.button
            whileHover={!chosen ? { scale: 1.05 } : {}}
            whileTap={!chosen ? { scale: 0.95 } : {}}
            onClick={handleDecline}
            disabled={chosen}
            className="p-4 sm:p-5 rounded-xl bg-white text-gray-700 font-black text-lg sm:text-xl shadow-lg border-2 border-gray-300 disabled:opacity-50 transition-all"
          >
            <div className="text-3xl mb-1">🛡️</div>
            안 할래
          </motion.button>
        </div>

        {timeLeft <= 2 && !chosen && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-red-500 font-bold mt-3"
          >
            시간 초과 시 패스됩니다!
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
