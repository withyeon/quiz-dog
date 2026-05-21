'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

interface BattleRoyaleDashboardProps {
    players: Player[]
    zoneLevel?: number
    gameStartTime?: number
}

interface FeedItem {
    id: string
    attackerNickname: string
    targetNickname: string
    damage: number
    isCritical: boolean
    timestamp: number
    type: 'attack' | 'eliminated' | 'zone'
}

function formatTime(seconds: number) {
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function getHealthColor(healthPct: number) {
    if (healthPct > 60) return 'from-emerald-400 to-green-500'
    if (healthPct > 30) return 'from-yellow-300 to-orange-400'
    return 'from-rose-400 to-red-600'
}

export default function BattleRoyaleDashboard({
    players,
    zoneLevel = 1,
    gameStartTime,
}: BattleRoyaleDashboardProps) {
    const [feed, setFeed] = useState<FeedItem[]>([])
    const [elapsed, setElapsed] = useState(0)
    const previousPlayersRef = useRef<Map<string, Player>>(new Map())

    const sortedPlayers = useMemo(() => (
        [...players].sort((a, b) => (b.health ?? 100) - (a.health ?? 100))
    ), [players])
    const aliveCount = sortedPlayers.filter((player) => (player.health ?? 100) > 0).length

    useEffect(() => {
        if (!gameStartTime) return

        const interval = window.setInterval(() => {
            setElapsed(Math.floor((Date.now() - gameStartTime) / 1000))
        }, 1000)

        return () => window.clearInterval(interval)
    }, [gameStartTime])

    useEffect(() => {
        const previousPlayers = previousPlayersRef.current
        const nextFeed: FeedItem[] = []

        players.forEach((player) => {
            const previous = previousPlayers.get(player.id)
            if (!previous) return

            const previousHealth = previous.health ?? 100
            const currentHealth = player.health ?? 100
            const damage = Math.max(0, Math.round(previousHealth - currentHealth))

            if (damage > 0) {
                nextFeed.push({
                    id: `attack-${player.id}-${Date.now()}-${damage}`,
                    attackerNickname: '누군가',
                    targetNickname: player.nickname,
                    damage,
                    isCritical: damage >= 30,
                    timestamp: Date.now(),
                    type: 'attack',
                })
            }

            if (previousHealth > 0 && currentHealth <= 0) {
                nextFeed.push({
                    id: `eliminated-${player.id}-${Date.now()}`,
                    attackerNickname: '⛄',
                    targetNickname: `${player.nickname} 탈락!`,
                    damage: 0,
                    isCritical: false,
                    timestamp: Date.now(),
                    type: 'eliminated',
                })
            }
        })

        if (nextFeed.length > 0) {
            setFeed(prev => [...nextFeed, ...prev].slice(0, 12))
        }

        previousPlayersRef.current = new Map(players.map((player) => [player.id, player]))
    }, [players])

    return (
        <section className="overflow-hidden rounded-lg border border-cyan-200/30 bg-slate-950 text-white shadow-2xl shadow-cyan-950/30">
            <div className="flex flex-col gap-3 border-b border-white/10 bg-cyan-950/40 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-black">❄️ 눈싸움 대작전 LIVE</h2>
                    <p className="mt-1 text-sm font-bold text-cyan-100/75">실시간 체온 변화와 탈락 현황</p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm font-black">
                    <span className="rounded-full bg-emerald-400 px-3 py-2 text-emerald-950">생존 {aliveCount}명</span>
                    <span className="rounded-full bg-white/10 px-3 py-2 text-cyan-100">경과 {formatTime(elapsed)}</span>
                    <span className="rounded-full bg-rose-500 px-3 py-2 text-white">폭설 Lv.{zoneLevel}</span>
                </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                {sortedPlayers.map((player, index) => {
                    const health = Math.max(0, player.health ?? 100)
                    const maxHealth = player.player_class === 'shield' ? 150 : 100
                    const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100))
                    const isAlive = health > 0
                    const isDanger = healthPct <= 25 && isAlive

                    return (
                        <motion.article
                            key={player.id}
                            layout
                            initial={{ opacity: 0, y: 14 }}
                            animate={{
                                opacity: isAlive ? 1 : 0.46,
                                y: 0,
                                boxShadow: index === 0 && isAlive
                                    ? '0 0 28px rgba(251, 191, 36, 0.38)'
                                    : isDanger
                                        ? ['0 0 0 1px rgba(239,68,68,0.7)', '0 0 0 6px rgba(239,68,68,0.18)', '0 0 0 1px rgba(239,68,68,0.7)']
                                        : '0 0 0 rgba(0,0,0,0)',
                            }}
                            transition={{ boxShadow: isDanger ? { duration: 0.9, repeat: Infinity } : undefined }}
                            className={`relative overflow-hidden rounded-lg border p-4 ${
                                index === 0 && isAlive
                                    ? 'border-amber-300 bg-amber-300/14'
                                    : isDanger
                                        ? 'border-rose-300 bg-rose-500/14'
                                        : 'border-white/10 bg-white/10'
                            } ${!isAlive ? 'grayscale' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-lg font-black">{index === 0 && isAlive ? '👑 ' : ''}{player.nickname}</div>
                                    <div className="mt-1 text-xs font-bold text-cyan-100/70">#{index + 1} · {player.score ?? 0}점</div>
                                </div>
                                {isDanger && <span className="rounded-full bg-rose-500 px-2 py-1 text-[10px] font-black">위험</span>}
                            </div>

                            <div className="mt-4">
                                <div className="mb-1 flex justify-between text-xs font-black text-cyan-100">
                                    <span>체온</span>
                                    <span>{Math.round(health)}° / {maxHealth}°</span>
                                </div>
                                <div className="h-3 overflow-hidden rounded-full bg-slate-950/70">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${getHealthColor(healthPct)}`}
                                        style={{ width: `${healthPct}%` }}
                                    />
                                </div>
                            </div>

                            {!isAlive && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-200/75 backdrop-blur-[1px]">
                                    <span className="text-5xl">⛄</span>
                                </div>
                            )}
                        </motion.article>
                    )
                })}
            </div>

            <div className="border-t border-white/10 bg-white/[0.04] p-4">
                <h3 className="mb-3 text-sm font-black text-cyan-100">전투 피드</h3>
                <div className="space-y-2">
                    <AnimatePresence initial={false}>
                        {feed.slice(0, 8).map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: Math.max(0.4, 1 - index * 0.12), x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                                    item.isCritical ? 'border border-yellow-200 bg-yellow-50 text-slate-900' : 'bg-slate-50 text-slate-800'
                                }`}
                            >
                                <span>{item.type === 'eliminated' ? '⛄' : item.isCritical ? '💥' : '❄️'}</span>
                                <span>{item.attackerNickname}</span>
                                {item.type !== 'eliminated' && <span className="text-slate-400">→</span>}
                                <span>{item.targetNickname}</span>
                                {item.type !== 'eliminated' && (
                                    <span className={`ml-auto font-black ${item.isCritical ? 'text-yellow-600' : 'text-cyan-600'}`}>
                                        -{item.damage}°
                                    </span>
                                )}
                                {item.isCritical && <span className="text-xs text-yellow-500">CRITICAL!</span>}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}
