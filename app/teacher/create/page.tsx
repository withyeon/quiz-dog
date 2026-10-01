'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Sparkles } from 'lucide-react'
import { checkSupabaseConfig } from '@/lib/supabase/client'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import QuestionReviewEditor, { withUid, type AiAssist, type ReviewQuestion } from '@/components/teacher/QuestionReviewEditor'
import SourcePicker, { getSourceOption, type SourceType } from '@/components/teacher/create/SourcePicker'
import AudienceFields from '@/components/teacher/create/AudienceFields'
import QuestionMixFields, {
  AI_TYPE_ORDER,
  DEFAULT_TYPE_COUNTS,
  MAX_AI_QUESTION_COUNT,
  describeTypeCounts,
  sumTypeCounts,
  type TypeCounts,
} from '@/components/teacher/create/QuestionMixFields'
import GenerationSummary, { type SummaryRow } from '@/components/teacher/create/GenerationSummary'
import GenerationProgress from '@/components/teacher/create/GenerationProgress'
import SaveSuccessPanel from '@/components/teacher/create/SaveSuccessPanel'
import { createQuestionSetWithQuestions } from '@/lib/services/questionSets'
import { getTeacherAccessToken } from '@/lib/services/questionImages'
import { formatServiceError } from '@/lib/services/errors'
import { remapSubjectToLevel, schoolLevelFromGrade } from '@/lib/constants/subjects'
import { createBlankQuestion, type QuestionType } from '@/lib/quiz/questionQuality'
import { toast } from '@/components/ui/Toaster'
import { confirmAsync } from '@/components/ui/ConfirmDialog'

type Mode = 'ai' | 'manual'
type Stage = 'setup' | 'review' | 'saved'

// AI에게 자주 하는 부탁. 누르면 추가 요청 칸에 들어간다.
const PROMPT_SUGGESTIONS = [
  '쉬운 낱말로 써 주세요',
  '실생활 예시를 넣어 주세요',
  '오답 보기를 더 헷갈리게 해 주세요',
  '계산 문제 위주로',
  '낱말 뜻을 묻는 문제 위주로',
]

const STAGES_BY_SOURCE: Record<SourceType, string[]> = {
  topic: ['주제 살펴보는 중', '문제와 보기 만드는 중', '정답·해설 점검 중'],
  file: ['자료 읽는 중', '문제와 보기 만드는 중', '정답·해설 점검 중'],
  youtube: ['영상 자막 가져오는 중', '문제와 보기 만드는 중', '정답·해설 점검 중'],
  exam: ['시험지 읽는 중', '문제와 보기 옮기는 중', '그림 잘라 붙이는 중'],
}
// 단계가 바뀌는 시각(초). 진짜 진행률은 없어서, 평균 소요 시간을 기준으로 넘긴다.
const STAGE_SWITCH_SECONDS = [3, 12]

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
}

type Progress = { title: string; stages: string[]; startedAt: number; elapsedSec: number }

