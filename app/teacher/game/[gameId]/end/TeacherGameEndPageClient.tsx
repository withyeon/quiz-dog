'use client'

import { toast } from '@/components/ui/Toaster'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TeacherEndSequence from '@/components/results/TeacherEndSequence'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { assertQuestionSetHasQuestions, resetRoom, startRoom } from '@/lib/services/rooms'
import { formatServiceError } from '@/lib/services/errors'
import { DEFAULT_GAME_MODE, isGameModeId } from '@/lib/game/modes'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

export default function TeacherGameEndPageClient({ gameId }: { gameId: string }) {
  const router = useRouter()
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [questions, setQuestions] = useState<AnalyticsQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [isRestarting, setIsRestarting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadEndSequence = async () => {
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
        console.error('Error loading teacher end sequence:', error)
        setErrorMessage(formatServiceError(error))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (gameId) void loadEndSequence()

    return () => {
      cancelled = true
    }
  }, [gameId])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#102a43] p-6">
        <p className="text-3xl font-black text-white">결과 발표를 준비하는 중입니다...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center">
        <p className="text-xl font-black text-red-600">
          {errorMessage ? `종료 화면을 불러오지 못했습니다. ${errorMessage}` : '게임 결과를 찾을 수 없습니다.'}
        </p>
        <button
          onClick={() => router.push('/teacher/dashboard')}
          className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white"
        >
          대시보드로 돌아가기
        </button>
      </div>
    )
  }

  const handleRestart = async () => {
    if (!room || isRestarting) return
    setIsRestarting(true)
    try {
      const gameMode = isGameModeId(room.game_mode) ? room.game_mode : DEFAULT_GAME_MODE
      await assertQuestionSetHasQuestions(room.set_id ?? null)
      const durationSeconds = room.duration_seconds

      await resetRoom(room.room_code)
      await startRoom({
        roomCode: room.room_code,
        gameMode,
        durationSeconds,
      })

      router.replace(`/teacher/dashboard?room=${encodeURIComponent(room.room_code)}`)
    } catch (error) {
      console.error('Error restarting game:', error)
      toast.error('다시 시작에 실패했습니다: ' + formatServiceError(error))
      setIsRestarting(false)
    }
  }

  return (
    <TeacherEndSequence
      room={room}
      players={players}
      questions={questions}
      onRestart={handleRestart}
      isRestarting={isRestarting}
    />
  )
}
