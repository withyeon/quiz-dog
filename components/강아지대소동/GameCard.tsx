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
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`min-h-[168px] rounded-[24px] border-4 p-4 text-center shadow-[5px_5px_0_#0f172a] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#0f172a] disabled:opacity-70 ${RARITY_CLASS[card.rarity]}`}
    >
      <div className="mb-2 text-5xl">{card.emoji}</div>
      <div className="text-xl font-black text-slate-900">{card.label}</div>
      <div className="mt-2 text-sm font-bold text-slate-600">{card.description}</div>
    </button>
  )
}
