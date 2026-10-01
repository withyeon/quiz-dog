'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { BLANK_PLACEHOLDER_DISPLAY, displayBlankText } from '@/lib/quiz/blankText'
import { getOptionLabel } from '@/lib/quiz/optionLabels'
import { toast } from '@/components/ui/Toaster'
import QuestionImageField from '@/components/teacher/QuestionImageField'
import AudienceFields from '@/components/teacher/create/AudienceFields'
import {
  CHOICE_OPTION_COUNT,
  QUESTION_TYPE_LABEL,
  convertQuestionType,
  createBlankQuestion,
  getQuestionErrors,
  getQuestionWarnings,
  type QuestionType,
} from '@/lib/quiz/questionQuality'

/** 화면에서만 쓰는 고유 키. 저장 시 normalizeQuestionDraft가 아는 필드만 추리므로 DB에는 안 간다. */
export type ReviewQuestion = GeneratedQuestion & { uid: string }

export function newQuestionUid(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function withUid(question: GeneratedQuestion): ReviewQuestion {
  return { ...question, uid: newQuestionUid() }
}

/** AI로 만든 문제집에서만 쓸 수 있는 보조 기능 */
export type AiAssist = {
  /** 이 문제 하나만 같은 유형으로 다시 만들기 */
  regenerate: (index: number) => Promise<void>
  /** 같은 자료로 문제 더 만들기 */
  addMore: (count: number, type: QuestionType | 'MIX') => Promise<void>
  busyIndex: number | null
  addingMore: boolean
}

const TYPE_ORDER: QuestionType[] = ['CHOICE', 'OX', 'SHORT', 'BLANK']

const TYPE_STYLE: Record<QuestionType, { chip: string; active: string; number: string }> = {
  CHOICE: { chip: 'bg-sky-50 text-sky-700', active: 'bg-sky-500 text-white shadow-sm', number: 'bg-sky-500' },
  OX: { chip: 'bg-emerald-50 text-emerald-700', active: 'bg-emerald-500 text-white shadow-sm', number: 'bg-emerald-500' },
  SHORT: { chip: 'bg-amber-50 text-amber-700', active: 'bg-amber-500 text-white shadow-sm', number: 'bg-amber-500' },
  BLANK: { chip: 'bg-teal-50 text-teal-700', active: 'bg-teal-500 text-white shadow-sm', number: 'bg-teal-500' },
}

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] font-semibold leading-6 text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100'

const iconButtonClass =
  'grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400'

function autoRows(text: string, min = 2, max = 6): number {
  const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 56)), 0)
  return Math.min(max, Math.max(min, lines))
}

// ===================================================================
// 문제 카드
// ===================================================================

interface QuestionCardProps {
  question: ReviewQuestion
  index: number
  total: number
  onPatch: (uid: string, patch: Partial<GeneratedQuestion>) => void
  onReplace: (uid: string, next: GeneratedQuestion) => void
  onMove: (uid: string, direction: -1 | 1) => void
  onDuplicate: (uid: string) => void
  onDelete: (uid: string) => void
  onRegenerate?: (index: number) => void
  regenerating: boolean
}

