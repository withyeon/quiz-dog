'use client'

import type { Database } from '@/types/database.types'
import Leaderboard from '@/components/Leaderboard'
import FishingPond from '@/components/FishingPond'
import FactoryView from '@/components/FactoryView'
import BattleRoyaleDashboard from './BattleRoyaleDashboard'
import Link from 'next/link'
import { getGameModeConfig } from '@/lib/game/modes'
import PuppyChaosTeacherBoard from '@/components/강아지대소동/강아지대소동TeacherBoard'
import { usePuppyChaosEvents } from '@/hooks/use강아지대소동Events'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface LiveDashboardRendererProps {
    room: Room
    players: Player[]
}

export default function LiveDashboardRenderer({ room, players }: LiveDashboardRendererProps) {
    const { events } = usePuppyChaosEvents(room.room_code, room.game_mode === 'poop_dodge')

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
    const modeConfig = getGameModeConfig(mode)

    if (mode === 'battle_royale') {
        return <BattleRoyaleDashboard players={players} />
    } else if (mode === 'poop_dodge') {
        return <PuppyChaosTeacherBoard room={room} players={players} events={events} />
    } else if (mode === 'fishing') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900" style={{ fontFamily: modeConfig.fontFamily }}>🕹️ 인형뽑기 현황</h2>
                <FishingPond players={players as any} currentPlayerId={null} />
                <div className="mt-6">
                    <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="🕹️ 인형뽑기 순위" />
                </div>
            </div>
        )
    } else if (mode === 'factory') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">{modeConfig.emoji} {modeConfig.shortLabel} 현황</h2>
                <FactoryView players={players as any} currentPlayerId={null} roomCode={room.room_code} />
            </div>
        )
    } else if (mode === 'dontlookdown') {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
                <h2 className="text-2xl font-semibold mb-4 text-gray-900">{modeConfig.emoji} {modeConfig.shortLabel} 현황</h2>
                <Leaderboard players={players} currentPlayerId={null} sortBy="score" title="⛰️ 높이 순위" />
            </div>
        )
    }

    // 기본 리더보드 (골드 퀘스트, 까페, 마피아, 타워 등 복잡한 전용 UI가 없는 게임들)
    return (
        <Leaderboard
            players={players}
            currentPlayerId={null}
            sortBy={modeConfig.leaderboardSort === 'gold' ? 'gold' : 'score'}
            title={`${modeConfig.emoji} ${modeConfig.shortLabel} 순위`}
        />
    )
}
