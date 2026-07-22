'use client'

import { motion } from 'framer-motion'
import { Trash2, XCircle, Globe, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TARGET_GRADE_OPTIONS } from '@/lib/constants/grades'
import { ArrowLeft } from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { displayBlankText } from '@/lib/quiz/blankText'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import { toast } from '@/components/ui/Toaster'

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  CHOICE: { label: '객관식', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  SHORT: { label: '주관식', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  OX: { label: 'OX', color: 'text-black', bg: 'bg-sky-50', border: 'border-sky-200' },
  BLANK: { label: '빈칸', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
}

function getQuestionErrors(q: GeneratedQuestion): string[] {
  const errors: string[] = []
  if (!q.question_text.trim()) errors.push('문제 내용이 비어 있습니다')
  if (!q.answer.trim()) errors.push('정답이 비어 있습니다')
  if (q.type === 'CHOICE') {
    const filledOptions = (q.options || []).filter((o: string) => o.trim())
    if (filledOptions.length !== 4) errors.push('객관식 보기는 정확히 4개가 필요합니다')
    if (q.answer.trim() && !filledOptions.includes(q.answer.trim())) {
      errors.push('정답이 보기에 포함되어 있지 않습니다')
    }
  }
  if (q.type === 'OX' && q.answer.trim() && q.answer !== 'O' && q.answer !== 'X') {
    errors.push('OX 문제의 정답은 O 또는 X여야 합니다')
  }
  if (q.type === 'BLANK' && !(/\[\s*\]|\{\{blank\}\}/.test(q.question_text))) {
    errors.push('빈칸 문제에는 [            ] 표시가 필요합니다')
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
  isPublic: boolean
  setIsPublic: (value: boolean) => void
  onBack: () => void
  onSave: () => void
  onCreateManual: (type: 'CHOICE' | 'SHORT' | 'OX') => void
  isSaving?: boolean
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
  isPublic,
  setIsPublic,
  onBack,
  onSave,
  onCreateManual,
  isSaving = false,
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
    <main className="text-black">
      <div className="mx-auto max-w-5xl">
      <Button
        variant="ghost"
        onClick={onBack}
        className="-ml-3 mb-4 h-10 rounded-xl px-3 text-slate-500 hover:bg-slate-100 hover:text-black"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        방식 다시 선택
      </Button>

      {/* 상단 요약 바 */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-slate-500">저장 전 검수</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">내용 확인</h2>
            <p className="text-sm font-bold text-slate-500 mt-1">
              {generatedQuestions.length}문제 · {totalErrors > 0 ? (
                <span className="text-red-500 font-black">⚠ {totalErrors}개 수정 필요</span>
              ) : (
                <span className="text-emerald-600 font-black">✓ 모두 정상</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
              const count = generatedQuestions.filter(q => q.type === type).length
              if (count === 0) return null
              return (
                <span key={type} className={`rounded-full px-2.5 py-1 text-xs font-black ${cfg.bg} ${cfg.color}`}>
                  {cfg.label} {count}
                </span>
              )
            })}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-600">문제집 이름</label>
          <input
            type="text"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            placeholder="예: 한국사 기초 문제집"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">과목</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
            <label className="mb-1.5 block text-sm font-semibold text-slate-600">대상 학년</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              <option value="">학년 선택</option>
              {TARGET_GRADE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 자료실 공개 여부 */}
        <button
          type="button"
          onClick={() => setIsPublic(!isPublic)}
          aria-pressed={isPublic}
          className={`mt-4 flex w-full items-center gap-3 rounded-lg border p-4 text-left transition ${
            isPublic
              ? 'border-sky-300 bg-sky-50'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <span
            className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg ${
              isPublic ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-black">
              {isPublic ? '자료실에 공개' : '나만 보기 (비공개)'}
            </span>
            <span className="mt-0.5 block text-xs font-bold leading-5 text-slate-500">
              {isPublic
                ? '다른 선생님들이 자료실에서 이 문제집을 찾아 사용할 수 있어요.'
                : '내 문제집에만 저장됩니다. 자료실에는 올라가지 않아요.'}
            </span>
          </span>
          <span
            className={`relative h-7 w-12 flex-shrink-0 rounded-full transition ${
              isPublic ? 'bg-sky-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                isPublic ? 'left-6' : 'left-1'
              }`}
            />
          </span>
        </button>
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
              className={`overflow-hidden rounded-2xl border bg-white transition-all ${errors.length > 0 ? 'border-red-200 shadow-red-50' : 'border-slate-200'
                } shadow-sm hover:shadow-md`}
            >
              {/* 문제 헤더 */}
              <div className={`flex items-center justify-between border-b px-5 py-3 ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-black">{index + 1}</span>
                  <select
                    value={q.type}
                    onChange={(e) => handleTypeChange(index, e.target.value)}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-black ${cfg.color} ${cfg.bg} ${cfg.border}`}
                  >
                    <option value="CHOICE">📝 객관식</option>
                    <option value="OX">⭕ OX</option>
                    <option value="SHORT">✏️ 주관식</option>
                    <option value="BLANK">🔲 빈칸</option>
                  </select>
                </div>
                <button
                  onClick={() => setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="문제 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* 문제 텍스트 */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">문제</label>
                  <textarea
                    value={q.type === 'BLANK' ? displayBlankText(q.question_text) : q.question_text}
                    onChange={(e) => handleEditQuestion(index, 'question_text', e.target.value)}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    rows={2}
                    placeholder="문제를 입력하세요"
                  />
                </div>

                {/* 보기 (객관식/OX) */}
                {(q.type === 'CHOICE' || q.type === 'OX') && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-600">
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
                              className={`flex-1 flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-all ${isAnswer
                                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                              <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${isAnswer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                {isAnswer ? '✓' : getOptionLabel(optIdx)}
                              </span>
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleEditOption(index, optIdx, e.target.value)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-transparent font-bold text-black outline-none placeholder:text-slate-400"
                                placeholder={`보기 ${optIdx + 1}`}
                                readOnly={q.type === 'OX'}
                              />
                            </button>
                            {q.type === 'CHOICE' && (q.options || []).length > 2 && (
                              <button
                                onClick={() => handleRemoveOption(index, optIdx)}
                                className="p-1 text-slate-300 transition-colors hover:text-red-400"
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
                          className="w-full rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-black text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600"
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
                    <label className="mb-1.5 block text-sm font-semibold text-slate-600">정답</label>
                    <input
                      type="text"
                      value={q.answer}
                      onChange={(e) => handleEditQuestion(index, 'answer', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
          <p className="mb-3 text-sm font-semibold text-slate-500">문제 추가</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => onCreateManual('CHOICE')}
              className="rounded-lg bg-sky-100 px-4 py-2 text-sm font-black text-black transition-colors hover:bg-sky-200"
            >
              + 객관식
            </button>
            <button
              onClick={() => onCreateManual('SHORT')}
              className="rounded-lg bg-cyan-100 px-4 py-2 text-sm font-black text-cyan-700 transition-colors hover:bg-cyan-200"
            >
              + 주관식
            </button>
            <button
              onClick={() => onCreateManual('OX')}
              className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-black text-amber-700 transition-colors hover:bg-amber-200"
            >
              + OX
            </button>
          </div>
        </div>
      </div>

      {/* 하단 저장 바 */}
      <div className="sticky bottom-4 mt-6 z-50">
        <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <Button
            variant="outline"
            onClick={onBack}
            className="h-11 flex-1 rounded-lg font-black"
          >
            다시 생성
          </Button>
          <Button
            onClick={() => {
              if (isSaving) return
              if (totalErrors > 0) {
                toast.error(`수정이 필요한 항목이 ${totalErrors}개 있습니다. 빨간 경고를 먼저 고쳐주세요.`)
                return
              }
              onSave()
            }}
            disabled={isSaving}
            className={`h-11 flex-1 rounded-lg font-black ${totalErrors > 0 ? 'bg-slate-300 text-slate-600 hover:bg-slate-300' : 'bg-sky-500 text-white hover:bg-sky-600'}`}
          >
            {isSaving
              ? '저장 중...'
              : totalErrors > 0
                ? `⚠ ${totalErrors}개 주의 · 저장하기`
                : `✓ ${generatedQuestions.length}문제 저장하기`
            }
          </Button>
        </div>
      </div>
      </div>
    </main>
  )
}
