'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StudentResultView from '@/components/results/StudentResultView'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { listQuestionsForAnalytics, type AnalyticsQuestion } from '@/lib/services/questions'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import { DEFAULT_GAME_MODE, getGameModeUrl } from '@/lib/game/modes'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

function StudentResultContent({ gameId }: { gameId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const playerId = searchParams?.get('playerId') ?? searchParams?.get('player') ?? ''
  const { room: liveRoom } = useRoomRealtime({ roomCode: gameId })
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

  useEffect(() => {
    if (liveRoom?.status !== 'playing' || !playerId) return
    // 제한 시간이 이미 지난 게임이면 결과 화면을 유지한다. 학생은 로컬에서 시간 종료로
    // 넘어왔고 교사의 finished 기록이 약간 늦을 수 있는데, 여기서 되돌리면 결과↔게임
    // 무한 루프가 생긴다. (교사가 새 게임을 시작한 경우엔 started_at이 갱신돼 통과)
    if (liveRoom.started_at && liveRoom.duration_seconds) {
      const elapsed = (Date.now() - new Date(liveRoom.started_at).getTime()) / 1000
      if (elapsed >= Number(liveRoom.duration_seconds)) return
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`quiz_index_${gameId}`)
    }
    router.replace(getGameModeUrl(liveRoom.game_mode || DEFAULT_GAME_MODE, gameId, playerId))
  }, [gameId, liveRoom?.game_mode, liveRoom?.status, liveRoom?.started_at, liveRoom?.duration_seconds, playerId, router])

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7fbff] p-6">
        <p className="text-xl font-black text-slate-500">내 결과를 불러오는 중입니다...</p>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f7fbff] p-6 text-center">
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

export default function StudentGameResultPageClient({ gameId }: { gameId: string }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">로딩 중...</div>}>
      <StudentResultContent gameId={gameId} />
    </Suspense>
  )
}
