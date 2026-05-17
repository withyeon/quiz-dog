'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  FileSpreadsheet,
  HelpCircle,
  Printer,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import { getGameModeConfig } from '@/lib/game/modes'
import {
  buildResultAnalytics,
  formatResponseTime,
  type Player,
  type PlayerAnalysis,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'

type SortKey = 'score' | 'accuracy' | 'name' | 'attendance' | 'time'
type MatrixSortKey = 'accuracy' | 'score' | 'attendance'
type DiagnosticTab = 'students' | 'questions' | 'accuracy'

type TeacherPostGameReportProps = {
  room: Room
  players: Player[]
  questions: AnalyticsQuestion[]
  className?: string
}

function accuracyColor(accuracy: number) {
  if (accuracy < 60) return '#ef4444'
  if (accuracy < 80) return '#f59e0b'
  return '#22c55e'
}

function badgeForStudent(player: PlayerAnalysis) {
  const unansweredRatio = player.totalCount > 0
    ? (player.totalCount - player.answeredCount) / player.totalCount
    : 0
  if (unansweredRatio >= 0.3) return '미응답 多'
  if (player.accuracy < 40) return '최하위'
  if (player.accuracy < 60) return '개념 부족'
  return '점검 필요'
}

function answerForQuestion(player: PlayerAnalysis, questionIndex: number) {
  return player.history.find((answer) => answer.questionIndex === questionIndex)
}

export default function TeacherPostGameReport({
  room,
  players,
  questions,
  className = '',
}: TeacherPostGameReportProps) {
  const analytics = useMemo(
    () => buildResultAnalytics(players, questions, room),
    [players, questions, room],
  )
  const [questionView, setQuestionView] = useState<'graph' | 'matrix'>('graph')
  const [matrixSort, setMatrixSort] = useState<MatrixSortKey>('accuracy')
  const [studentSort, setStudentSort] = useState<SortKey>('score')
  const [studentQuery, setStudentQuery] = useState('')
  const [diagnosticTab, setDiagnosticTab] = useState<DiagnosticTab>('students')
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionAnalysis | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<PlayerAnalysis | null>(null)
  const [copied, setCopied] = useState(false)

  const mode = getGameModeConfig(room.game_mode)
  const playedAt = room.started_at ?? room.updated_at ?? room.created_at
  const matrixEnabled = analytics.questions.length <= 30

  const graphData = analytics.hardestQuestions.map((question) => ({
    ...question,
    label: `Q${question.index + 1}`,
  }))

  const matrixPlayers = useMemo(() => {
    const sorted = [...analytics.players]
    if (matrixSort === 'accuracy') return sorted.sort((a, b) => a.accuracy - b.accuracy || b.score - a.score)
    if (matrixSort === 'attendance') return sorted.sort((a, b) => a.attendanceNo - b.attendanceNo)
    return sorted.sort((a, b) => b.score - a.score)
  }, [analytics.players, matrixSort])

  const tablePlayers = useMemo(() => {
    const query = studentQuery.trim().toLowerCase()
    const filtered = analytics.players.filter((player) => player.nickname.toLowerCase().includes(query))
    return filtered.sort((a, b) => {
      if (studentSort === 'accuracy') return b.accuracy - a.accuracy || b.score - a.score
      if (studentSort === 'name') return a.nickname.localeCompare(b.nickname, 'ko-KR')
      if (studentSort === 'attendance') return a.attendanceNo - b.attendanceNo
      if (studentSort === 'time') return (a.avgResponseTimeMs ?? Number.MAX_SAFE_INTEGER) - (b.avgResponseTimeMs ?? Number.MAX_SAFE_INTEGER)
      return b.score - a.score
    })
  }, [analytics.players, studentQuery, studentSort])

  const copyJournal = async () => {
    try {
      await navigator.clipboard.writeText(analytics.journalSummary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const downloadCsv = () => {
    const rows = [
      ['출석번호', '학생명', '정답률', '점수', '평균응답시간', ...analytics.questions.map((question) => `Q${question.index + 1}`)],
      ...analytics.players.map((player) => [
        String(player.attendanceNo),
        player.nickname,
        `${player.accuracy}%`,
        String(player.score),
        formatResponseTime(player.avgResponseTimeMs),
        ...analytics.questions.map((question) => {
          const answer = answerForQuestion(player, question.index)
          if (!answer) return '미응답'
          return answer.isCorrect ? '정답' : `오답:${answer.selectedAnswer || '미응답'}`
        }),
      ]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `quizdog-report-${room.room_code}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={`space-y-6 text-slate-900 ${className}`}>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <span>{new Date(playedAt).toLocaleDateString('ko-KR')}</span>
            <span>방 코드 {room.room_code}</span>
            <span>{mode.shortLabel}</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-slate-950">게임 결과 사후 분석 리포트</h1>
          <p className="mt-1 text-sm text-slate-500">점수 순위와 학습 정답률을 분리해서 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadCsv} className="bg-slate-900 hover:bg-slate-800">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            엑셀 다운로드
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            인쇄
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '참여 학생', value: `${analytics.totalParticipants}명`, icon: Users },
          { label: '평균 정답률', value: `${analytics.averageAccuracy}%`, icon: CheckCircle2 },
          { label: '평균 점수', value: analytics.averageScore.toLocaleString(), icon: Trophy },
          { label: '완주율', value: `${analytics.completionRate}%`, icon: BarChart3 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">{item.label}</span>
              <item.icon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-950">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-bold text-emerald-950">{analytics.journalSummary}</p>
        <Button variant="outline" onClick={copyJournal} className="border-emerald-300 bg-white">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          {copied ? '복사됨' : '복사'}
        </Button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">문항별 분석</h2>
            {!matrixEnabled && (
              <p className="mt-1 text-sm text-slate-500">문항이 많을 때는 그래프 뷰를 이용해주세요.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={questionView === 'graph' ? 'default' : 'outline'}
              onClick={() => setQuestionView('graph')}
              className={questionView === 'graph' ? 'bg-slate-900 hover:bg-slate-800' : ''}
            >
              그래프 뷰
            </Button>
            <Button
              size="sm"
              variant={questionView === 'matrix' ? 'default' : 'outline'}
              onClick={() => matrixEnabled && setQuestionView('matrix')}
              disabled={!matrixEnabled}
              className={questionView === 'matrix' ? 'bg-slate-900 hover:bg-slate-800' : ''}
            >
              매트릭스 뷰
            </Button>
          </div>
        </div>

        {questionView === 'graph' ? (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graphData} layout="vertical" margin={{ top: 10, right: 30, left: 12, bottom: 10 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="label" width={48} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const question = payload[0].payload as QuestionAnalysis & { label: string }
                    return (
                      <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                        <p className="font-black">Q{question.index + 1}. {question.text}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          정답률 {question.accuracy}% · {question.correctCount}/{question.totalCount}명
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="accuracy"
                  radius={[0, 6, 6, 0]}
                  onClick={(data) => setSelectedQuestion((data as unknown as { payload: QuestionAnalysis }).payload)}
                >
                  {graphData.map((entry) => (
                    <Cell key={entry.id} fill={accuracyColor(entry.accuracy)} className="cursor-pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="space-y-3 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-500">행 정렬</span>
              {[
                ['accuracy', '정답률 낮은 순'],
                ['score', '점수 높은 순'],
                ['attendance', '출석번호 순'],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={matrixSort === key ? 'default' : 'outline'}
                  onClick={() => setMatrixSort(key as MatrixSortKey)}
                  className={matrixSort === key ? 'bg-slate-900 hover:bg-slate-800' : ''}
                >
                  {label}
                </Button>
              ))}
            </div>
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left">학생</th>
                  {analytics.questions.map((question) => (
                    <th
                      key={question.id}
                      onClick={() => setSelectedQuestion(question)}
                      className="cursor-pointer border border-slate-200 px-2 py-2 text-center"
                    >
                      Q{question.index + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">정답률</th>
                  <th className="px-3 py-2 text-right">점수</th>
                </tr>
              </thead>
              <tbody>
                {matrixPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-50">
                    <td
                      onClick={() => setSelectedStudent(player)}
                      className="sticky left-0 cursor-pointer bg-white px-3 py-2 font-bold"
                    >
                      {player.nickname}
                    </td>
                    {analytics.questions.map((question) => {
                      const answer = answerForQuestion(player, question.index)
                      const label = answer?.isCorrect ? 'O' : answer ? normalizeCellAnswer(answer.selectedAnswer) : '-'
                      return (
                        <td
                          key={`${player.id}-${question.id}`}
                          className={`h-9 min-w-9 border border-slate-200 text-center font-black ${
                            answer?.isCorrect
                              ? 'bg-emerald-100 text-emerald-700'
                              : answer
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {label}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right font-bold">{player.accuracy}%</td>
                    <td className="px-3 py-2 text-right font-bold">{player.score.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 bg-slate-50 px-3 py-2 font-black">문항 정답률</td>
                  {analytics.questions.map((question) => (
                    <td
                      key={question.id}
                      className={`border border-slate-200 px-2 py-2 text-center font-black ${
                        question.accuracy < 60 ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {question.accuracy}%
                    </td>
                  ))}
                  <td />
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-xl font-black">학생별 분석</h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={studentQuery}
                onChange={(event) => setStudentQuery(event.target.value)}
                placeholder="학생 검색"
                className="w-36 outline-none"
              />
            </label>
            <select
              value={studentSort}
              onChange={(event) => setStudentSort(event.target.value as SortKey)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
            >
              <option value="score">점수 높은 순</option>
              <option value="accuracy">정답률 높은 순</option>
              <option value="attendance">출석번호 순</option>
              <option value="name">이름순</option>
              <option value="time">응답시간 빠른 순</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">출석번호</th>
                <th className="px-3 py-3 text-left">학생명</th>
                <th className="px-3 py-3 text-right">정답률</th>
                <th className="px-3 py-3 text-right">점수</th>
                <th className="px-3 py-3 text-right">평균 응답시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tablePlayers.map((player) => (
                <tr key={player.id} onClick={() => setSelectedStudent(player)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-3 py-3">{player.attendanceNo}</td>
                  <td className="px-3 py-3 font-bold">{player.nickname}</td>
                  <td className="px-3 py-3 text-right font-black">{player.accuracy}%</td>
                  <td className="px-3 py-3 text-right font-bold">{player.score.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right">{formatResponseTime(player.avgResponseTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ['students', '도움이 필요한 학생 Top 5'],
            ['questions', '다시 가르쳐야 할 문제 Top 5'],
            ['accuracy', '정답률 Top 3'],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={diagnosticTab === key ? 'default' : 'outline'}
              onClick={() => setDiagnosticTab(key as DiagnosticTab)}
              className={diagnosticTab === key ? 'bg-slate-900 hover:bg-slate-800' : ''}
            >
              {label}
            </Button>
          ))}
        </div>

        {diagnosticTab === 'students' && (
          <div className="grid gap-3 lg:grid-cols-5">
            {[...analytics.players].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5).map((player) => (
              <button key={player.id} onClick={() => setSelectedStudent(player)} className="rounded-lg border border-red-100 bg-red-50 p-4 text-left">
                <div className="text-sm font-bold text-red-600">{badgeForStudent(player)}</div>
                <div className="mt-2 text-lg font-black">{player.nickname}</div>
                <div className="mt-2 text-sm text-slate-600">정답률 {player.accuracy}% · {player.score.toLocaleString()}점</div>
              </button>
            ))}
          </div>
        )}

        {diagnosticTab === 'questions' && (
          <div className="grid gap-3 lg:grid-cols-5">
            {analytics.hardestQuestions.slice(0, 5).map((question) => (
              <button key={question.id} onClick={() => setSelectedQuestion(question)} className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-left">
                <div className="text-sm font-bold text-amber-700">Q{question.index + 1} · {question.accuracy}%</div>
                <div className="mt-2 line-clamp-3 text-sm font-bold">{question.text}</div>
                <div className="mt-2 text-xs text-slate-600">
                  최다 오답 {question.topWrongAnswer ? `${question.topWrongAnswer[0]} (${question.topWrongAnswer[1]}명)` : '-'}
                </div>
              </button>
            ))}
          </div>
        )}

        {diagnosticTab === 'accuracy' && (
          <div className="grid gap-3 lg:grid-cols-3">
            {analytics.playersByAccuracy.slice(0, 3).map((player, index) => (
              <button key={player.id} onClick={() => setSelectedStudent(player)} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-left">
                <div className="text-sm font-bold text-emerald-700">정답률 {index + 1}위</div>
                <div className="mt-2 text-xl font-black">{player.nickname}</div>
                <div className="mt-2 text-sm text-slate-600">정답률 {player.accuracy}% · {player.score.toLocaleString()}점</div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedQuestion && (
        <QuestionDetailModal question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />
      )}

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          questions={analytics.questions}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

function normalizeCellAnswer(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'
  return String(value).slice(0, 2)
}

function QuestionDetailModal({
  question,
  onClose,
}: {
  question: QuestionAnalysis
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-xl font-black">Q{question.index + 1}. 문항 상세</h3>
            <p className="mt-1 text-sm text-slate-500">정답률 {question.accuracy}% · 정답 {question.answer}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 p-5">
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
          <div>
            <h4 className="mb-2 font-black">오답 분포</h4>
            <div className="space-y-2">
              {Object.entries(question.optionDistribution).filter(([, count]) => count > 0).map(([answer, count]) => (
                <div key={answer} className="rounded-md bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{answer}</span>
                    <span className="font-black">{count}명</span>
                  </div>
                  {question.wrongStudentsByAnswer[answer]?.length > 0 && (
                    <p className="mt-1 text-sm text-slate-500">{question.wrongStudentsByAnswer[answer].join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StudentDetailModal({
  student,
  questions,
  onClose,
}: {
  student: PlayerAnalysis
  questions: QuestionAnalysis[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-xl font-black">{student.nickname} 학생 답안 상세</h3>
            <p className="mt-1 text-sm text-slate-500">정답률 {student.accuracy}% · 점수 {student.score.toLocaleString()} · 평균 응답시간 {formatResponseTime(student.avgResponseTimeMs)}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {questions.map((question) => {
            const answer = answerForQuestion(student, question.index)
            return (
              <div key={question.id} className="p-4">
                <div className="flex items-start gap-3">
                  {answer?.isCorrect ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
                  ) : answer ? (
                    <AlertTriangle className="mt-1 h-5 w-5 text-red-500" />
                  ) : (
                    <HelpCircle className="mt-1 h-5 w-5 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black">Q{question.index + 1}. {question.text}</p>
                    <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                      <span>학생 답: <strong>{answer ? (answer.selectedAnswer || '미응답') : '미응답'}</strong></span>
                      <span>정답: <strong>{question.answer}</strong></span>
                      <span>응답시간: <strong>{formatResponseTime(answer?.responseTimeMs ?? answer?.response_time_ms ?? null)}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
