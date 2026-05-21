'use client'

import type { ReactNode } from 'react'
import { Coffee, Shield, Snowflake, Zap, type LucideIcon } from 'lucide-react'
import { PLAYER_CLASSES, type PlayerClass } from '@/lib/game/battleRoyale'

export const CLASS_BADGES: Record<PlayerClass, { Icon: LucideIcon; tone: string }> = {
    ice_fist: { Icon: Snowflake, tone: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
    rapid_fire: { Icon: Zap, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
    shield: { Icon: Shield, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    hot_choco: { Icon: Coffee, tone: 'text-rose-700 bg-rose-50 border-rose-200' },
}

export function getReloadDelay(playerClass: PlayerClass | null) {
    const attackSpeed = playerClass ? PLAYER_CLASSES[playerClass].attackSpeed : 1
    return Math.max(700, Math.round(1400 / attackSpeed))
}

export function HudTile({
    icon,
    label,
    value,
    detail,
    tone = 'default',
}: {
    icon: ReactNode
    label: string
    value: string
    detail?: string
    tone?: 'default' | 'warm' | 'good' | 'danger'
}) {
    const toneClass = {
        default: 'border-slate-200 bg-white/[0.68] text-slate-900',
        warm: 'border-amber-200 bg-amber-50 text-amber-950',
        good: 'border-teal-200 bg-teal-50 text-teal-950',
        danger: 'border-rose-200 bg-rose-50 text-rose-950',
    }[tone]

    return (
        <div className={`rounded-[8px] border px-3 py-2 shadow-sm ${toneClass}`}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                {icon}
                {label}
            </div>
            <div className="text-xl font-black leading-tight text-slate-950 tabular-nums">{value}</div>
            {detail && <div className="mt-0.5 text-[11px] font-bold text-slate-500">{detail}</div>}
        </div>
    )
}
