'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import type { Database } from '@/types/database.types'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'
import { getPrimaryScoreValue, getScoreDisplay } from '@/lib/game/scoreDisplay'
import { DEFAULT_GAME_MODE, type GameModeId } from '@/lib/game/modes'

type Player = Database['public']['Tables']['players']['Row']

interface LeaderboardProps {
  players: Player[]
  currentPlayerId?: string | null
  sortBy?: 'score' | 'gold'
  gameMode?: GameModeId | string | null
  title?: string
  titleIcon?: string
}

export default function Leaderboard({
  players,
  currentPlayerId,
  sortBy = 'score',
  gameMode = DEFAULT_GAME_MODE,
  title = '실시간 순위',
  titleIcon,
}: LeaderboardProps) {
  const [sortedPlayers, setSortedPlayers] = useState<Player[]>([])
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map())
  const prevSortedRef = useRef<Player[]>([])

  useEffect(() => {
    const sorted = [...players].sort((a, b) => {
      if (sortBy === 'gold') {
        if (b.gold !== a.gold) {
          return b.gold - a.gold
        }
        return b.score - a.score
      }

      const scoreCompare = getPrimaryScoreValue(b, gameMode) - getPrimaryScoreValue(a, gameMode)
      if (scoreCompare !== 0) return scoreCompare
      return (b.score ?? 0) - (a.score ?? 0)
    })

    const newPreviousRanks = new Map<string, number>()
    sorted.forEach((player, index) => {
      const oldIndex = prevSortedRef.current.findIndex((p) => p.id === player.id)
      if (oldIndex !== -1) {
        newPreviousRanks.set(player.id, oldIndex)
      }
    })
    setPreviousRanks(newPreviousRanks)

    prevSortedRef.current = sorted
    setSortedPlayers(sorted)
  }, [gameMode, players, sortBy])

  const getRankChange = (playerId: string, currentIndex: number): number | null => {
    const previousRank = previousRanks.get(playerId)
    if (previousRank === undefined) return null
    return previousRank - currentIndex
  }

  const isGoldMode = sortBy === 'gold'

  return (
    <div className={`rounded-xl shadow-2xl p-6 border-2 ${isGoldMode
        ? 'bg-yellow-50 border-yellow-300'
        : 'bg-white border-gray-200'
      }`}>
      <h2 className={`flex items-center gap-3 text-3xl font-bold mb-6 ${isGoldMode
          ? 'text-yellow-700'
          : 'text-gray-900'
        }`}>
        {titleIcon && (
          <Image
            src={titleIcon}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 flex-shrink-0 object-contain"
          />
        )}
        {title}
      </h2>

      {sortedPlayers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">플레이어가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const rankChange = getRankChange(player.id, index)
            const isCurrentPlayer = player.id === currentPlayerId
            const displayNickname = getPlayerDisplayNickname(player.nickname, player.avatar)
            const scoreDisplay = getScoreDisplay(player, gameMode)

            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-colors ${isCurrentPlayer
                    ? isGoldMode
                      ? 'border-yellow-500 bg-yellow-100 shadow-md'
                      : 'border-blue-500 bg-blue-100 shadow-md'
                    : isGoldMode
                      ? 'border-yellow-200 bg-white hover:bg-yellow-50'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  } ${rankChange && rankChange > 0
                    ? 'bg-green-50 border-green-300'
                    : rankChange && rankChange < 0
                      ? 'bg-red-50 border-red-300'
                      : ''
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-lg shadow-md ${isGoldMode
                        ? index < 3
                          ? 'bg-yellow-600'
                          : 'bg-yellow-500'
                        : 'bg-blue-600'
                      }`}
                  >
                    {index + 1}
                  </div>
                  <PlayerAvatarDisplay
                    avatar={player.avatar}
                    nickname={displayNickname}
                    fallback="🎮"
                    className="relative h-12 w-12 overflow-hidden rounded-xl bg-white text-3xl ring-1 ring-gray-200"
                    sizes="48px"
                  />
                  <div>
                    <div className="font-bold text-gray-800 text-lg">
                      {displayNickname}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-xs bg-primary-500 text-white px-2 py-1 rounded-full">
                          나
                        </span>
                      )}
                    </div>
                  </div>
                  {rankChange !== null && rankChange !== 0 && (
                    <div
                      className={`text-sm font-bold ${rankChange > 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                      {rankChange > 0 ? '↑' : '↓'} {Math.abs(rankChange)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {sortBy === 'gold' ? (
                    <>
                      <div className="text-3xl font-bold text-yellow-600 flex items-center justify-end gap-2">
                        <Image src="/gold-quest/gold-stack.svg" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
                        <span>{(player.gold ?? 0).toLocaleString()}</span>
                        <span className="text-xl">골드</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`text-2xl font-bold ${
                        scoreDisplay.tone === 'money'
                          ? 'text-emerald-600'
                          : scoreDisplay.tone === 'gold'
                            ? 'text-yellow-600'
                            : scoreDisplay.tone === 'health'
                              ? 'text-red-600'
                              : 'text-gray-800'
                      } flex items-center justify-end gap-1.5`}>
                        {scoreDisplay.icon && (
                          <Image src={scoreDisplay.icon} alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                        )}
                        {scoreDisplay.text}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
