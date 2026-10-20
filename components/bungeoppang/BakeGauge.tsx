'use client'

import type { GradeZone } from '@/lib/game/bungeoppang'

type BakeGaugeProps = {
  zones: GradeZone[]
  /** 0 ~ 100 */
  value: number
  running: boolean
}

/**
 * 굽기 게이지: 날것 ━ 덜 익음 ━ 맛있음 ━ ★완벽★ ━ 바삭 ━ 탄다🔥
 * 구간 비율은 lib/game/bungeoppang.getGradeZones 가 준다(버터 타임이면 완벽 구간이 넓다).
 */
export default function BakeGauge({ zones, value, running }: BakeGaugeProps) {
  return (
    <div className="w-full select-none">
      <div className="relative">
        <div className="flex h-9 w-full overflow-hidden rounded-xl border-[3px] border-[#1f1a17] shadow-[0_4px_0_rgba(0,0,0,0.35)] sm:h-11">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`relative flex items-center justify-center text-[11px] font-black sm:text-sm ${
                zone.id === 'perfect' ? 'text-white bungeo-perfect-glow' : zone.id === 'burnt' ? 'text-white' : 'text-[#5a3a12]'
              }`}
              style={{ width: `${zone.width}%`, backgroundColor: zone.color }}
            >
              <span className="truncate px-0.5">{zone.id === 'perfect' ? `★${zone.label}★` : zone.label}</span>
            </div>
          ))}
        </div>
        {/* 마커 — 위치는 일반 div 가 맡는다 */}
        <div
          className="pointer-events-none absolute -top-2 bottom-[-8px] w-0"
          style={{ left: `${Math.max(0, Math.min(100, value))}%` }}
        >
          <div className={`absolute left-1/2 top-0 h-full w-[5px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_#1f1a17] ${running ? '' : 'opacity-90'}`} />
          <div className="absolute left-1/2 -top-3 -translate-x-1/2 text-base leading-none">🔻</div>
        </div>
      </div>
      <div className="mt-1 flex justify-between px-0.5 text-[10px] font-bold text-amber-100/80 sm:text-xs">
        <span>날것</span>
        <span>탄다 🔥</span>
      </div>
    </div>
  )
}
