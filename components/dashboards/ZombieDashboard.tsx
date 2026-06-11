'use client'

import { useMemo } from 'react'
import type { Database } from '@/types/database.types'
import { getZombieMeta, roomPlayerToZombiePlayer, formatTime, GAME_CONSTANTS } from '@/lib/game/zombie'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface ZombieDashboardProps {
  players: Player[]
  room: Room
}

export default function ZombieDashboard({ players, room }: ZombieDashboardProps) {
  const activePlayers = useMemo(() => players.filter((p) => !p.is_kicked), [players])

  const { humanCount, zombieCount, totalWithRoles } = useMemo(() => {
    let humans = 0
    let zombies = 0
    for (const p of activePlayers) {
      const meta = getZombieMeta(p as any)
      if (!meta) continue
      const zp = roomPlayerToZombiePlayer(p as any)
      if (zp.role === 'human') humans++
      else zombies++
    }
    return { humanCount: humans, zombieCount: zombies, totalWithRoles: humans + zombies }
  }, [activePlayers])

  const timeRemaining = useMemo(() => {
    if (!room.started_at || !room.duration_seconds) return null
    const elapsed = Math.floor((Date.now() - new Date(room.started_at).getTime()) / 1000)
    return Math.max(0, Number(room.duration_seconds) - elapsed)
  }, [room.started_at, room.duration_seconds])

  const infectionRate = totalWithRoles > 0 ? Math.round((zombieCount / totalWithRoles) * 100) : 0

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
      <h2 className="text-2xl font-semibold mb-1 text-gray-900">🧟 좀비를 피해라! 현황</h2>
      <p className="text-sm text-gray-500 mb-5">역할·점수는 게임 종료 후 공개됩니다 (공개 시 좀비 신원 노출 방지)</p>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard label="참가자" value={`${activePlayers.length}명`} color="gray" />
        <StatCard label="인간 생존" value={totalWithRoles > 0 ? `${humanCount}명` : '—'} color="blue" />
        <StatCard label="좀비" value={totalWithRoles > 0 ? `${zombieCount}명` : '—'} color="green" />
        <StatCard
          label="남은 시간"
          value={timeRemaining !== null ? formatTime(timeRemaining) : '—'}
          color={timeRemaining !== null && timeRemaining <= 60 ? 'red' : 'gray'}
        />
      </div>

      {totalWithRoles > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-sm font-semibold mb-1">
            <span className="text-blue-600">인간 {humanCount}명</span>
            <span className="text-green-600">좀비 {zombieCount}명 ({infectionRate}%)</span>
          </div>
          <div className="h-4 rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${infectionRate}%` }}
            />
          </div>
        </div>
      )}

      <div>
        <h3 className="text-base font-bold text-gray-700 mb-3">참가자 목록 ({activePlayers.length}명)</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {activePlayers.map((player) => {
            const meta = getZombieMeta(player as any)
            const isAlive = !meta || roomPlayerToZombiePlayer(player as any).role === 'human'
            return (
              <div
                key={player.id}
                className={`rounded-lg px-3 py-2 text-center text-sm font-bold border ${
                  !meta
                    ? 'border-gray-200 bg-gray-50 text-gray-500'
                    : isAlive
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-green-200 bg-green-50 text-green-800'
                }`}
              >
                {player.nickname}
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          파란색: 생존 중 · 초록색: 감염됨 · 회색: 역할 미배정
        </p>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'gray' | 'blue' | 'green' | 'red' }) {
  const colorMap = {
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-semibold mt-1 opacity-70">{label}</div>
    </div>
  )
}
