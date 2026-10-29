'use client'

import { BONE_RUSH, formatPlayTime } from '@/lib/game/boneRush'
import type { BoneRushHud } from '@/hooks/useBoneRushGame'

type BoneRushHudBarProps = {
  hud: BoneRushHud
  nickname: string
  rank: number | null
  total: number
}

/**
 * 마당 위에 겹치는 숫자판: 왼쪽 위 뼈다귀 수·울타리, 오른쪽 위 순위·시간, 아래 자석·고양이 경고.
 * 가운데 위는 GameTimeBadge(남은 시간) 자리라 비워 둔다 — 폰은 좁아서 양쪽 칸을 그 아래로 내린다.
 */
export default function BoneRushHudBar({ hud, nickname, rank, total }: BoneRushHudBarProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 font-bitbit">
      <div className="absolute left-2 top-11 flex items-center gap-2 sm:left-3 sm:top-4">
        <div className="rounded-xl border-2 border-slate-900 bg-yellow-300 px-3 py-1 shadow-[0_3px_0_#0f172a]">
          <div className="text-[10px] font-black text-slate-700">내 뼈다귀</div>
          <div className="tabular-nums text-xl font-black leading-none text-slate-900 sm:text-3xl">🦴 {hud.bones.toLocaleString()}</div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="rounded-xl bg-slate-900/70 px-2.5 py-1 text-xs font-black text-white sm:text-sm">
            <div className="max-w-[7rem] truncate sm:max-w-[10rem]">{nickname}</div>
          </div>
          <div className="flex gap-0.5" title={`울타리 ${hud.fences}/${BONE_RUSH.FENCE_MAX}`}>
            {Array.from({ length: BONE_RUSH.FENCE_MAX }, (_, i) => (
              <span key={i} className={`flex h-6 w-6 items-center justify-center rounded-md border-2 border-slate-900 text-xs ${i < hud.fences ? 'bg-amber-400' : 'bg-white/40 opacity-50'}`}>🛡️</span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-11 flex flex-col items-end gap-1 sm:right-3 sm:top-4">
        {rank !== null && total > 1 && (
          <div className="rounded-xl border-2 border-slate-900 bg-white px-3 py-1 text-right shadow-[0_3px_0_#0f172a]">
            <div className="text-[10px] font-black text-slate-500">순위</div>
            <div className="tabular-nums text-lg font-black leading-none text-slate-900 sm:text-2xl">{rank}/{total}등</div>
          </div>
        )}
        <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-black text-cyan-200 tabular-nums">⏱ {formatPlayTime(hud.playMs)}</span>
      </div>

      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2 px-2 sm:bottom-3">
        {hud.magnetMs > 0 && (
          <span className="rounded-full bg-sky-500 px-3 py-1 text-xs font-black text-white shadow sm:text-sm">🧲 자석 {Math.ceil(hud.magnetMs / 1000)}초</span>
        )}
        {hud.cats > 0 && (
          <span className="animate-pulse rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white shadow sm:text-sm">😼 고양이 {hud.cats}마리! 도망쳐요</span>
        )}
      </div>
    </div>
  )
}
