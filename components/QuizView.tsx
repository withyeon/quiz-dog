'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { useAudioContext } from '@/components/AudioProvider'

interface QuizViewProps {
  question: {
    id: string
    type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
    question_text: string
    options: string[]
    answer?: string
  }
  onAnswer: (answer: string) => void | boolean | Promise<void | boolean>
  timeLimit?: number
  onCorrectClick?: () => void // 정답 확인 후 클릭 시 호출
  className?: string // 외부에서 스타일 오버라이드 가능
  variant?: 'default' | 'goldQuest' | 'battle'
}

export default function QuizView({ question, onAnswer, timeLimit, onCorrectClick, className, variant = 'default' }: QuizViewProps) {
  const [inputValue, setInputValue] = useState<string>('')
  const [submittedAnswer, setSubmittedAnswer] = useState<string>('')
  const [answerResult, setAnswerResult] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timeLimit || 30)
  const { playSFX } = useAudioContext()

  const MotionDiv = motion.div
  const MotionButton = motion.button
  const isGoldQuest = variant === 'goldQuest'
  const isBattle = variant === 'battle'

  const handleAnswerSelect = useCallback(async (answer: string) => {
    if (submittedAnswer || isSubmitting) return
    playSFX('click')
    setSubmittedAnswer(answer)
    setInputValue(answer)
    setIsSubmitting(true)

    try {
      const result = await onAnswer(answer)

      if (typeof result === 'boolean') {
        setAnswerResult(result)
        return
      }

      if (typeof question.answer === 'string') {
        setAnswerResult(answer === question.answer)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [submittedAnswer, isSubmitting, playSFX, onAnswer, question.answer])

  // 시간 제한 카운트다운
  useEffect(() => {
    if (submittedAnswer || !timeLimit) return // 이미 제출했거나 시간 제한이 없으면 중단

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
            if (!submittedAnswer && !isSubmitting) {
              void handleAnswerSelect('') // 시간 초과 처리
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
  }, [submittedAnswer, timeLimit, isSubmitting, handleAnswerSelect])

  // 문제가 바뀔 때마다 시간 리셋
  useEffect(() => {
    setTimeLeft(timeLimit || 30)
    setInputValue('')
    setSubmittedAnswer('')
    setAnswerResult(null)
    setIsSubmitting(false)
  }, [question.id, timeLimit])

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className ?? (isGoldQuest
        ? "gold-quest-panel p-5 sm:p-7 max-w-3xl mx-auto"
        : isBattle
          ? "battle-frost-panel p-5 sm:p-7 max-w-3xl mx-auto"
        : "bg-white rounded-xl shadow-2xl p-8 max-w-2xl mx-auto border-2 border-gray-200")}
    >
      <div className="mb-6">
        {timeLimit && (
          <div className={`flex justify-between items-center mb-4 rounded-lg p-3 ${
            isGoldQuest
              ? 'border border-teal-900/10 bg-[#0c3b42] text-white shadow-lg shadow-teal-950/10'
              : isBattle
                ? 'border border-slate-200/70 bg-[#13202b] text-white shadow-lg shadow-slate-900/10'
              : 'bg-blue-600 text-white'
          }`}>
            <div className="text-sm font-semibold">남은 시간</div>
            <div className={`text-3xl font-black tabular-nums ${isGoldQuest ? 'text-amber-200' : isBattle ? 'text-cyan-100' : ''}`}>{timeLeft}초</div>
          </div>
        )}
        <h2 className={`gold-quest-title text-2xl sm:text-3xl font-black leading-tight mb-4 ${
          isGoldQuest ? 'text-[#17262a]' : isBattle ? 'text-[#13202b]' : 'text-gray-900'
        }`}>
          {question.question_text.replace(/\{\{blank\}\}/g, ' ▢ ')}
        </h2>
      </div>

      <div className="space-y-3">
        {/* 단답형 문제 */}
        {question.type === 'SHORT' && (
          <div className="space-y-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && inputValue.trim()) {
                  e.preventDefault()
                  void handleAnswerSelect(inputValue.trim())
                }
              }}
              disabled={!!submittedAnswer || isSubmitting}
              placeholder="답을 입력하세요"
              className={`w-full px-6 py-4 text-lg border rounded-lg bg-white/90 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                isGoldQuest
                  ? 'border-amber-300/70 focus:ring-2 focus:ring-amber-400 focus:border-transparent'
                  : isBattle
                    ? 'border-slate-200 focus:ring-2 focus:ring-teal-400 focus:border-transparent'
                  : 'border-2 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              }`}
              autoFocus
            />
            <MotionButton
              type="button"
              onClick={() => void handleAnswerSelect(inputValue.trim())}
              disabled={!inputValue.trim() || !!submittedAnswer || isSubmitting}
              whileHover={inputValue.trim() && !submittedAnswer ? { scale: 1.02 } : {}}
              whileTap={inputValue.trim() && !submittedAnswer ? { scale: 0.98 } : {}}
              className={`w-full text-white py-4 px-6 rounded-lg transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isGoldQuest ? 'bg-[#b7791f] hover:bg-[#9a6219]' : isBattle ? 'bg-[#13202b] hover:bg-[#223848]' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              제출
            </MotionButton>
          </div>
        )}

        {/* 빈칸 채우기 문제 */}
        {question.type === 'BLANK' && (
          <div className="space-y-4">
            <div className={`p-6 rounded-lg border ${
              isGoldQuest
                ? 'border-amber-300/70 bg-amber-50/80'
                : isBattle
                  ? 'border-slate-200 bg-white/[0.72]'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200'
            }`}>
              <p className="text-xl text-gray-800 whitespace-pre-wrap leading-relaxed">
                {question.question_text.split('{{blank}}').map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && inputValue.trim()) {
                            e.preventDefault()
                            void handleAnswerSelect(inputValue.trim())
                          }
                        }}
                        disabled={!!submittedAnswer || isSubmitting}
                        className={`inline-block mx-2 px-4 py-2 border bg-white min-w-[150px] text-center font-semibold rounded-md shadow-sm focus:outline-none focus:bg-white ${
                          isGoldQuest
                            ? 'border-amber-400 text-[#7a4b14] focus:border-amber-600'
                            : isBattle
                              ? 'border-teal-300 text-[#13202b] focus:border-teal-500'
                            : 'border-2 border-blue-400 text-blue-700 focus:border-blue-600'
                        }`}
                        placeholder=""
                        aria-label="빈칸 정답 입력"
                        autoFocus
                      />
                    )}
                  </span>
                ))}
              </p>
            </div>
            <MotionButton
              type="button"
              onClick={() => void handleAnswerSelect(inputValue.trim())}
              disabled={!inputValue.trim() || !!submittedAnswer || isSubmitting}
              whileHover={inputValue.trim() && !submittedAnswer ? { scale: 1.02 } : {}}
              whileTap={inputValue.trim() && !submittedAnswer ? { scale: 0.98 } : {}}
              className={`w-full text-white py-4 px-6 rounded-lg transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                isGoldQuest ? 'bg-[#b7791f] hover:bg-[#9a6219]' : isBattle ? 'bg-[#13202b] hover:bg-[#223848]' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              제출
            </MotionButton>
          </div>
        )}

        {/* 객관식 문제 (기본) */}
        {(!question.type || question.type === 'CHOICE' || question.type === 'OX') && question.options.map((option, index) => {
          const isSelected = submittedAnswer === option
          const hasResolved = answerResult !== null
          const isCorrect = answerResult === true && isSelected
          const showResult = submittedAnswer !== '' && answerResult !== null

          return (
            <MotionButton
              key={index}
              onClick={() => void handleAnswerSelect(option)}
              disabled={submittedAnswer !== '' || isSubmitting}
              whileHover={submittedAnswer === '' ? { scale: 1.02, x: 5 } : {}}
              whileTap={submittedAnswer === '' ? { scale: 0.98 } : {}}
              className={`w-full text-left p-5 sm:p-6 rounded-lg border transition-all ${submittedAnswer === ''
                ? isGoldQuest
                  ? 'border-[#d7bd78]/80 bg-white/[0.78] hover:border-[#b7791f] hover:bg-[#fff5dc] cursor-pointer shadow-md hover:shadow-xl'
                  : isBattle
                    ? 'border-slate-200 bg-white/[0.74] hover:border-teal-400 hover:bg-white cursor-pointer shadow-sm hover:shadow-lg'
                  : 'border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer shadow-md hover:shadow-xl'
                : isSelected && !hasResolved
                  ? isGoldQuest
                    ? 'border-[#b7791f] bg-[#fff5dc] shadow-lg'
                    : isBattle
                      ? 'border-teal-400 bg-teal-50 shadow-lg'
                    : 'border-2 border-blue-300 bg-blue-50 shadow-lg'
                : isSelected
                  ? isCorrect
                    ? 'border-green-500 bg-green-50 scale-105 shadow-lg'
                    : 'border-red-500 bg-red-50 scale-105 shadow-lg'
                  : isGoldQuest
                    ? 'border-stone-200 bg-stone-50/80 opacity-50'
                    : isBattle
                      ? 'border-slate-200 bg-white/[0.46] opacity-50'
                    : 'border-2 border-gray-200 bg-gray-50 opacity-50'
                }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${submittedAnswer === ''
                    ? isGoldQuest
                      ? 'bg-[#0c3b42] text-amber-100'
                      : isBattle
                        ? 'bg-[#13202b] text-cyan-50'
                      : 'bg-indigo-100 text-indigo-600'
                    : isSelected && !hasResolved
                      ? isGoldQuest
                        ? 'bg-[#b7791f] text-white'
                        : isBattle
                          ? 'bg-teal-500 text-white'
                        : 'bg-blue-500 text-white'
                    : isSelected
                      ? isCorrect
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                    }`}
                >
                  {String.fromCharCode(65 + index)}
                </div>
                <span className={`text-lg font-medium flex-1 ${isBattle ? 'text-slate-800' : 'text-gray-800'}`}>{option}</span>
                {showResult && isSelected && (
                  isCorrect ? (
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  ) : (
                    <XCircle className="h-7 w-7 text-red-600" />
                  )
                )}
              </div>
            </MotionButton>
          )
        })}
      </div>

      {submittedAnswer && answerResult !== null && (
        <MotionDiv
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={answerResult && onCorrectClick ? onCorrectClick : undefined}
          className={`mt-6 p-5 rounded-lg text-center font-bold text-xl sm:text-2xl shadow-2xl ${answerResult
            ? isGoldQuest
              ? 'bg-[#0c6b4f] text-white border border-emerald-200 cursor-pointer hover:bg-[#0b5d46] transition-colors'
              : isBattle
                ? 'bg-[#0f766e] text-white border border-teal-200 cursor-pointer hover:bg-[#115e59] transition-colors'
              : 'bg-green-600 text-white border-2 border-green-300 cursor-pointer hover:bg-green-500 transition-colors'
            : isGoldQuest
              ? 'bg-[#a83d34] text-white border border-red-200'
              : isBattle
                ? 'bg-[#be3f45] text-white border border-red-200'
              : 'bg-red-600 text-white border-2 border-red-300'
            }`}
        >
          {answerResult ? (
            <MotionDiv
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-6 w-6" />
              정답입니다
              {onCorrectClick && <ArrowRight className="h-5 w-5" />}
            </MotionDiv>
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <XCircle className="h-6 w-6" />
              오답입니다
            </span>
          )}
        </MotionDiv>
      )}
    </MotionDiv>
  )
}
