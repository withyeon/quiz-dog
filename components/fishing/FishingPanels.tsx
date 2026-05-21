'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Clock, Coins, Gift, ShieldCheck, Star, Target, Ticket, Trophy, Zap } from 'lucide-react'
import {
    getAimGradeLabel,
    getAnswerSpeedLabel,
    type Doll,
    type SpecialItemType,
} from '@/lib/game/fishing'
import type { useFishingGame } from '@/hooks/useFishingGame'
import type { Database } from '@/types/database.types'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'

export type FishingPlayer = Database['public']['Tables']['players']['Row'] & {
    caught_dolls?: Doll[]
    claw_points?: number
}

export const ITEM_LABELS: Record<SpecialItemType, string> = {
    DOUBLE_SCORE: '2배 점수',
    LUCKY_BOOST: '행운 부스트',
    COIN_RAIN: '보너스 코인',
    EXTRA_PULL: '복습 티켓',
    SHIELD: '꽝 방지',
}

const COLLECTION_TIER_STYLE: Record<string, string> = {
    일반: 'border-slate-200 bg-white',
    희귀: 'border-sky-200 bg-sky-50',
    영웅: 'border-violet-200 bg-violet-50',
    전설: 'border-amber-200 bg-amber-50',
    꽝: 'border-slate-200 bg-slate-50',
}

function getPlayerDolls(player: FishingPlayer) {
    return Array.isArray(player.caught_dolls) ? (player.caught_dolls as Doll[]) : []
}

export function SpecialItemIcon({
    type,
    size = 14,
    className = '',
}: {
    type: SpecialItemType
    size?: number
    className?: string
}) {
    if (type === 'DOUBLE_SCORE') return <Zap size={size} className={className} />
    if (type === 'LUCKY_BOOST') return <Star size={size} className={className} />
    if (type === 'COIN_RAIN') return <Coins size={size} className={className} />
    if (type === 'EXTRA_PULL') return <Ticket size={size} className={className} />
    if (type === 'SHIELD') return <ShieldCheck size={size} className={className} />
    return <Gift size={size} className={className} />
}

