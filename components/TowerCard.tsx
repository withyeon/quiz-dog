'use client'

import NextImage from 'next/image'
import { motion } from 'framer-motion'
import { Check, Coins, Crosshair, Gauge, Lock, Sparkles, Target } from 'lucide-react'
import { TowerType, TowerTypeId } from '@/lib/game/tower'
import { useState, useEffect } from 'react'

interface TowerCardProps {
    tower: TowerType
    isSelected: boolean
    canAfford: boolean
    disabledLabel?: string
    onSelect: () => void
}

const towerImagePaths: Record<TowerTypeId, string> = {
    BASIC: '/tower/basic.svg',
    MAGIC: '/tower/magic.svg',
    BOMB: '/tower/bomb.svg',
    LASER: '/tower/laser.svg',
    SLOW: '/tower/slow.svg',
}

const towerTone: Record<TowerTypeId, { rail: string; icon: string; selected: string; text: string }> = {
    BASIC: {
        rail: 'bg-emerald-500',
        icon: 'bg-emerald-50 border-emerald-100',
        selected: 'border-emerald-400 ring-2 ring-emerald-100',
        text: 'text-emerald-700',
    },
    MAGIC: {
        rail: 'bg-indigo-500',
        icon: 'bg-indigo-50 border-indigo-100',
        selected: 'border-indigo-400 ring-2 ring-indigo-100',
        text: 'text-indigo-700',
    },
    BOMB: {
        rail: 'bg-rose-500',
        icon: 'bg-rose-50 border-rose-100',
        selected: 'border-rose-400 ring-2 ring-rose-100',
        text: 'text-rose-700',
    },
    LASER: {
        rail: 'bg-sky-500',
        icon: 'bg-sky-50 border-sky-100',
        selected: 'border-sky-400 ring-2 ring-sky-100',
        text: 'text-sky-700',
    },
    SLOW: {
        rail: 'bg-cyan-500',
        icon: 'bg-cyan-50 border-cyan-100',
        selected: 'border-cyan-400 ring-2 ring-cyan-100',
        text: 'text-cyan-700',
    },
}

const specialLabels: Record<string, string> = {
    splash: '범위',
    explosion: '폭발',
    pierce: '관통',
    slow: '둔화',
}

export default function TowerCard({ tower, isSelected, canAfford, disabledLabel = '골드 부족', onSelect }: TowerCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)
    const tone = towerTone[tower.id]
    
    useEffect(() => {
        setImageLoaded(false)
        setImageError(false)
        const img = new window.Image()
        img.src = towerImagePaths[tower.id]
        img.onload = () => setImageLoaded(true)
        img.onerror = () => setImageError(true)
    }, [tower.id])

    return (
        <motion.button
            type="button"
            whileHover={canAfford ? { y: -2 } : {}}
            whileTap={canAfford ? { scale: 0.985 } : {}}
            onClick={canAfford ? onSelect : undefined}
            disabled={!canAfford}
            className={`group relative w-full overflow-hidden rounded-lg border bg-white p-3 text-left shadow-sm transition-all ${isSelected
                ? `${tone.selected} shadow-lg`
                : canAfford
                    ? 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    : 'border-slate-200 opacity-55'
            }`}
        >
            <div className={`absolute inset-y-0 left-0 w-1 ${tone.rail}`} />

            {isSelected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg"
                >
                    <Check className="h-4 w-4" />
                </motion.div>
            )}

            <div className="flex gap-3 pl-1">
                <div className={`flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border ${tone.icon}`}>
                    {imageLoaded && !imageError ? (
                        <NextImage
                            src={towerImagePaths[tower.id]}
                            alt={tower.name}
                            width={64}
                            height={64}
                            unoptimized
                            className="h-14 w-14 object-contain drop-shadow-sm"
                        />
                    ) : (
                        <Target className={`h-8 w-8 ${tone.text}`} />
                    )}
                </div>

                <div className="min-w-0 flex-1 pr-6">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <h3 className="truncate text-base font-black tracking-normal text-slate-950">{tower.name}</h3>
                            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-slate-500">{tower.description}</p>
                        </div>
                        <div className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-black ${canAfford ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                            <Coins className="h-3.5 w-3.5" />
                            {tower.cost}
                        </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Target className="h-3 w-3" />
                                피해
                            </div>
                            <div className="mt-0.5 text-sm font-black text-slate-950">{tower.damage}</div>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Crosshair className="h-3 w-3" />
                                범위
                            </div>
                            <div className="mt-0.5 text-sm font-black text-slate-950">{tower.range}</div>
                        </div>
                        <div className="rounded-md bg-slate-50 px-2 py-1.5">
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                                <Gauge className="h-3 w-3" />
                                속도
                            </div>
                            <div className="mt-0.5 text-sm font-black text-slate-950">{tower.attackSpeed}</div>
                        </div>
                    </div>

                    {tower.special && (
                        <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black ${tone.text}`}>
                            <Sparkles className="h-3 w-3" />
                            {specialLabels[tower.special] || tower.special}
                        </div>
                    )}
                </div>
            </div>

            {!canAfford && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/68 backdrop-blur-[1px]">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white shadow-lg">
                        <Lock className="h-3.5 w-3.5" />
                        {disabledLabel}
                    </div>
                </div>
            )}
        </motion.button>
    )
}
