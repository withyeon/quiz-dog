'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, CheckCircle2, KeyRound, RotateCcw, Target, Trophy, X } from 'lucide-react'
import { isHomeworkPastDue } from '@/lib/game/roomStatus'
import {
  canStartNewAttempt,
  countFinishedAttempts,
  getBestAttempt,
  parseStudyAttempts,
  parseStudySettings,
} from '@/lib/game/studySettings'
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
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { getScoreDisplay } from '@/lib/game/scoreDisplay'

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
  const studentScoreDisplay = student ? getScoreDisplay({ score: student.score }, room.game_mode) : null
  // 공부 모드: 시도 기록과 "처음부터 다시 풀기" (과제이고 마감 전이고 횟수가 남았을 때)
  const studyInfo = useMemo(() => {
    if (room.game_mode !== 'study') return null
    const raw = players.find((player) => player.id === playerId)
    const attempts = parseStudyAttempts(raw?.attempts)
    const settings = parseStudySettings(room.settings)
    const best = getBestAttempt(attempts)
    const canRetry = Boolean(room.is_homework)
      && room.status === 'playing'
      && !isHomeworkPastDue(room)
      && canStartNewAttempt(attempts, settings)
    return { attempts, best, finished: countFinishedAttempts(attempts), canRetry }
  }, [playerId, players, room])

  if (!student) {
    return (
      <div className="min-h-dvh bg-[#f7fbff] px-4 py-10">
        <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">내 결과를 찾을 수 없어요</h1>
          <p className="mt-2 text-slate-500">학생 결과 화면은 개인 식별용 playerId가 필요합니다.</p>
          <div className="mt-5 flex justify-center">
            <LobbyLink />
          </div>
        </div>
      </div>
    )
  }

  // 복습 목록 = "한 번이라도 틀린 문제". 아직 나오지 않은 문제는 틀린 게 아니므로 넣지 않는다.
  const wrongQuestions = analytics.questions.filter((question) =>
    attemptsForQuestion(student, question.index).some((attempt) => !attempt.isCorrect))
  const correctCount = student.correctCount
  const wrongCount = Math.max(0, student.answeredCount - correctCount)
  const chartData = [
    { name: '정답', value: correctCount },
    { name: '복습', value: wrongCount },
  ]
  const isTopThree = student.rankByScore <= 3

  return (
    <main className="min-h-dvh bg-[#f7fbff] px-4 py-6 font-bitbit text-slate-900 sm:px-6">
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
                {student.rankByScore}등 · {studentScoreDisplay?.text}
              </h1>
              <p className="mt-3 text-lg font-bold text-slate-600">
                {student.answeredCount}번 풀어서 {student.correctCount}번 정답
              </p>
            </div>
            <PlayerAvatarDisplay
              avatar={student.avatar}
              nickname={student.nickname}
              fallback="🐶"
              className="relative h-28 w-28 overflow-hidden rounded-full bg-white text-6xl shadow-sm"
              sizes="112px"
            />
          </div>
          <p className="mt-5 rounded-md bg-white/80 px-4 py-3 text-base font-bold text-slate-700">
            {isTopThree ? '멋진 집중력이었어요. 오늘 배운 것도 한 번 더 확인해볼까요?' : '좋아요. 틀린 문제를 다시 한 번 확인해 봅시다.'}
          </p>
        </section>

        {studyInfo && (
          <section className="rounded-lg border border-sky-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-black text-sky-700">
                  <BookOpen className="h-4 w-4" />
                  공부 기록
                </div>
                <p className="mt-2 text-lg font-bold text-slate-800">
                  {studyInfo.finished > 0 ? `${studyInfo.finished}번 풀었어요` : '아직 끝까지 푼 기록이 없어요'}
                  {studyInfo.best && ` · 최고 ${studyInfo.best.correct}/${studyInfo.best.total}`}
                  {studyInfo.best?.mastered && ' · 틀린 문제까지 모두 맞혔어요'}
                </p>
              </div>
              {studyInfo.canRetry && (
                <Link
                  href={`/study?room=${room.room_code}&playerId=${playerId}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-3 font-black text-white shadow-sm transition hover:bg-sky-600"
                >
                  <RotateCcw className="h-4 w-4" />
                  처음부터 다시 풀기
                </Link>
              )}
            </div>
          </section>
        )}

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
                맞춘 횟수
              </div>
              <div className="mt-2 text-3xl font-black">{correctCount}번</div>
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
                const answer = reviewAnswerForQuestion(student, question.index)
                const attempts = attemptsForQuestion(student, question.index)
                const correct = attempts.filter((attempt) => attempt.isCorrect).length
                return (
                  <button
                    key={question.id}
                    onClick={() => setSelectedQuestion(question)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:bg-slate-100"
                  >
                    <div className="text-sm font-black text-slate-400">Q{question.index + 1}</div>
                    {question.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={question.imageUrl} alt="" className="mt-2 max-h-24 w-auto rounded-md border border-slate-200 object-contain" />
                    )}
                    <div className="mt-1 font-bold text-slate-900">{question.text}</div>
                    <div className="mt-2 text-sm text-slate-500">
                      내 답: {answer?.selectedAnswer || '시간 초과'}
                      {attempts.length > 1 && <span className="ml-2">· {attempts.length}번 중 {correct}번 맞혔어요</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <p className="text-lg font-black text-slate-900">다음 게임 준비됐나요?</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                선생님이 새 코드를 알려주면 여기서 바로 입력할 수 있어요.
              </p>
            </div>
            <LobbyLink />
          </div>
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

/** 한 문항을 푼 모든 시도. 제한 시간 동안 문제가 반복되는 게임에서는 2회 이상일 수 있다. */
function attemptsForQuestion(student: PlayerAnalysis, questionIndex: number) {
  return student.history.filter((answer) => answer.questionIndex === questionIndex)
}

/** 복습 화면에서 보여줄 답 — 틀린 시도가 있으면 마지막으로 틀린 답을 보여준다. */
function reviewAnswerForQuestion(student: PlayerAnalysis, questionIndex: number) {
  const attempts = attemptsForQuestion(student, questionIndex)
  const wrong = attempts.filter((attempt) => !attempt.isCorrect)
  return wrong[wrong.length - 1] ?? attempts[attempts.length - 1]
}

/** 로비(코드 입력 화면)로 가는 버튼. 선생님이 다른 문제집으로 새 방을 열었을 때 쓴다. */
function LobbyLink() {
  return (
    <Link
      href="/lobby"
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 font-black text-white shadow-sm transition hover:bg-slate-700"
    >
      <KeyRound className="h-4 w-4" />
      새 게임 코드 입력하기
    </Link>
  )
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
  const answer = reviewAnswerForQuestion(student, question.index)

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
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="문제 그림" className="max-h-56 w-auto max-w-full rounded-lg border border-slate-200 object-contain" />
          )}
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
          {question.explanation ? (
            <div className="rounded-md bg-sky-50 p-4">
              <div className="text-sm font-black text-sky-700">해설</div>
              <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">{question.explanation}</p>
            </div>
          ) : (
            <div className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-600">
              이 문제에는 해설이 없어요. 정답을 다시 한 번 확인해 보세요.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
