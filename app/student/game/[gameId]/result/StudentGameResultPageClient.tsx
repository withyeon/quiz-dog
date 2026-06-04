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
    if (liveRoom?.status !== 'playing' || !playerId || !liveRoom.started_at) return
    // 이 결과 화면이 보여주는 '종료된 세션'의 시작 시각.
    const endedStartedAt = room?.started_at
    // 종료 세션 정보가 아직 로드되지 않았으면 되돌리지 않는다(섣부른 재입장 방지).
    if (!endedStartedAt) return
    // 같은 세션(시간 종료 직후, 교사의 finished 기록이 약간 늦는 경우)에서는 절대 게임으로
    // 되돌리지 않는다. 예전에는 elapsed(경과시간)로 판단했는데, 학생 기기 시계가 조금만
    // 느려도 elapsed < duration이 되어 일부 학생만 게임으로 끌려가 '게임에 머무르는' 문제가
    // 있었다. started_at(세션 식별자) 비교는 시계 오차와 무관하다.
    if (liveRoom.started_at === endedStartedAt) return
    // started_at이 바뀐 경우 = 교사가 새 게임을 시작 → 새 세션으로 재입장한다.
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(`quiz_index_${gameId}`)
    }
    router.replace(getGameModeUrl(liveRoom.game_mode || DEFAULT_GAME_MODE, gameId, playerId))
  }, [gameId, liveRoom?.game_mode, liveRoom?.status, liveRoom?.started_at, playerId, room?.started_at, router])

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
