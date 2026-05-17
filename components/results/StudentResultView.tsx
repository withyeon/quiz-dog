'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, RotateCcw, Target, Trophy, X } from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from 'recharts'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import {
  buildResultAnalytics,
  type Player,
  type PlayerAnalysis,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'

type StudentResultViewProps = {
  room: Room
  players: Player[]
  questions: AnalyticsQuestion[]
  playerId: string
}

export default function StudentResultView({
  room,
  players,
  questions,
  playerId,
}: StudentResultViewProps) {
  const analytics = useMemo(
    () => buildResultAnalytics(players, questions, room),
    [players, questions, room],
  )
  const student = analytics.players.find((player) => player.id === playerId) ?? null
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnalysis | null>(null)

  if (!student) {
    return (
      <div className="min-h-screen bg-[#f7fbff] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">내 결과를 찾을 수 없어요</h1>
          <p className="mt-2 text-slate-500">학생 결과 화면은 개인 식별용 playerId가 필요합니다.</p>
        </div>
      </div>
    )
  }

  const wrongQuestions = analytics.questions.filter((question) => {
    const answer = answerForQuestion(student, question.index)
    return !answer?.isCorrect
  })
  const correctCount = student.correctCount
  const wrongCount = Math.max(0, student.totalCount - correctCount)
  const chartData = [
    { name: '정답', value: correctCount },
    { name: '복습', value: wrongCount },
  ]
  const isTopThree = student.rankByScore <= 3

  return (
    <main className="min-h-screen bg-[#f7fbff] px-4 py-6 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className={`overflow-hidden rounded-lg border p-6 shadow-sm ${
          isTopThree
            ? 'border-amber-200 bg-amber-50'
            : 'border-sky-200 bg-white'
        }`}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-500">내 최종 결과</p>
              <h1 className="mt-2 text-5xl font-black tracking-normal text-slate-950">
                {student.rankByScore}등 · {student.score.toLocaleString()}점
              </h1>
              <p className="mt-3 text-lg font-bold text-slate-600">
                {student.totalCount}문제 중 {student.correctCount}개 정답
              </p>
            </div>
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white text-6xl shadow-sm">
              {student.avatar || '🐶'}
            </div>
          </div>
          <p className="mt-5 rounded-md bg-white/80 px-4 py-3 text-base font-bold text-slate-700">
            {isTopThree ? '멋진 집중력이었어요. 오늘 배운 것도 한 번 더 확인해볼까요?' : '좋아요. 틀린 문제만 차근차근 다시 보면 다음 게임은 훨씬 가벼워질 거예요.'}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    <Cell fill="#22c55e" />
                    <Cell fill="#f97316" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black">{student.accuracy}%</div>
              <div className="text-sm font-bold text-slate-500">정답률</div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                맞춘 문제
              </div>
              <div className="mt-2 text-3xl font-black">{correctCount}개</div>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-orange-700">
                <RotateCcw className="h-4 w-4" />
                복습할 문제
              </div>
              <div className="mt-2 text-3xl font-black">{wrongQuestions.length}개</div>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-sky-700">
                <Trophy className="h-4 w-4" />
                점수 순위
              </div>
              <div className="mt-2 text-3xl font-black">{student.rankByScore}등</div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-slate-500" />
            <h2 className="text-xl font-black">복습할 문제</h2>
          </div>

          {wrongQuestions.length === 0 ? (
            <div className="rounded-md bg-emerald-50 p-5 text-center font-bold text-emerald-800">
              틀린 문제가 없어요. 오늘 감각 그대로 다음 게임도 가봅시다.
            </div>
          ) : (
            <div className="space-y-2">
              {wrongQuestions.map((question) => {
                const answer = answerForQuestion(student, question.index)
                return (
                  <button
                    key={question.id}
                    onClick={() => setSelectedQuestion(question)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
                  >
                    <div className="text-sm font-black text-slate-400">Q{question.index + 1}</div>
                    <div className="mt-1 font-bold text-slate-900">{question.text}</div>
                    <div className="mt-2 text-sm text-slate-500">내 답: {answer?.selectedAnswer || '미응답'}</div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {selectedQuestion && (
        <ReviewModal
          question={selectedQuestion}
          student={student}
          onClose={() => setSelectedQuestion(null)}
        />
      )}
    </main>
  )
}

function answerForQuestion(student: PlayerAnalysis, questionIndex: number) {
  return student.history.find((answer) => answer.questionIndex === questionIndex)
}

function ReviewModal({
  question,
  student,
  onClose,
}: {
  question: QuestionAnalysis
  student: PlayerAnalysis
  onClose: () => void
}) {
  const answer = answerForQuestion(student, question.index)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-xl font-black">Q{question.index + 1}. 다시 보기</h3>
            <p className="mt-1 text-sm text-slate-500">정답과 내 답을 확인해요.</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-lg font-bold leading-relaxed">{question.text}</p>
          {question.options.length > 0 && (
            <div className="grid gap-2">
              {question.options.map((option, index) => (
                <div key={`${option}-${index}`} className="rounded-md border border-slate-200 p-3">
                  <span className="font-black">{index + 1}.</span> {option}
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-orange-50 p-4">
              <div className="text-sm font-black text-orange-700">내 답</div>
              <div className="mt-1 text-lg font-black">{answer?.selectedAnswer || '미응답'}</div>
            </div>
            <div className="rounded-md bg-emerald-50 p-4">
              <div className="text-sm font-black text-emerald-700">정답</div>
              <div className="mt-1 text-lg font-black">{question.answer}</div>
            </div>
          </div>
          <div className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-600">
            해설은 v1 데이터에 별도 저장값이 없어서 정답 중심으로 표시합니다.
          </div>
        </div>
      </div>
    </div>
  )
}
