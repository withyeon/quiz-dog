'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import GameCard from '@/components/강아지대소동/GameCard'
import { PUPPY_ICON } from '@/components/강아지대소동/puppyIcons'
import type { PuppyChaosCard } from '@/lib/game/강아지대소동'

type Props = {
  cards: PuppyChaosCard[]
  cardCountdown: number
  selectedBoxIndex: number | null
  isOpeningBox: boolean
  onSelect: (boxIndex: number) => void
}

/** 정답 뒤 랜덤박스 셋 중 하나 고르기. 고르면 상자가 뒤집히며 카드가 드러난다. */
export default function RandomBoxPicker({ cards, cardCountdown, selectedBoxIndex, isOpeningBox, onSelect }: Props) {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="rounded-[28px] border-4 border-slate-900 bg-white p-5 shadow-[5px_5px_0_#0f172a]">
      <div className="mb-5 text-center">
        <div className="text-4xl font-black">랜덤박스 하나 고르기!</div>
        <div className="mt-2 text-lg font-black text-rose-600">
          {isOpeningBox ? '상자를 여는 중' : `${cardCountdown}초 후 랜덤 자동 선택`}
        </div>
      </div>
      {isOpeningBox && selectedBoxIndex !== null && cards[selectedBoxIndex] ? (
        <div className="flex min-h-[360px] items-center justify-center py-4">
          <motion.div
            key={`revealed-${selectedBoxIndex}-${cards[selectedBoxIndex].id}`}
            initial={{ rotateY: 90, scale: 0.72, y: 18 }}
            animate={{ rotateY: 0, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="w-full max-w-sm"
          >
            <GameCard card={cards[selectedBoxIndex]} disabled size="large" />
          </motion.div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((card, index) => {
            const isSelected = selectedBoxIndex === index

            return (
              <motion.button
                key={`box-${index}`}
                type="button"
                disabled={isOpeningBox}
                onClick={() => onSelect(index)}
                whileHover={isOpeningBox ? undefined : { y: -6, rotate: index === 1 ? 0 : index === 0 ? -2 : 2 }}
                whileTap={isOpeningBox ? undefined : { scale: 0.96 }}
                className={`min-h-[168px] rounded-[24px] border-4 border-slate-900 bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-200 p-4 text-center shadow-[5px_5px_0_#0f172a] transition-opacity disabled:opacity-70 ${
                  isSelected ? 'ring-4 ring-rose-400' : ''
                }`}
              >
                <Image
                  src={PUPPY_ICON.randomBox}
                  alt="랜덤박스"
                  width={72}
                  height={72}
                  className="mx-auto mb-3 h-[72px] w-[72px] object-contain"
                  unoptimized
                />
                <div className="text-2xl font-black text-slate-900">랜덤박스</div>
                <div className="mt-2 text-sm font-bold text-slate-600">열기 전까지 비밀!</div>
                <div className="mt-3 text-3xl font-black text-rose-500">?</div>
              </motion.button>
            )
          })}
        </div>
      )}
    </motion.section>
  )
}
