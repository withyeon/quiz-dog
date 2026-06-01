'use client'

import { motion } from 'framer-motion'
import { Coins, HeartPulse, ShieldCheck, Target } from 'lucide-react'
import {
    PLAYER_START_GOLD,
    PLAYER_START_HP,
    TOWER_TYPES,
    WAVES,
} from '@/lib/game/tower'

interface TowerLobbyPanelProps {
    roomCode: string
}

export default function TowerLobbyPanel({ roomCode }: TowerLobbyPanelProps) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-[calc(100dvh-40px)] items-center justify-center"
        >
            <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
                <div className="p-8 sm:p-10">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800">
                        <ShieldCheck className="h-4 w-4" />
                        전략 퀴즈 모드
                    </div>
                    <h1 className="text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl">
                        타워 디펜스
                    </h1>
                    <p className="mt-4 max-w-xl text-base font-semibold leading-relaxed text-slate-600">
                        정답으로 자원을 확보하고, 방어선을 설계해 마지막 웨이브까지 코어를 지키세요.
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <Target className="mb-3 h-5 w-5 text-rose-500" />
                            <div className="text-2xl font-black text-slate-950">{WAVES.length}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">웨이브</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <Coins className="mb-3 h-5 w-5 text-amber-500" />
                            <div className="text-2xl font-black text-slate-950">{PLAYER_START_GOLD}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">시작 골드</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <HeartPulse className="mb-3 h-5 w-5 text-red-500" />
                            <div className="text-2xl font-black text-slate-950">{PLAYER_START_HP}</div>
                            <div className="mt-1 text-xs font-bold text-slate-500">코어 체력</div>
                        </div>
                    </div>

                    <p className="mt-8 text-sm font-bold text-slate-500">선생님이 게임을 시작하면 작전이 열립니다.</p>
                </div>

                <div className="relative min-h-[360px] overflow-hidden bg-[#172323]">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
                    <div className="absolute left-8 top-10 h-16 w-16 rounded-lg border border-emerald-300/50 bg-emerald-300/20 shadow-[0_0_40px_rgba(52,211,153,0.18)]" />
                    <div className="absolute right-10 bottom-12 h-20 w-20 rounded-lg border border-rose-300/50 bg-rose-300/20 shadow-[0_0_40px_rgba(251,113,133,0.18)]" />
                    <div className="absolute left-[-30px] top-[128px] h-16 w-[76%] rotate-[18deg] rounded-full bg-[#c8b08b] shadow-2xl" />
                    <div className="absolute right-[-45px] top-[210px] h-16 w-[70%] -rotate-[13deg] rounded-full bg-[#c8b08b] shadow-2xl" />
                    <div className="absolute left-1/2 top-1/2 grid w-[74%] -translate-x-1/2 -translate-y-1/2 grid-cols-3 gap-4">
                        {Object.values(TOWER_TYPES).slice(0, 3).map(tower => (
                            <div key={tower.id} className="rounded-lg border border-white/12 bg-white/10 p-4 shadow-2xl backdrop-blur">
                                <div className="text-xs font-bold text-white/55">{tower.cost}G</div>
                                <div className="mt-1 text-sm font-black text-white">{tower.name}</div>
                            </div>
                        ))}
                    </div>
                    <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-lg border border-white/12 bg-black/24 px-4 py-3 text-xs font-bold text-white/70 backdrop-blur">
                        <span>방 {roomCode}</span>
                        <span>코어 작동 중</span>
                    </div>
                </div>
            </div>
        </motion.section>
    )
}
