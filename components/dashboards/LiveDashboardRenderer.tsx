'use client'

import type { Database } from '@/types/database.types'
import Leaderboard from '@/components/Leaderboard'
import RacingTrack from '@/components/RacingTrack'
import FishingPond from '@/components/FishingPond'
import FactoryView from '@/components/FactoryView'
import BattleRoyaleDashboard from './BattleRoyaleDashboard'
import Link from 'next/link'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface LiveDashboardRendererProps {
    room: Room
    players: Player[]
}

export default function LiveDashboardRenderer({ room, players }: LiveDashboardRendererProps) {
    if (room.status === 'finished') {
        return (
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-sm p-12 text-center border-2 border-green-200 mb-6">
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-3xl font-black text-green-800 mb-4">게임이 성공적으로 종료되었습니다!</h2>
                <p className="text-green-700 mb-8 text-lg font-medium">학생들의 자세한 풀이 결과와 점수를 분석 리포트에서 확인하세요.</p>
                <Link
                    href={`/teacher/report/${room.room_code}`}
                    className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-1 text-xl"
                >
                    📊 결과 리포트 보러가기
                </Link>
            </div>
        )
    }

    const mode = room.game_mode

    if (mode === 'racing') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">🏁 레이스 현황</h2>
                <RacingTrack
                    players={players.map(p => ({ ...p, position: p.position || 0 }))}
                    currentPlayerId={null}
                    trackLength={1000}
                />
                <div className="mt-6">
                    <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="🏁 레이싱 순위" />
                </div>
            </div>
        )
    } else if (mode === 'battle_royale') {
        return <BattleRoyaleDashboard players={players} />
    } else if (mode === 'fishing') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900" style={{ fontFamily: 'OkDanDan, sans-serif' }}>🕹️ 인형뽑기 현황</h2>
                <FishingPond players={players as any} currentPlayerId={null} />
                <div className="mt-6">
                    <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="🎣 낚시 순위" />
                </div>
            </div>
        )
    } else if (mode === 'factory') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">🏭 팩토리 현황</h2>
                <FactoryView players={players as any} currentPlayerId={null} roomCode={room.room_code} />
            </div>
        )
    } else if (mode === 'pool') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">🎱 포켓볼 게임 현황</h2>
                <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="🎱 포켓볼 점수 순위" />
            </div>
        )
    } else if (mode === 'dontlookdown') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">⛰️ Don't Look Down 현황</h2>
                <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="⛰️ 높이 순위" />
            </div>
        )
    }

    if (mode === 'allin') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">💎 올인 퀴즈 현황</h2>
                <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="💎 점수 순위" />
            </div>
        )
    }

    // 기본 리더보드 (골드 퀘스트, 까페, 마피아, 타워 등 복잡한 전용 UI가 없는 게임들)
    return (
        <Leaderboard players={players} currentPlayerId={null} sortBy="gold" title="💰 금괴/점수 순위" />
    )
}