export function CollectionGrid({ dolls }: { dolls: Doll[] }) {
    return (
        <div className="grid max-h-[220px] grid-cols-5 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-7 lg:grid-cols-9">
            {dolls.length === 0 ? (
                <div className="col-span-5 rounded-lg border border-dashed border-sky-200 bg-white/70 py-8 text-center text-sm text-slate-500 sm:col-span-7 lg:col-span-9">
                    아직 획득한 인형이 없어요.
                </div>
            ) : (
                dolls.map((item, index) => (
                    <div
                        key={`${item.id}-${index}`}
                        title={`${item.name} (+${item.score}점)`}
                        className={`group relative flex aspect-square cursor-default items-center justify-center rounded-lg border ${COLLECTION_TIER_STYLE[item.tier] ?? COLLECTION_TIER_STYLE['일반']} shadow-sm`}
                    >
                        {item.image ? (
                            <Image src={item.image} alt={item.name} width={36} height={36} unoptimized className="h-9 w-9 object-contain drop-shadow" />
                        ) : (
                            <Gift size={24} className="text-slate-400" />
                        )}
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-sky-100 bg-white px-2 py-1 text-xs font-bold text-slate-800 shadow-xl group-hover:block">
                            {item.name}
                            <span className="block text-center text-amber-500">+{item.score}점</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export function LeaderboardPanel({ players, playerId }: { players: FishingPlayer[]; playerId: string }) {
    const sorted = [...players].sort((a, b) => ((b as FishingPlayer).claw_points || 0) - ((a as FishingPlayer).claw_points || 0))

    return (
        <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/50">
            <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-800">
                <Trophy size={16} /> 순위
            </h3>
            <div className="space-y-2">
                {sorted.slice(0, 5).map((player, index) => {
                    const typedPlayer = player as FishingPlayer
                    const isMe = player.id === playerId
                    const pts = typedPlayer.claw_points || 0
                    const dolls = getPlayerDolls(typedPlayer)
                    const rankColors = ['text-amber-500', 'text-slate-500', 'text-orange-500']

                    return (
                        <div key={player.id} className={`rounded-lg border p-2.5 ${isMe ? 'border-amber-300 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white/80'}`}>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className={`w-6 text-sm font-black ${rankColors[index] ?? 'text-slate-400'}`}>#{index + 1}</span>
                                    <PlayerAvatarDisplay
                                        avatar={player.avatar}
                                        nickname={player.nickname}
                                        fallback={player.nickname?.slice(0, 1) || 'P'}
                                        className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-100 text-xs font-black text-slate-600"
                                        sizes="28px"
                                    />
                                    <span className="truncate text-sm font-bold text-slate-800">{player.nickname}</span>
                                </div>
                                <div className="shrink-0 text-right">
                                    <div className="text-sm font-black text-slate-900">{pts.toLocaleString()}점</div>
                                    <div className="text-xs text-slate-500">{dolls.length}개</div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function ResultCard({
    fishingResult,
    onClose,
}: {
    fishingResult: NonNullable<ReturnType<typeof useFishingGame>['fishingResult']>
    onClose: () => void
}) {
    const doll = fishingResult.doll
    if (!doll) return null

    const tierLabel: Record<string, string> = {
        일반: '획득 완료',
        희귀: '희귀 인형',
        영웅: '영웅 인형',
        전설: '전설 인형',
    }

    const tierCardStyle: Record<string, string> = {
        일반: 'from-amber-100 via-white to-orange-100 border-amber-300',
        희귀: 'from-sky-100 via-white to-cyan-100 border-sky-300',
        영웅: 'from-violet-100 via-white to-fuchsia-100 border-violet-300',
        전설: 'from-yellow-100 via-white to-amber-200 border-yellow-300',
    }

    const cardStyle = tierCardStyle[doll.tier] ?? tierCardStyle['일반']

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-sky-100/70 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.5, rotate: -6, y: 40 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                className={`relative w-full max-w-sm overflow-hidden rounded-xl border bg-gradient-to-b ${cardStyle} p-6 text-left shadow-xl shadow-slate-200/60`}
                onClick={(event) => event.stopPropagation()}
            >
                <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                    animate={{ x: ['-120%', '120%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                />

                <p className="mb-1 text-center text-sm font-extrabold text-slate-500">
                    {tierLabel[doll.tier] ?? '획득 완료'}
                </p>
                <h2 className="mb-4 text-center text-2xl font-extrabold text-slate-900">{doll.name}</h2>

                <div className="mb-5 flex justify-center">
                    <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        className="flex h-36 w-36 items-center justify-center rounded-xl border border-white bg-white/70 shadow-inner"
                    >
                        {doll.image ? (
                            <Image src={doll.image} alt={doll.name} width={120} height={120} unoptimized className="h-28 w-28 object-contain drop-shadow-2xl" />
                        ) : (
                            <Gift size={76} className="text-slate-400" />
                        )}
                    </motion.div>
                </div>

                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
                        <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                            <Star size={10} /> 점수
                        </div>
                        <div className="text-xl font-black text-slate-900">{doll.score.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
                        <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                            <Clock size={10} /> 속도
                        </div>
                        <div className="text-sm font-black leading-tight text-slate-900">
                            {getAnswerSpeedLabel(fishingResult.speedGrade)}
                        </div>
                    </div>
                    <div className="rounded-lg border border-white bg-white/70 px-2 py-3">
                        <div className="mb-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-500">
                            <Target size={10} /> 조준
                        </div>
                        <div className="text-sm font-black leading-tight text-slate-900">
                            {getAimGradeLabel(fishingResult.aimGrade)}
                        </div>
                    </div>
                </div>

                {fishingResult.bonusPoints > 0 && (
                    <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-100 px-3 py-2 text-center text-sm font-extrabold text-yellow-800">
                        보너스 +{fishingResult.bonusPoints.toLocaleString()}점
                    </div>
                )}

                <button
                    type="button"
                    onClick={onClose}
                    className="mt-1 w-full rounded-lg bg-sky-500 py-3.5 text-center text-base font-extrabold text-white transition-transform hover:bg-sky-400 active:scale-95"
                >
                    계속하기
                </button>
            </motion.div>
        </motion.div>
    )
}
