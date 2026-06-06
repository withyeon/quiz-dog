'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Database } from '@/types/database.types'
import { PLAYER_CLASSES, TEAM_INFO, type PlayerClass, type Team } from '@/lib/game/battleRoyale'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'

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
    zoneLevel: zoneLevelProp,
    gameStartTime,
}: BattleRoyaleDashboardProps) {
    const [feed, setFeed] = useState<FeedItem[]>([])
    const [elapsed, setElapsed] = useState(0)
    const previousPlayersRef = useRef<Map<string, Player>>(new Map())

    // 경과 시간으로 폭설(자기장) 단계 계산 — 2분마다 +1 (게임 로직과 동일)
    const zoneLevel = zoneLevelProp ?? Math.floor(elapsed / 120) + 1

    const sortedPlayers = useMemo(() => (
        [...players].sort((a, b) => (b.health ?? 100) - (a.health ?? 100))
    ), [players])
    const aliveCount = sortedPlayers.filter((player) => (player.health ?? 100) > 0).length
    const isTeamGame = useMemo(
      () => players.some((p) => p.team === 'red' || p.team === 'blue'),
      [players],
    )

    const teamRosters = useMemo(() => {
      if (!isTeamGame) return null
      return {
        red: sortedPlayers.filter((p) => p.team === 'red'),
        blue: sortedPlayers.filter((p) => p.team === 'blue'),
      }
    }, [isTeamGame, sortedPlayers])

    const teamAlive = useMemo(() => {
      if (!isTeamGame) return null
      return {
        red: players.filter((p) => p.team === 'red' && (p.health ?? 100) > 0).length,
        blue: players.filter((p) => p.team === 'blue' && (p.health ?? 100) > 0).length,
      }
    }, [isTeamGame, players])

    useEffect(() => {
        if (!gameStartTime) return

        const interval = window.setInterval(() => {
            setElapsed(Math.floor((Date.now() - gameStartTime) / 1000))
        }, 1000)

        return () => window.clearInterval(interval)
    }, [gameStartTime])

    // 닉네임 조회를 위한 최신 플레이어 맵 (구독 콜백에서 사용)
    const playersRef = useRef(players)
    playersRef.current = players

    // 공격 피드 — 실제 battle:attacked 이벤트에서 공격자 실명·크리티컬을 표시
    useEffect(() => {
        return subscribeRoomRuntimeEvent((event) => {
            if (event.type !== 'battle:attacked') return
            const payload = event.payload as {
                attackerNickname?: string
                targetId?: string
                damage?: number
                isCritical?: boolean
            } | undefined
            if (!payload) return

            const target = playersRef.current.find((p) => p.id === payload.targetId)
            setFeed((prev) => [
                {
                    id: `attack-${payload.targetId ?? 'all'}-${Date.now()}-${payload.damage ?? 0}`,
                    attackerNickname: payload.attackerNickname || '누군가',
                    targetNickname: target?.nickname ?? '상대',
                    damage: payload.damage ?? 0,
                    isCritical: Boolean(payload.isCritical),
                    timestamp: Date.now(),
                    type: 'attack' as const,
                },
                ...prev,
            ].slice(0, 12))
        })
    }, [])

    // 탈락 감지는 체력 변화로 (폭설·아이템 등 모든 원인 포함)
    useEffect(() => {
        const previousPlayers = previousPlayersRef.current
        const nextFeed: FeedItem[] = []

        players.forEach((player) => {
            const previous = previousPlayers.get(player.id)
            if (!previous) return

            const previousHealth = previous.health ?? 100
            const currentHealth = player.health ?? 100

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
                    {isTeamGame && teamAlive ? (
                        <>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-2 text-white">
                                <span>🐕</span> 홍팀 {teamAlive.red}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-2 text-white">
                                <span>🐺</span> 청팀 {teamAlive.blue}
                            </span>
                        </>
                    ) : (
                        <span className="rounded-full bg-emerald-400 px-3 py-2 text-emerald-950">생존 {aliveCount}명</span>
                    )}
                    <span className="rounded-full bg-white/10 px-3 py-2 text-cyan-100">경과 {formatTime(elapsed)}</span>
                    <span className="rounded-full bg-rose-500/80 px-3 py-2 text-white">폭설 Lv.{zoneLevel}</span>
                </div>
            </div>

            {isTeamGame && teamRosters ? (
                <div className="grid gap-4 p-4 lg:grid-cols-2">
                    <TeamColumn team="red" players={teamRosters.red} />
                    <TeamColumn team="blue" players={teamRosters.blue} />
                </div>
            ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                    {sortedPlayers.map((player, index) => (
                        <PlayerCard key={player.id} player={player} rank={index + 1} highlightLeader />
                    ))}
                </div>
            )}

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

function PlayerCard({
    player,
    rank,
    highlightLeader = false,
}: {
    player: Player
    rank: number
    highlightLeader?: boolean
}) {
    const health = Math.max(0, player.health ?? 100)
    const playerClass = player.player_class as PlayerClass | null
    const maxHealth = playerClass ? PLAYER_CLASSES[playerClass].maxHealth : 100
    const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100))
    const isAlive = health > 0
    const isDanger = healthPct <= 25 && isAlive
    const isLeader = highlightLeader && rank === 1 && isAlive

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{
                opacity: isAlive ? 1 : 0.46,
                y: 0,
                boxShadow: isLeader
                    ? '0 0 28px rgba(251, 191, 36, 0.38)'
                    : isDanger
                        ? ['0 0 0 1px rgba(239,68,68,0.7)', '0 0 0 6px rgba(239,68,68,0.18)', '0 0 0 1px rgba(239,68,68,0.7)']
                        : '0 0 0 rgba(0,0,0,0)',
            }}
            transition={{ boxShadow: isDanger ? { duration: 0.9, repeat: Infinity } : undefined }}
            className={`relative overflow-hidden rounded-lg border p-3 ${
                isLeader
                    ? 'border-amber-300 bg-amber-300/14'
                    : isDanger
                        ? 'border-rose-300 bg-rose-500/14'
                        : 'border-white/10 bg-white/10'
            } ${!isAlive ? 'grayscale' : ''}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-base font-black">
                        {isLeader ? '👑 ' : ''}{player.nickname}
                    </div>
                    <div className="mt-0.5 text-[10px] font-bold text-cyan-100/70">#{rank} · {player.score ?? 0}점</div>
                </div>
                {isDanger && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black">위험</span>}
            </div>

            <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] font-black text-cyan-100">
                    <span>체온</span>
                    <span>{Math.round(health)}° / {maxHealth}°</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-950/70">
                    <div
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${getHealthColor(healthPct)}`}
                        style={{ width: `${healthPct}%` }}
                    />
                </div>
            </div>

            {!isAlive && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-200/75 backdrop-blur-[1px]">
                    <span className="text-4xl">⛄</span>
                </div>
            )}
        </motion.article>
    )
}

