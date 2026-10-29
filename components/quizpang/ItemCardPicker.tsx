'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ITEM_INFO, type ItemCard } from '@/lib/game/quizpang'
import ItemIcon from '@/components/quizpang/ItemIcon'

type ItemCardPickerProps = {
  cards: ItemCard[]
  onPick: (index: number) => void
}

const TONE: Record<string, string> = {
  bomb: 'bg-rose-100',
  line: 'bg-amber-100',
  shuffle: 'bg-sky-100',
  double: 'bg-lime-100',
}

/** 정답 보상: 아이템 카드 3장 중 하나 고르기 (1·2·3 키로도 고를 수 있다). 고른 아이템은 보관함에 들어간다 */
export default function ItemCardPicker({ cards, onPick }: ItemCardPickerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code)
      if (index >= 0 && index < cards.length) onPick(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length, onPick])

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#0f172a] sm:text-4xl">정답! 아이템을 골라요</h2>
      <p className="mb-4 text-center text-sm font-bold text-white/85 break-keep sm:text-base">고른 아이템은 보관함에 들어가요. 퍼즐로 돌아가서 원할 때 써요</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card, index) => {
          const info = ITEM_INFO[card.item]
          return (
            <motion.button
              key={`${card.item}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 24, scale: 0.92, rotate: -3 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 320, damping: 22 }}
              onClick={() => onPick(index)}
              className="group relative flex items-center gap-3 rounded-2xl border-4 border-slate-900 bg-white p-3 text-left shadow-[0_6px_0_#0f172a] transition hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#0f172a] sm:flex-col sm:p-5 sm:text-center"
            >
              <span className="absolute left-2 top-2 hidden rounded-md bg-slate-100 px-1.5 text-xs font-black text-slate-500 sm:block">{index + 1}</span>
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl p-1.5 text-4xl sm:h-24 sm:w-24 sm:text-6xl ${TONE[card.item]}`}>
                <ItemIcon id={card.item} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-900 sm:text-xl">{info.label}</div>
                <div className="mt-0.5 text-xs font-black text-slate-500">{info.needsTarget ? '자리 고르기' : '바로 발동'} · {info.short}</div>
                <div className="mt-1 text-sm font-bold break-keep text-slate-700">{info.describe}</div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
