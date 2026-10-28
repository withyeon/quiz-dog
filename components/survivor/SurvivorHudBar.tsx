'use client'

import { SKILLS, SKILL_MAX_LEVEL, WEAPON_IDS, PASSIVE_IDS, formatBattleTime, type SkillId } from '@/lib/game/survivor'
import type { SurvivorHud } from '@/hooks/useSurvivorGame'
import SkillIcon from '@/components/survivor/SkillIcon'

type SurvivorHudBarProps = {
  hud: SurvivorHud
  nickname: string
  rank: number | null
  total: number
}

/**
 * 전투 화면 위에 겹치는 숫자판: 왼쪽 위 레벨·경험치, 오른쪽 위 점수·순위, 아래 스킬 칸, 보스 체력.
 * 가운데 위는 GameTimeBadge(남은 시간) 자리라 비워 둔다 — 폰은 좁아서 양쪽 칸을 그 아래로 내린다.
 */
export default function SurvivorHudBar({ hud, nickname, rank, total }: SurvivorHudBarProps) {
  const xpRatio = hud.xpNeed > 0 ? Math.min(1, hud.xp / hud.xpNeed) : 0
  const owned = [...WEAPON_IDS, ...PASSIVE_IDS].filter((id) => (hud.skills[id] ?? 0) > 0) as SkillId[]

  return (
    <div className="pointer-events-none absolute inset-0 z-20 font-bitbit">
      {/* 경험치 막대 (맨 위 가로 전체) */}
      <div className="absolute inset-x-0 top-0 h-2.5 bg-slate-900/50 sm:h-3">
        <div className="h-full bg-gradient-to-r from-cyan-300 to-sky-500 transition-[width] duration-200" style={{ width: `${xpRatio * 100}%` }} />
      </div>

      <div className="absolute left-2 top-11 flex items-center gap-2 sm:left-3 sm:top-5">
        <div className="rounded-xl border-2 border-slate-900 bg-yellow-300 px-2.5 py-1 text-base font-black text-slate-900 shadow-[0_3px_0_#0f172a] sm:text-xl">
          Lv.{hud.level}
        </div>
        <div className="rounded-xl bg-slate-900/70 px-2.5 py-1 text-xs font-black text-white sm:text-sm">
          <div className="max-w-[7rem] truncate sm:max-w-[10rem]">{nickname}</div>
          <div className="tabular-nums text-cyan-200">⏱ {formatBattleTime(hud.battleMs)}</div>
        </div>
      </div>

      <div className="absolute right-2 top-11 flex flex-col items-end gap-1 sm:right-3 sm:top-5">
        <div className="rounded-xl border-2 border-slate-900 bg-white px-3 py-1 text-right shadow-[0_3px_0_#0f172a]">
          <div className="text-[10px] font-black text-slate-500">점수</div>
          <div className="tabular-nums text-lg font-black leading-none text-slate-900 sm:text-2xl">{hud.score.toLocaleString()}</div>
        </div>
        <div className="flex gap-1">
          <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-black text-white tabular-nums">⚔️ {hud.kills.toLocaleString()}</span>
          {rank !== null && total > 1 && (
            <span className="rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-black text-yellow-200 tabular-nums">🏅 {rank}/{total}등</span>
          )}
        </div>
      </div>

      {hud.boss && (
        <div className="absolute left-1/2 top-28 w-[min(420px,80vw)] -translate-x-1/2 sm:top-16">
          <div className="mb-0.5 text-center text-xs font-black text-white [text-shadow:0_1px_2px_#0f172a] sm:text-sm">👑 대왕 슬라임</div>
          <div className="h-3 overflow-hidden rounded-full border-2 border-slate-900 bg-slate-900/60">
            <div className="h-full bg-rose-500 transition-[width] duration-200" style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-2 flex justify-center px-2 sm:bottom-3">
        <div className="flex flex-wrap justify-center gap-1 rounded-2xl bg-slate-900/55 p-1.5">
          {owned.map((id) => (
            <div key={id} className="relative h-9 w-9 rounded-lg bg-white/90 p-1 sm:h-11 sm:w-11" title={SKILLS[id].label}>
              <SkillIcon id={id} className="h-full w-full" />
              <span className={`absolute -bottom-1 -right-1 rounded-md px-1 text-[10px] font-black leading-tight ${hud.skills[id] === SKILL_MAX_LEVEL ? 'bg-yellow-300 text-slate-900' : 'bg-slate-900 text-white'}`}>
                {hud.skills[id] === SKILL_MAX_LEVEL ? 'MAX' : hud.skills[id]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
