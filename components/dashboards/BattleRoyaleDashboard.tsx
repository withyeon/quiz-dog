'use client'

import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface BattleRoyaleDashboardProps {
    players: Player[]
}

export default function BattleRoyaleDashboard({ players }: BattleRoyaleDashboardProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
            <h2 className="text-2xl font-semibold mb-4 text-gray-900">⚔️ 배틀 현황</h2>
            <div className="bg-gradient-to-br from-red-900 via-red-800 to-orange-900 rounded-xl p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {players.map((player) => {
                        const health = player.health || 100
                        const isAlive = health > 0
                        return (
                            <div
                                key={player.id}
                                className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 border-2 ${isAlive ? 'border-white/30' : 'border-gray-500'
                                    }`}
                            >
                                <div className="text-center">
                                    <div className="text-3xl mb-2">{player.avatar || '🐕'}</div>
                                    <div className="font-bold text-white text-sm mb-1">
                                        {player.nickname}
                                    </div>
                                    <div className={`text-lg font-bold ${isAlive ? 'text-green-300' : 'text-gray-400'
                                        }`}>
                                        {health} HP
                                    </div>
                                    {!isAlive && (
                                        <div className="text-xs text-gray-400 mt-1">💀 탈락</div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="mt-4 text-center">
                    <div className="bg-black/50 rounded-lg p-3 inline-block">
                        <span className="text-white font-bold">
                            생존자: {players.filter(p => (p.health || 100) > 0).length}명
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
