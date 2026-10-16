import { Clock, Users } from 'lucide-react'
import type { RaidState } from '@/lib/game/raid'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import AnimatedNumber from '@/components/raid/result/AnimatedNumber'
import BossPips from '@/components/raid/result/BossPips'
import { formatTime } from '@/lib/utils/formatTime'

type HeaderStripProps = {
  raidState: RaidState
  /** 남은 초. 게임 중이 아니거나 제한 시간이 없으면 null */
  remaining: number | null
  paused: boolean
}

/**
 * 프로젝터 상단 띠 — 제목, 참가 인원, 처치 현황(펭귄 그림), 반 전체 데미지, 남은 시간.
 * 아래 가는 막대는 펭귄 군단 전체에서 얼마나 막았는지.
 */
export default function HeaderStrip({ raidState, remaining, paused }: HeaderStripProps) {
  const urgent = remaining !== null && remaining <= 30
  return (
    <header className="relative flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 bg-gradient-to-r from-sky-950 via-slate-900 to-sky-950 px-4 py-3 2xl:px-6 2xl:py-4">
      <div className="flex items-center gap-3">
        <img
          src={RAID_SPRITE_SRC.emperor.idle}
          alt=""
          width={36}
          height={45}
          draggable={false}
          className="h-[45px] w-9 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        />
        <div>
          <h2 className="text-2xl font-black leading-none text-white 2xl:text-3xl">황제 펭귄을 막아라!</h2>
          <p className="mt-1.5 flex items-center gap-2 text-xs font-black text-sky-200/80">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            LIVE · 반 전체가 한 파티
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2 2xl:gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-base font-black text-sky-100">
          <Users className="h-4 w-4" /> {raidState.activePlayerCount}명
        </span>

        <span className="inline-flex items-center gap-2.5 rounded-full bg-emerald-400/15 py-1.5 pl-3.5 pr-3 text-base font-black text-emerald-100 ring-1 ring-emerald-300/40">
          처치 {raidState.defeatedCount}/{raidState.roster.length}
          <BossPips bosses={raidState.bosses} width={20} currentIndex={raidState.current?.def.index ?? null} className="gap-1.5" />
        </span>

        <span className="rounded-full bg-amber-300 px-3.5 py-2 text-base font-black text-amber-950">
          반 전체 <AnimatedNumber value={raidState.totalDamage} /> 데미지
        </span>

        {paused ? (
          <span className="rounded-full bg-amber-500/20 px-3.5 py-2 text-base font-black text-amber-200 ring-1 ring-amber-300/50">잠시 멈춤</span>
        ) : (
          remaining !== null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-lg font-black tabular-nums 2xl:text-xl ${
                urgent ? 'animate-pulse bg-rose-500 text-white' : 'bg-white/10 text-sky-100'
              }`}
            >
              <Clock className="h-5 w-5" />
              <span className="text-sm">남은 시간</span>
              {formatTime(remaining)}
            </span>
          )
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10" aria-hidden>
        <div
          className="h-full bg-gradient-to-r from-cyan-300 via-amber-300 to-rose-400 transition-[width] duration-700"
          style={{ width: `${Math.round(raidState.progressRatio * 100)}%` }}
        />
      </div>
    </header>
  )
}
