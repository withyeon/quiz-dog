'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import { formatCafeMoney } from '@/lib/game/cafe'
import { ITEM_CHOICE_SECONDS, type CafeItem, type ItemId } from '@/lib/game/cafeItems'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import PixelIcon from '@/components/ui/PixelIcon'
import CafeImage from '@/components/cafe/CafeImage'

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
  const [secondsLeft, setSecondsLeft] = useState(ITEM_CHOICE_SECONDS)

  // 콜백은 ref로 들고 있는다. onSelect가 players(점수 동기화마다 바뀜)에 의존해
  // 매번 새 함수가 되는데, 그걸 effect 의존성에 넣으면 타이머가 계속 초기화된다.
  const onSelectRef = useRef(onSelect)
  const onSkipRef = useRef(onSkip)
  useEffect(() => {
    onSelectRef.current = onSelect
    onSkipRef.current = onSkip
  }, [onSelect, onSkip])

  // 선택 제한 시간. 방해 아이템을 눌러 대상 고르기로 넘어가면 다시 처음부터 센다.
  // 시간이 다 되면: 대상 고르는 중이면 건너뛰기, 아니면 버프 중 하나를 대신 골라 준다.
  useEffect(() => {
    if (items.length === 0) return

    const deadline = Date.now() + ITEM_CHOICE_SECONDS * 1000
    setSecondsLeft(ITEM_CHOICE_SECONDS)

    const tick = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    }, 250)

    const timer = setTimeout(() => {
      if (selectedItem) {
        onSkipRef.current()
        return
      }
      const buffs = items.filter(item => item.type === 'buff')
      if (buffs.length === 0) {
        onSkipRef.current()
        return
      }
      onSelectRef.current(buffs[Math.floor(Math.random() * buffs.length)].id)
    }, ITEM_CHOICE_SECONDS * 1000)

    return () => {
      clearInterval(tick)
      clearTimeout(timer)
    }
  }, [items, selectedItem])

  const targets = players
    .filter(player => player.id !== currentPlayerId && !player.is_kicked)
    .sort((a, b) => (b.score || 0) - (a.score || 0))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="rounded-lg border-4 border-amber-300 bg-white p-5 shadow-2xl"
    >
      <div className="mb-5 text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-black text-slate-950">
          <PixelIcon name="correct" size={28} alt="정답" />
          <span className="inline-flex items-center gap-1">
            정답!
            <PixelIcon name="dish" size={24} alt="" />
            {restockedMenuName} 재고 충전!
          </span>
        </div>
        {consecutiveCorrect >= 2 && (
          <div className="mt-2 inline-flex rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white">
            <PixelIcon name="streak" size={16} alt="" className="mr-1 inline-block align-text-bottom" />
            {consecutiveCorrect}연속 정답! 희귀 아이템이 더 잘 나와요
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold text-slate-500">
          <span className={secondsLeft <= 3 ? 'text-rose-600' : ''}>
            {selectedItem ? '대상 고르기' : '아이템 고르기'} {secondsLeft}초
          </span>
          <span className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
            <span
              className={`block h-full rounded-full transition-[width] duration-300 ${secondsLeft <= 3 ? 'bg-rose-500' : 'bg-amber-400'}`}
              style={{ width: `${(secondsLeft / ITEM_CHOICE_SECONDS) * 100}%` }}
            />
          </span>
        </div>
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
              <CafeImage
                src={item.image}
                alt={item.name}
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                fallbackEmoji={item.emoji}
                fallbackClassName="h-16 w-16 text-5xl"
              />
              <span className="text-base font-black text-slate-900">{item.name}</span>
              <span className="text-center text-xs font-semibold text-slate-600">{item.description}</span>
              {item.rarity === 'rare' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-600">
                  <PixelIcon name="rare" size={14} alt="" /> 희귀
                </span>
              )}
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                item.type === 'buff' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
              }`}>
                {item.type === 'buff' ? '🟢 나에게 좋아요' : '🔴 상대 방해'}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {selectedItem && (
        <div className="mt-4">
          <p className="mb-3 font-black text-slate-800">
            <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700">
              {selectedItem.name}
            </span>
            누구에게 사용할까요?
          </p>
          {targets.length === 0 && (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-500">
              방해할 상대가 아직 없어요
            </p>
          )}
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
                <span className="text-xs font-black text-green-600">{formatCafeMoney(player.score || 0)}</span>
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
