'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TeacherPostGameReport from '@/components/results/TeacherPostGameReport'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

export default function TeacherGameReportPage() {
  const params = useParams()
  const router = useRouter()
  const gameId = params.gameId as string
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<AnalyticsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadReport = async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const { room: roomData, players: playersData } = await getFinishedRoomReport(gameId)
        const questionData = roomData?.set_id ? await listQuestionsForAnalytics(roomData.set_id) : []

        if (cancelled) return
        setRoom(roomData)
        setPlayers(playersData)
        setQuestions(questionData)
      } catch (error) {
        if (cancelled) return
        console.error('Error loading teacher game report:', error)
        setErrorMessage(formatServiceError(error))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (gameId) void loadReport()

    return () => {
      cancelled = true
    }
  }, [gameId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <p className="text-xl font-black text-slate-500">결과 데이터를 불러오는 중입니다...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <p className="text-xl font-black text-red-600">
          {errorMessage ? `리포트를 불러오지 못했습니다. ${errorMessage}` : '게임 결과를 찾을 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push('/teacher/analytics')}
          className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white"
        >
          히스토리로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <TeacherPostGameReport room={room} players={players} questions={questions} />
      </div>
    </main>
  )
}
