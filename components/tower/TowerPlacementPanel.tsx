'use client'

import { Wrench } from 'lucide-react'
import TowerCard from '@/components/TowerCard'
import { TOWER_TYPES, TowerTypeId } from '@/lib/game/tower'

interface TowerPlacementPanelProps {
    gold: number
    selectedTowerType: TowerTypeId | null
    onSelectTowerType: (towerType: TowerTypeId) => void
}

export default function TowerPlacementPanel({
    gold,
    selectedTowerType,
    onSelectTowerType,
}: TowerPlacementPanelProps) {
    return (
        <section className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-base font-black text-slate-950">
                        <Wrench className="h-4 w-4 text-indigo-500" />
                        타워 배치
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">길 위와 기존 타워 주변을 피해 자유롭게 설치하세요.</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                    <div className="text-[10px] font-black tracking-[0.08em] text-amber-700">골드</div>
                    <div className="text-lg font-black text-amber-900">{gold.toLocaleString()}</div>
                </div>
            </div>
            <div className="space-y-3">
                {Object.values(TOWER_TYPES).map(tower => (
                    <TowerCard
                        key={tower.id}
                        tower={tower}
                        isSelected={selectedTowerType === tower.id}
                        canAfford={gold >= tower.cost}
                        disabledLabel="골드 부족"
                        onSelect={() => onSelectTowerType(tower.id)}
                    />
                ))}
            </div>
        </section>
    )
}
