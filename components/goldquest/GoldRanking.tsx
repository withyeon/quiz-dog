'use client'

import Image from 'next/image'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import type { GoldQuestPlayer } from '@/hooks/useGoldQuestGame'

type Props = {
  rankedPlayers: GoldQuestPlayer[]
  leaderGold: number
  playerId: string
}

/** 골드 순위표. 1등 골드를 기준으로 각 줄의 배경을 채운다. */
export default function GoldRanking({ rankedPlayers, leaderGold, playerId }: Props) {
  return (
    <section className="gold-quest-ink-panel p-4 sm:p-5 text-[#17262a]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="gold-quest-title flex items-center gap-2 text-xl font-black">
          <Image src="/trophy.webp" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
          골드 순위
        </h2>
        <div className="text-xs font-bold text-slate-500">{rankedPlayers.length}명 참가</div>
      </div>
      <div className="grid gap-2">
        {rankedPlayers.map((player, index) => {
          const isTopPlayer = index === 0
          const isCurrent = player.id === playerId
          const gold = player.gold ?? 0
          const fill = Math.max(6, Math.round((gold / leaderGold) * 100))
          return (
            <div
              key={player.id}
              className={`relative overflow-hidden rounded-lg border p-3 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ${
                isCurrent
                  ? 'border-amber-300/70 bg-amber-100/45'
                  : isTopPlayer
                    ? 'border-red-200/70 bg-red-100/40'
                    : 'gold-quest-glass-chip'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-200/40 to-transparent"
                style={{ width: `${fill}%` }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                    isTopPlayer ? 'bg-red-500 text-white' : 'border border-white/50 bg-white/35 text-slate-700 backdrop-blur-sm'
                  }`}>
                    {index + 1}
                  </div>
                  <PlayerAvatarDisplay
                    avatar={player.avatar}
                    nickname={player.nickname}
                    fallback="P"
                    className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/55 bg-white/35 text-2xl backdrop-blur-sm"
                    sizes="40px"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-black">{player.nickname}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-[#163238]">
                          나
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5 text-lg font-black text-amber-700 tabular-nums">
                    <Image src="/gold-quest/gold-stack.webp" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                    {gold}
                  </div>
                  <div className="text-xs font-bold text-slate-500">골드</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
