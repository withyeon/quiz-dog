'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TeacherAnalytics from '@/components/TeacherAnalytics'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

export default function ReportPage() {
    const params = useParams()
    const router = useRouter()
    const roomCode = params.roomCode as string

    const [room, setRoom] = useState<Room | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!roomCode) return

        const fetchGameData = async () => {
            try {
                setErrorMessage(null)
                const { room: roomData, players: playersData } = await getFinishedRoomReport(roomCode)
                setRoom(roomData)
                setPlayers(playersData)
            } catch (err) {
                console.error('Error fetching game report:', err)
                setErrorMessage(formatServiceError(err))
            } finally {
                setLoading(false)
            }
        }

        fetchGameData()
    }, [roomCode])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <p className="text-xl font-bold text-gray-500">결과 데이터를 불러오는 중입니다...</p>
            </div>
        )
    }

    if (!room) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-4">
                <p className="text-xl font-bold text-red-500">
                    {errorMessage ? `게임 방 정보를 불러오지 못했습니다. ${errorMessage}` : '게임 방 정보를 찾을 수 없습니다.'}
                </p>
                <button
                    onClick={() => router.push('/teacher/dashboard')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                    대시보드로 돌아가기
                </button>
            </div>
        )
    }

    if (room.status !== 'finished') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 gap-4">
                <div className="bg-yellow-100 text-yellow-800 p-6 rounded-xl border border-yellow-200">
                    <p className="text-lg font-bold">아직 게임이 진행 중입니다!</p>
                    <p className="mt-2">결과 리포트는 게임이 완전히 종료된 후에 볼 수 있습니다.</p>
                </div>
                <button
                    onClick={() => router.push('/teacher/dashboard')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                    대시보드로 돌아가기
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">게임 결과 리포트</h1>
                        <p className="text-gray-600 mt-2">방 코드: <span className="font-mono font-bold">{roomCode}</span></p>
                    </div>
                    <button
                        onClick={() => router.push('/teacher/dashboard')}
                        className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        ← 대시보드로 복귀
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <TeacherAnalytics setId={room.set_id || null} players={players} />
                </div>
            </div>
        </div>
    )
}
