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
import QuizSetName from '@/components/game/QuizSetName'

interface TowerBattleHeaderProps {
    roomCode: string
    questionSetTitle: string | null
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
    quizHudDetail: string
    quizButtonLabel: string
    consecutiveCorrect: number
    isQuizAvailable: boolean
    canStartWave: boolean
    startWaveButtonLabel: string
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
    quizHudDetail,
    questionSetTitle,
    quizButtonLabel,
    consecutiveCorrect,
    isQuizAvailable,
    canStartWave,
    startWaveButtonLabel,
    onQuizClick,
    onStartWave,
}: TowerBattleHeaderProps) {
    // 폰에서 헤더가 320px(화면 절반)을 차지하던 문제: 제목 축소, HUD 5개를 항상 한 줄
    return (
        <header className="mb-3 rounded-lg border border-white/70 bg-white/78 p-2.5 shadow-xl shadow-slate-200/70 backdrop-blur-xl sm:mb-4 sm:p-3">
            <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg sm:h-12 sm:w-12">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">방 {roomCode}</span>
                            <QuizSetName title={questionSetTitle} />
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
                                    🔥 {consecutiveCorrect}연속!
                                </motion.span>
                            )}
                        </div>
                        <h1 className="mt-0.5 truncate text-xl font-black tracking-normal text-slate-950 sm:mt-1 sm:text-3xl">
                            타워 디펜스
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-2 xl:flex">
                    <HudMetric icon={HeartPulse} label="코어" value={hp} detail="체력" tone="text-red-500" />
                    <HudMetric icon={Coins} label="골드" value={gold.toLocaleString()} detail={`${totalGoldEarned.toLocaleString()} 획득`} tone="text-amber-500" />
                    <HudMetric icon={Target} label="웨이브" value={`${Math.min(currentWave + 1, WAVES.length)}/${WAVES.length}`} detail={isWaveActive ? `${waveEnemiesRemaining}마리 남음` : `${waveProgress}% 클리어`} tone="text-indigo-500" />
                    <HudMetric icon={Crosshair} label="배치" value="자유" detail={`${occupiedSlotCount}개 설치`} tone="text-emerald-500" />
                    <HudMetric icon={BrainCircuit} label="퀴즈" value={quizHudValue} detail={quizHudDetail} tone="text-sky-500" />
                </div>

                <div className="flex flex-wrap gap-2">
                    <motion.button
                        whileHover={isQuizAvailable ? { y: -1 } : {}}
                        whileTap={isQuizAvailable ? { scale: 0.98 } : {}}
                        onClick={onQuizClick}
                        disabled={!isQuizAvailable}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-black text-white shadow-lg shadow-slate-300 sm:h-11 sm:px-4 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                        <BrainCircuit className="h-4 w-4" />
                        {quizButtonLabel}
                    </motion.button>

                    {!isWaveActive && currentWave < WAVES.length && (
                        <motion.button
                            whileHover={canStartWave ? { y: -1 } : {}}
                            whileTap={canStartWave ? { scale: 0.98 } : {}}
                            onClick={onStartWave}
                            disabled={!canStartWave}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-500 px-3 text-sm font-black text-white shadow-lg shadow-rose-200 sm:h-11 sm:px-4 transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-slate-200"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            {startWaveButtonLabel}
                        </motion.button>
                    )}
                </div>
            </div>
        </header>
    )
}
