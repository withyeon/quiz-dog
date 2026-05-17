'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import StudentResultView from '@/components/results/StudentResultView'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

function StudentResultContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const gameId = params.gameId as string
  const playerId = searchParams?.get('playerId') ?? searchParams?.get('player') ?? ''
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<AnalyticsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadResult = async () => {
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
        console.error('Error loading student result:', error)
        setErrorMessage(formatServiceError(error))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (gameId) void loadResult()

    return () => {
      cancelled = true
    }
  }, [gameId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff] p-6">
        <p className="text-xl font-black text-slate-500">내 결과를 불러오는 중입니다...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff] p-6 text-center">
        <p className="text-xl font-black text-red-600">
          {errorMessage ? `결과를 불러오지 못했습니다. ${errorMessage}` : '게임 결과를 찾을 수 없습니다.'}
        </p>
      </div>
    )
  }

  return (
    <StudentResultView
      room={room}
      players={players}
      questions={questions}
      playerId={playerId}
    />
  )
}

export default function StudentGameResultPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">로딩 중...</div>}>
      <StudentResultContent />
    </Suspense>
  )
}
