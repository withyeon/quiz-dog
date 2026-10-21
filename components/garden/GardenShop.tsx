'use client'

import Image from 'next/image'
import { useState } from 'react'
import {
  CROPS,
  GARDEN,
  RARITY,
  SPRINKLER_LEVELS,
  nextExpandPrice,
  nextSprinklerPrice,
  type CropId,
  type GardenState,
} from '@/lib/game/garden'
import { cropSummary } from '@/components/garden/RewardCards'

type GardenShopProps = {
  garden: GardenState
  onBuySeed: (cropId: CropId) => void
  onExpand: () => void
  onSprinkler: () => void
  onScarecrow: () => void
}

function PriceButton({ price, coins, onClick, soldOut }: { price: number | null; coins: number; onClick: () => void; soldOut?: string }) {
  if (price === null || soldOut) {
    return <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1.5 text-xs font-black text-slate-400">{soldOut ?? '최고 단계'}</span>
  }
  const ok = coins >= price
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ok}
      className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black transition sm:text-sm ${ok ? 'bg-amber-400 text-amber-950 shadow-[0_3px_0_#b45309] hover:brightness-105 active:translate-y-0.5 active:shadow-none' : 'bg-slate-100 text-slate-400'}`}
    >
      <Image unoptimized width={256} height={256} src="/garden/icon-coin.webp" alt="" className="h-4 w-4 object-contain" />
      {price.toLocaleString()}
    </button>
  )
}

/** 씨앗 가게(정답마다 재입고) + 도구(밭 넓히기·스프링클러·허수아비) */
export default function GardenShop({ garden, onBuySeed, onExpand, onSprinkler, onScarecrow }: GardenShopProps) {
  const [tab, setTab] = useState<'seeds' | 'tools'>('seeds')
  const stocked = CROPS.filter((crop) => (garden.shop[crop.id] ?? 0) > 0)
  const sprinklerNext = SPRINKLER_LEVELS[garden.sprinkler + 1]

  return (
    <div className="rounded-xl border border-white/70 bg-white/90 p-3 shadow-lg">
      <div className="mb-2 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['seeds', 'tools'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md py-1.5 text-sm font-black transition ${tab === id ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}
          >
            {id === 'seeds' ? '🌱 씨앗 가게' : '🛠️ 도구'}
          </button>
        ))}
      </div>

      {tab === 'seeds' ? (
        <div className="space-y-1.5">
          {stocked.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-3 text-center text-sm font-bold text-slate-500">다 팔렸어요. 문제를 맞히면 다시 채워져요!</p>
          )}
          {stocked.map((crop) => {
            const rarity = RARITY[crop.rarity]
            return (
              <div key={crop.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${rarity.ring}`}>
                <Image unoptimized width={256} height={256} src={crop.image} alt="" className="h-9 w-9 shrink-0 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                    {crop.label}
                    <span className={`text-[10px] ${rarity.color}`}>{rarity.label}</span>
                    <span className="text-[10px] font-bold text-slate-400">남은 {garden.shop[crop.id]}개</span>
                  </div>
                  <div className="truncate text-[11px] font-bold text-slate-500">{cropSummary(crop.id)}</div>
                </div>
                <PriceButton price={crop.price} coins={garden.coins} onClick={() => onBuySeed(crop.id)} />
              </div>
            )
          })}
          <p className="pt-1 text-center text-[11px] font-bold text-slate-400">문제를 맞힐 때마다 가게가 새로 채워져요</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-lime-200 bg-lime-50 px-2 py-1.5">
            <Image unoptimized width={256} height={256} src="/garden/tile-soil.webp" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">밭 넓히기</div>
              <div className="text-[11px] font-bold text-slate-500">한 칸 더 심을 수 있어요 ({garden.plots.filter((plot) => plot.unlocked).length}/{garden.plots.length}칸)</div>
            </div>
            <PriceButton price={nextExpandPrice(garden)} coins={garden.coins} onClick={onExpand} soldOut={nextExpandPrice(garden) === null ? '다 열었어요' : undefined} />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5">
            <Image unoptimized width={256} height={256} src="/garden/icon-sprinkler.webp" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">스프링클러 {garden.sprinkler > 0 && `Lv.${garden.sprinkler}`}</div>
              <div className="text-[11px] font-bold text-slate-500">
                {sprinklerNext ? `모든 작물이 ${sprinklerNext.speed}배 빨리 자라요` : `지금 ${SPRINKLER_LEVELS[garden.sprinkler].speed}배로 자라요`}
              </div>
            </div>
            <PriceButton price={nextSprinklerPrice(garden)} coins={garden.coins} onClick={onSprinkler} />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
            <Image unoptimized width={256} height={256} src="/garden/scarecrow.webp" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black text-slate-900">허수아비 ({garden.scarecrows}/{GARDEN.SCARECROW_MAX})</div>
              <div className="text-[11px] font-bold text-slate-500">친구가 보낸 까마귀를 한 번 막아 줘요</div>
            </div>
            <PriceButton
              price={GARDEN.SCARECROW_PRICE}
              coins={garden.coins}
              onClick={onScarecrow}
              soldOut={garden.scarecrows >= GARDEN.SCARECROW_MAX ? '가득' : undefined}
            />
          </div>
        </div>
      )}
    </div>
  )
}
