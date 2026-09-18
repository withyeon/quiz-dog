'use client'

import { useMemo, useState } from 'react'
import { toast } from '@/components/ui/Toaster'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  FileSpreadsheet,
  HelpCircle,
  Printer,
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
  formatQuestionAccuracy,
  formatResponseTime,
  type Player,
  type PlayerAnalysis,
  type QuestionAnalysis,
  type Room,
} from './resultAnalytics'
import PixelIcon from '@/components/ui/PixelIcon'

type SortKey = 'score' | 'accuracy' | 'name' | 'time'
type MatrixSortKey = 'accuracy' | 'score'
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

// 학생을 등급으로 판정하는 말('최하위', '개념 부족' 등)은 교사 화면에서도 절대 쓰지 않는다.
// 화면이 학생에게 노출될 수 있고, 교사에게도 '무엇을 하면 되는지'가 더 쓸모 있기 때문.
function badgeForStudent(player: PlayerAnalysis) {
  if (player.answeredCount === 0) return '아직 문제를 안 풀었어요'
  if (player.unservedQuestionCount > 0) return '아직 못 만난 문제가 있어요'
  if (player.accuracy < 40) return '함께 복습이 필요해요'
  if (player.accuracy < 60) return '틀린 문제를 다시 봐요'
  return '한 번 더 확인해요'
}

function answerForQuestion(player: PlayerAnalysis, questionIndex: number) {
  return player.history.find((answer) => answer.questionIndex === questionIndex)
}

