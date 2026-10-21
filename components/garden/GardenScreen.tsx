'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import Leaderboard from '@/components/Leaderboard'
import IsoGarden from '@/components/garden/IsoGarden'
import SeedBag from '@/components/garden/SeedBag'
import GardenShop from '@/components/garden/GardenShop'
import { GARDEN, isRipe } from '@/lib/game/garden'
import type { useGardenGame } from '@/hooks/useGardenGame'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type GardenGame = ReturnType<typeof useGardenGame>

type GardenScreenProps = {
  game: GardenGame
  players: Player[]
  playerId: string | null
  disabled?: boolean
}

/**
 * 밭 화면(정답 카드를 고른 뒤 GARDEN.VISIT_MS 동안): 쿼터뷰 밭 + 씨앗 가방 + 가게.
 * 「다음 문제」를 누르거나 시간이 다 되면 훅이 다음 문제로 넘긴다.
 */
export default function GardenScreen({ game, players, playerId, disabled = false }: GardenScreenProps) {
  const { garden, visitLeftMs, activeCrow } = game
  const ripeCount = garden.plots.filter((plot) => isRipe(plot, garden.clockMs)).length
  const visitRatio = visitLeftMs / GARDEN.VISIT_MS

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="relative overflow-hidden rounded-2xl border-4 border-white/80 bg-gradient-to-b from-sky-300 via-sky-200 to-lime-200 p-2 shadow-2xl sm:p-4">
        {/* 위 막대: 남은 시간 · 모두 수확 · 다음 문제 */}
        <div className="relative z-[150] flex flex-wrap items-center gap-2">
          <div className="flex min-w-[140px] flex-1 items-center gap-2 rounded-xl bg-white/85 px-3 py-2 shadow">
            <span className="shrink-0 text-xs font-black text-slate-600 sm:text-sm">⏰ 밭 시간</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${visitRatio < 0.25 ? 'bg-red-500' : 'bg-lime-500'}`}
                style={{ width: `${Math.round(visitRatio * 100)}%` }}
              />
            </div>
            <span className="shrink-0 whitespace-nowrap text-right text-sm font-black text-slate-800">{Math.ceil(visitLeftMs / 1000)}초</span>
          </div>
          <button
            type="button"
            onClick={game.harvestEverything}
            disabled={disabled || ripeCount === 0}
            className="rounded-xl bg-yellow-300 px-3 py-2 text-sm font-black text-yellow-950 shadow-[0_4px_0_#a16207] transition active:translate-y-0.5 active:shadow-none disabled:bg-white/70 disabled:text-slate-400 disabled:shadow-none"
          >
            🧺 모두 수확{ripeCount > 0 && ` ${ripeCount}`}
          </button>
          <button
            type="button"
            onClick={game.leaveGarden}
            disabled={disabled || Boolean(activeCrow)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white shadow-[0_4px_0_#020617] transition active:translate-y-0.5 active:shadow-none disabled:opacity-50"
          >
            다음 문제 →
          </button>
        </div>

        <AnimatePresence>
          {game.raining && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="relative z-[150] mt-2 rounded-xl bg-sky-700/85 px-3 py-1.5 text-center text-sm font-black text-white"
            >
              🌧️ 비가 와요! 쑥쑥 자라고, 다 자란 작물이 💧촉촉해질 수도 있어요
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mx-auto mt-1 max-w-[620px]">
          <IsoGarden
            garden={garden}
            raining={game.raining}
            interactive={!disabled}
            activeCrow={activeCrow}
            floats={game.floats}
            onTapPlot={game.tapPlot}
            onTapCrow={game.tapCrow}
            onExpand={game.purchaseExpansion}
          />
          <Image unoptimized width={256} height={256}
            src="/garden/farmer.webp"
            alt=""
            className="pointer-events-none absolute bottom-0 left-0 h-auto w-[17%] max-w-[110px] drop-shadow-lg"
          />
        </div>

        {activeCrow && (
          <div className="relative z-[150] mt-1 rounded-xl bg-red-600 px-3 py-2 text-center text-sm font-black text-white shadow-lg ramen-blink sm:text-base">
            🐦 {activeCrow.fromName}의 까마귀다! 까마귀를 {GARDEN.CROW_SHOO_TAPS}번 톡톡 눌러 쫓아요
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-3">
        <SeedBag seeds={garden.seeds} selected={game.selectedSeed} onSelect={game.setSelectedSeed} />
        <GardenShop
          garden={garden}
          onBuySeed={game.purchaseSeed}
          onExpand={game.purchaseExpansion}
          onSprinkler={game.purchaseSprinkler}
          onScarecrow={game.purchaseScarecrow}
        />
        <Leaderboard compact players={players} currentPlayerId={playerId} sortBy="score" gameMode="garden" title="🌱 번 돈 순위" />
      </aside>
    </div>
  )
}
