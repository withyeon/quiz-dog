'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, CheckCircle2, MessageSquare, XCircle, ScanLine, Sparkles, SlidersHorizontal } from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { extractTextFromPPTX } from '@/lib/extractors/ppt'
import { filterNickname } from '@/lib/utils/profanityFilter'
import QuestionReviewEditor from '@/components/teacher/QuestionReviewEditor'
import QuestionSourceSelector from '@/components/teacher/QuestionSourceSelector'
import { createQuestionSetWithQuestions } from '@/lib/services/questionSets'
import { formatServiceError } from '@/lib/services/errors'
import { TARGET_GRADE_OPTIONS } from '@/lib/constants/grades'

type SourceType = 'topic' | 'youtube' | 'file' | 'exam'
type ManualQuestionType = 'CHOICE' | 'SHORT' | 'OX' | 'MIXED'
const MAX_AI_QUESTION_COUNT = 20

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
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [examFile, setExamFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState('5')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
      const normalizedQuestionCount = Math.min(MAX_AI_QUESTION_COUNT, Math.max(1, Number(questionCount) || 5))
      formData.append('questionCount', normalizedQuestionCount.toString())
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
      alert(`문제 생성에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (isSaving) return

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
      setIsSaving(true)
      await createQuestionSetWithQuestions({
        metadata: {
          title: setName,
          description: activeTab === 'ai' ? `AI로 생성된 문제집 (${sourceType})` : '직접 만든 문제집',
          subject,
          grade,
        },
        questions: generatedQuestions,
      })

      alert('문제가 저장되었습니다!')
      router.push('/teacher')
    } catch (error) {
      console.error('Error saving questions:', error)
      const errorMessage = formatServiceError(error)
      alert(`문제 저장에 실패했습니다: ${errorMessage}`)
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
        onBack={() => setIsReviewing(false)}
        onSave={handleSaveQuestions}
        onCreateManual={handleCreateManual}
        isSaving={isSaving}
      />
    )
  }

  // ======= 메인 생성 화면 =======
  return (
    <main className="min-h-dvh bg-[#f5f7fb] px-4 py-5 text-black sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => router.push('/teacher')}
              className="-ml-3 mb-3 h-10 rounded-lg px-3 text-slate-500 hover:bg-slate-100 hover:text-black"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              문제집 목록
            </Button>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-black text-white shadow-sm">
                <Pencil className="h-6 w-6" />
              </div>
              <div>
                <div className="text-sm font-black text-black">문제집 제작실</div>
                <h1 className="text-3xl font-black tracking-normal text-black sm:text-4xl">
                  새 문제집 만들기
                </h1>
              </div>
            </div>
          </div>

          <div className="flex w-full rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black transition sm:flex-none ${
                activeTab === 'manual'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <Pencil className="h-4 w-4" />
              직접 작성
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-black transition sm:flex-none ${
                activeTab === 'ai'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-black'
              }`}
            >
              <ScanLine className="h-4 w-4" />
              AI로 퀴즈 초안 만들기
            </button>
          </div>
        </div>

      {activeTab === 'manual' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-black">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-black">빈 문제로 시작</h2>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                유형을 고르면 검수 화면에서 바로 내용을 채울 수 있어요. 문제는 저장 전까지 자유롭게 추가하고 바꿀 수 있습니다.
              </p>
              <div className="mt-5 rounded-lg bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
                추천 흐름: 유형 선택 → 문제 작성 → 과목/학년 지정 → 저장
              </div>
            </aside>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCreateManual('CHOICE')}
                className="group min-h-56 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-sky-100 text-black">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 group-hover:bg-sky-100 group-hover:text-black">
                    1-4
                  </span>
                </div>
                <div className="text-2xl font-black text-black">객관식</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">보기와 정답을 빠르게 구성하는 기본 문제 유형</p>
                <div className="mt-6 text-sm font-black text-black">시작하기</div>
              </motion.button>

              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCreateManual('SHORT')}
                className="group min-h-56 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-cyan-100 text-cyan-700">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 group-hover:bg-cyan-100 group-hover:text-cyan-700">
                    입력
                  </span>
                </div>
                <div className="text-2xl font-black text-black">단답형</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">짧은 답, 빈칸, 용어 확인에 어울리는 작성형 문제</p>
                <div className="mt-6 text-sm font-black text-cyan-700">시작하기</div>
              </motion.button>

              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCreateManual('OX')}
                className="group min-h-56 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber-100 text-amber-700">
                    <XCircle className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-700">
                    O/X
                  </span>
                </div>
                <div className="text-2xl font-black text-black">OX</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">개념 판단이나 빠른 확인에 좋은 OX 문제</p>
                <div className="mt-6 text-sm font-black text-amber-700">시작하기</div>
              </motion.button>

              <motion.button
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCreateManual('MIXED')}
                className="group min-h-56 rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:shadow-md"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-sky-100 text-black">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-500 group-hover:bg-sky-100 group-hover:text-black">
                    3종
                  </span>
                </div>
                <div className="text-2xl font-black text-black">혼합 유형</div>
                <p className="mt-3 text-sm font-bold leading-6 text-slate-500">객관식, 단답형, OX 문제를 한 번에 추가합니다</p>
                <div className="mt-6 text-sm font-black text-black">시작하기</div>
              </motion.button>
            </div>
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
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-sky-100 text-black">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-black">생성 조건</h2>
                    <p className="text-sm font-bold text-slate-500">자료를 문제로 바꿀 때 사용할 기본값입니다.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-600">과목</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
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
                    <label className="mb-2 block text-sm font-black text-slate-600">대상 학년</label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">전체/해당없음</option>
                      {TARGET_GRADE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-600">
                      {sourceType === 'exam' ? '최대 문제 수' : '생성 문제 수'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={MAX_AI_QUESTION_COUNT}
                      value={questionCount}
                      onChange={(e) => {
                        const nextValue = e.target.value
                        if (/^\d*$/.test(nextValue)) {
                          setQuestionCount(nextValue)
                        }
                      }}
                      className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      한 번에 최대 {MAX_AI_QUESTION_COUNT}문제까지 생성합니다.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="mt-5 h-12 w-full rounded-lg bg-black text-base font-black text-white shadow-sm hover:bg-neutral-800"
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
                  <p className="mt-3 text-center text-xs font-bold text-slate-500">
                    AI가 시험지를 읽고 문제를 추출합니다. 추출 후 검토 화면에서 수정할 수 있습니다.
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
