'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { checkSupabaseConfig, testSupabaseConnection } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Pencil, ScanLine, Sparkles, Plus, Minus } from 'lucide-react'
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
type ManualQuestionType = 'CHOICE' | 'SHORT' | 'OX'
type AiQuestionType = 'CHOICE' | 'OX' | 'SHORT'
type TypeCounts = Record<AiQuestionType, number>
const MAX_AI_QUESTION_COUNT = 20
// 유형별 개수를 정하면 총 문항 수가 자동으로 계산된다.
const AI_TYPE_OPTIONS: Array<{ id: AiQuestionType; label: string; hint: string }> = [
  { id: 'CHOICE', label: '객관식', hint: '보기 4개 중 정답 고르기' },
  { id: 'OX', label: 'OX', hint: '맞다/틀리다 판단' },
  { id: 'SHORT', label: '주관식', hint: '짧은 답 직접 입력' },
]
const DEFAULT_TYPE_COUNTS: TypeCounts = { CHOICE: 3, OX: 1, SHORT: 1 }

function createBlankQuestion(type: ManualQuestionType): GeneratedQuestion {
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
  // 유형별 생성 개수 (AI). 합계가 총 문항 수가 된다.
  const [typeCounts, setTypeCounts] = useState<TypeCounts>(DEFAULT_TYPE_COUNTS)
  // 시험지 추출은 유형 구분이 없으므로 최대 개수만 사용.
  const [examCount, setExamCount] = useState(10)
  // 선택: AI에게 추가로 전달할 요청사항
  const [userPrompt, setUserPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [setName, setSetName] = useState('')
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const totalTypeCount = typeCounts.CHOICE + typeCounts.OX + typeCounts.SHORT

  const adjustTypeCount = (type: AiQuestionType, delta: number) => {
    setTypeCounts((prev) => {
      const next = Math.max(0, Math.min(MAX_AI_QUESTION_COUNT, prev[type] + delta))
      // 합계가 최대치를 넘지 않도록 제한
      const others = totalTypeCount - prev[type]
      if (others + next > MAX_AI_QUESTION_COUNT) return prev
      return { ...prev, [type]: next }
    })
  }

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
    if (sourceType !== 'exam' && totalTypeCount < 1) {
      toast.error('문항 유형별 개수를 1개 이상 정해주세요.')
      return
    }

    setIsGenerating(true)
    try {
      const formData = new FormData()
      formData.append('sourceType', sourceType!)
      // 시험지: 최대 개수만. 그 외: 유형별 개수 합계가 총 문항 수.
      const normalizedQuestionCount = sourceType === 'exam'
        ? Math.min(MAX_AI_QUESTION_COUNT, Math.max(1, examCount))
        : Math.min(MAX_AI_QUESTION_COUNT, Math.max(1, totalTypeCount))
      formData.append('questionCount', normalizedQuestionCount.toString())
      // 시험지 추출은 원본 문제 유형을 그대로 옮기므로 유형/개수 지정을 보내지 않는다.
      if (sourceType !== 'exam') {
        // 개수가 0인 유형은 제외
        const activeCounts = Object.fromEntries(
          (Object.entries(typeCounts) as Array<[AiQuestionType, number]>).filter(([, n]) => n > 0),
        )
        formData.append('questionCounts', JSON.stringify(activeCounts))
      }
      if (userPrompt.trim()) formData.append('userPrompt', userPrompt.trim())
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
    setGeneratedQuestions((prev) => [...prev, createBlankQuestion(type)])
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
                      {sourceType === 'exam' ? '과목 · 학년 · 문제 수' : '과목 · 학년 · 문항 구성'}
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

                {/* 문항 구성 — 유형별 개수를 정하면 총 문항 수가 자동 계산 */}
                {sourceType !== 'exam' ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold text-slate-600">문항 구성</label>
                      <span className="rounded-lg bg-sky-50 px-3 py-1 text-sm font-black text-sky-700">
                        총 {totalTypeCount}문항
                      </span>
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      {AI_TYPE_OPTIONS.map((option) => {
                        const count = typeCounts[option.id]
                        return (
                          <div
                            key={option.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3.5 py-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-black text-slate-800">
                                {option.label} {count > 0 && <span className="text-sky-600">({count}개)</span>}
                              </div>
                              <div className="text-xs font-medium text-slate-400">{option.hint}</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => adjustTypeCount(option.id, -1)}
                                disabled={count <= 0}
                                aria-label={`${option.label} 줄이기`}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <span className="w-8 text-center text-base font-black tabular-nums text-slate-900">{count}</span>
                              <button
                                type="button"
                                onClick={() => adjustTypeCount(option.id, 1)}
                                disabled={totalTypeCount >= MAX_AI_QUESTION_COUNT}
                                aria-label={`${option.label} 늘리기`}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-slate-400">
                      원하는 유형만 개수를 올리면 돼요. 합계가 총 문항 수가 되고, 한 번에 최대 {MAX_AI_QUESTION_COUNT}문제까지.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-slate-600">최대 문제 수</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExamCount((c) => Math.max(1, c - 1))}
                        disabled={examCount <= 1}
                        aria-label="줄이기"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center text-lg font-black tabular-nums text-slate-900">{examCount}</span>
                      <button
                        type="button"
                        onClick={() => setExamCount((c) => Math.min(MAX_AI_QUESTION_COUNT, c + 1))}
                        disabled={examCount >= MAX_AI_QUESTION_COUNT}
                        aria-label="늘리기"
                        className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <span className="ml-2 text-xs font-medium text-slate-400">시험지에서 최대 {examCount}문제까지 추출</span>
                    </div>
                  </div>
                )}

                {/* 추가 요청 (선택) — AI에게 전달할 특별 지시 */}
                <div className="mt-4">
                  <label htmlFor="ai-user-prompt" className="mb-2 block text-sm font-semibold text-slate-600">
                    추가 요청 <span className="font-medium text-slate-400">(선택)</span>
                  </label>
                  <textarea
                    id="ai-user-prompt"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value.slice(0, 500))}
                    rows={2}
                    placeholder="예: 속담의 뜻을 제시하고 그 속담을 맞히는 주관식으로 내주세요."
                    className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-black outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                  <p className="mt-1 text-right text-xs font-medium text-slate-400">{userPrompt.length}/500</p>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || (sourceType !== 'exam' && totalTypeCount < 1)}
                  className="mt-5 h-12 w-full rounded-xl bg-sky-500 text-base font-bold text-white shadow-sm shadow-sky-200 hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  size="lg"
                >
                  {isGenerating
                    ? sourceType === 'exam'
                      ? '시험지 분석 중…'
                      : '문제 만드는 중…'
                    : sourceType === 'exam'
                      ? '시험지에서 문제 추출'
                      : totalTypeCount < 1
                        ? '유형별 개수를 정해주세요'
                        : `${totalTypeCount}문제 만들기`
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
