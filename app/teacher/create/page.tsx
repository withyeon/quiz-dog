'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase, checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Pencil, FileText, Youtube, FileUp, CheckCircle2, MessageSquare, XCircle, ScanLine, Trash2 } from 'lucide-react'
import type { Database } from '@/types/database.types'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { filterNickname } from '@/lib/utils/profanityFilter'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'

export default function CreateQuestionPage() {
  const router = useRouter()
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState(5)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [setName, setSetName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')

  const handleGenerate = async () => {
    if (sourceType === 'topic' && !topic.trim()) {
      alert('주제를 입력해주세요.')
      return
    }
    if (sourceType === 'youtube' && !youtubeUrl.trim()) {
      alert('유튜브 URL을 입력해주세요.')
      return
    }
    if (sourceType === 'file' && !file) {
      alert('파일을 선택해주세요.')
      return
    }
    if (sourceType === 'exam' && !examFile) {
      alert('시험지 파일을 선택해주세요.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('sourceType', sourceType!)
      formData.append('questionCount', questionCount.toString())
      if (subject) formData.append('subject', subject)
      if (grade) formData.append('grade', grade)

      if (sourceType === 'topic') {
        formData.append('topic', topic)
      } else if (sourceType === 'youtube') {
        formData.append('youtubeUrl', youtubeUrl)
      } else if (sourceType === 'file' && file) {
        formData.append('file', file)
      } else if (sourceType === 'exam' && examFile) {
        formData.append('file', examFile)
      }

      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '문제 생성에 실패했습니다.')
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error('생성된 문제가 없습니다. 다시 시도해주세요.')
      }

      setGeneratedQuestions(data.questions)
      setIsReviewing(true)
    } catch (error) {
      console.error('Error generating questions:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`문제 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (!setName.trim()) {
      alert('문제집 이름을 입력해주세요.')
      return
    }
    if (!subject) {
      alert('과목을 선택해주세요.')
      return
    }
    if (!grade) {
      alert('대상 학년을 선택해주세요.')
      return
    }

    const nameCheck = filterNickname(setName)
    if (!nameCheck.isValid) {
      alert('문제집 이름에 부적절한 단어가 포함되어 있습니다.')
      return
    }

    const supabaseCheck = checkSupabaseConfig()
    if (!supabaseCheck.isValid) {
      alert(`Supabase 연결 오류: ${supabaseCheck.error}`)
      return
    }

    const connectionTest = await testSupabaseConnection()
    if (!connectionTest.success) {
      alert(`Supabase 연결 실패: ${connectionTest.error}\n\n환경 변수를 확인하고 개발 서버를 재시작해주세요.`)
      return
    }

    try {
      const setId = `set-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      const questionsToSave = generatedQuestions.map((q) => {
        let optionsArray: string[] = []
        if (Array.isArray(q.options)) {
          optionsArray = q.options
        } else if (q.options && typeof q.options === 'string') {
          optionsArray = (q.options as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        }

        return {
          set_id: setId,
          type: q.type,
          question_text: q.question_text.trim(),
          options: optionsArray,
          answer: q.answer.trim(),
        }
      })

      const { error: setListError } = await ((supabase
        .from('question_sets') as any)
        .insert({
          id: setId,
          title: setName.trim(),
          description: `AI로 생성된 문제집 (${sourceType})`,
          subject,
          grade,
        } as any))

      if (setListError) throw setListError

      const { data, error } = await ((supabase
        .from('questions') as any)
        .insert(questionsToSave as any)
        .select() as any)

      if (error) {
        let errorMessage = '알 수 없는 오류가 발생했습니다.'
        if (error.message) errorMessage = error.message
        else if (error.details) errorMessage = error.details
        else if (error.hint) errorMessage = error.hint
        throw new Error(errorMessage)
      }

      alert('문제가 저장되었습니다!')
      router.push('/teacher')
    } catch (error) {
      console.error('Error saving questions:', error)
      let errorMessage = '알 수 없는 오류가 발생했습니다.'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null) {
        const err = error as any
        errorMessage = err.message || err.details || err.hint || errorMessage
      }
      alert(`문제 저장에 실패했습니다: ${errorMessage}`)
    }
  }

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

  const handleCreateManual = (type: 'CHOICE' | 'SHORT' | 'OX') => {
    const newQuestion: GeneratedQuestion = {
      type,
      question_text: '',
      options: type === 'OX' ? ['O', 'X'] : type === 'CHOICE' ? ['', '', '', ''] : [],
      answer: '',
    }
    setGeneratedQuestions((prev) => [...prev, newQuestion])
    setIsReviewing(true)
  }

  // 문제 유효성 검증
  const getQuestionErrors = (q: GeneratedQuestion): string[] => {
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

  const totalErrors = generatedQuestions.reduce((sum, q) => sum + getQuestionErrors(q).length, 0)

  const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    CHOICE: { label: '객관식', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    SHORT: { label: '주관식', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    OX: { label: 'OX', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    BLANK: { label: '빈칸', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  }

  // ======= 검수(리뷰) 화면 =======
  if (isReviewing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Button
          variant="outline"
          onClick={() => setIsReviewing(false)}
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
                onClick={() => handleCreateManual('CHOICE')}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium text-sm transition-colors"
              >
                + 객관식
              </button>
              <button
                onClick={() => handleCreateManual('SHORT')}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium text-sm transition-colors"
              >
                + 주관식
              </button>
              <button
                onClick={() => handleCreateManual('OX')}
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
              onClick={() => setIsReviewing(false)}
              className="flex-1"
            >
              다시 생성
            </Button>
            <Button
              onClick={() => {
                if (totalErrors > 0) {
                  if (!confirm(`수정이 필요한 항목이 ${totalErrors}개 있습니다. 그래도 저장하시겠습니까?`)) return
                }
                handleSaveQuestions()
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

  // ======= 메인 생성 화면 =======
  return (
    <div className="max-w-5xl mx-auto p-6">
      <Button
        variant="outline"
        onClick={() => router.push('/teacher')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        뒤로 가기
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          새로운 문제집 만들기
        </h1>
        <p className="text-gray-600">
          원하는 방식으로 문제를 추가하고 새로운 퀴즈 세트를 만들어보세요.
        </p>
      </div>

      {/* 탭 버튼 */}
      <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8 w-fit mx-auto md:mx-0">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold text-[15px] transition-all whitespace-nowrap ${activeTab === 'manual'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Pencil className="w-4 h-4" />
          직접 만들기
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-bold text-[15px] transition-all whitespace-nowrap ${activeTab === 'ai'
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ScanLine className="w-4 h-4" />
          자료에서 자동 생성
        </button>
      </div>

      {activeTab === 'manual' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl p-8 border-2 border-purple-100 text-center shadow-sm">
            <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Pencil className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">직접 문제 만들기</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              원하는 문제 유형을 선택하면 빈 문제집이 생성됩니다. 생성 후 검토 화면에서 추가 문제를 자유롭게 작성할 수 있습니다.
            </p>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {/* 직접 문제 만들기 버튼들 */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('CHOICE')}
                className="bg-green-500 hover:bg-green-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="font-bold">선택형 문제 +</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('SHORT')}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="font-bold">단답형/빈칸 문제 +</div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleCreateManual('OX')}
                className="bg-purple-500 hover:bg-purple-600 text-white rounded-2xl p-6 text-center transition-all shadow hover:shadow-lg flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6" />
                </div>
                <div className="font-bold">OX 문제 +</div>
              </motion.button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* AI 생성 카드들 - 2x2 그리드 */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">

            {/* 주제 직접 입력 */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all border-2 h-full ${sourceType === 'topic'
                  ? 'border-purple-500 bg-purple-50 shadow-lg'
                  : 'border-gray-200 hover:border-purple-300'
                  }`}
                onClick={() => setSourceType('topic')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Pencil className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">주제 직접 입력</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">주제를 입력하면 AI가 문제를 생성합니다</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sourceType === 'topic' && (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="예: 초5 도형의 넓이"
                        className="w-full px-4 py-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* 파일에서 추출 */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all border-2 h-full ${sourceType === 'file'
                  ? 'border-blue-500 bg-blue-50 shadow-lg'
                  : 'border-gray-200 hover:border-blue-300'
                  }`}
                onClick={() => setSourceType('file')}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">파일에서 추출</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">학습 자료에서 문제를 자동 생성합니다</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sourceType === 'file' ? (
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept=".pdf,.txt,.csv,.docx"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-xs text-gray-500">지원 형식: PDF, DOCX, TXT, CSV</p>
                      {file && (
                        <p className="text-sm text-blue-600 font-medium">
                          선택됨: {file.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">PDF, DOCX, TXT, CSV</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* 유튜브에서 추출 */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all border-2 h-full relative ${sourceType === 'youtube'
                  ? 'border-red-500 bg-red-50 shadow-lg'
                  : 'border-gray-200 hover:border-red-300'
                  }`}
                onClick={() => setSourceType('youtube')}
              >
                <div className="absolute top-2 right-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">
                  Beta
                </div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                      <Youtube className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">유튜브에서 추출</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">영상 자막에서 문제를 생성합니다</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sourceType === 'youtube' ? (
                    <div className="space-y-3">
                      <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..."
                        className="w-full px-4 py-3 border-2 border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-xs text-gray-500">자막이 있는 영상만 지원됩니다</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">자막 있는 영상 지원</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* 시험지/문제지 업로드 */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all border-2 h-full relative ${sourceType === 'exam'
                  ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                  : 'border-gray-200 hover:border-emerald-300'
                  }`}
                onClick={() => setSourceType('exam')}
              >
                <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold px-2 py-1 rounded">
                  New
                </div>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <ScanLine className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">시험지에서 추출</CardTitle>
                      <p className="text-sm text-gray-500 mt-1">시험지/문제지의 문제를 그대로 가져옵니다</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sourceType === 'exam' ? (
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-3 border-2 border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-xs text-gray-500">PDF 또는 이미지(JPG, PNG) 지원 — 스캔본도 OK</p>
                      {examFile && (
                        <p className="text-sm text-emerald-600 font-medium">
                          선택됨: {examFile.name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">PDF, JPG, PNG (스캔본 지원)</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* AI 생성 버튼 */}
          {sourceType && (
            <div className="mb-8">
              <div className="bg-white rounded-xl p-6 border-2 border-gray-200">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">과목 (선택사항)</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-32 px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">전체/해당없음</option>
                      <option value="국어">국어</option>
                      <option value="영어">영어</option>
                      <option value="수학">수학</option>
                      <option value="사회">사회</option>
                      <option value="과학">과학</option>
                      <option value="역사">역사</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">대상 학년 (선택사항)</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-32 px-2 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
                    >
                      <option value="">전체/해당없음</option>
                      <option value="초등 저학년">초등 저학년</option>
                      <option value="초등 고학년">초등 고학년</option>
                      <option value="중학교">중학교</option>
                      <option value="고등학교">고등학교</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {sourceType === 'exam' ? '최대 문제 수' : '생성 문제 수'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={questionCount}
                      onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                      className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg font-bold"
                  size="lg"
                >
                  {isGenerating
                    ? sourceType === 'exam'
                      ? '시험지 분석 중...'
                      : '문제 생성 중...'
                    : sourceType === 'exam'
                      ? '시험지에서 문제 추출하기'
                      : '문제 생성하기'
                  }
                </Button>
                {sourceType === 'exam' && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    AI가 시험지를 읽고 문제를 추출합니다. 추출 후 검토 화면에서 수정할 수 있습니다.
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
