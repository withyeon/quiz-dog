'use client'

import Image from 'next/image'
import { CROP_BY_ID, RARITY, type RewardCard } from '@/lib/game/garden'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type RewardCardsProps = {
  cards: RewardCard[]
  choosingCrowTarget: boolean
  targets: Player[]
  onPick: (index: number) => void
  onSendCrow: (playerId: string) => void
  onCancelCrow: () => void
}

/** 작물 한 줄 설명: "18초 · 22코인" / 여러 번 열리면 "×5번" / 끝없이 열리면 "계속 열려요" */
export function cropSummary(cropId: keyof typeof CROP_BY_ID): string {
  const def = CROP_BY_ID[cropId]
  const harvest = def.harvests === 0 ? ' · 계속 열려요' : def.harvests > 1 ? ` · ${def.harvests}번 열려요` : ''
  return `${Math.round(def.growMs / 1000)}초 · ${def.value.toLocaleString()}코인${harvest}`
}

/**
 * 정답 보상: 무료 카드 3장 중 하나 고르기. 까마귀 카드를 고르면 보낼 친구를 고른다.
 */
export default function RewardCards({ cards, choosingCrowTarget, targets, onPick, onSendCrow, onCancelCrow }: RewardCardsProps) {
  if (choosingCrowTarget) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border-4 border-slate-800 bg-white/95 p-5 shadow-2xl sm:p-7">
        <div className="flex items-center gap-3">
          <Image unoptimized width={256} height={256} src="/garden/crow.webp" alt="" className="h-16 w-16 object-contain" />
          <div>
            <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">누구 밭에 보낼까요?</h2>
            <p className="text-sm font-bold text-slate-500 break-keep">친구가 3번 톡톡 눌러 쫓지 못하면, 가장 많이 자란 작물이 처음부터 다시 자라요.</p>
          </div>
        </div>
        <div className="mt-5 grid max-h-[46vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {targets.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSendCrow(player.id)}
              className="truncate rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-3 text-base font-black text-slate-800 shadow-[0_4px_0_#cbd5e1] transition hover:-translate-y-0.5 hover:border-slate-800 active:translate-y-0.5 active:shadow-none"
            >
              {player.nickname}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancelCrow} className="mt-4 text-sm font-bold text-slate-500 underline underline-offset-2">
          다른 카드 고르기
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 text-center">
        <h2 className="text-3xl font-black text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.35)] sm:text-4xl">정답! 하나를 골라요</h2>
        <p className="mt-1 text-sm font-bold text-white/85 sm:text-base">고르면 씨앗 가게도 새로 채워져요</p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {cards.map((card, index) => {
          if (card.kind === 'crow') {
            return (
              <button
                key={index}
                type="button"
                onClick={() => onPick(index)}
                className="garden-card-pop flex flex-col items-center rounded-2xl border-4 border-slate-800 bg-slate-700 p-2 text-white shadow-[0_6px_0_#0f172a] transition hover:-translate-y-1 sm:p-4"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black sm:text-xs">방해</span>
                <Image unoptimized width={256} height={256} src="/garden/crow.webp" alt="" className="my-2 h-20 w-20 object-contain sm:h-28 sm:w-28" />
                <span className="text-base font-black break-keep sm:text-xl">까마귀 보내기</span>
                <span className="mt-1 text-[11px] font-bold text-slate-300 break-keep sm:text-xs">친구 밭의 작물을 콕!</span>
              </button>
            )
          }
          const def = CROP_BY_ID[card.cropId]
          const rarity = RARITY[def.rarity]
          return (
            <button
              key={index}
              type="button"
              onClick={() => onPick(index)}
              className={`garden-card-pop flex flex-col items-center rounded-2xl border-4 p-2 shadow-[0_6px_0_rgba(0,0,0,0.25)] transition hover:-translate-y-1 sm:p-4 ${rarity.ring}`}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span className={`rounded-full bg-white px-2 py-0.5 text-[10px] font-black sm:text-xs ${rarity.color}`}>{rarity.label}</span>
              <Image unoptimized width={256} height={256} src={def.image} alt="" className="my-2 h-20 w-20 object-contain sm:h-28 sm:w-28" />
              <span className="text-base font-black text-slate-900 sm:text-xl">
                {def.label} 씨앗{card.count > 1 ? ` ×${card.count}` : ''}
              </span>
              <span className="mt-1 text-[11px] font-bold text-slate-500 break-keep sm:text-xs">{cropSummary(def.id)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