function TeamColumn({ team, players }: { team: Team; players: Player[] }) {
    const info = TEAM_INFO[team]
    const alive = players.filter((p) => (p.health ?? 100) > 0).length
    const avgHealth = players.length === 0
        ? 0
        : Math.round(players.reduce((sum, p) => sum + Math.max(0, p.health ?? 100), 0) / players.length)
    const isRed = team === 'red'

    return (
        <div
            className={`rounded-xl border-2 p-3 ${
                isRed ? 'border-rose-400/50 bg-rose-500/[0.08]' : 'border-sky-400/50 bg-sky-500/[0.08]'
            }`}
        >
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-3xl">{info.emoji}</span>
                    <div>
                        <div className={`text-xl font-black ${isRed ? 'text-rose-200' : 'text-sky-200'}`}>
                            {info.name}
                        </div>
                        <div className="text-[10px] font-bold text-cyan-100/70">
                            생존 {alive}/{players.length} · 평균 체온 {avgHealth}°
                        </div>
                    </div>
                </div>
                <span
                    className={`rounded-full px-3 py-1.5 text-sm font-black ${
                        isRed ? 'bg-rose-500 text-white' : 'bg-sky-500 text-white'
                    }`}
                >
                    {alive}명
                </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {players.map((player, index) => (
                    <PlayerCard key={player.id} player={player} rank={index + 1} />
                ))}
            </div>
        </div>
    )
}
