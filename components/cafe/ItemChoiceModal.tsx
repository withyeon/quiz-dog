'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import type { CafeItem, ItemId } from '@/lib/game/cafeItems'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'

type Player = Database['public']['Tables']['players']['Row']

interface ItemChoiceModalProps {
  items: CafeItem[]
  restockedMenuName: string
  consecutiveCorrect: number
  players: Player[]
  currentPlayerId: string | null
  onSelect: (itemId: ItemId, targetPlayerId?: string) => void
  onSkip: () => void
}

export default function ItemChoiceModal({
  items,
  restockedMenuName,
  consecutiveCorrect,
  players,
  currentPlayerId,
  onSelect,
  onSkip,
}: ItemChoiceModalProps) {
  const [selectedItem, setSelectedItem] = useState<CafeItem | null>(null)

  useEffect(() => {
    if (items.length === 0) return

    const timer = setTimeout(() => {
      const item = items[Math.floor(Math.random() * items.length)]
      if (item.type === 'buff') {
        onSelect(item.id)
      } else {
        onSkip()
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [items, onSelect, onSkip])

  const targets = players
    .filter(player => player.id !== currentPlayerId)
    .sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-lg border-4 border-amber-300 bg-white p-5 shadow-2xl"
    >
      <div className="mb-5 text-center">
        <div className="text-2xl font-black text-slate-950">✅ 정답! 🍽️ {restockedMenuName} 재고 충전!</div>
        {consecutiveCorrect >= 2 && (
          <div className="mt-2 inline-flex rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white">
            🔥 {consecutiveCorrect}연속 정답! 희귀 아이템 확률 UP
          </div>
        )}
      </div>

      {!selectedItem && (
        <div className="grid gap-3 md:grid-cols-3">
          {items.map(item => (
            <motion.button
              key={item.id}
              type="button"
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                if (item.type === 'debuff') {
                  setSelectedItem(item)
                  return
                }
                onSelect(item.id)
              }}
              className={`flex min-h-[180px] cursor-pointer flex-col items-center gap-2 rounded-lg border-4 p-5 transition-all ${
                item.type === 'buff'
                  ? 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100'
                  : 'border-rose-400 bg-rose-50 hover:bg-rose-100'
              } ${item.rarity === 'rare' ? 'ring-4 ring-amber-400 ring-offset-2' : ''}`}
            >
              <span className="text-5xl">{item.emoji}</span>
              <span className="text-base font-black text-slate-900">{item.name}</span>
              <span className="text-center text-xs font-semibold text-slate-600">{item.description}</span>
              {item.rarity === 'rare' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-600">
                  ✨ RARE
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                item.type === 'buff' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
              }`}>
                {item.type === 'buff' ? '🟢 내 버프' : '🔴 상대 방해'}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="mt-4">
          <p className="mb-3 font-black text-slate-800">누구에게 사용할까요?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {targets.map(player => (
              <button
                key={player.id}
                type="button"
                onClick={() => onSelect(selectedItem.id, player.id)}
                className="flex min-h-20 flex-col items-center gap-1 rounded-lg border-2 border-rose-300 bg-rose-50 p-3 font-bold hover:bg-rose-100"
              >
                <PlayerAvatarDisplay
                  avatar={player.avatar}
                  nickname={player.nickname}
                  fallback="🐕"
                  className="relative h-9 w-9 overflow-hidden rounded-lg bg-white text-2xl ring-1 ring-rose-200"
                  sizes="36px"
                />
                <span className="w-full truncate text-center text-xs text-slate-700">{player.nickname}</span>
                <span className="text-xs font-black text-green-600">${(player.score || 0).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="mx-auto mt-5 block min-h-11 rounded-lg border border-slate-200 px-5 py-2 text-sm font-black text-slate-500 hover:bg-slate-50"
      >
        건너뛰기
      </button>
    </motion.div>
  )
}
