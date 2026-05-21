'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import { CAFE_ITEMS, type ItemId } from '@/lib/game/cafeItems'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'

type Player = Database['public']['Tables']['players']['Row']

interface CafeDashboardProps {
    players: Player[]
    roomCode: string
    gameStartTime?: number
    duration?: number
}

interface FeedItem {
    id: string
    text: string
    emoji: string
    timestamp: number
}

function formatClock(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export default function CafeDashboard({
    players,
    roomCode,
    gameStartTime,
    duration = 420,
}: CafeDashboardProps) {
    const [feed, setFeed] = useState<FeedItem[]>([])
    const [remaining, setRemaining] = useState(duration)

    const sortedPlayers = useMemo(() => (
        [...players].sort((a, b) => (b.score || 0) - (a.score || 0))
    ), [players])
    const maxScore = sortedPlayers[0]?.score || 1

    useEffect(() => {
        if (!gameStartTime) return

        const interval = window.setInterval(() => {
            setRemaining(Math.max(0, duration - Math.floor((Date.now() - gameStartTime) / 1000)))
        }, 1000)

        return () => window.clearInterval(interval)
    }, [duration, gameStartTime])

    useEffect(() => {
        return subscribeRoomRuntimeEvent((event) => {
            if (event.roomCode !== roomCode || event.type !== 'cafe:item_attack') return

            const payload = event.payload as {
                attackerNickname?: string
                targetId?: string
                itemId?: ItemId
            } | undefined
            if (!payload?.itemId) return

            const item = CAFE_ITEMS[payload.itemId]
            const target = players.find(player => player.id === payload.targetId)
            setFeed(prev => [{
                id: `${Date.now()}-${Math.random()}`,
                emoji: item.emoji,
                text: `${payload.attackerNickname || '누군가'} → ${target?.nickname || '상대'}에게 ${item.name}!`,
                timestamp: Date.now(),
            }, ...prev].slice(0, 10))
        })
    }, [players, roomCode])

    return (
        <section className="overflow-hidden rounded-lg border border-amber-200 bg-orange-50 p-5 shadow-xl">
            <header className="mb-5 flex flex-col gap-3 rounded-lg bg-amber-900 px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-black">☕ 달콤 바삭 카페 LIVE</h2>
                    <p className="text-sm font-bold text-amber-100">실시간 수익 랭킹 중계판</p>
                </div>
                <div className="rounded-full bg-white/15 px-4 py-2 text-lg font-black">
                    남은 시간 {formatClock(remaining)}
                </div>
            </header>

            <div className="space-y-3">
                {sortedPlayers.map((player, index) => {
                    const rank = index + 1
                    const score = player.score || 0
                    const barWidth = Math.max(4, (score / maxScore) * 100)
                    const displayNickname = getPlayerDisplayNickname(player.nickname, player.avatar)

                    return (
                        <motion.div
                            key={player.id}
                            layout
                            className="flex items-center gap-4 rounded-lg bg-white/85 px-4 py-3 shadow-sm"
                        >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-black ${
                                rank === 1 ? 'bg-yellow-400 text-yellow-900'
                                    : rank === 2 ? 'bg-slate-300 text-slate-800'
                                        : rank === 3 ? 'bg-amber-600 text-white'
                                            : 'bg-slate-100 text-slate-600'
                            }`}>
                                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                            </div>

                            <div className="flex w-32 shrink-0 items-center gap-2">
                                <PlayerAvatarDisplay
                                    avatar={player.avatar}
                                    nickname={displayNickname}
                                    fallback="🐕"
                                    className="relative h-9 w-9 overflow-hidden rounded-lg bg-white text-2xl ring-1 ring-amber-100"
                                    sizes="36px"
                                />
                                <span className="truncate text-sm font-black text-slate-900">{displayNickname}</span>
                            </div>

                            <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <motion.div
                                    animate={{ width: `${barWidth}%` }}
                                    transition={{ duration: 0.6, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${
                                        rank === 1
                                            ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                            : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                                    }`}
                                />
                            </div>

                            <div className="w-24 text-right text-lg font-black text-slate-900">
                                ${score.toLocaleString()}
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <div className="mt-5 rounded-lg bg-white/80 p-4">
                <h3 className="mb-3 font-black text-slate-900">이벤트 피드</h3>
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                        {feed.map(item => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 16 }}
                                className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-slate-800"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.text}</span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
