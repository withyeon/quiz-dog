'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAudioContext } from '@/components/AudioProvider'

interface QuizViewProps {
  question: {
    id: string
    type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
    question_text: string
    options: string[]
    answer: string
  }
  onAnswer: (answer: string) => void
  timeLimit?: number
  onCorrectClick?: () => void // 정답 확인 후 클릭 시 호출
}

export default function QuizView({ question, onAnswer, timeLimit, onCorrectClick }: QuizViewProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState(timeLimit || 30)
  const { playSFX } = useAudioContext()

  const MotionDiv = motion.div
  const MotionButton = motion.button

  // 시간 제한 카운트다운
  useEffect(() => {
    if (selectedAnswer || !timeLimit) return // 이미 답을 선택했거나 시간 제한이 없으면 중단

    let timerId: NodeJS.Timeout | null = null

    timerId = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // 시간 초과 시 자동으로 빈 답안 처리
          if (timerId) {
            clearInterval(timerId)
            timerId = null
          }
          // 다음 tick에서 onAnswer 호출 (상태 업데이트 후)
          setTimeout(() => {
            if (!selectedAnswer) {
              onAnswer('') // 시간 초과 처리
            }
          }, 0)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerId) {
        clearInterval(timerId)
      }
    }
  }, [selectedAnswer, timeLimit]) // onAnswer를 dependency에서 제거

  // 문제가 바뀔 때마다 시간 리셋
  useEffect(() => {
    setTimeLeft(timeLimit || 30)
    setSelectedAnswer('')
  }, [question.id, timeLimit])

  const handleAnswerSelect = (answer: string) => {
    if (selectedAnswer) return // 이미 답을 선택했으면 무시
    playSFX('click')
    setSelectedAnswer(answer)
    onAnswer(answer)
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-2xl p-8 max-w-2xl mx-auto border-2 border-gray-200 glow-box"
    >
      <div className="mb-6">
        {timeLimit && (
          <div className="flex justify-between items-center mb-4 bg-blue-600 rounded-lg p-3 text-white">
            <div className="text-sm font-medium">남은 시간</div>
            <div className="text-3xl font-bold neon-glow">{timeLeft}초</div>
          </div>
        )}
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {question.question_text}
        </h2>
      </div>

      <div className="space-y-3">
        {/* 단답형 문제 */}
        {question.type === 'SHORT' && (
          <div className="space-y-4">
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && selectedAnswer.trim()) {
                  e.preventDefault()
                  handleAnswerSelect(selectedAnswer.trim())
                }
              }}
              disabled={false}
              placeholder="답을 입력하세요"
              className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              autoFocus
            />
            <MotionButton
              type="button"
              onClick={() => handleAnswerSelect(selectedAnswer.trim())}
              disabled={!selectedAnswer.trim()}
              whileHover={selectedAnswer.trim() ? { scale: 1.02 } : {}}
              whileTap={selectedAnswer.trim() ? { scale: 0.98 } : {}}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              제출
            </MotionButton>
          </div>
        )}

        {/* 빈칸 채우기 문제 */}
        {question.type === 'BLANK' && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
              <p className="text-xl text-gray-800 whitespace-pre-wrap leading-relaxed">
                {question.question_text.split('{{blank}}').map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input
                        type="text"
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && selectedAnswer.trim()) {
                            e.preventDefault()
                            handleAnswerSelect(selectedAnswer.trim())
                          }
                        }}
                        disabled={false}
                        className="inline-block mx-2 px-4 py-2 border-b-2 border-blue-500 bg-white/80 focus:outline-none focus:bg-white focus:border-blue-600 min-w-[150px] text-center font-semibold text-blue-700 rounded"
                        placeholder="답 입력"
                        autoFocus
                      />
                    )}
                  </span>
                ))}
              </p>
            </div>
            <MotionButton
              type="button"
              onClick={() => handleAnswerSelect(selectedAnswer.trim())}
              disabled={!selectedAnswer.trim()}
              whileHover={selectedAnswer.trim() ? { scale: 1.02 } : {}}
              whileTap={selectedAnswer.trim() ? { scale: 0.98 } : {}}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              제출
            </MotionButton>
          </div>
        )}

        {/* 객관식 문제 (기본) */}
        {(!question.type || question.type === 'CHOICE' || question.type === 'OX') && question.options.map((option, index) => {
          const isSelected = selectedAnswer === option
          const isCorrect = option === question.answer
          const showResult = selectedAnswer !== ''

          return (
            <MotionButton
              key={index}
              onClick={() => handleAnswerSelect(option)}
              disabled={selectedAnswer !== ''}
              whileHover={selectedAnswer === '' ? { scale: 1.02, x: 5 } : {}}
              whileTap={selectedAnswer === '' ? { scale: 0.98 } : {}}
              className={`w-full text-left p-6 rounded-xl border-2 transition-all ${selectedAnswer === ''
                ? 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer shadow-md hover:shadow-xl'
                : isSelected
                  ? isCorrect
                    ? 'border-green-500 bg-green-50 scale-105 shadow-lg glow-box'
                    : 'border-red-500 bg-red-50 scale-105 shadow-lg'
                  : isCorrect && showResult
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-gray-50 opacity-50'
                }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${selectedAnswer === ''
                    ? 'bg-indigo-100 text-indigo-600'
                    : isSelected
                      ? isCorrect
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : isCorrect && showResult
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                >
                  {String.fromCharCode(65 + index)}
                </div>
                <span className="text-lg font-medium text-gray-800 flex-1">{option}</span>
                {showResult && isSelected && (
                  <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
                )}
                {showResult && !isSelected && isCorrect && (
                  <span className="text-2xl">✅</span>
                )}
              </div>
            </MotionButton>
          )
        })}
      </div>

      {selectedAnswer && (
        <MotionDiv
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={selectedAnswer === question.answer && onCorrectClick ? onCorrectClick : undefined}
          className={`mt-6 p-6 rounded-xl text-center font-bold text-2xl shadow-2xl ${selectedAnswer === question.answer
            ? 'bg-green-600 text-white border-2 border-green-300 glow-box cursor-pointer hover:bg-green-500 transition-colors'
            : 'bg-red-600 text-white border-2 border-red-300'
            }`}
        >
          {selectedAnswer === question.answer ? (
            <MotionDiv
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              ✅ 정답입니다! (클릭하여 계속)
            </MotionDiv>
          ) : (
            '❌ 오답입니다.'
          )}
        </MotionDiv>
      )}
    </MotionDiv>
  )
}
