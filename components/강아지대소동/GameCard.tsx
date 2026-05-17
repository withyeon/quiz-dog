'use client'

import type { PuppyChaosCard } from '@/lib/game/강아지대소동'

type GameCardProps = {
  card: PuppyChaosCard
  onSelect?: () => void
  disabled?: boolean
}

const RARITY_CLASS = {
  common: 'bg-emerald-50 border-emerald-500',
  rare: 'bg-sky-50 border-sky-500',
  attack: 'bg-rose-50 border-rose-500',
  legendary: 'bg-amber-50 border-amber-500',
}

export default function GameCard({ card, onSelect, disabled = false }: GameCardProps) {
  const isGoldenDog = card.id === 'golden_dog'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`min-h-[168px] rounded-[24px] border-4 p-4 text-center shadow-[5px_5px_0_#0f172a] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#0f172a] disabled:opacity-70 ${RARITY_CLASS[card.rarity]}`}
    >
      <div className="mb-2 flex h-14 items-center justify-center text-5xl">
        {isGoldenDog ? (
          <span className="relative inline-flex">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-3xl">👑</span>
            <img src="/mascot_pome.png" alt="황금 강아지" className="h-14 w-14 object-contain drop-shadow-md" />
          </span>
        ) : (
          card.emoji
        )}
      </div>
      <div className="text-xl font-black text-slate-900">{card.label}</div>
      <div className="mt-2 text-sm font-bold text-slate-600">{card.description}</div>
    </button>
  )
}
