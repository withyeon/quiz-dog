'use client'

import { motion } from 'framer-motion'
import { Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CHOICE: { label: '객관식', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  SHORT: { label: '주관식', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  OX: { label: 'OX', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  BLANK: { label: '빈칸', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
}

function getQuestionErrors(q: GeneratedQuestion): string[] {
  const errors: string[] = []
  if (!q.question_text.trim()) errors.push('문제 내용이 비어 있습니다')
  if (!q.answer.trim()) errors.push('정답이 비어 있습니다')
  if (q.type === 'CHOICE') {
    const filledOptions = (q.options || []).filter((o: string) => o.trim())
    if (filledOptions.length < 2) errors.push('보기가 2개 이상 필요합니다')
    if (q.answer.trim() && !filledOptions.includes(q.answer.trim())) {
      errors.push('정답이 보기에 포함되어 있지 않습니다')
    }
  }
  if (q.type === 'OX' && q.answer.trim() && q.answer !== 'O' && q.answer !== 'X') {
    errors.push('OX 문제의 정답은 O 또는 X여야 합니다')
  }
  return errors
}

interface QuestionReviewEditorProps {
  generatedQuestions: GeneratedQuestion[]
  setGeneratedQuestions: React.Dispatch<React.SetStateAction<GeneratedQuestion[]>>
  setName: string
  setSetName: (value: string) => void
  subject: string
  setSubject: (value: string) => void
  grade: string
  setGrade: (value: string) => void
  onBack: () => void
  onSave: () => void
  onCreateManual: (type: 'CHOICE' | 'SHORT' | 'OX') => void
}

export default function QuestionReviewEditor({
  generatedQuestions,
  setGeneratedQuestions,
  setName,
  setSetName,
  subject,
  setSubject,
  grade,
  setGrade,
  onBack,
  onSave,
  onCreateManual,
}: QuestionReviewEditorProps) {
  const handleEditQuestion = (index: number, field: keyof GeneratedQuestion, value: any) => {
    const updated = [...generatedQuestions]
    updated[index] = { ...updated[index], [field]: value }
    setGeneratedQuestions(updated)
  }

  const handleEditOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...generatedQuestions]
    const opts = [...(updated[qIndex].options || [])]
    opts[optIndex] = value
    updated[qIndex] = { ...updated[qIndex], options: opts }
    setGeneratedQuestions(updated)
  }

  const handleAddOption = (qIndex: number) => {
    const updated = [...generatedQuestions]
    const opts = [...(updated[qIndex].options || []), '']
    updated[qIndex] = { ...updated[qIndex], options: opts }
    setGeneratedQuestions(updated)
  }

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const updated = [...generatedQuestions]
    const opts = (updated[qIndex].options || []).filter((_: string, i: number) => i !== optIndex)
    updated[qIndex] = { ...updated[qIndex], options: opts }
    setGeneratedQuestions(updated)
  }

  const handleSetAnswer = (qIndex: number, answer: string) => {
    const updated = [...generatedQuestions]
    updated[qIndex] = { ...updated[qIndex], answer }
    setGeneratedQuestions(updated)
  }

  const handleTypeChange = (index: number, newType: string) => {
    const updated = [...generatedQuestions]
    const q = updated[index]
    if (newType === 'OX') {
      updated[index] = { ...q, type: 'OX' as any, options: ['O', 'X'], answer: q.answer === 'O' || q.answer === 'X' ? q.answer : '' }
    } else if (newType === 'SHORT') {
      updated[index] = { ...q, type: 'SHORT' as any, options: [] }
    } else if (newType === 'CHOICE') {
      const opts = (q.options && q.options.length >= 2) ? q.options : ['', '', '', '']
      updated[index] = { ...q, type: 'CHOICE' as any, options: opts }
    } else {
      updated[index] = { ...q, type: newType as any }
    }
    setGeneratedQuestions(updated)
  }

  const totalErrors = generatedQuestions.reduce((sum, q) => sum + getQuestionErrors(q).length, 0)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Button
        variant="outline"
        onClick={onBack}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로 가기
      </Button>

      {/* 상단 요약 바 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">문제 검수</h2>
            <p className="text-sm text-gray-500 mt-1">
              {generatedQuestions.length}문제 · {totalErrors > 0 ? (
                <span className="text-red-500 font-medium">⚠ {totalErrors}개 수정 필요</span>
              ) : (
                <span className="text-green-600 font-medium">✓ 모두 정상</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
              const count = generatedQuestions.filter(q => q.type === type).length
              if (count === 0) return null
              return (
                <span key={type} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                  {cfg.label} {count}
                </span>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제집 이름</label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="예: 한국사 기초 문제집"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">과목</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all bg-white"
            >
              <option value="">과목 선택</option>
              <option value="국어">국어</option>
              <option value="영어">영어</option>
              <option value="수학">수학</option>
              <option value="사회">사회</option>
              <option value="과학">과학</option>
              <option value="역사">역사</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">대상 학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all bg-white"
            >
              <option value="">학년 선택</option>
              <option value="초등 저학년">초등 저학년</option>
              <option value="초등 고학년">초등 고학년</option>
              <option value="중학교">중학교</option>
              <option value="고등학교">고등학교</option>
              <option value="기타">기타</option>
            </select>
          </div>
        </div>
      </div>

      {/* 문제 목록 */}
      <div className="space-y-5">
        {generatedQuestions.map((q, index) => {
          const errors = getQuestionErrors(q)
          const cfg = TYPE_CONFIG[q.type] || TYPE_CONFIG.CHOICE

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${errors.length > 0 ? 'border-red-200 shadow-red-50' : 'border-gray-200'
                } shadow-sm hover:shadow-md`}
            >
              {/* 문제 헤더 */}
              <div className={`flex items-center justify-between px-5 py-3 ${cfg.bg} border-b ${cfg.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-800">{index + 1}</span>
                  <select
                    value={q.type}
                    onChange={(e) => handleTypeChange(index, e.target.value)}
                    className={`px-3 py-1.5 rounded-lg border font-semibold text-sm ${cfg.color} ${cfg.bg} ${cfg.border} cursor-pointer`}
                  >
                    <option value="CHOICE">📝 객관식</option>
                    <option value="OX">⭕ OX</option>
                    <option value="SHORT">✏️ 주관식</option>
                    <option value="BLANK">🔲 빈칸</option>
                  </select>
                </div>
                <button
                  onClick={() => setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index))}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                  title="문제 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* 문제 텍스트 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">문제</label>
                  <textarea
                    value={q.question_text}
                    onChange={(e) => handleEditQuestion(index, 'question_text', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none transition-all"
                    rows={2}
                    placeholder="문제를 입력하세요"
                  />
                </div>

                {/* 보기 (객관식/OX) */}
                {(q.type === 'CHOICE' || q.type === 'OX') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      보기 <span className="font-normal text-gray-400">— 정답을 클릭하세요</span>
                    </label>
                    <div className="space-y-2">
                      {(q.options || []).map((opt: string, optIdx: number) => {
                        const isAnswer = q.answer.trim() !== '' && opt.trim() !== '' && opt.trim() === q.answer.trim()
                        return (
                          <div key={optIdx} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => opt.trim() && handleSetAnswer(index, opt.trim())}
                              className={`flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg border-2 text-left transition-all ${isAnswer
                                ? 'border-green-500 bg-green-50 ring-1 ring-green-200'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isAnswer ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                                }`}>
                                {isAnswer ? '✓' : String.fromCharCode(65 + optIdx)}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleEditOption(index, optIdx, e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
                                placeholder={`보기 ${optIdx + 1}`}
                                readOnly={q.type === 'OX'}
                              />
                            </button>
                            {q.type === 'CHOICE' && (q.options || []).length > 2 && (
                              <button
                                onClick={() => handleRemoveOption(index, optIdx)}
                                className="text-gray-300 hover:text-red-400 p-1 transition-colors"
                                title="보기 삭제"
                              >
                                <XCircle className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        )
                      })}
                      {q.type === 'CHOICE' && (
                        <button
                          onClick={() => handleAddOption(index)}
                          className="w-full px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-300 text-sm font-medium transition-colors"
                        >
                          + 보기 추가
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 정답 (주관식/빈칸) */}
                {(q.type === 'SHORT' || q.type === 'BLANK') && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">정답</label>
                    <input
                      type="text"
                      value={q.answer}
                      onChange={(e) => handleEditQuestion(index, 'answer', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                      placeholder="정답을 입력하세요"
                    />
                  </div>
                )}

                {/* 유효성 경고 */}
                {errors.length > 0 && (
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-lg border border-red-100">
                    <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                    <div className="text-sm text-red-600 space-y-0.5">
                      {errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}

        {/* 문제 추가 */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-3">문제 추가하기</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => onCreateManual('CHOICE')}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium text-sm transition-colors"
            >
              + 객관식
            </button>
            <button
              onClick={() => onCreateManual('SHORT')}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm transition-colors"
            >
              + 주관식
            </button>
            <button
              onClick={() => onCreateManual('OX')}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium text-sm transition-colors"
            >
              + OX
            </button>
          </div>
        </div>
      </div>

      {/* 하단 저장 바 */}
      <div className="sticky bottom-4 mt-6 z-50">
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-4 flex gap-3">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1"
          >
            다시 생성
          </Button>
          <Button
            onClick={() => {
              if (totalErrors > 0) {
                if (!confirm(`수정이 필요한 항목이 ${totalErrors}개 있습니다. 그래도 저장하시겠습니까?`)) return
              }
              onSave()
            }}
            className={`flex-1 font-bold ${totalErrors > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-sky-500 hover:bg-sky-600'} text-white`}
          >
            {totalErrors > 0 ? `⚠ ${totalErrors}개 주의 · 저장하기` : `✓ ${generatedQuestions.length}문제 저장하기`}
          </Button>
        </div>
      </div>
    </div>
  )
}
