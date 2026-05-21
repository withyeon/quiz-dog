'use client'

import { Swords } from 'lucide-react'
import { WAVES } from '@/lib/game/tower'

interface TowerWavePanelProps {
    currentWave: number
    isWaveActive: boolean
    nextWaveRoster: string
    waveProgress: number
}

export default function TowerWavePanel({
    currentWave,
    isWaveActive,
    nextWaveRoster,
    waveProgress,
}: TowerWavePanelProps) {
    const hasNextWave = currentWave < WAVES.length

    return (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-white/70 bg-white/68 px-4 py-3 shadow-lg shadow-slate-200/60 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div>
                <div className="flex items-center gap-2 text-sm font-black text-slate-950">
                    <Swords className="h-4 w-4 text-rose-500" />
                    {isWaveActive ? `웨이브 ${currentWave + 1} 진행 중` : hasNextWave ? `다음 웨이브 ${currentWave + 1}` : '최종 결과'}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{nextWaveRoster}</p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 lg:w-56">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-400 transition-all duration-500"
                    style={{ width: `${waveProgress}%` }}
                />
            </div>
        </div>
    )
}