function SectionCard({
  step,
  title,
  caption,
  optional = false,
  children,
}: {
  step: number
  title: string
  caption?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-sm font-black text-white">{step}</span>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
            {title}
            {optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">선택</span>}
          </h2>
          {caption && <p className="mt-0.5 break-keep text-sm font-medium text-slate-500">{caption}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function CreateQuestionPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('ai')
  const [stage, setStage] = useState<Stage>('setup')

  // 1단계 — 자료
  const [sourceType, setSourceType] = useState<SourceType>('topic')
  const [topic, setTopic] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [examFile, setExamFile] = useState<File | null>(null)
  // 2단계 — 대상
  const [grade, setGrade] = useState('')
  const [subject, setSubject] = useState('')
  // 3·4단계 — 구성 · 추가 요청
  const [typeCounts, setTypeCounts] = useState<TypeCounts>(DEFAULT_TYPE_COUNTS)
  const [examCount, setExamCount] = useState(10)
  const [userPrompt, setUserPrompt] = useState('')

  // 검수 · 저장
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [setName, setSetName] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<{ setId: string; title: string; count: number } | null>(null)

  // 생성 진행
  const [progress, setProgress] = useState<Progress | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null)
  const [addingMore, setAddingMore] = useState(false)
  // 지금 검수 중인 문제들을 만든 자료. 직접 작성이면 null → AI 보조 기능 숨김
  const [reviewSource, setReviewSource] = useState<SourceType | null>(null)

  // 다시 만들기·더 만들기 콜백이 문제 목록이 바뀔 때마다 새로 만들어지지 않게 최신 값은 ref로 읽는다
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const regeneratingRef = useRef(false)

  const totalTypeCount = sumTypeCounts(typeCounts)
  const isExam = sourceType === 'exam'
  const hasUnsaved = stage === 'review' && questions.length > 0 && !saved

  // 학년을 바꾸면 학교급이 바뀌므로 과목도 그 학교급 이름으로 옮긴다 (중등 '역사' → 고등 '한국사')
  const handleGradeChange = useCallback((nextGrade: string) => {
    setGrade(nextGrade)
    setSubject((current) => remapSubjectToLevel(current, schoolLevelFromGrade(nextGrade)))
  }, [])

  // 검수 중에 창을 닫거나 새로고침하면 만든 문제가 다 날아간다
  useEffect(() => {
    if (!hasUnsaved) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsaved])

  // 진행 화면의 초 단위 시계
  useEffect(() => {
    if (!progress) return
    const timer = setInterval(() => {
      setProgress((prev) => (prev ? { ...prev, elapsedSec: Math.floor((Date.now() - prev.startedAt) / 1000) } : prev))
    }, 1000)
    return () => clearInterval(timer)
  }, [progress?.startedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const progressStageIndex = progress
    ? STAGE_SWITCH_SECONDS.filter((seconds) => progress.elapsedSec >= seconds).length
    : 0

  // ------------------------------------------------------------------
  // 요약 · 검증
  // ------------------------------------------------------------------
  const sourceLabel = useMemo(() => {
    if (sourceType === 'topic') return topic.trim() ? `주제 · ${topic.trim()}` : ''
    if (sourceType === 'file') return file ? `파일 · ${file.name}` : ''
    if (sourceType === 'youtube') return youtubeUrl.trim() ? '유튜브 영상' : ''
    return examFile ? `시험지 · ${examFile.name}` : ''
  }, [sourceType, topic, file, youtubeUrl, examFile])

  const missing = useMemo(() => {
    const items: string[] = []
    if (sourceType === 'topic' && !topic.trim()) items.push('주제를 적어 주세요')
    if (sourceType === 'file' && !file) items.push('수업 자료 파일을 올려 주세요')
    if (sourceType === 'youtube' && !youtubeUrl.trim()) items.push('영상 링크를 넣어 주세요')
    if (sourceType === 'exam' && !examFile) items.push('시험지 파일을 올려 주세요')
    if (!grade) items.push('학년을 골라 주세요')
    if (!subject) items.push('과목을 골라 주세요')
    if (!isExam && totalTypeCount < 1) items.push('문항 유형 개수를 정해 주세요')
    return items
  }, [sourceType, topic, file, youtubeUrl, examFile, grade, subject, isExam, totalTypeCount])

  const summaryRows: SummaryRow[] = [
    { label: '자료', value: sourceLabel || `${getSourceOption(sourceType).title} · 아직 없어요`, muted: !sourceLabel },
    { label: '대상', value: [grade, subject].filter(Boolean).join(' · ') || '학년 · 과목 미정', muted: !grade && !subject },
    {
      label: '구성',
      value: isExam ? `최대 ${examCount}문제` : describeTypeCounts(typeCounts) || '유형을 골라 주세요',
      muted: !isExam && totalTypeCount < 1,
    },
  ]

  // ------------------------------------------------------------------
  // AI 호출
  // ------------------------------------------------------------------
  const requestGeneration = useCallback(async (opts: {
    count: number
    typeCounts?: Partial<Record<QuestionType, number>>
    allowedTypes?: QuestionType[]
    avoid?: string[]
    signal?: AbortSignal
  }): Promise<{ questions: GeneratedQuestion[]; figureCount: number }> => {
    const formData = new FormData()
    formData.append('sourceType', sourceType)
    formData.append('questionCount', String(Math.min(MAX_AI_QUESTION_COUNT, Math.max(1, opts.count))))
    // 시험지 추출은 원본 유형을 그대로 옮기므로 유형·개수 지정을 보내지 않는다
    if (sourceType !== 'exam') {
      if (opts.typeCounts) {
        const active = Object.fromEntries(Object.entries(opts.typeCounts).filter(([, n]) => (n ?? 0) > 0))
        formData.append('questionCounts', JSON.stringify(active))
      } else if (opts.allowedTypes && opts.allowedTypes.length > 0) {
        formData.append('questionTypes', JSON.stringify(opts.allowedTypes))
      }
    }
    if (opts.avoid && opts.avoid.length > 0) formData.append('avoidQuestions', JSON.stringify(opts.avoid))
    if (userPrompt.trim()) formData.append('userPrompt', userPrompt.trim())
    if (subject) formData.append('subject', subject)
    if (grade) formData.append('grade', grade)

    if (sourceType === 'topic') formData.append('topic', topic.trim())
    else if (sourceType === 'youtube') formData.append('youtubeUrl', youtubeUrl.trim())
    else if (sourceType === 'file' && file) formData.append('file', file)
    else if (sourceType === 'exam' && examFile) formData.append('file', examFile)

    // 시험지 스캔의 그림을 잘라 붙이려면 서버가 "누구 그림인지" 알아야 한다 → 로그인 토큰 동봉
    const accessToken = await getTeacherAccessToken()
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: formData,
      signal: opts.signal,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || '문제 생성에 실패했습니다.')
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('만들어진 문제가 없어요. 주제나 자료를 조금 더 구체적으로 넣고 다시 시도해 주세요.')
    }
    return { questions: data.questions as GeneratedQuestion[], figureCount: typeof data.figureCount === 'number' ? data.figureCount : 0 }
  }, [sourceType, topic, youtubeUrl, file, examFile, userPrompt, subject, grade])

  const handleGenerate = async () => {
    if (missing.length > 0) {
      toast.error(missing[0])
      return
    }
    if (questions.length > 0) {
      const ok = await confirmAsync({
        title: '새로 만들까요?',
        message: `검수 중인 ${questions.length}문제가 있어요. 새로 만들면 지금 문제들은 사라져요.`,
        confirmLabel: '새로 만들기',
        cancelLabel: '취소',
      })
      if (!ok) return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setProgress({
      title: isExam ? '시험지를 옮기고 있어요' : '문제를 만들고 있어요',
      stages: STAGES_BY_SOURCE[sourceType],
      startedAt: Date.now(),
      elapsedSec: 0,
    })

    try {
      const active = Object.fromEntries(AI_TYPE_ORDER.filter((type) => typeCounts[type] > 0).map((type) => [type, typeCounts[type]]))
      const result = await requestGeneration({
        count: isExam ? examCount : totalTypeCount,
        typeCounts: isExam ? undefined : active,
        signal: controller.signal,
      })
      setQuestions(result.questions.map(withUid))
      setReviewSource(sourceType)
      setSaved(null)
      // 이름이 비어 있으면 자료 이름으로 미리 채운다 (고치면 그대로 둔다)
      if (!setName.trim()) {
        const suggested = sourceType === 'topic'
          ? topic.trim()
          : sourceType === 'file' && file
            ? stripExtension(file.name)
            : sourceType === 'exam' && examFile
              ? stripExtension(examFile.name)
              : '영상으로 만든 퀴즈'
        setSetName(suggested.slice(0, 60))
      }
      if (result.figureCount > 0) {
        toast.success(`시험지의 그림 ${result.figureCount}개를 문제에 붙였어요. 검수 화면에서 확인해 주세요.`)
      }
      setMode('ai')
      setStage('review')
      window.scrollTo({ top: 0 })
    } catch (error) {
      if (controller.signal.aborted) {
        toast.info('문제 만들기를 멈췄어요.')
      } else {
        console.error('Error generating questions:', error)
        toast.error(`문제를 만들지 못했어요: ${formatServiceError(error)}`)
      }
    } finally {
      abortRef.current = null
      setProgress(null)
    }
  }

  const cancelGeneration = () => {
    abortRef.current?.abort()
  }

  // 한 문제만 같은 유형으로 다시 만들기 — 나머지 문제는 겹치지 않게 AI에게 알려 준다
  const regenerateQuestion = useCallback(async (index: number) => {
    const current = questionsRef.current
    const target = current[index]
    if (!target || regeneratingRef.current) return
    regeneratingRef.current = true
    setRegeneratingIndex(index)
    try {
      const avoid = current.filter((_, i) => i !== index).map((q) => q.question_text)
      const result = await requestGeneration({ count: 1, typeCounts: { [target.type]: 1 }, avoid })
      const fresh = result.questions[0]
      setQuestions((prev) => prev.map((q) => (q.uid === target.uid ? { ...fresh, uid: q.uid } : q)))
      toast.success(`${index + 1}번 문제를 새로 만들었어요.`)
    } catch (error) {
      toast.error(`다시 만들지 못했어요: ${formatServiceError(error)}`)
    } finally {
      regeneratingRef.current = false
      setRegeneratingIndex(null)
    }
  }, [requestGeneration])

  // 같은 자료로 몇 문제 더 — '섞어서'는 지금 있는 유형들 안에서 AI가 고른다
  const addingMoreRef = useRef(false)
  const addMoreQuestions = useCallback(async (count: number, type: QuestionType | 'MIX') => {
    const current = questionsRef.current
    if (addingMoreRef.current) return
    if (current.length + count > MAX_AI_QUESTION_COUNT * 2) {
      toast.error(`한 문제집에는 ${MAX_AI_QUESTION_COUNT * 2}문제까지 담는 걸 권해요.`)
      return
    }
    addingMoreRef.current = true
    setAddingMore(true)
    try {
      const avoid = current.map((q) => q.question_text)
      const presentTypes = Array.from(new Set(current.map((q) => q.type)))
      const result = await requestGeneration(
        type === 'MIX'
          ? { count, allowedTypes: presentTypes.length > 0 ? presentTypes : ['CHOICE', 'OX', 'SHORT'], avoid }
          : { count, typeCounts: { [type]: count }, avoid },
      )
      setQuestions((prev) => [...prev, ...result.questions.map(withUid)])
      toast.success(`${result.questions.length}문제를 더 만들었어요.`)
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
    } catch (error) {
      toast.error(`더 만들지 못했어요: ${formatServiceError(error)}`)
    } finally {
      addingMoreRef.current = false
      setAddingMore(false)
    }
  }, [requestGeneration])

  const aiAssist: AiAssist | null = reviewSource && reviewSource !== 'exam'
    ? { regenerate: regenerateQuestion, addMore: addMoreQuestions, busyIndex: regeneratingIndex, addingMore }
    : null

  // ------------------------------------------------------------------
  // 저장
  // ------------------------------------------------------------------
  const handleSave = async () => {
    if (isSaving) return
    const title = setName.trim()
    if (!title) {
      toast.error('문제집 이름을 적어 주세요.')
      document.getElementById('review-set-name')?.focus()
      return
    }
    if (title.length > 60) {
      toast.error('문제집 이름은 60자까지 쓸 수 있어요.')
      return
    }
    if (!grade) {
      toast.error('학년을 골라 주세요.')
      return
    }
    if (!subject) {
      toast.error('과목을 골라 주세요.')
      return
    }
    const supabaseCheck = checkSupabaseConfig()
    if (!supabaseCheck.isValid) {
      toast.error(`Supabase 연결 오류: ${supabaseCheck.error}`)
      return
    }

    const description = reviewSource === 'topic'
      ? `AI 생성 · 주제: ${topic.trim()}`
      : reviewSource === 'file' && file
        ? `AI 생성 · 자료: ${file.name}`
        : reviewSource === 'youtube'
          ? 'AI 생성 · 유튜브 영상'
          : reviewSource === 'exam' && examFile
            ? `시험지에서 가져옴 · ${examFile.name}`
            : '직접 만든 문제집'

    try {
      setIsSaving(true)
      const setId = await createQuestionSetWithQuestions({
        metadata: { title, description, subject, grade },
        questions,
        isPublic,
      })
      setSaved({ setId, title, count: questions.length })
      setStage('saved')
      window.scrollTo({ top: 0 })
    } catch (error) {
      console.error('Error saving questions:', error)
      toast.error(`저장하지 못했어요: ${formatServiceError(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const resetForNew = () => {
    setQuestions([])
    setSetName('')
    setSaved(null)
    setReviewSource(null)
    setTopic('')
    setFile(null)
    setExamFile(null)
    setYoutubeUrl('')
    setMode('ai')
    setStage('setup')
    window.scrollTo({ top: 0 })
  }

  // ------------------------------------------------------------------
  // 직접 작성 · 이동
  // ------------------------------------------------------------------
  const startManual = () => {
    setMode('manual')
    setReviewSource(null)
    setQuestions((prev) => (prev.length > 0 ? prev : [withUid(createBlankQuestion('CHOICE'))]))
    setStage('review')
    window.scrollTo({ top: 0 })
  }

  const switchToAi = () => {
    setMode('ai')
    setStage('setup')
  }

  const leaveToList = async () => {
    if (hasUnsaved) {
      const ok = await confirmAsync({
        title: '저장하지 않고 나갈까요?',
        message: `검수 중인 ${questions.length}문제가 사라져요.`,
        confirmLabel: '나가기',
        cancelLabel: '계속 작성',
        destructive: true,
      })
      if (!ok) return
    }
    router.push('/teacher')
  }

  // ======= 저장 완료 =======
  if (stage === 'saved' && saved) {
    return (
      <SaveSuccessPanel
        setId={saved.setId}
        title={saved.title}
        questionCount={saved.count}
        subject={subject}
        grade={grade}
        isPublic={isPublic}
        onCreateAnother={resetForNew}
      />
    )
  }

  // ======= 검수 =======
  if (stage === 'review') {
    const sourceSummary = reviewSource === 'topic'
      ? `주제 · ${topic.trim()}`
      : reviewSource === 'file' && file
        ? `자료 · ${file.name}`
        : reviewSource === 'youtube'
          ? '유튜브 영상으로 만든 문제'
          : reviewSource === 'exam' && examFile
            ? `시험지 · ${examFile.name}`
            : null
    return (
      <QuestionReviewEditor
        questions={questions}
        setQuestions={setQuestions}
        setName={setName}
        setSetName={setSetName}
        subject={subject}
        setSubject={setSubject}
        grade={grade}
        setGrade={handleGradeChange}
        isPublic={isPublic}
        setIsPublic={setIsPublic}
        onBack={() => {
          setStage('setup')
          window.scrollTo({ top: 0 })
        }}
        backLabel={mode === 'ai' ? '설정으로 돌아가기' : '처음으로'}
        onSave={handleSave}
        isSaving={isSaving}
        sourceSummary={sourceSummary}
        ai={aiAssist}
      />
    )
  }

  // ======= 설정 (메인) =======
  const actionLabel = isExam ? '시험지에서 문제 가져오기' : `${totalTypeCount}문제 만들기`

  return (
    <main className={`text-black ${mode === 'ai' ? 'pb-32 lg:pb-0' : ''}`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => void leaveToList()}
              className="-ml-2 mb-3 inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              문제집 목록
            </button>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">문제 만들기</h1>
            <p className="mt-1.5 text-sm font-medium text-slate-500">
              자료를 넣으면 AI가 초안을 만들어요. 검수 화면에서 고친 뒤 저장하면 바로 게임에 쓸 수 있어요.
            </p>
          </div>

          <div role="tablist" aria-label="만드는 방식" className="flex w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-auto">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'ai'}
              onClick={switchToAi}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition sm:flex-none ${
                mode === 'ai' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              AI로 만들기
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'manual'}
              onClick={startManual}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-black transition sm:flex-none ${
                mode === 'manual' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Pencil className="h-4 w-4" />
              직접 작성
            </button>
          </div>
        </div>

        {mode === 'manual' ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-sky-100 text-sky-600">
              <Pencil className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              {questions.length > 0 ? `작성 중인 문제 ${questions.length}개가 있어요` : '빈 문제로 바로 시작'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-slate-500">
              문항마다 객관식 · OX · 주관식 · 빈칸을 자유롭게 고를 수 있고, 저장 전까지 얼마든지 고칠 수 있어요.
            </p>
            <button
              type="button"
              onClick={startManual}
              className="mx-auto mt-6 flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-8 text-base font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600"
            >
              <Pencil className="h-5 w-5" />
              {questions.length > 0 ? '이어서 작성하기' : '문제 작성 시작'}
            </button>
            <button type="button" onClick={switchToAi} className="mt-4 block w-full text-xs font-bold text-slate-400 transition hover:text-sky-700">
              AI로 초안을 먼저 만들고 고치는 쪽이 빨라요 →
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <SectionCard step={1} title="무엇으로 만들까요?" caption="주제를 적거나, 수업 자료 · 영상 · 시험지를 넣어요.">
                <SourcePicker
                  sourceType={sourceType}
                  onSelect={setSourceType}
                  topic={topic}
                  setTopic={setTopic}
                  youtubeUrl={youtubeUrl}
                  setYoutubeUrl={setYoutubeUrl}
                  file={file}
                  setFile={setFile}
                  examFile={examFile}
                  setExamFile={setExamFile}
                  disabled={!!progress}
                />
              </SectionCard>

              <SectionCard step={2} title="누구에게 낼까요?" caption="학년에 맞춰 낱말과 난이도를 조절해요.">
                <AudienceFields
                  grade={grade}
                  onGradeChange={handleGradeChange}
                  subject={subject}
                  onSubjectChange={setSubject}
                  disabled={!!progress}
                />
              </SectionCard>

              <SectionCard
                step={3}
                title={isExam ? '몇 문제까지 옮길까요?' : '몇 문제를 어떤 유형으로?'}
                caption={isExam ? '시험지에 적힌 유형을 그대로 따라가요.' : '유형별 개수의 합이 총 문항 수가 돼요.'}
              >
                <QuestionMixFields
                  mode={isExam ? 'exam' : 'mix'}
                  typeCounts={typeCounts}
                  onTypeCountsChange={setTypeCounts}
                  examCount={examCount}
                  onExamCountChange={setExamCount}
                  disabled={!!progress}
                />
              </SectionCard>

              {!isExam && (
                <SectionCard step={4} title="AI에게 부탁할 말" caption="강조하고 싶은 점이나 피했으면 하는 것을 적어요." optional>
                  <textarea
                    id="ai-user-prompt"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value.slice(0, 500))}
                    rows={2}
                    disabled={!!progress}
                    placeholder="예: 속담의 뜻을 보여 주고 그 속담을 맞히는 주관식으로 내 주세요."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] font-semibold leading-6 text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {PROMPT_SUGGESTIONS.map((suggestion) => {
                      const included = userPrompt.includes(suggestion)
                      return (
                        <button
                          key={suggestion}
                          type="button"
                          disabled={!!progress}
                          onClick={() => {
                            if (included) {
                              setUserPrompt((prev) => prev.replace(suggestion, '').replace(/\s{2,}/g, ' ').replace(/^[\s,]+|[\s,]+$/g, ''))
                            } else {
                              setUserPrompt((prev) => `${prev.trim() ? `${prev.trim()} ` : ''}${suggestion}`.slice(0, 500))
                            }
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                            included
                              ? 'border-sky-400 bg-sky-100 text-sky-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700'
                          }`}
                        >
                          {included ? '✓ ' : '+ '}{suggestion}
                        </button>
                      )
                    })}
                    <span className="ml-auto text-xs font-medium text-slate-400">{userPrompt.length}/500</span>
                  </div>
                </SectionCard>
              )}
            </div>

            <GenerationSummary
              rows={summaryRows}
              missing={missing}
              actionLabel={actionLabel}
              isGenerating={!!progress}
              onGenerate={() => void handleGenerate()}
            />
          </div>
        )}
      </div>

      {progress && (
        <GenerationProgress
          title={progress.title}
          stages={progress.stages}
          activeIndex={progressStageIndex}
          elapsedSec={progress.elapsedSec}
          onCancel={cancelGeneration}
        />
      )}
    </main>
  )
}
