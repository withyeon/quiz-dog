'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, ScanLine, Sparkles } from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { extractTextFromPPTX } from '@/lib/extractors/ppt'
import { filterNickname } from '@/lib/utils/profanityFilter'
import QuestionReviewEditor from '@/components/teacher/QuestionReviewEditor'
import QuestionSourceSelector from '@/components/teacher/QuestionSourceSelector'
import { createQuestionSetWithQuestions } from '@/lib/services/questionSets'
import { formatServiceError } from '@/lib/services/errors'
import { TARGET_GRADE_OPTIONS } from '@/lib/constants/grades'
import { toast } from '@/components/ui/Toaster'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'
type ManualQuestionType = 'CHOICE' | 'SHORT' | 'OX' | 'MIXED'
type AiQuestionType = 'CHOICE' | 'OX' | 'SHORT'
const MAX_AI_QUESTION_COUNT = 20
const QUESTION_COUNT_PRESETS = [5, 10, 15, 20]
const AI_TYPE_OPTIONS: Array<{ id: AiQuestionType; label: string }> = [
  { id: 'CHOICE', label: '객관식' },
  { id: 'OX', label: 'OX' },
  { id: 'SHORT', label: '주관식' },
]

function createBlankQuestion(type: Exclude<ManualQuestionType, 'MIXED'>): GeneratedQuestion {
  return {
    type,
    question_text: '',
    options: type === 'OX' ? ['O', 'X'] : type === 'CHOICE' ? ['', '', '', ''] : [],
    answer: '',
  }
}

