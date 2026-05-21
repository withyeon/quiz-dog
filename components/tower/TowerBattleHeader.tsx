'use client'

import { motion } from 'framer-motion'
import {
    BrainCircuit,
    Coins,
    Crosshair,
    HeartPulse,
    Play,
    ShieldCheck,
    Target,
} from 'lucide-react'
import HudMetric from '@/components/game/HudMetric'
import {
    TOWER_TYPES,
    TowerTypeId,
    WAVES,
} from '@/lib/game/tower'

interface TowerBattleHeaderProps {
    roomCode: string
    selectedTowerType: TowerTypeId | null
    hp: number
    gold: number
    totalGoldEarned: number
    currentWave: number
    isWaveActive: boolean
    waveEnemiesRemaining: number
    waveProgress: number
    occupiedSlotCount: number
    quizHudValue: string
    quizButtonLabel: string
    consecutiveCorrect: number
    isQuizAvailable: boolean
    onQuizClick: () => void
    onStartWave: () => void
}

export default function TowerBattleHeader({
    roomCode,
    selectedTowerType,
    hp,
    gold,
    totalGoldEarned,
    currentWave,
    isWaveActive,
    waveEnemiesRemaining,
    waveProgress,
    occupiedSlotCount,
    quizHudValue,
    quizButtonLabel,
    consecutiveCorrect,
    isQuizAvailable,
    onQuizClick,
    onStartWave,
}: TowerBattleHeaderProps) {
    return (
        <header className="mb-4 rounded-lg border border-white/70 bg-white/78 p-3 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">ROOM {roomCode}</span>
                            {selectedTowerType && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                                    <Crosshair className="h-3.5 w-3.5" />
                                    {TOWER_TYPES[selectedTowerType].name} 배치 중
                                </span>
                            )}
                            {consecutiveCorrect >= 2 && (
                                <motion.span
                                    key={consecutiveCorrect}
                                    initial={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-orange-200"
                                >
                                    🔥 COMBO ×{consecutiveCorrect}
                                </motion.span>
                            )}
                        </div>
                        <h1 className="mt-1 truncate text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                            타워 디펜스
                        </h1>
                    </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex">
                    <HudMetric icon={HeartPulse} label="Core" value={hp} detail="HP" tone="text-red-500" />
                    <HudMetric icon={Coins} label="Gold" value={gold.toLocaleString()} detail={`${totalGoldEarned.toLocaleString()} 획득`} tone="text-amber-500" />
                    <HudMetric icon={Target} label="Wave" value={`${Math.min(currentWave + 1, WAVES.length)} / ${WAVES.length}`} detail={isWaveActive ? `${waveEnemiesRemaining} 대기` : `${waveProgress}% 클리어`} tone="text-indigo-500" />
                    <HudMetric icon={Crosshair} label="Build" value="자유" detail={`${occupiedSlotCount} 배치`} tone="text-emerald-500" />
                    <HudMetric icon={BrainCircuit} label="Quiz" value={quizHudValue} detail="웨이브당 1회" tone="text-sky-500" />
                </div>

                <div className="flex flex-wrap gap-2">
                    <motion.button
                        whileHover={isQuizAvailable ? { y: -1 } : {}}
                        whileTap={isQuizAvailable ? { scale: 0.98 } : {}}
                        onClick={onQuizClick}
                        disabled={!isQuizAvailable}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white shadow-lg shadow-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                        <BrainCircuit className="h-4 w-4" />
                        {quizButtonLabel}
                    </motion.button>

                    {!isWaveActive && currentWave < WAVES.length && (
                        <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onStartWave}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 text-sm font-black text-white shadow-lg shadow-rose-200 transition-colors hover:bg-rose-600"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            웨이브 {currentWave + 1}
                        </motion.button>
                    )}
                </div>
            </div>
        </header>
    )
}
