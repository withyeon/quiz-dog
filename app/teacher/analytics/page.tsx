'use client'

import { useState, useEffect, Suspense } from 'react'
import TeacherPostGameReport from '@/components/results/TeacherPostGameReport'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  Play,
  Users,
} from 'lucide-react'
import { getGameModeConfig, isGameModeId } from '@/lib/game/modes'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import {
  getGameReportById,
  listGameReportsForOwner,
  parseReportPlayers,
  type GameReportWithQuestionSetTitle,
} from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import { useAuth } from '@/contexts/AuthContext'
import { EmptyState, LoadingState } from '@/components/ui/StateViews'
import type {
  Database,
} from '@/types/database.types'

type ReportRoom = Database['public']['Tables']['rooms']['Row']

const LEGACY_REPORT_MODE_CONFIG: Record<string, { label: string; emoji: string; image?: string }> = {
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

function getReportTitle(report: GameReportWithQuestionSetTitle, fallback: string): string {
  return report.question_set_title?.trim() || fallback
}

function GameTitleImage({
  mode,
  size = 'md',
}: {
  mode: { label: string; emoji: string; image?: string }
  size?: 'sm' | 'md'
}) {
  const imageSize = size === 'sm' ? 44 : 56
  const className = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12'

  if (!mode.image) {
    return <span className="text-2xl">{mode.emoji}</span>
  }

  return (
    <Image
      src={mode.image}
      alt={mode.label}
      width={imageSize}
      height={imageSize}
      className={`${className} object-contain drop-shadow-sm`}
    />
  )
}

function AnalyticsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedReportId = searchParams?.get('report')

  const [reports, setReports] = useState<GameReportWithQuestionSetTitle[]>([])
  const { user } = useAuth()
  const ownerId = user?.id ?? null
  const [selectedReport, setSelectedReport] = useState<GameReportWithQuestionSetTitle | null>(null)
  const [selectedQuestions, setSelectedQuestions] = useState<AnalyticsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadReports = async () => {
      if (!ownerId) return
      setLoading(true)
      setErrorMessage(null)
      setSelectedReport(null)
      setSelectedQuestions([])

      try {
        const [recentReports, detailReport] = await Promise.all([
          listGameReportsForOwner(ownerId, 50),
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
  }, [selectedReportId, ownerId])

  // 상세 보기 모드
  if (selectedReportId) {
    const report = selectedReport ?? reports.find((item) => item.id === selectedReportId) ?? null

    if (loading) {
      return <LoadingState label="기록을 불러오는 중" card={false} />
    }

    if (!report) {
      return (
        <div className="p-8 text-center">
          <p className="mb-4 text-slate-500">
            {errorMessage ? `결과를 불러오지 못했어요. ${errorMessage}` : '결과를 찾을 수 없어요.'}
          </p>
          <Button variant="outline" onClick={() => router.push('/teacher/analytics')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> 돌아가기
          </Button>
        </div>
      )
    }

    const players = parseReportPlayers(report.players_data)
    const modeCfg = getReportModeConfig(report.game_mode)
    const reportTitle = getReportTitle(report, modeCfg.label)
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

    return (
      <div className="p-6">
        <Button
          variant="outline"
          onClick={() => router.push('/teacher/analytics')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> 기록 목록
        </Button>

        <div className="mb-6">
          <h1 className="mb-2 flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50">
              <GameTitleImage mode={modeCfg} />
            </span>
            {reportTitle}
          </h1>
          {/* 방 코드·날짜·참가 인원은 아래 리포트 머리말에 이미 나온다.
              여기서는 어떤 문제집이었는지만 알려 준다. */}
        </div>

        {/* 게임 종료 직후와 같은 리포트를 쓴다. 화면이 두 벌이면 한쪽만 고쳐지고
            엑셀 다운로드처럼 한쪽에만 있는 기능이 생긴다. */}
        <TeacherPostGameReport
          room={roomForReport}
          players={players}
          questions={selectedQuestions}
        />

        {/* 이 문제집으로 다시 게임 시작 */}
        {report.set_id && (
          <div className="mt-6 text-center">
            <Button
              onClick={() => router.push(`/teacher/play?set=${encodeURIComponent(report.set_id!)}`)}
              className="rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
            >
              <Play className="mr-2 h-4 w-4" /> 이 문제집으로 다시 시작
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
        <h1 className="mb-2 text-3xl font-black tracking-tight text-slate-900">게임 기록</h1>
        <p className="font-medium text-slate-500">지난 게임 결과</p>
        {errorMessage && (
          <p className="mt-3 text-sm text-red-500">기록을 불러오는 중 문제가 생겼어요: {errorMessage}</p>
        )}
      </div>

      {loading ? (
        <LoadingState label="게임 기록을 불러오는 중" />
      ) : reports.length === 0 ? (
        <EmptyState
          mascot
          title="아직 기록이 없어요"
          description="게임을 진행하면 결과가 자동으로 저장돼요"
          action={
            <Button
              onClick={() => router.push('/teacher/play')}
              className="rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
            >
              <Play className="mr-2 h-4 w-4" /> 게임 시작
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report, index) => {
            const modeCfg = getReportModeConfig(report.game_mode)
            const reportTitle = getReportTitle(report, modeCfg.label)
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
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all hover:border-sky-200 hover:shadow-md"
              >
                {/* 게임 모드 아이콘 */}
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50">
                  <GameTitleImage mode={modeCfg} size="sm" />
                </div>

                {/* 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-bold text-slate-900">{reportTitle}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">{report.room_code}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-slate-500">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Users className="h-3.5 w-3.5 shrink-0" /> {report.player_count}명
                    </span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Clock className="h-3.5 w-3.5 shrink-0" /> {dateStr}
                    </span>
                  </div>
                </div>

                {/* 화살표 */}
                <ChevronRight className="h-5 w-5 text-slate-300 transition-colors group-hover:text-sky-500" />
              </motion.button>
            )
          })}
        </div>
      )}
    </div>
  )
}


export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">불러오는 중…</div>}>
      <AnalyticsPageContent />
    </Suspense>
  )
}
