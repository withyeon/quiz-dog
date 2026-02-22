'use client'

import { useState } from 'react'
import type { Database } from '@/types/database.types'

type Question = Database['public']['Tables']['questions']['Row']

interface QuizQuestionProps {
  question: Question
  onAnswer: (answer: string) => void
  isAnswered: boolean
  timeLimit?: number // 초 단위
}

export default function QuizQuestion({
  question,
  onAnswer,
  isAnswered,
  timeLimit,
}: QuizQuestionProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState(timeLimit || 0)

  // Json 타입을 string[]로 안전하게 변환
  const options: string[] = Array.isArray(question.options) 
    ? question.options.filter((opt): opt is string => typeof opt === 'string')
    : []

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return
    setSelectedAnswer(answer)
    onAnswer(answer)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{question.question_text}</h2>
        {timeLimit && timeLeft > 0 && (
          <div className="text-sm text-gray-500">남은 시간: {timeLeft}초</div>
        )}
      </div>

      <div className="space-y-3">
        {question.type === 'CHOICE' && (
          <>
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                disabled={isAnswered}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isAnswered
                    ? selectedAnswer === option
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-gray-50 opacity-50'
                    : selectedAnswer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                <span className="font-medium text-gray-800">{option}</span>
              </button>
            ))}
          </>
        )}

        {question.type === 'OX' && (
          <div className="grid grid-cols-2 gap-4">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                disabled={isAnswered}
                className={`p-6 rounded-lg border-2 text-2xl font-bold transition-all ${
                  isAnswered
                    ? selectedAnswer === option
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-gray-50 opacity-50'
                    : selectedAnswer === option
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {question.type === 'SHORT' && (
          <div>
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && selectedAnswer.trim()) {
                  handleAnswerSelect(selectedAnswer.trim())
                }
              }}
              disabled={isAnswered}
              placeholder="답을 입력하세요"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => handleAnswerSelect(selectedAnswer.trim())}
              disabled={isAnswered || !selectedAnswer.trim()}
              className="mt-3 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              제출
            </button>
          </div>
        )}

        {question.type === 'BLANK' && (
          <div>
            <div className="p-4 bg-gray-50 rounded-lg mb-3">
              <p className="text-gray-700 whitespace-pre-wrap">
                {question.question_text.split('{{blank}}').map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <input
                        type="text"
                        value={selectedAnswer}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        disabled={isAnswered}
                        className="inline-block mx-2 px-2 py-1 border-b-2 border-indigo-500 focus:outline-none min-w-[100px]"
                      />
                    )}
                  </span>
                ))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleAnswerSelect(selectedAnswer.trim())}
              disabled={isAnswered || !selectedAnswer.trim()}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              제출
            </button>
          </div>
        )}
      </div>

      {isAnswered && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">
            정답: <span className="font-semibold">{question.answer}</span>
          </p>
        </div>
      )}
    </div>
  )
}
