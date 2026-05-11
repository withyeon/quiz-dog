'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { ArrowRight, Coins, Target } from 'lucide-react'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface PlayerSelectorProps {
  players: Player[]
  currentPlayerId: string
  onSelect: (playerId: string) => void
  title: string
  description: string
  icon: string
  iconImage?: string
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
  iconImage,
  emptyMessage = '선택할 수 있는 플레이어가 없습니다.',
}: PlayerSelectorProps) {
  // 전달된 players는 이미 자기 제외·조건 필터된 목록
  const otherPlayers = players
    .filter((p) => p.id !== currentPlayerId)
    .sort((a, b) => ((b.gold ?? 0) - (a.gold ?? 0)) || ((b.score ?? 0) - (a.score ?? 0)))

  if (otherPlayers.length === 0) {
    return (
      <div className="gold-quest-panel max-w-2xl mx-auto p-8 text-center">
        <p className="text-lg font-black text-[#17262a]">{emptyMessage}</p>
        <p className="text-sm font-semibold text-slate-500 mt-2">잠시 후 다음 문제로 넘어갑니다.</p>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="gold-quest-panel p-5 sm:p-7 max-w-4xl mx-auto"
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/70 bg-amber-100/70 shadow-lg"
          >
            {iconImage ? (
              <Image src={iconImage} alt="" width={48} height={48} className="h-12 w-12 drop-shadow-md" />
            ) : (
              <span className="text-3xl">{icon}</span>
            )}
          </motion.div>
          <div>
            <h2 className="gold-quest-title text-3xl font-black text-[#17262a]">{title}</h2>
            <p className="mt-1 text-base font-semibold text-slate-600">{description}</p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-900/10 bg-[#0c3b42] px-3 py-1 text-xs font-black uppercase tracking-normal text-amber-100">
          <Target className="h-4 w-4" />
          Target
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {otherPlayers.map((player, index) => {
          const isTopPlayer = index === 0
          return (
            <motion.button
              key={player.id}
              onClick={() => onSelect(player.id)}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.98 }}
              className={`group min-h-[128px] rounded-lg border p-4 text-left transition-all ${
                isTopPlayer
                  ? 'border-red-300/70 bg-red-50 shadow-lg shadow-red-950/10'
                  : 'border-amber-300/70 bg-white/[0.82] hover:border-[#b7791f] hover:bg-[#fff5dc]'
              }`}
            >
              <div className="flex h-full items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-3xl shadow-sm">
                  {player.avatar || 'P'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-black text-[#17262a]">
                      {player.nickname}
                    </span>
                    {isTopPlayer && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
                        1위
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
                    <span>#{index + 1}</span>
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Coins className="h-4 w-4" />
                      {player.gold ?? 0} Gold
                    </span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2 text-right">
                  <div>
                    <div className="text-xl font-black text-[#17262a]">{player.score ?? 0}</div>
                    <div className="text-xs font-bold text-slate-500">점</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
