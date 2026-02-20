'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface LeaderboardProps {
  players: Player[]
  currentPlayerId?: string | null
  sortBy?: 'score' | 'gold' // 정렬 기준 (기본값: score)
  title?: string // 제목 커스터마이징
}

export default function Leaderboard({
  players,
  currentPlayerId,
  sortBy = 'score',
  title = '실시간 순위'
}: LeaderboardProps) {
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([])
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map())
  const prevSortedRef = useRef<Player[]>([])

  useEffect(() => {
    // 정렬 기준에 따라 정렬
    const sorted = [...players].sort((a, b) => {
      if (sortBy === 'gold') {
        // Gold 기준 정렬 (Gold가 같으면 score로)
        if (b.gold !== a.gold) {
          return b.gold - a.gold
        }
        return b.score - a.score
      } else {
        // Score 기준 정렬 (Score가 같으면 gold로)
        if (b.score !== a.score) {
          return b.score - a.score
        }
        return b.gold - a.gold
      }
    })

    // 이전 순위 저장 (prevSortedRef 사용)
    const newPreviousRanks = new Map<string, number>()
    sorted.forEach((player, index) => {
      const oldIndex = prevSortedRef.current.findIndex((p) => p.id === player.id)
      if (oldIndex !== -1) {
        newPreviousRanks.set(player.id, oldIndex)
      }
    })
    setPreviousRanks(newPreviousRanks)

    // 현재 정렬된 배열을 ref에 저장
    prevSortedRef.current = sorted
    setSortedPlayers(sorted)
  }, [players, sortBy]) // sortedPlayers 제거!

  const getRankChange = (playerId: string, currentIndex: number): number | null => {
    const previousRank = previousRanks.get(playerId)
    if (previousRank === undefined) return null
    return previousRank - currentIndex // 양수면 상승, 음수면 하락
  }

  const isGoldMode = sortBy === 'gold'

  return (
    <div className={`rounded-xl shadow-2xl p-6 border-2 glow-box ${isGoldMode
        ? 'bg-yellow-50 border-yellow-300'
        : 'bg-white border-gray-200'
      }`}>
      <motion.h2
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`text-3xl font-bold mb-6 ${isGoldMode
            ? 'text-yellow-700'
            : 'text-gray-900'
          }`}
      >
        {title}
      </motion.h2>

      {sortedPlayers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">플레이어가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {sortedPlayers.map((player, index) => {
              const rankChange = getRankChange(player.id, index)
              const isCurrentPlayer = player.id === currentPlayerId

              return (
                <motion.div
                  key={player.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${isCurrentPlayer
                      ? isGoldMode
                        ? 'border-yellow-500 bg-yellow-100 scale-105 shadow-lg glow-box'
                        : 'border-blue-500 bg-blue-100 scale-105 shadow-lg glow-box'
                      : isGoldMode
                        ? 'border-yellow-200 bg-white hover:bg-yellow-50 hover:shadow-md'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:shadow-md'
                    } ${rankChange && rankChange > 0
                      ? 'pulse-glow bg-green-50 border-green-300'
                      : rankChange && rankChange < 0
                        ? 'bg-red-50 border-red-300'
                        : ''
                    }`}
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      animate={rankChange && rankChange > 0 ? { scale: [1, 1.3, 1] } : {}}
                      className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-lg shadow-lg ${isGoldMode
                          ? index < 3
                            ? 'bg-yellow-600'
                            : 'bg-yellow-500'
                          : 'bg-blue-600'
                        }`}
                    >
                      {index + 1}
                    </motion.div>
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                      className="text-3xl"
                    >
                      {player.avatar || '🎮'}
                    </motion.span>
                    <div>
                      <div className="font-bold text-gray-800 text-lg">
                        {player.nickname}
                        {isCurrentPlayer && (
                          <span className="ml-2 text-xs bg-primary-500 text-white px-2 py-1 rounded-full">
                            나
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {player.is_online ? '🟢 온라인' : '🔴 오프라인'}
                      </div>
                    </div>
                    {rankChange !== null && rankChange !== 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`text-sm font-bold ${rankChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                      >
                        {rankChange > 0 ? '↑' : '↓'} {Math.abs(rankChange)}
                      </motion.div>
                    )}
                  </div>
                  <motion.div
                    animate={rankChange && rankChange > 0 ? { scale: [1, 1.1, 1] } : {}}
                    className="text-right"
                  >
                    {sortBy === 'gold' ? (
                      <>
                        <motion.div
                          animate={index < 3 ? { scale: [1, 1.05, 1] } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="text-3xl font-bold text-yellow-600 mb-1 flex items-center justify-end gap-2"
                        >
                          <motion.span
                            animate={{ rotate: [0, 15, -15, 0] }}
                            transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                            className="text-3xl"
                          >
                            💰
                          </motion.span>
                          <span className="neon-glow">{player.gold.toLocaleString()}</span>
                          <span className="text-xl">Gold</span>
                        </motion.div>
                        <div className="text-sm text-gray-600 font-semibold">{player.score}점</div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-gray-800">{player.score}점</div>
                        <div className="text-sm text-yellow-600 font-semibold">💰 {player.gold.toLocaleString()} Gold</div>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
