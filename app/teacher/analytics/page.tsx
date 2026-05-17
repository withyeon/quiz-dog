'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileQuestion,
  HelpCircle,
  ListChecks,
  Play,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { getGameModeConfig, isGameModeId } from '@/lib/game/modes'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import {
  getGameReportById,
  listRecentGameReports,
  parseReportPlayers,
  type GameReportRow,
} from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import {
  buildResultAnalytics,
  formatResponseTime,
  type PlayerAnalysis,
  type QuestionAnalysis,
} from '@/components/results/resultAnalytics'
import type { Database } from '@/types/database.types'

type ReportRoom = Database['public']['Tables']['rooms']['Row']

const LEGACY_REPORT_MODE_CONFIG: Record<string, { label: string; emoji: string }> = {
  racing: { label: '미션: 등교 임파서블', emoji: '🏃' },
  pool: { label: '포켓볼 게임', emoji: '🎱' },
  allin: { label: '올인 퀴즈', emoji: '💎' },
}

function getReportModeConfig(mode: string | null | undefined) {
  if (!mode) {
    return { label: '알 수 없음', emoji: '🎮' }
  }

  if (isGameModeId(mode)) {
    return getGameModeConfig(mode)
  }

  return LEGACY_REPORT_MODE_CONFIG[mode] ?? { label: mode, emoji: '🎮' }
}

function AnalyticsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedReportId = searchParams?.get('report')

  const [reports, setReports] = useState<GameReportRow[]>([])
  const [selectedReport, setSelectedReport] = useState<GameReportRow | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<AnalyticsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadReports = async () => {
      setLoading(true)
      setErrorMessage(null)
      setSelectedReport(null)
      setSelectedQuestions([])

      try {
        const [recentReports, detailReport] = await Promise.all([
          listRecentGameReports(50),
          selectedReportId ? getGameReportById(selectedReportId) : Promise.resolve(null),
        ])
        const detailQuestions = detailReport?.set_id
          ? await listQuestionsForAnalytics(detailReport.set_id)
          : []

        if (cancelled) return

        setReports(recentReports)
        setSelectedReport(detailReport)
        setSelectedQuestions(detailQuestions)
      } catch (error) {
        if (cancelled) return
        console.error('Error fetching game reports:', error)
        setErrorMessage(formatServiceError(error))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadReports()

    return () => {
      cancelled = true
    }
  }, [selectedReportId])

  // 상세 보기 모드
  if (selectedReportId) {
    const report = selectedReport ?? reports.find((item) => item.id === selectedReportId) ?? null

    if (loading) {
      return <div className="p-8 text-center text-gray-500 font-bold">로딩 중...</div>
    }

    if (!report) {
      return (
        <div className="p-8 text-center">
          <p className="text-gray-500 mb-4">
            {errorMessage ? `리포트를 불러오지 못했습니다. ${errorMessage}` : '리포트를 찾을 수 없습니다.'}
          </p>
          <Button variant="outline" onClick={() => router.push('/teacher/analytics')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> 돌아가기
          </Button>
        </div>
      )
    }

    const players = parseReportPlayers(report.players_data)
    const modeCfg = getReportModeConfig(report.game_mode)
    const roomForReport: ReportRoom = {
      room_code: report.room_code,
      status: 'finished',
      current_q_index: 0,
      game_mode: isGameModeId(report.game_mode) ? report.game_mode : undefined,
      set_id: report.set_id,
      duration_seconds: null,
      started_at: null,
      created_at: report.created_at,
      updated_at: report.created_at,
    }
    const analytics = buildResultAnalytics(players, selectedQuestions, roomForReport)

    return (
      <div className="p-6">
        <Button
          variant="outline"
          onClick={() => router.push('/teacher/analytics')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> 리포트 목록
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {modeCfg.emoji} 게임 결과 리포트
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>방 코드: <span className="font-mono font-bold">{report.room_code}</span></span>
            <span>참여 {report.player_count}명</span>
            <span>{new Date(report.created_at).toLocaleString('ko-KR')}</span>
          </div>
        </div>

        <HistoryReportDetail
          questions={analytics.questions}
          students={analytics.players}
          averageAccuracy={analytics.averageAccuracy}
          averageScore={analytics.averageScore}
          completionRate={analytics.completionRate}
        />

        {/* 이 문제집으로 다시 게임 시작 */}
        {report.set_id && (
          <div className="mt-6 text-center">
            <Button
              onClick={() => router.push(`/teacher/dashboard?set=${encodeURIComponent(report.set_id!)}`)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Play className="h-4 w-4 mr-2" /> 이 문제집으로 다시 게임 시작
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 목록 모드
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">📊 게임 히스토리</h1>
        <p className="text-gray-600">지난 게임 결과를 다시 확인하세요</p>
        {errorMessage && (
          <p className="mt-3 text-sm text-red-500">리포트를 불러오는 중 문제가 발생했습니다: {errorMessage}</p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">로딩 중...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">아직 게임 기록이 없습니다</h2>
          <p className="text-gray-500 mb-6">게임을 진행하면 결과가 여기에 자동으로 저장됩니다.</p>
          <Button
            onClick={() => router.push('/teacher/dashboard')}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Play className="h-4 w-4 mr-2" /> 게임 시작하기
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, index) => {
            const modeCfg = getReportModeConfig(report.game_mode)
            const dateStr = new Date(report.created_at).toLocaleString('ko-KR', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <motion.button
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => router.push(`/teacher/analytics?report=${report.id}`)}
                className="w-full bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-300 transition-all text-left group"
              >
                {/* 게임 모드 아이콘 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl">
                  {modeCfg.emoji}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-gray-900">{modeCfg.label}</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{report.room_code}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {report.player_count}명
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {dateStr}
                    </span>
                  </div>
                </div>

                {/* 화살표 */}
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function HistoryReportDetail({
  questions,
  students,
  averageAccuracy,
  averageScore,
  completionRate,
}: {
  questions: QuestionAnalysis[]
  students: PlayerAnalysis[]
  averageAccuracy: number
  averageScore: number
  completionRate: number
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: '평균 정답률', value: `${averageAccuracy}%`, icon: Target },
          { label: '평균 점수', value: averageScore.toLocaleString(), icon: Trophy },
          { label: '완주율', value: `${completionRate}%`, icon: CheckCircle2 },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-500">{item.label}</span>
              <item.icon className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 text-3xl font-black text-slate-950">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-500">
              <ListChecks className="h-4 w-4" />
              그때 플레이했던 문제
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{questions.length}개 문항</h2>
          </div>
          <p className="text-sm font-medium text-slate-500">정답과 당시 학생들의 정답률을 함께 봅니다.</p>
        </div>

        {questions.length === 0 ? (
          <div className="p-10 text-center text-sm font-bold text-slate-500">
            연결된 문제 데이터를 찾지 못했습니다.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {questions.map((question) => (
              <div key={question.id} className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                        Q{question.index + 1}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                        {question.type}
                      </span>
                    </div>
                    <h3 className="text-lg font-black leading-relaxed text-slate-950">{question.text}</h3>
                    {question.options.length > 0 && (
                      <div className="mt-4 grid gap-2 md:grid-cols-2">
                        {question.options.map((option, index) => {
                          const isAnswer = option === question.answer || String(index + 1) === question.answer
                          return (
                            <div
                              key={`${question.id}-${option}-${index}`}
                              className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                                isAnswer
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {index + 1}. {option}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="grid min-w-44 grid-cols-2 gap-2 lg:grid-cols-1">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-400">정답</div>
                      <div className="mt-1 text-sm font-black text-slate-950">{question.answer}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <div className="text-xs font-bold text-slate-400">정답률</div>
                      <div className="mt-1 text-sm font-black text-slate-950">
                        {question.accuracy}% · {question.correctCount}/{question.totalCount}명
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-500">
              <Users className="h-4 w-4" />
              그때 아이들 결과
            </div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{students.length}명 결과</h2>
          </div>
          <p className="text-sm font-medium text-slate-500">점수 순위와 문항별 답안을 같이 확인합니다.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-black">순위</th>
                <th className="px-4 py-3 text-left font-black">학생</th>
                <th className="px-4 py-3 text-right font-black">점수</th>
                <th className="px-4 py-3 text-right font-black">정답</th>
                <th className="px-4 py-3 text-right font-black">정답률</th>
                <th className="px-4 py-3 text-right font-black">평균 응답시간</th>
                <th className="px-4 py-3 text-left font-black">문항별 결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-slate-500">{student.rankByScore}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{student.nickname}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{student.score.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-700">
                    {student.correctCount}/{student.totalCount}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                      student.accuracy >= 80
                        ? 'bg-emerald-50 text-emerald-700'
                        : student.accuracy >= 60
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                    }`}>
                      {student.accuracy}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-slate-500">
                    {formatResponseTime(student.avgResponseTimeMs)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-max gap-1.5">
                      {questions.map((question) => {
                        const answer = student.history.find((item) => item.questionIndex === question.index)
                        const Icon = answer?.isCorrect ? CheckCircle2 : answer ? XCircle : HelpCircle
                        return (
                          <div
                            key={`${student.id}-${question.id}`}
                            title={`Q${question.index + 1}: ${answer?.isCorrect ? '정답' : answer ? `오답 (${answer.selectedAnswer || '미응답'})` : '미응답'}`}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              answer?.isCorrect
                                ? 'bg-emerald-50 text-emerald-600'
                                : answer
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center font-bold text-slate-500">
                    저장된 학생 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">로딩 중...</div>}>
      <AnalyticsPageContent />
    </Suspense>
  )
}
