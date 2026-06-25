'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import TeacherAnalytics from '@/components/TeacherAnalytics'
import { getFinishedRoomReport } from '@/lib/services/reports'
import { formatServiceError } from '@/lib/services/errors'
import type { Database } from '@/types/database.types'

type Room = Database['public']['Tables']['rooms']['Row']
type Player = Database['public']['Tables']['players']['Row']

export default function ReportPageClient({ roomCode }: { roomCode: string }) {
    const router = useRouter()

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
            <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-6">
                <p className="text-xl font-bold text-slate-500">결과를 불러오는 중…</p>
            </div>
        )
    }

    if (!room) {
        return (
            <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
                <p className="text-xl font-bold text-red-500">
                    {errorMessage ? `게임 방 정보를 불러오지 못했습니다. ${errorMessage}` : '게임 방 정보를 찾을 수 없습니다.'}
                </p>
                <button
                    onClick={() => router.push('/teacher/dashboard')}
                    className="rounded-xl bg-sky-500 px-6 py-2 font-bold text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
                >
                    게임 시작으로
                </button>
            </div>
        )
    }

    if (room.status !== 'finished') {
        return (
            <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
                <div className="bg-yellow-100 text-yellow-800 p-6 rounded-xl border border-yellow-200">
                    <p className="text-lg font-bold">아직 게임이 진행 중이에요</p>
                    <p className="mt-2">게임이 끝나면 결과를 볼 수 있어요.</p>
                </div>
                <button
                    onClick={() => router.push('/teacher/dashboard')}
                    className="rounded-xl bg-sky-500 px-6 py-2 font-bold text-white shadow-sm shadow-sky-200 hover:bg-sky-600"
                >
                    게임 시작으로
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-dvh bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-black">게임 결과</h1>
                        <p className="text-slate-500 mt-2">참가코드 <span className="font-mono font-bold">{roomCode}</span></p>
                    </div>
                    <button
                        onClick={() => router.push('/teacher/dashboard')}
                        className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                    >
                        게임 시작으로
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    <TeacherAnalytics setId={room.set_id || null} players={players} />
                </div>
            </div>
        </div>
    )
}
