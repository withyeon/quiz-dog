'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X, Eye, EyeOff, Check, ImageIcon } from 'lucide-react'
import type { Database } from '@/types/database.types'
import { getQuestionSetWithQuestions } from '@/lib/services/questionSets'
import { normalizeQuestionOptions } from '@/lib/services/questions'
import { displayBlankText } from '@/lib/quiz/blankText'
import { formatServiceError } from '@/lib/services/errors'

type QuestionRow = Database['public']['Tables']['questions']['Row']

const TYPE_LABEL: Record<QuestionRow['type'], string> = { CHOICE: '객관식', OX: 'OX', SHORT: '주관식', BLANK: '빈칸' }
const TYPE_TONE: Record<QuestionRow['type'], string> = {
  CHOICE: 'bg-sky-100 text-sky-700',
  OX: 'bg-amber-100 text-amber-700',
  SHORT: 'bg-emerald-100 text-emerald-700',
  BLANK: 'bg-violet-100 text-violet-700',
}
const PAGE_SIZE = 20

// 한 번 연 문제집은 캐시를 먼저 보여 주고(자료실에서 여러 개 훑어볼 때 빠르게) 뒤에서 다시 읽어 바꿔 끼운다.
// 전에는 다시 읽지 않아서, 미리보기 → 수정 → 미리보기를 하면 옛 문제가 그대로 보였다 (2026-10-18).
const cache = new Map<string, QuestionRow[]>()

interface QuestionSetPreviewModalProps {
  setId: string
  title: string
  onClose: () => void
  /** 모달 아래 줄에 둘 버튼들(자료실: 담기·게임 시작 / 내 문제집: 게임 시작·수정) */
  actions?: ReactNode
}

function normalizeForCompare(value: string): string {
  return value.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
}

/**
 * 문제집 안의 문제를 읽기 전용으로 보여 주는 모달. 자료실·내 문제집·게임 시작 화면이 같이 쓴다.
 * questions 는 누구나 읽을 수 있어서(RLS USING true) 자료실 문제집도 담기 전에 볼 수 있다.
 */
export default function QuestionSetPreviewModal({ setId, title, onClose, actions }: QuestionSetPreviewModalProps) {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(cache.get(setId) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [showAnswers, setShowAnswers] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    let cancelled = false
    const cached = cache.get(setId) ?? null
    setQuestions(cached)
    setError(null)
    getQuestionSetWithQuestions(setId)
      .then(({ questions: rows }) => {
        if (cancelled) return
        cache.set(setId, rows)
        setQuestions(rows)
      })
      .catch((err) => { if (!cancelled) setError(formatServiceError(err)) })
    return () => { cancelled = true }
  }, [setId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<QuestionRow['type'], number>> = {}
    for (const q of questions ?? []) counts[q.type] = (counts[q.type] ?? 0) + 1
    return (Object.keys(TYPE_LABEL) as QuestionRow['type'][])
      .filter((type) => counts[type])
      .map((type) => `${TYPE_LABEL[type]} ${counts[type]}`)
      .join(' · ')
  }, [questions])

  const visible = questions?.slice(0, visibleCount) ?? []

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 문제 미리보기`}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-500">문제 미리보기</p>
            <h2 className="mt-0.5 truncate text-lg font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {questions ? `${questions.length}문제${typeCounts ? ` · ${typeCounts}` : ''}` : '불러오는 중'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAnswers((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition ${
                showAnswers ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {showAnswers ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              정답 {showAnswers ? '보임' : '숨김'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">문제를 불러오지 못했어요: {error}</p>
          )}
          {!error && questions === null && (
            <ul className="space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </ul>
          )}
          {questions && questions.length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-slate-500">아직 문제가 없어요.</p>
          )}
          {questions && questions.length > 0 && (
            <ol className="space-y-3">
              {visible.map((q, index) => {
                const options = normalizeQuestionOptions(q.options)
                const answerKey = normalizeForCompare(q.answer)
                return (
                  <li key={q.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 w-6 shrink-0 text-right text-sm font-black tabular-nums text-slate-400">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-black ${TYPE_TONE[q.type]}`}>{TYPE_LABEL[q.type]}</span>
                          {q.image_url && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><ImageIcon className="h-3 w-3" />그림</span>
                          )}
                        </div>
                        <p className="mt-1.5 whitespace-pre-line break-keep text-[15px] font-semibold leading-6 text-slate-900">
                          {displayBlankText(q.question_text)}
                        </p>
                        {q.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={q.image_url} alt="" className="mt-2 max-h-40 rounded-lg border border-slate-200 object-contain" />
                        )}
                        {q.type === 'CHOICE' && options.length > 0 && (
                          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                            {options.map((option, i) => {
                              const isAnswer = showAnswers && normalizeForCompare(option) === answerKey
                              return (
                                <li
                                  key={`${q.id}-${i}`}
                                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ${
                                    isAnswer ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'
                                  }`}
                                >
                                  {isAnswer ? <Check className="h-4 w-4 shrink-0" /> : <span className="w-4 shrink-0 text-center text-xs text-slate-400">{i + 1}</span>}
                                  <span className="break-keep">{option}</span>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {q.type !== 'CHOICE' && showAnswers && (
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800">
                            <Check className="h-4 w-4" />
                            {q.type === 'OX' ? q.answer.toUpperCase() : q.answer.split('|').join(' / ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          {questions && questions.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              {Math.min(PAGE_SIZE, questions.length - visibleCount)}문제 더 보기 ({visibleCount}/{questions.length})
            </button>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
