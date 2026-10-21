'use client'

import Image from 'next/image'
import { CROPS, type CropId, type SeedBag as SeedBagState } from '@/lib/game/garden'

type SeedBagProps = {
  seeds: SeedBagState
  selected: CropId | null
  onSelect: (cropId: CropId) => void
}

/** 씨앗 가방: 고른 씨앗이 빈 칸을 누르면 심긴다 */
export default function SeedBag({ seeds, selected, onSelect }: SeedBagProps) {
  const owned = CROPS.filter((crop) => (seeds[crop.id] ?? 0) > 0)
  return (
    <div className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-lg">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
        <Image unoptimized width={256} height={256} src="/garden/icon-seedpack.webp" alt="" className="h-6 w-6 object-contain" />
        씨앗 가방
        <span className="text-xs font-bold text-slate-500">고르고 빈 칸을 눌러 심어요</span>
      </div>
      {owned.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm font-bold text-slate-500 break-keep">씨앗이 없어요. 가게에서 사거나 문제를 맞혀요!</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {owned.map((crop) => {
            const active = selected === crop.id
            return (
              <button
                key={crop.id}
                type="button"
                onClick={() => onSelect(crop.id)}
                className={`flex items-center gap-1.5 rounded-xl border-2 px-2 py-1 text-sm font-black transition ${active ? 'border-lime-600 bg-lime-100 text-lime-900 shadow-[0_3px_0_#4d7c0f]' : 'border-slate-200 bg-white text-slate-700 shadow-[0_3px_0_#e2e8f0] hover:border-slate-400'}`}
              >
                <Image unoptimized width={256} height={256} src={crop.image} alt="" className="h-8 w-8 object-contain" />
                {crop.label}
                <span className="rounded-full bg-slate-800 px-1.5 text-xs text-white">{seeds[crop.id]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