export default function CreateQuestionPage() {
  const router = useRouter()
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  // AI 생성을 기본으로 — 대부분 자료/주제에서 바로 만드는 흐름을 우선한다.
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('ai')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState('5')
  const [questionTypes, setQuestionTypes] = useState<AiQuestionType[]>(['CHOICE', 'OX', 'SHORT'])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [setName, setSetName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const handleGenerate = async () => {
    if (sourceType === 'topic' && !topic.trim()) {
      toast.error('주제를 입력해주세요.')
      return
    }
    if (sourceType === 'youtube' && !youtubeUrl.trim()) {
      toast.error('유튜브 URL을 입력해주세요.')
      return
    }
    if (sourceType === 'file' && !file) {
      toast.error('파일을 선택해주세요.')
      return
    }
    if (sourceType === 'exam' && !examFile) {
      toast.error('시험지 파일을 선택해주세요.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('sourceType', sourceType!)
      const normalizedQuestionCount = Math.min(MAX_AI_QUESTION_COUNT, Math.max(1, Number(questionCount) || 5))
      formData.append('questionCount', normalizedQuestionCount.toString())
      // 시험지 추출은 원본 문제 유형을 그대로 옮기므로 유형 제한을 보내지 않는다.
      if (sourceType !== 'exam' && questionTypes.length > 0) {
        formData.append('questionTypes', JSON.stringify(questionTypes))
      }
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
      const errorMessage = formatServiceError(error)
      toast.error(`문제 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (isSaving) return

    if (!setName.trim()) {
      toast.error('문제집 이름을 입력해주세요.')
      return
    }
    if (!subject) {
      toast.error('과목을 선택해주세요.')
      return
    }
    if (!grade) {
      toast.error('대상 학년을 선택해주세요.')
      return
    }

    const nameCheck = filterNickname(setName)
    if (!nameCheck.isValid) {
      toast.error('문제집 이름에 부적절한 단어가 포함되어 있습니다.')
      return
    }

    const supabaseCheck = checkSupabaseConfig()
    if (!supabaseCheck.isValid) {
      toast.error(`Supabase 연결 오류: ${supabaseCheck.error}`)
      return
    }

    const connectionTest = await testSupabaseConnection()
    if (!connectionTest.success) {
      toast.error(`Supabase 연결 실패: ${connectionTest.error}\n환경 변수를 확인하고 개발 서버를 재시작해주세요.`)
      return
    }

    try {
      setIsSaving(true)
      await createQuestionSetWithQuestions({
        metadata: {
          title: setName,
          description: activeTab === 'ai' ? `AI로 생성된 문제집 (${sourceType})` : '직접 만든 문제집',
          subject,
          grade,
        },
        questions: generatedQuestions,
        isPublic,
      })

      toast.success(
        isPublic
          ? '문제집을 저장하고 자료실에 공개했습니다!'
          : '문제집이 저장되었습니다!',
      )
      router.push('/teacher')
    } catch (error) {
      console.error('Error saving questions:', error)
      const errorMessage = formatServiceError(error)
      toast.error(`문제 저장에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCreateManual = (type: ManualQuestionType) => {
    const newQuestions = type === 'MIXED'
      ? [createBlankQuestion('CHOICE'), createBlankQuestion('SHORT'), createBlankQuestion('OX')]
      : [createBlankQuestion(type)]

    setGeneratedQuestions((prev) => [...prev, ...newQuestions])
    setIsReviewing(true)
  }

  // 직접 작성: 유형을 미리 고르지 않고 빈 문제 1개로 바로 편집기에 진입한다.
  // (유형은 편집기에서 문항별로 자유롭게 바꾸거나, '+객관식/+주관식/+OX'로 추가)
  const startManual = () => {
    setActiveTab('manual')
    setGeneratedQuestions((prev) => (prev.length > 0 ? prev : [createBlankQuestion('CHOICE')]))
    setIsReviewing(true)
  }

  // ======= 검수(리뷰) 화면 =======
  if (isReviewing) {
    return (
      <QuestionReviewEditor
        generatedQuestions={generatedQuestions}
        setGeneratedQuestions={setGeneratedQuestions}
        setName={setName}
        setSetName={setSetName}
        subject={subject}
        setSubject={setSubject}
        grade={grade}
        setGrade={setGrade}
        isPublic={isPublic}
        setIsPublic={setIsPublic}
        onBack={() => setIsReviewing(false)}
        onSave={handleSaveQuestions}
        onCreateManual={handleCreateManual}
        isSaving={isSaving}
      />
    )
  }

  // ======= 메인 생성 화면 =======
  return (
    <main className="text-black">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push('/teacher')}
              className="-ml-3 mb-3 h-10 rounded-xl px-3 text-slate-500 hover:bg-slate-100 hover:text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              문제집 목록
            </Button>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-500 text-white shadow-sm shadow-sky-200">
                <Pencil className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                문제 만들기
              </h1>
            </div>
          </div>

          <div className="flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
                activeTab === 'ai'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <ScanLine className="h-4 w-4" />
              AI로 만들기
            </button>
            <button
              type="button"
              onClick={startManual}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
                activeTab === 'manual'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <Pencil className="h-4 w-4" />
              직접 작성
            </button>
          </div>
        </div>

      {activeTab === 'manual' ? (
        <div className="animate-in fade-in duration-300">
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-sky-100 text-sky-600">
              <Pencil className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">빈 문제로 바로 시작</h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
              문제를 입력하면서 유형(객관식·주관식·OX)을 문항마다 자유롭게 고를 수 있어요.
              저장 전까지 얼마든지 추가하고 수정할 수 있습니다.
            </p>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={startManual}
              className="mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-8 text-base font-bold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
            >
              <Pencil className="h-5 w-5" />
              문제 만들기 시작
            </motion.button>
            <p className="mt-4 text-xs font-semibold text-slate-400">
              문제 작성 → 과목·학년 → 저장
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* AI 생성 카드들 */}
          <QuestionSourceSelector
            sourceType={sourceType}
            setSourceType={setSourceType}
            topic={topic}
            setTopic={setTopic}
            youtubeUrl={youtubeUrl}
            setYoutubeUrl={setYoutubeUrl}
            file={file}
            setFile={setFile}
            examFile={examFile}
            setExamFile={setExamFile}
          />

          {/* AI 생성 버튼 */}
          {sourceType && (
            <div className="mb-8">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-sky-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">옵션</h2>
                    <p className="text-sm font-medium text-slate-500">
                      {sourceType === 'exam' ? '과목 · 학년 · 문제 수' : '과목 · 학년 · 문제 수 · 유형'}
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">과목</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
                    <label className="mb-2 block text-sm font-semibold text-slate-600">대상 학년</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">전체/해당없음</option>
                      {TARGET_GRADE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 문제 수 — 프리셋 칩 + 직접 입력 */}
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-semibold text-slate-600">
                    {sourceType === 'exam' ? '최대 문제 수' : '생성 문제 수'}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {QUESTION_COUNT_PRESETS.map((preset) => {
                      const active = questionCount === String(preset)
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuestionCount(String(preset))}
                          className={`h-11 min-w-[64px] rounded-xl border px-4 text-sm font-black transition ${
                            active
                              ? 'border-sky-400 bg-sky-50 text-sky-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {preset}개
                        </button>
                      )
                    })}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max={MAX_AI_QUESTION_COUNT}
                        value={questionCount}
                        onChange={(e) => {
                          const nextValue = e.target.value
                          if (/^\d*$/.test(nextValue)) setQuestionCount(nextValue)
                        }}
                        aria-label="문제 수 직접 입력"
                        className="h-11 w-20 rounded-xl border border-slate-200 px-3 text-center text-sm font-bold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      />
                      <span className="text-sm font-semibold text-slate-500">개 직접</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs font-medium text-slate-400">한 번에 최대 {MAX_AI_QUESTION_COUNT}문제</p>
                </div>

                {/* 문항 유형 — 시험지 추출은 원본 유형을 유지하므로 표시하지 않음 */}
                {sourceType !== 'exam' && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-600">문항 유형</label>
                    <div className="flex flex-wrap gap-2">
                      {AI_TYPE_OPTIONS.map((option) => {
                        const active = questionTypes.includes(option.id)
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setQuestionTypes((prev) => {
                                if (prev.includes(option.id)) {
                                  // 최소 1개는 남긴다
                                  const next = prev.filter((t) => t !== option.id)
                                  return next.length > 0 ? next : prev
                                }
                                return [...prev, option.id]
                              })
                            }}
                            aria-pressed={active}
                            className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                              active
                                ? 'border-sky-400 bg-sky-50 text-sky-700'
                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <span className={`grid h-5 w-5 place-items-center rounded-md text-[11px] ${
                              active ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {active ? '✓' : ''}
                            </span>
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-slate-400">
                      선택한 유형으로 문제를 만들어요. 여러 개 고르면 골고루 섞여요.
                    </p>
                  </div>
                )}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="mt-5 h-12 w-full rounded-xl bg-sky-500 text-base font-bold text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
                  size="lg"
                >
                  {isGenerating
                    ? sourceType === 'exam'
                      ? '시험지 분석 중…'
                      : '문제 만드는 중…'
                    : sourceType === 'exam'
                      ? '시험지에서 문제 추출'
                      : '문제 만들기'
                  }
                </Button>
                {sourceType === 'exam' && (
                  <p className="mt-3 text-center text-xs font-medium text-slate-500">
                    AI가 시험지를 읽고 문제를 추출해요 · 추출 후 수정 가능
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      )}
      </div>
    </main>
  )
}
