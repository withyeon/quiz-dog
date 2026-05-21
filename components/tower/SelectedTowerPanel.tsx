'use client'

import {
    ArrowUpCircle,
    Crosshair,
    Gauge,
    MousePointer2,
    Trash2,
    TrendingUp,
} from 'lucide-react'
import {
    Tower,
    TOWER_TYPES,
    getTowerDamage,
    getTowerRange,
} from '@/lib/game/tower'

interface SelectedTowerPanelProps {
    selectedTower: Tower | null
    gold: number
    selectedUpgradeCost: number | null
    selectedSellValue: number
    totalTowersPlaced: number
    totalEnemiesKilled: number
    onUpgradeTower: () => void
    onSellTower: () => void
}

export default function SelectedTowerPanel({
    selectedTower,
    gold,
    selectedUpgradeCost,
    selectedSellValue,
    totalTowersPlaced,
    totalEnemiesKilled,
    onUpgradeTower,
    onSellTower,
}: SelectedTowerPanelProps) {
    const selectedTowerMeta = selectedTower ? TOWER_TYPES[selectedTower.type] : null

    return (
        <section className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
            {selectedTower && selectedTowerMeta ? (
                <>
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Selected</div>
                            <h2 className="mt-1 text-xl font-black text-slate-950">{selectedTowerMeta.name}</h2>
                        </div>
                        <div className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white">
                            Lv.{selectedTower.level}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <TrendingUp className="mb-2 h-4 w-4 text-rose-500" />
                            <div className="text-lg font-black text-slate-950">{getTowerDamage(selectedTower.type, selectedTower.level)}</div>
                            <div className="text-[11px] font-bold text-slate-500">피해</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <Crosshair className="mb-2 h-4 w-4 text-indigo-500" />
                            <div className="text-lg font-black text-slate-950">{getTowerRange(selectedTower.type, selectedTower.level)}</div>
                            <div className="text-[11px] font-bold text-slate-500">범위</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <Gauge className="mb-2 h-4 w-4 text-emerald-500" />
                            <div className="text-lg font-black text-slate-950">{TOWER_TYPES[selectedTower.type].attackSpeed}</div>
                            <div className="text-[11px] font-bold text-slate-500">속도</div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <button
                            onClick={onUpgradeTower}
                            disabled={!selectedUpgradeCost || gold < selectedUpgradeCost}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-black text-white shadow-lg shadow-indigo-100 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                        >
                            <ArrowUpCircle className="h-4 w-4" />
                            {selectedUpgradeCost ? `${selectedUpgradeCost}G` : 'MAX'}
                        </button>
                        <button
                            onClick={onSellTower}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            {selectedSellValue}G
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex min-h-[170px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                    <MousePointer2 className="mb-3 h-7 w-7 text-slate-400" />
                    <div className="text-base font-black text-slate-800">선택된 타워 없음</div>
                    <div className="mt-1 text-xs font-bold text-slate-500">{totalTowersPlaced}개 배치 · {totalEnemiesKilled} 처치</div>
                </div>
            )}
        </section>
    )
}