const QuestionCard = memo(function QuestionCard({
  question: q,
  index,
  total,
  onPatch,
  onReplace,
  onMove,
  onDuplicate,
  onDelete,
  onRegenerate,
  regenerating,
}: QuestionCardProps) {
  const errors = getQuestionErrors(q)
  const warnings = getQuestionWarnings(q)
  const style = TYPE_STYLE[q.type] ?? TYPE_STYLE.CHOICE
  const options = q.options || []
  const displayText = q.type === 'BLANK' ? displayBlankText(q.question_text) : q.question_text

  const setOption = (optIndex: number, value: string) => {
    const next = [...options]
    const wasAnswer = options[optIndex].trim() !== '' && options[optIndex].trim() === q.answer.trim()
    next[optIndex] = value
    // 정답으로 고른 보기의 글자를 고치면 정답도 같이 따라간다
    onPatch(q.uid, wasAnswer ? { options: next, answer: value } : { options: next })
  }

  const insertBlank = () => {
    const text = q.question_text
    const next = text.endsWith(' ') || text === '' ? `${text}${BLANK_PLACEHOLDER_DISPLAY}` : `${text} ${BLANK_PLACEHOLDER_DISPLAY}`
    onPatch(q.uid, { question_text: next })
  }

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-colors ${
        errors.length > 0 ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      {/* 카드 머리: 번호 · 유형 · 동작 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black text-white ${style.number}`}>
          {index + 1}
        </span>
        <div role="radiogroup" aria-label="문제 유형" className="flex rounded-lg bg-slate-100 p-0.5">
          {TYPE_ORDER.map((type) => {
            const active = q.type === type
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => !active && onReplace(q.uid, convertQuestionType(q, type))}
                className={`rounded-md px-2.5 py-1 text-xs font-black transition ${
                  active ? TYPE_STYLE[type].active : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {QUESTION_TYPE_LABEL[type]}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => onMove(q.uid, -1)} disabled={index === 0} aria-label="위로" title="위로" className={iconButtonClass}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(q.uid, 1)} disabled={index === total - 1} aria-label="아래로" title="아래로" className={iconButtonClass}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onDuplicate(q.uid)} aria-label="복제" title="복제" className={iconButtonClass}>
            <Copy className="h-4 w-4" />
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(index)}
              disabled={regenerating}
              aria-label="AI로 다시 만들기"
              title="AI로 이 문제만 다시 만들기"
              className={`${iconButtonClass} hover:bg-sky-50 hover:text-sky-600`}
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(q.uid)}
            aria-label="삭제"
            title="삭제"
            className={`${iconButtonClass} hover:bg-rose-50 hover:text-rose-600`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* 문제 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor={`${q.uid}-text`} className="text-sm font-bold text-slate-700">문제</label>
            <span className={`text-xs font-semibold ${q.question_text.length > 80 ? 'text-amber-600' : 'text-slate-400'}`}>
              {q.question_text.length}자
            </span>
          </div>
          <textarea
            id={`${q.uid}-text`}
            value={displayText}
            onChange={(e) => onPatch(q.uid, { question_text: e.target.value })}
            rows={autoRows(displayText)}
            placeholder={q.type === 'BLANK' ? `예: 물이 수증기로 변하는 현상을 ${BLANK_PLACEHOLDER_DISPLAY}(이)라고 해요` : '학생에게 보여줄 문제를 적어 주세요'}
            className={`${fieldClass} resize-none`}
          />
          {q.type === 'BLANK' && !/\[\s*\]|\{\{blank\}\}/.test(q.question_text) && (
            <button
              type="button"
              onClick={insertBlank}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-700 transition hover:bg-teal-100"
            >
              <Plus className="h-3.5 w-3.5" />
              빈칸 표시 넣기
            </button>
          )}
        </div>

        {/* 그림 (선택) */}
        <QuestionImageField
          value={q.image_url}
          onChange={(url) => onPatch(q.uid, { image_url: url })}
          compact
        />

        {/* 보기 — 객관식 */}
        {q.type === 'CHOICE' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">보기</span>
              <span className="text-xs font-semibold text-slate-400">번호를 눌러 정답을 고르세요</span>
            </div>
            <div className="space-y-2">
              {options.map((opt, optIdx) => {
                const isAnswer = q.answer.trim() !== '' && opt.trim() !== '' && opt.trim() === q.answer.trim()
                return (
                  <div
                    key={optIdx}
                    className={`flex items-center gap-2 rounded-xl border pl-1.5 pr-1.5 transition ${
                      isAnswer ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => opt.trim() && onPatch(q.uid, { answer: opt.trim() })}
                      disabled={!opt.trim()}
                      aria-label={isAnswer ? `${optIdx + 1}번 보기가 정답` : `${optIdx + 1}번 보기를 정답으로`}
                      aria-pressed={isAnswer}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black transition ${
                        isAnswer ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {isAnswer ? <Check className="h-4 w-4" strokeWidth={3} /> : getOptionLabel(optIdx)}
                    </button>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => setOption(optIdx, e.target.value)}
                      placeholder={`보기 ${optIdx + 1}`}
                      aria-label={`보기 ${optIdx + 1}`}
                      className="h-11 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
                    />
                    {options.length > CHOICE_OPTION_COUNT && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = options.filter((_, i) => i !== optIdx)
                          onPatch(q.uid, isAnswer ? { options: next, answer: '' } : { options: next })
                        }}
                        aria-label="보기 삭제"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
              {options.length < CHOICE_OPTION_COUNT && (
                <button
                  type="button"
                  onClick={() => onPatch(q.uid, { options: [...options, ''] })}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-black text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  + 보기 추가 ({options.length}/{CHOICE_OPTION_COUNT})
                </button>
              )}
            </div>
          </div>
        )}

        {/* 정답 — OX */}
        {q.type === 'OX' && (
          <div>
            <span className="mb-1.5 block text-sm font-bold text-slate-700">정답</span>
            <div className="grid grid-cols-2 gap-2">
              {(['O', 'X'] as const).map((value) => {
                const active = q.answer === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onPatch(q.uid, { answer: value })}
                    aria-pressed={active}
                    className={`h-12 rounded-xl border text-xl font-black transition ${
                      active
                        ? value === 'O'
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100'
                          : 'border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-100'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-700'
                    }`}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 정답 — 주관식 · 빈칸 */}
        {(q.type === 'SHORT' || q.type === 'BLANK') && (
          <div>
            <label htmlFor={`${q.uid}-answer`} className="mb-1.5 block text-sm font-bold text-slate-700">정답</label>
            <input
              id={`${q.uid}-answer`}
              type="text"
              value={q.answer}
              onChange={(e) => onPatch(q.uid, { answer: e.target.value })}
              placeholder={q.type === 'BLANK' ? '빈칸에 들어갈 말' : '학생이 입력할 짧은 답'}
              className={`${fieldClass} h-11 py-0`}
            />
            <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
              띄어쓰기·대소문자는 채점에서 무시해요. 여러 표기를 인정하려면 <span className="rounded bg-slate-100 px-1 font-black text-slate-700">|</span>로 이어 적어요. 예: <span className="font-bold text-slate-700">세종대왕|세종</span>
            </p>
          </div>
        )}

        {/* 해설 (선택) */}
        <div>
          <label htmlFor={`${q.uid}-explanation`} className="mb-1.5 block text-sm font-bold text-slate-700">
            해설 <span className="font-medium text-slate-400">(선택 · 공부 모드와 결과 복습에 보여요)</span>
          </label>
          <textarea
            id={`${q.uid}-explanation`}
            value={q.explanation ?? ''}
            onChange={(e) => onPatch(q.uid, { explanation: e.target.value })}
            rows={autoRows(q.explanation ?? '', 2, 4)}
            placeholder="왜 이게 정답인지 한두 문장으로"
            className={`${fieldClass} resize-none text-sm`}
          />
        </div>

        {/* 점검 결과 */}
        {(errors.length > 0 || warnings.length > 0) && (
          <div className="space-y-2">
            {errors.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                {errors.map((err) => (
                  <li key={err} className="flex items-start gap-2 text-sm font-bold text-rose-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                {warnings.map((warn) => (
                  <li key={warn} className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    {warn}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {regenerating && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-white/80 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-sky-700 shadow">
            <Loader2 className="h-4 w-4 animate-spin" />
            이 문제를 다시 만드는 중
          </div>
        </div>
      )}
    </motion.div>
  )
})

// ===================================================================
// 검수 화면
// ===================================================================

interface QuestionReviewEditorProps {
  questions: ReviewQuestion[]
  setQuestions: React.Dispatch<React.SetStateAction<ReviewQuestion[]>>
  setName: string
  setSetName: (value: string) => void
  subject: string
  setSubject: (value: string) => void
  grade: string
  setGrade: (value: string) => void
  isPublic: boolean
  setIsPublic: (value: boolean) => void
  onBack: () => void
  backLabel?: string
  onSave: () => void
  isSaving?: boolean
  /** 어떤 자료로 만들었는지 (머리글에 표시) */
  sourceSummary?: string | null
  /** AI 보조 기능. 직접 작성·시험지 추출에서는 넘기지 않는다 */
  ai?: AiAssist | null
}

export default function QuestionReviewEditor({
  questions,
  setQuestions,
  setName,
  setSetName,
  subject,
  setSubject,
  grade,
  setGrade,
  isPublic,
  setIsPublic,
  onBack,
  backLabel = '설정으로 돌아가기',
  onSave,
  isSaving = false,
  sourceSummary = null,
  ai = null,
}: QuestionReviewEditorProps) {
  const [moreType, setMoreType] = useState<QuestionType | 'MIX'>('MIX')
  const [moreCount, setMoreCount] = useState(3)
  // 실수로 지운 문제를 되돌릴 수 있게 잠깐 들고 있는다
  const [lastDeleted, setLastDeleted] = useState<{ question: ReviewQuestion; index: number } | null>(null)
  // 카드에 넘기는 콜백이 매 입력마다 바뀌면 모든 카드가 다시 그려진다 → 최신 값은 ref로 읽는다
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const regenerateRef = useRef(ai?.regenerate)
  regenerateRef.current = ai?.regenerate

  useEffect(() => {
    if (!lastDeleted) return
    const timer = setTimeout(() => setLastDeleted(null), 8000)
    return () => clearTimeout(timer)
  }, [lastDeleted])

  const issues = useMemo(() => {
    let errors = 0
    let warnings = 0
    for (const q of questions) {
      errors += getQuestionErrors(q).length
      warnings += getQuestionWarnings(q).length
    }
    return { errors, warnings }
  }, [questions])

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<QuestionType, number>> = {}
    for (const q of questions) counts[q.type] = (counts[q.type] ?? 0) + 1
    return counts
  }, [questions])

  const handlePatch = useCallback((uid: string, patch: Partial<GeneratedQuestion>) => {
    setQuestions((prev) => prev.map((q) => (q.uid === uid ? { ...q, ...patch } : q)))
  }, [setQuestions])

  const handleReplace = useCallback((uid: string, next: GeneratedQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.uid === uid ? { ...next, uid } : q)))
  }, [setQuestions])

  const handleMove = useCallback((uid: string, direction: -1 | 1) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.uid === uid)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [setQuestions])

  const handleDuplicate = useCallback((uid: string) => {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.uid === uid)
      if (index < 0) return prev
      const copy: ReviewQuestion = { ...prev[index], uid: newQuestionUid() }
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)]
    })
  }, [setQuestions])

  const handleDelete = useCallback((uid: string) => {
    const index = questionsRef.current.findIndex((q) => q.uid === uid)
    if (index < 0) return
    setLastDeleted({ question: questionsRef.current[index], index })
    setQuestions((prev) => prev.filter((q) => q.uid !== uid))
  }, [setQuestions])

  const undoDelete = () => {
    if (!lastDeleted) return
    const { question, index } = lastDeleted
    setQuestions((prev) => {
      const at = Math.min(index, prev.length)
      return [...prev.slice(0, at), question, ...prev.slice(at)]
    })
    setLastDeleted(null)
  }

  const addBlank = (type: QuestionType) => {
    setQuestions((prev) => [...prev, withUid(createBlankQuestion(type))])
    // 새 카드가 아래 생기므로 살짝 기다렸다가 끝으로 내려간다
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50)
  }

  const handleRegenerate = useCallback((index: number) => {
    void regenerateRef.current?.(index)
  }, [])

  const handleSaveClick = () => {
    if (isSaving) return
    if (questions.length === 0) {
      toast.error('저장할 문제가 없어요. 문제를 하나 이상 추가해 주세요.')
      return
    }
    if (issues.errors > 0) {
      toast.error(`고쳐야 할 곳이 ${issues.errors}개 있어요. 빨간 표시를 먼저 확인해 주세요.`)
      const firstError = document.querySelector('[data-has-error="true"]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    onSave()
  }

  const statusLine = issues.errors > 0
    ? { tone: 'text-rose-600', icon: AlertTriangle, text: `${issues.errors}곳 고쳐야 저장할 수 있어요` }
    : issues.warnings > 0
      ? { tone: 'text-amber-600', icon: AlertTriangle, text: `저장할 수 있어요 · 살펴볼 점 ${issues.warnings}개` }
      : { tone: 'text-emerald-600', icon: CheckCircle2, text: '모두 정상이에요' }
  const StatusIcon = statusLine.icon

  return (
    <main className="pb-28 text-black">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 mb-4 inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </button>

        {/* 머리글: 상태 + 문제집 정보 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">검수하고 저장하기</h1>
              <p className={`mt-1.5 flex items-center gap-1.5 text-sm font-bold ${statusLine.tone}`}>
                <StatusIcon className="h-4 w-4" />
                {questions.length}문제 · {statusLine.text}
              </p>
              {sourceSummary && (
                <p className="mt-1 text-xs font-medium text-slate-400">{sourceSummary}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_ORDER.map((type) => {
                const count = typeCounts[type] ?? 0
                if (count === 0) return null
                return (
                  <span key={type} className={`rounded-full px-2.5 py-1 text-xs font-black ${TYPE_STYLE[type].chip}`}>
                    {QUESTION_TYPE_LABEL[type]} {count}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="review-set-name" className="text-sm font-bold text-slate-700">문제집 이름</label>
                <span className={`text-xs font-semibold ${setName.length > 60 ? 'text-rose-500' : 'text-slate-400'}`}>{setName.length}/60</span>
              </div>
              <input
                id="review-set-name"
                type="text"
                value={setName}
                onChange={(e) => setSetName(e.target.value.slice(0, 60))}
                placeholder="예: 물의 상태 변화 복습 퀴즈"
                className={`${fieldClass} h-12 py-0 text-base`}
              />
            </div>
            <AudienceFields compact grade={grade} onGradeChange={setGrade} subject={subject} onSubjectChange={setSubject} />

            <button
              type="button"
              onClick={() => setIsPublic(!isPublic)}
              aria-pressed={isPublic}
              className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                isPublic ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${isPublic ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {isPublic ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">{isPublic ? '자료실에 공개' : '나만 보기'}</span>
                <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">
                  {isPublic ? '다른 선생님도 자료실에서 찾아 쓸 수 있어요.' : '내 문제집에만 저장돼요. 나중에 바꿀 수 있어요.'}
                </span>
              </span>
              <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isPublic ? 'bg-sky-500' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${isPublic ? 'left-6' : 'left-1'}`} />
              </span>
            </button>
          </div>
        </div>

        {/* 되돌리기 */}
        {lastDeleted && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600">
            <span>{lastDeleted.index + 1}번 문제를 지웠어요</span>
            <button
              type="button"
              onClick={undoDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-black text-sky-700 ring-1 ring-slate-200 transition hover:bg-sky-50"
            >
              <Undo2 className="h-4 w-4" />
              되돌리기
            </button>
          </div>
        )}

        {/* 문제 목록 */}
        <div className="mt-5 space-y-4">
          {questions.map((q, index) => (
            <div key={q.uid} data-has-error={getQuestionErrors(q).length > 0 ? 'true' : undefined}>
              <QuestionCard
                question={q}
                index={index}
                total={questions.length}
                onPatch={handlePatch}
                onReplace={handleReplace}
                onMove={handleMove}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onRegenerate={ai ? handleRegenerate : undefined}
                regenerating={ai?.busyIndex === index}
              />
            </div>
          ))}

          {questions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
              <p className="text-base font-black text-slate-700">아직 문제가 없어요</p>
              <p className="mt-1 text-sm font-medium text-slate-500">아래에서 유형을 골라 첫 문제를 추가해 보세요.</p>
            </div>
          )}

          {/* 문제 추가 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-bold text-slate-700">직접 문제 추가</span>
              <div className="flex flex-wrap gap-1.5">
                {TYPE_ORDER.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addBlank(type)}
                    className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-black transition hover:brightness-95 ${TYPE_STYLE[type].chip}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {QUESTION_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>

            {ai && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
                    <Sparkles className="h-4 w-4 text-sky-500" />
                    같은 자료로 AI가 더 만들기
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={moreType}
                      onChange={(e) => setMoreType(e.target.value as QuestionType | 'MIX')}
                      aria-label="추가할 문제 유형"
                      disabled={ai.addingMore}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-bold text-slate-800 outline-none focus:border-sky-400"
                    >
                      <option value="MIX">지금 구성대로 섞어서</option>
                      {TYPE_ORDER.map((type) => (
                        <option key={type} value={type}>{QUESTION_TYPE_LABEL[type]}만</option>
                      ))}
                    </select>
                    <div className="flex rounded-lg bg-slate-100 p-0.5">
                      {[1, 2, 3, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMoreCount(n)}
                          disabled={ai.addingMore}
                          className={`h-8 min-w-[2.25rem] rounded-md px-2 text-sm font-black transition ${
                            moreCount === n ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void ai.addMore(moreCount, moreType)}
                      disabled={ai.addingMore}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 text-sm font-black text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                    >
                      {ai.addingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {ai.addingMore ? '만드는 중' : `${moreCount}문제 더`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 아래 고정 저장 바 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur-sm lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-black text-slate-900">{setName.trim() || '이름 없는 문제집'}</p>
            <p className={`truncate text-xs font-bold ${statusLine.tone}`}>{questions.length}문제 · {statusLine.text}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="h-12 shrink-0 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <span className="sm:hidden">뒤로</span>
            <span className="hidden sm:inline">{backLabel}</span>
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-base font-black text-white shadow-sm transition sm:flex-none sm:min-w-[220px] ${
              issues.errors > 0
                ? 'bg-slate-400 shadow-none hover:bg-slate-500'
                : 'bg-sky-500 shadow-sky-200 hover:bg-sky-600'
            } disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : issues.errors > 0 ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={3} />}
            {isSaving ? '저장하는 중' : issues.errors > 0 ? `${issues.errors}곳 고치고 저장` : `${questions.length}문제 저장하기`}
          </button>
        </div>
      </div>
    </main>
  )
}