/** 한 학생이 한 문항을 푼 모든 시도. 반복 출제 게임에서는 2회 이상일 수 있다. */
function attemptsForQuestion(player: PlayerAnalysis, questionIndex: number) {
  return player.history.filter((answer) => answer.questionIndex === questionIndex)
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
  const [downloading, setDownloading] = useState(false)
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
    return sorted.sort((a, b) => b.score - a.score)
  }, [analytics.players, matrixSort])

  const tablePlayers = useMemo(() => {
    const query = studentQuery.trim().toLowerCase()
    const filtered = analytics.players.filter((player) => player.nickname.toLowerCase().includes(query))
    return filtered.sort((a, b) => {
      if (studentSort === 'accuracy') return b.accuracy - a.accuracy || b.score - a.score
      if (studentSort === 'name') return a.nickname.localeCompare(b.nickname, 'ko-KR')
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

  const downloadXlsx = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      // 엑셀 작성기는 클릭했을 때만 받아온다 — 선생님 화면 첫 로딩에 얹지 않으려고.
      const { buildXlsx, saveBlob } = await import('@/lib/reports/xlsx')

      const studentSheet = {
        name: '학생별',
        rows: [
          ['학생명', '정답률(%)', '푼 횟수', '맞힌 횟수', '받아본 문항', '점수', '평균응답시간',
            ...analytics.questions.map((question) => `Q${question.index + 1}`)],
          ...analytics.players.map((player) => [
            player.nickname,
            player.accuracy,
            player.answeredCount,
            player.correctCount,
            `${player.servedQuestionCount}/${analytics.totalQuestions}`,
            player.score,
            formatResponseTime(player.avgResponseTimeMs),
            ...analytics.questions.map((question) => {
              const attempts = attemptsForQuestion(player, question.index)
              if (attempts.length === 0) return '미출제'
              const correct = attempts.filter((attempt) => attempt.isCorrect).length
              if (attempts.length === 1) {
                return correct === 1 ? '정답' : `오답:${attempts[0].selectedAnswer || '시간초과'}`
              }
              return `${correct}/${attempts.length}`
            }),
          ]),
        ],
      }

      const questionSheet = {
        name: '문항별',
        rows: [
          ['번호', '문항', '정답', '정답률(%)', '푼 횟수', '맞힘', '틀림', '받아본 학생', '미출제 학생', '가장 많은 오답'],
          ...analytics.questions.map((question) => [
            question.index + 1,
            question.text,
            question.answer,
            question.accuracy ?? '미출제',
            question.attemptCount,
            question.correctCount,
            question.incorrectCount,
            question.servedPlayerCount,
            question.unservedPlayerCount,
            question.topWrongAnswer ? `${question.topWrongAnswer[0]} (${question.topWrongAnswer[1]}회)` : '',
          ]),
        ],
      }

      const blob = await buildXlsx([studentSheet, questionSheet])
      const playedOn = new Date(playedAt).toISOString().slice(0, 10)
      saveBlob(blob, `퀴즈독 리포트 ${playedOn} ${room.room_code}.xlsx`)
    } catch (error) {
      console.error('엑셀 내보내기 실패:', error)
      toast.error('엑셀 파일을 만들지 못했어요.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`space-y-6 font-bitbit text-slate-900 ${className}`}>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <span>{new Date(playedAt).toLocaleDateString('ko-KR')}</span>
            <span>방 코드 {room.room_code}</span>
            <span>{mode.shortLabel}</span>
          </div>
          <h1 className="mt-2 text-3xl font-black text-slate-950">게임 결과 분석 리포트</h1>
          <p className="mt-1 text-sm text-slate-500">점수 순위와 학습 정답률을 분리해서 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadXlsx} disabled={downloading} className="bg-slate-900 hover:bg-slate-800">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {downloading ? '만드는 중' : '엑셀 다운로드'}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            인쇄
          </Button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '참여 학생', value: `${analytics.totalParticipants}명`, hint: null, icon: Users },
          {
            label: '평균 정답률',
            value: `${analytics.averageAccuracy}%`,
            // 문제가 반복해서 나오는 게임에서는 푼 횟수가 문항 수보다 훨씬 많다.
            // 정답률만 보면 "5문제를 다 맞혔다"로 오해하기 쉬워서 분모를 같이 보여준다.
            hint: `${analytics.totalAttempts}번 풀어서 ${analytics.totalCorrectAttempts}번 정답`,
            icon: CheckCircle2,
          },
          { label: '평균 점수', value: analytics.averageScore.toLocaleString(), hint: null, icon: Trophy },
          {
            label: '전체 문항 경험률',
            value: `${analytics.completionRate}%`,
            hint: `${analytics.totalQuestions}문항을 모두 받아본 학생 비율`,
            icon: BarChart3,
          },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">{item.label}</span>
              <item.icon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-3 text-3xl font-black text-slate-950">{item.value}</div>
            {item.hint && <div className="mt-1 text-xs font-bold text-slate-400">{item.hint}</div>}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-base font-bold text-emerald-950">{analytics.journalSummary}</p>
        <Button variant="outline" onClick={copyJournal} className="shrink-0 whitespace-nowrap border-emerald-300 bg-white">
          <ClipboardCopy className="mr-2 h-4 w-4 shrink-0" />
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
                          정답률 {formatQuestionAccuracy(question.accuracy)} · {question.correctCount}/{question.attemptCount}회
                        </p>
                        {question.unservedPlayerCount > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {question.unservedPlayerCount}명에게는 아직 안 나온 문제예요
                          </p>
                        )}
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
                      // 같은 문제를 여러 번 만난 학생은 'O'/'X' 하나로 요약할 수 없다.
                      // 2회 이상이면 '맞힌 횟수/푼 횟수'를 보여준다.
                      const attempts = attemptsForQuestion(player, question.index)
                      const correct = attempts.filter((attempt) => attempt.isCorrect).length
                      const label = attempts.length === 0
                        ? '미출제'
                        : attempts.length === 1
                          ? (correct === 1 ? 'O' : normalizeCellAnswer(attempts[0].selectedAnswer))
                          : `${correct}/${attempts.length}`
                      const tone = attempts.length === 0
                        ? 'bg-slate-100 text-slate-400'
                        : correct === attempts.length
                          ? 'bg-emerald-100 text-emerald-700'
                          : correct === 0
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      return (
                        <td
                          key={`${player.id}-${question.id}`}
                          title={attempts.length > 1 ? `${attempts.length}번 풀어서 ${correct}번 정답` : undefined}
                          className={`h-9 min-w-9 whitespace-nowrap border border-slate-200 px-1 text-center text-xs font-black ${tone}`}
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
                      className={`border border-slate-200 px-2 py-2 text-center text-xs font-black ${
                        question.accuracy === null
                          ? 'text-slate-400'
                          : question.accuracy < 60 ? 'text-red-600' : 'text-slate-700'
                      }`}
                    >
                      {formatQuestionAccuracy(question.accuracy)}
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
              <PixelIcon name="scan" size={20} alt="" className="shrink-0" />
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
              <option value="name">이름순</option>
              <option value="time">응답시간 빠른 순</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left">학생명</th>
                <th className="px-3 py-3 text-right">정답률</th>
                <th className="px-3 py-3 text-right">점수</th>
                <th className="px-3 py-3 text-right">평균 응답시간</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tablePlayers.map((player) => (
                <tr key={player.id} onClick={() => setSelectedStudent(player)} className="cursor-pointer hover:bg-slate-50">
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
              <button key={player.id} onClick={() => setSelectedStudent(player)} className="rounded-lg border border-sky-100 bg-sky-50 p-4 text-left">
                <div className="text-sm font-bold text-sky-700">{badgeForStudent(player)}</div>
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
                  최다 오답 {question.topWrongAnswer ? `${question.topWrongAnswer[0]} (${question.topWrongAnswer[1]}회)` : '-'}
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
            <p className="mt-1 text-sm text-slate-500">
              정답률 {formatQuestionAccuracy(question.accuracy)} · {question.correctCount}/{question.attemptCount}회 · 정답 {question.answer}
            </p>
            {question.unservedPlayerCount > 0 && (
              <p className="mt-1 text-sm text-slate-400">
                {question.unservedPlayerCount}명에게는 아직 안 나온 문제라 정답률에서 뺐어요
              </p>
            )}
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
                    <span className="font-black">{count}회</span>
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
            <p className="mt-1 text-sm text-slate-500">
              정답률 {student.accuracy}% ({student.answeredCount}번 풀어서 {student.correctCount}번 정답) · 점수 {student.score.toLocaleString()} · 평균 응답시간 {formatResponseTime(student.avgResponseTimeMs)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {questions.map((question) => {
            // 같은 문제를 여러 번 만났으면 시도를 전부 보여준다 —
            // 첫 시도만 보여주면 "틀렸다가 맞힌" 학습 과정이 사라진다.
            const attempts = attemptsForQuestion(student, question.index)
            const correct = attempts.filter((attempt) => attempt.isCorrect).length
            return (
              <div key={question.id} className="p-4">
                <div className="flex items-start gap-3">
                  {attempts.length === 0 ? (
                    <HelpCircle className="mt-1 h-5 w-5 text-slate-400" />
                  ) : correct === attempts.length ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className={`mt-1 h-5 w-5 ${correct > 0 ? 'text-amber-500' : 'text-red-500'}`} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black">Q{question.index + 1}. {question.text}</p>
                    {attempts.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">아직 이 문제를 받지 못했어요 (정답률 계산에서 제외)</p>
                    ) : (
                      <>
                        <div className="mt-2 text-sm">
                          정답: <strong>{question.answer}</strong>
                          {attempts.length > 1 && <span className="ml-2 text-slate-500">{attempts.length}번 풀어서 {correct}번 정답</span>}
                        </div>
                        <ul className="mt-2 space-y-1 text-sm">
                          {attempts.map((attempt, attemptIndex) => (
                            <li key={attemptIndex} className="flex flex-wrap items-center gap-2">
                              {attempts.length > 1 && <span className="text-slate-400">{attemptIndex + 1}회차</span>}
                              <span className={attempt.isCorrect ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                                {attempt.isCorrect ? '정답' : '오답'}
                              </span>
                              <span>{attempt.selectedAnswer || '시간 초과'}</span>
                              <span className="text-slate-400">
                                {formatResponseTime(attempt.responseTimeMs ?? attempt.response_time_ms ?? null)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
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
