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
    Trophy,
} from 'lucide-react'
import HudMetric from '@/components/game/HudMetric'
import {
    PLAYER_START_HP,
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
    /** 선생님 화면 순위에 올라가는 점수 (누적 획득 골드) */
    score: number
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

/** 코어 체력: 숫자 대신 비율 막대. 50% 아래면 주황, 25% 아래면 빨강으로 바뀌고 맥박처럼 깜빡인다 */
function HpBarMetric({ hp, maxHp }: { hp: number; maxHp: number }) {
    const ratio = Math.max(0, Math.min(1, hp / maxHp))
    const percent = Math.round(ratio * 100)
    const isDanger = ratio <= 0.25
    const isWarning = !isDanger && ratio <= 0.5
    const barColor = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'
    const textColor = isDanger ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-slate-950'
    return (
        <div
            className={`min-w-0 rounded-lg border px-1.5 py-1 shadow-sm backdrop-blur sm:min-w-[108px] sm:px-3 sm:py-2 ${
                isDanger ? 'border-red-200 bg-red-50/[0.85] animate-pulse' : 'border-white/70 bg-white/[0.72]'
            }`}
            role="meter"
            aria-label="코어 체력"
            aria-valuemin={0}
            aria-valuemax={maxHp}
            aria-valuenow={Math.max(0, hp)}
        >
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold tracking-normal text-slate-500 sm:mb-1 sm:text-[11px] sm:tracking-[0.08em]">
                <HeartPulse className="hidden h-3 w-3 shrink-0 text-red-500 sm:block sm:h-3.5 sm:w-3.5" />
                <span className="truncate">코어</span>
            </div>
            <div className={`truncate text-base font-black leading-none tabular-nums sm:text-xl ${textColor}`}>
                {Math.max(0, Math.round(hp))}
                <span className="text-[10px] font-bold text-slate-400 sm:text-xs">/{maxHp}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 sm:mt-1.5 sm:h-2">
                <div
                    className={`h-full rounded-full transition-[width,background-color] duration-300 ease-out ${barColor}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
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
    score,
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
        <header className="mb-3 rounded-lg border border-white/70 bg-white/[0.78] p-2.5 shadow-xl shadow-slate-200/70 backdrop-blur-xl sm:mb-4 sm:p-3">
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
                    <HpBarMetric hp={hp} maxHp={PLAYER_START_HP} />
                    <HudMetric icon={Coins} label="골드" value={gold.toLocaleString()} detail={`${totalGoldEarned.toLocaleString()} 획득`} tone="text-amber-500" />
                    {/* 선생님 화면·결과 순위와 같은 숫자. 예전엔 학생 화면 어디에도 점수가 없었다 */}
                    <HudMetric icon={Trophy} label="점수" value={score.toLocaleString()} detail="선생님 화면 순위" tone="text-emerald-500" />
                    <HudMetric icon={Target} label="웨이브" value={`${Math.min(currentWave + 1, WAVES.length)}/${WAVES.length}`} detail={isWaveActive ? `${waveEnemiesRemaining}마리 남음` : `${waveProgress}% 클리어`} tone="text-indigo-500" />
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
