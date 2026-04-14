'use client'

import { X, CheckCircle2, XCircle } from 'lucide-react'
import type { Question } from '@/hooks/useGameBase'

interface StudentDetailModalProps {
    studentName: string
    score: number
    accuracy: number
    history: Array<{ questionIndex: number, isCorrect: boolean, selectedAnswer?: string }>
    questions: Question[]
    onClose: () => void
}

export default function StudentDetailModal({
    studentName,
    score,
    accuracy,
    history,
    questions,
    onClose,
}: StudentDetailModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{studentName} 학생 상세 분석</h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm font-semibold text-purple-600">점수: {score.toLocaleString()}점</span>
                            <span className="text-gray-300">|</span>
                            <span className={`text-sm font-semibold ${accuracy >= 80 ? 'text-green-600' : accuracy >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                정답률: {accuracy}%
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50 space-y-3">
                    {history.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 font-medium">제출된 답안 기록이 없습니다.</div>
                    ) : (
                        history.map((record, i) => {
                            const q = questions[record.questionIndex]
                            if (!q) return null

                            return (
                                <div
                                    key={i}
                                    className={`bg-white p-4 rounded-xl border-l-4 shadow-sm border ${record.isCorrect ? 'border-l-green-500' : 'border-l-red-500'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5">
                                            {record.isCorrect ? (
                                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-500" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-gray-400">Q{record.questionIndex + 1}</span>
                                            </div>
                                            <p className="font-medium text-gray-900 mb-3">{q.question_text}</p>

                                            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-2 border border-gray-100">
                                                <div className="flex items-start">
                                                    <span className="w-16 font-semibold text-gray-500 flex-shrink-0">실제 정답:</span>
                                                    <span className="font-medium text-gray-900">{q.answer}</span>
                                                </div>
                                                <div className="flex items-start">
                                                    <span className="w-16 font-semibold text-gray-500 flex-shrink-0">고른 오답:</span>
                                                    <span className={`font-medium ${record.isCorrect ? 'text-green-600' : 'text-red-600 font-bold'}`}>
                                                        {record.isCorrect ? '정답과 일치' : (record.selectedAnswer || '시간 초과 / 미제출')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
