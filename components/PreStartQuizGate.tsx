'use client'

import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import QuizView from '@/components/QuizView'
import type { Question } from '@/hooks/useGameBase'

type QuizVariant = 'default' | 'goldQuest' | 'battle' | 'fishing' | 'glass'

interface PreStartQuizGateProps {
  question: Question | null
  submittedCount: number
  total: number
  onAnswer: (answer: string) => void | boolean | Promise<void | boolean>
  questionsLoading?: boolean
  questionsError?: string | null
  variant?: QuizVariant
  title?: string
}

export default function PreStartQuizGate({
  question,
  submittedCount,
  total,
  onAnswer,
  questionsLoading = false,
  questionsError = null,
  title = '시작 전 퀴즈',
}: PreStartQuizGateProps) {
  const progress = Math.min(submittedCount, total)
  const progressLabel = `${progress}/${total}`

  // 배경 흐림(backdrop-blur)은 뺐다. 뒤를 82% 어둡게 덮고 있어 시각적 차이는 거의 없는데,
  // 전체 화면 backdrop-filter는 합성 비용이 커서 저사양 태블릿에서 이 화면만 15fps까지 떨어졌다.
  return (
    <div className="fixed inset-0 z-[80] flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-950/[0.82] p-4">
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.98 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-4 rounded-lg border border-white/15 bg-white/95 px-5 py-4 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-slate-500">게임 시작 조건</div>
              <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
              <div className="text-xs font-black text-slate-500">제출</div>
              <div className="text-2xl font-black tabular-nums text-slate-950">{progressLabel}</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Array.from({ length: total }).map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full ${index < progress ? 'bg-emerald-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        {question ? (
          <QuizView
            key={`${question.id}-${progress}`}
            question={question}
            onAnswer={onAnswer}
            timeLimit={30}
            variant="glass"
            className="lg-panel lg-ink-outline font-bitbit p-6 sm:p-8"
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-2xl">
            {questionsLoading ? (
              <>
                <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-slate-500" />
                <h2 className="text-2xl font-black text-slate-900">문제를 불러오는 중...</h2>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-black text-slate-900">시작 전 퀴즈를 열 수 없어요</h2>
                <p className="mt-3 text-sm font-bold text-rose-600">
                  {questionsError || '문제집에 표시할 문제가 없습니다.'}
                </p>
              </>
            )}
          </div>
        )}
      </motion.section>
    </div>
  )
}
