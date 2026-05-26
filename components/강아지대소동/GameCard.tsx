'use client'

import Image from 'next/image'
import type { PuppyChaosCard } from '@/lib/game/강아지대소동'

type GameCardProps = {
  card: PuppyChaosCard
  onSelect?: () => void
  disabled?: boolean
  size?: 'normal' | 'large'
}

const RARITY_CLASS = {
  common: 'bg-emerald-50 border-emerald-500',
  rare: 'bg-sky-50 border-sky-500',
  attack: 'bg-rose-50 border-rose-500',
  legendary: 'bg-amber-50 border-amber-500',
}

export default function GameCard({ card, onSelect, disabled = false, size = 'normal' }: GameCardProps) {
  const isLarge = size === 'large'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`${isLarge ? 'min-h-[320px] w-full rounded-[32px] p-7 shadow-[8px_8px_0_#0f172a]' : 'min-h-[168px] rounded-[24px] p-4 shadow-[5px_5px_0_#0f172a]'} border-4 text-center transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#0f172a] disabled:opacity-70 ${RARITY_CLASS[card.rarity]}`}
    >
      <div className={`${isLarge ? 'mb-5 flex h-36' : 'mb-2 flex h-16'} items-center justify-center`}>
        {card.icon ? (
          <Image
            src={card.icon}
            alt={card.label}
            width={isLarge ? 144 : 64}
            height={isLarge ? 144 : 64}
            className={`${isLarge ? 'h-36 w-36' : 'h-16 w-16'} object-contain`}
            unoptimized
          />
        ) : (
          <span className={isLarge ? 'text-8xl' : 'text-5xl'}>{card.emoji}</span>
        )}
      </div>
      <div className={`${isLarge ? 'text-4xl' : 'text-xl'} font-black text-slate-900`}>{card.label}</div>
      <div className={`${isLarge ? 'mt-4 text-lg leading-7' : 'mt-2 text-sm'} font-bold text-slate-600`}>{card.description}</div>
    </button>
  )
}
