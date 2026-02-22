'use client'

import { motion } from 'framer-motion'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface PlayerSelectorProps {
  players: Player[]
  currentPlayerId: string
  onSelect: (playerId: string) => void
  title: string
  description: string
  icon: string
  /** 뺏기/훔치기일 때 선택 가능한 상대가 없을 때 안내 문구 */
  emptyMessage?: string
}

export default function PlayerSelector({
  players,
  currentPlayerId,
  onSelect,
  title,
  description,
  icon,
  emptyMessage = '선택할 수 있는 플레이어가 없습니다.',
}: PlayerSelectorProps) {
  // 전달된 players는 이미 자기 제외·조건 필터된 목록
  const otherPlayers = players
    .filter((p) => p.id !== currentPlayerId)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  if (otherPlayers.length === 0) {
    return (
      <div className="bg-yellow-50 rounded-xl p-8 text-center border-2 border-yellow-300">
        <p className="text-gray-700">{emptyMessage}</p>
        <p className="text-sm text-gray-500 mt-2">잠시 후 다음 문제로 넘어갑니다.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl shadow-2xl p-8 max-w-3xl mx-auto border-4 border-amber-400"
    >
      <div className="text-center mb-6">
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-6xl mb-4"
        >
          {icon}
        </motion.div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-700 text-lg">{description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherPlayers.map((player, index) => {
          const isTopPlayer = index === 0
          return (
            <motion.button
              key={player.id}
              onClick={() => onSelect(player.id)}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className={`p-6 rounded-xl border-4 transition-all text-left ${
                isTopPlayer
                  ? 'bg-red-100 border-red-500 shadow-lg'
                  : 'bg-white border-amber-300 hover:border-amber-500'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">{player.avatar || '🏴‍☠️'}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-gray-900">
                      {player.nickname}
                    </span>
                    {isTopPlayer && (
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="text-2xl"
                        title="현상수배!"
                      >
                        🎯
                      </motion.span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">
                    순위: #{index + 1} | 골드: {player.gold}💰
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-amber-600">
                    {player.score}점
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
