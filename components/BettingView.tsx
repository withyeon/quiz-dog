'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BET_OPTIONS,
  BETTING_TIME_LIMIT,
  getAppliedBetAmount,
  type BetOption,
} from '@/lib/game/allinQuiz'

interface BettingViewProps {
  currentScore: number
  streakMultiplier: number
  hasRescueBoost: boolean
  consecutiveCorrect: number
  questionNumber: number
  onBet: (amount: number, optionId: string) => void
}

export default function BettingView({
  currentScore,
  streakMultiplier,
  hasRescueBoost,
  consecutiveCorrect,
  questionNumber,
  onBet,
}: BettingViewProps) {
  const [timeLeft, setTimeLeft] = useState(BETTING_TIME_LIMIT)
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = useCallback(
    (option: BetOption) => {
      if (selected) return
      setSelected(option.id)
      const amount = getAppliedBetAmount(
        option,
        currentScore,
        streakMultiplier,
        hasRescueBoost,
      )
      onBet(amount, option.id)
    },
    [selected, currentScore, streakMultiplier, hasRescueBoost, onBet],
  )

  useEffect(() => {
    if (selected) return
    if (timeLeft <= 0) {
      handleSelect(BET_OPTIONS[0])
      return
    }
    const t = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, selected, handleSelect])

  const timerPercent = (timeLeft / BETTING_TIME_LIMIT) * 100

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-lg mx-auto border-2 border-indigo-200 relative overflow-hidden"
    >
      {/* 배경 장식 */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-100 to-transparent rounded-bl-full opacity-50" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-100 to-transparent rounded-tr-full opacity-50" />

      <div className="relative">
        {/* 문제 번호 & 타이머 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-gray-500">
            #{questionNumber} 문제
          </span>
          <div className="flex items-center gap-2">
            <motion.span
              animate={timeLeft <= 3 ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              className={`text-2xl font-black ${timeLeft <= 3 ? 'text-red-500' : 'text-indigo-600'}`}
            >
              {timeLeft}
            </motion.span>
            <span className="text-sm text-gray-400">초</span>
          </div>
        </div>

        {/* 타이머 바 */}
        <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${timeLeft <= 3 ? 'bg-red-500' : 'bg-indigo-500'}`}
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* 현재 점수 */}
        <div className="text-center mb-6">
          <div className="text-sm text-gray-500 mb-1">내 점수</div>
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-4xl font-black text-gray-900"
          >
            {currentScore.toLocaleString()}
            <span className="text-lg font-bold text-gray-400 ml-1">점</span>
          </motion.div>

          {/* 버프 표시 */}
          <AnimatePresence>
            {streakMultiplier > 1 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-bold"
              >
                🔥 {consecutiveCorrect}연속 정답! 보상 1.5배
              </motion.div>
            )}
            {hasRescueBoost && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold"
              >
                ⭐ 구원 라운드! 보상 3배
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 질문 */}
        <h2 className="text-xl sm:text-2xl font-black text-center text-gray-800 mb-6">
          얼마나 걸까?
        </h2>

        {/* 베팅 옵션 */}
        <div className="grid grid-cols-2 gap-3">
          {BET_OPTIONS.map((option, index) => {
            const amount = getAppliedBetAmount(
              option,
              currentScore,
              streakMultiplier,
              hasRescueBoost,
            )
            const isSelected = selected === option.id

            return (
              <motion.button
                key={option.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                whileHover={!selected ? { scale: 1.05, y: -2 } : {}}
                whileTap={!selected ? { scale: 0.95 } : {}}
                onClick={() => handleSelect(option)}
                disabled={!!selected}
                className={`
                  relative p-4 sm:p-5 rounded-xl border-3 transition-all
                  ${isSelected
                    ? `${option.borderColor} ${option.bgColor} ring-4 ring-offset-1 ${option.glowColor} scale-105`
                    : selected
                      ? 'border-gray-200 bg-gray-50 opacity-40'
                      : `${option.borderColor} ${option.bgColor} hover:shadow-lg cursor-pointer`
                  }
                  border-2
                `}
              >
                <div className="text-center">
                  <motion.div
                    className="text-3xl sm:text-4xl mb-2"
                    animate={
                      !selected && option.id === 'allin'
                        ? { rotate: [0, -5, 5, 0] }
                        : {}
                    }
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {option.emoji}
                  </motion.div>
                  <div className={`text-base sm:text-lg font-black ${option.color}`}>
                    {option.label}
                  </div>
                  <div className={`text-xl sm:text-2xl font-black mt-1 ${option.color}`}>
                    {amount.toLocaleString()}점
                  </div>
                </div>

                {/* 전부 걸기 반짝이 효과 */}
                {option.id === 'allin' && !selected && (
                  <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-purple-400"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.button>
            )
          })}
        </div>

        {/* 시간 초과 안내 */}
        {timeLeft <= 3 && !selected && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-sm text-red-500 font-bold mt-4"
          >
            시간 안에 고르지 않으면 제일 적게 걸려요!
          </motion.p>
        )}
      </div>
    </motion.div>
  )
}
