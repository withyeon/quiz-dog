'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { BarChart3, Users, Clock, ChevronRight, Play, ArrowLeft } from 'lucide-react'
import type { Database } from '@/types/database.types'
import TeacherAnalytics from '@/components/TeacherAnalytics'

type GameReport = Database['public']['Tables']['game_reports']['Row']

const GAME_MODE_LABELS: Record<string, { label: string; emoji: string }> = {
  gold_quest: { label: '골드 퀘스트', emoji: '💰' },
  racing: { label: '레이싱', emoji: '🏎️' },
  battle_royale: { label: '배틀로얄', emoji: '⚔️' },
  fishing: { label: '낚시', emoji: '🎣' },
  factory: { label: '공장', emoji: '🏭' },
  cafe: { label: '카페', emoji: '☕' },
  mafia: { label: '마피아', emoji: '🕵️' },
  pool: { label: '당구', emoji: '🎱' },
  tower: { label: '타워', emoji: '🗼' },
  dontlookdown: { label: '돈룩다운', emoji: '🧗' },
}

function AnalyticsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedReportId = searchParams?.get('report')

  const [reports, setReports] = useState<GameReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const { data, error } = await ((supabase
        .from('game_reports') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) as any)

      if (error) throw error
      setReports(data || [])
    } catch (err) {
      console.error('Error fetching game reports:', err)
    } finally {
      setLoading(false)
    }
  }

  // 상세 보기 모드
  if (selectedReportId) {
    const report = reports.find(r => r.id === selectedReportId)

    if (loading) {
      return <div className="p-8 text-center text-gray-500 font-bold">로딩 중...</div>
    }

    if (!report) {
      return (
        <div className="p-8 text-center">
          <p className="text-gray-500 mb-4">리포트를 찾을 수 없습니다.</p>
          <Button variant="outline" onClick={() => router.push('/teacher/analytics')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> 돌아가기
          </Button>
        </div>
      )
    }

    const players = Array.isArray(report.players_data) ? report.players_data as any[] : []
    const modeCfg = GAME_MODE_LABELS[report.game_mode || ''] || { label: report.game_mode || '알 수 없음', emoji: '🎮' }

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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <TeacherAnalytics setId={report.set_id || null} players={players} />
        </div>

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
            const modeCfg = GAME_MODE_LABELS[report.game_mode || ''] || { label: report.game_mode || '알 수 없음', emoji: '🎮' }
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

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">로딩 중...</div>}>
      <AnalyticsPageContent />
    </Suspense>
  )
}
