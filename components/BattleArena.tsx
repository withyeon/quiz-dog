'use client'

import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BadgeCheck,
  Coffee,
  Crosshair,
  Flame,
  Medal,
  Shield,
  Snowflake,
  Thermometer,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Database } from '@/types/database.types'
import { PLAYER_CLASSES, type PlayerClass } from '@/lib/game/battleRoyale'

type Player = Database['public']['Tables']['players']['Row'] & {
  health?: number
  player_class?: PlayerClass
}

interface BattleArenaProps {
  players: Player[]
  currentPlayerId: string | null
  attackResult?: {
    attackerId: string
    targetId: string | null
    damage: number
    isCritical: boolean
  } | null
  onPlayerClick?: (playerId: string) => void
  canAttack?: boolean
}

const CLASS_VISUALS: Record<PlayerClass, { Icon: LucideIcon; tone: string }> = {
  ice_fist: { Icon: Snowflake, tone: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  rapid_fire: { Icon: Zap, tone: 'text-amber-600 bg-amber-50 border-amber-200' },
  shield: { Icon: Shield, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  hot_choco: { Icon: Coffee, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
}

const DRIFTING_SNOW = Array.from({ length: 14 }, (_, index) => ({
  id: index,
  left: (index * 19 + 7) % 100,
  delay: (index % 7) * 0.35,
  duration: 5.2 + (index % 5) * 0.34,
  drift: ((index % 5) - 2) * 16,
  size: 5 + (index % 4) * 2,
}))

function getHealthBar(healthPercent: number) {
  if (healthPercent > 66) return 'from-emerald-400 to-teal-500'
  if (healthPercent > 34) return 'from-amber-300 to-orange-400'
  if (healthPercent > 0) return 'from-rose-400 to-red-500'
  return 'from-slate-300 to-slate-400'
}

function getRankTone(index: number, isAlive: boolean) {
  if (!isAlive) return 'bg-slate-200 text-slate-500'
  if (index === 0) return 'bg-amber-300 text-amber-950'
  if (index === 1) return 'bg-slate-200 text-slate-800'
  if (index === 2) return 'bg-orange-200 text-orange-900'
  return 'bg-white text-slate-700'
}

function PlayerAvatar({ avatar, nickname, isAlive }: { avatar: string | null; nickname: string; isAlive: boolean }) {
  const isImageAvatar = typeof avatar === 'string' && avatar.startsWith('/')

  return (
    <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border bg-white shadow-sm ${
      isAlive ? 'border-slate-200' : 'border-slate-200 grayscale'
    }`}>
      {isImageAvatar ? (
        <Image
          src={avatar}
          alt={nickname}
          fill
          sizes="48px"
          className="object-contain p-1"
        />
      ) : (
        <span className="text-2xl">{isAlive ? avatar || '❄️' : '⛄'}</span>
      )}
    </div>
  )
}

export default function BattleArena({
  players,
  currentPlayerId,
  attackResult,
  onPlayerClick,
  canAttack = false,
}: BattleArenaProps) {
  const sortedPlayers = [...players].sort((a, b) => {
    const healthA = a.health ?? 100
    const healthB = b.health ?? 100
    return healthB - healthA
  })
  const aliveCount = sortedPlayers.filter((player) => (player.health ?? 100) > 0).length

  return (
    <section className="battle-ink-panel battle-snowline overflow-hidden p-4 text-white sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        {DRIFTING_SNOW.map((flake) => (
          <motion.span
            key={flake.id}
            className="absolute rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.75)]"
            style={{
              left: `${flake.left}%`,
              top: '-12%',
              width: flake.size,
              height: flake.size,
            }}
            animate={{
              y: ['0%', '122vh'],
              x: [0, flake.drift],
              opacity: [0, 0.82, 0.82, 0],
            }}
            transition={{
              duration: flake.duration,
              repeat: Infinity,
              delay: flake.delay,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/10 px-3 py-1 text-xs font-black text-cyan-50">
            <Users className="h-3.5 w-3.5" />
            {aliveCount}명 생존
          </div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-normal text-white">
            <Trophy className="h-6 w-6 text-amber-200" />
            배틀 아레나
          </h2>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black ${
          canAttack
            ? 'battle-status-ready text-white battle-pulse'
            : 'border border-white/[0.12] bg-white/10 text-cyan-50'
        }`}>
          <Crosshair className="h-4 w-4" />
          {canAttack ? '타깃 선택 가능' : '장전 대기'}
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <AnimatePresence>
          {sortedPlayers.map((player, index) => {
            const health = Math.max(0, player.health ?? 100)
            const maxHealth = player.player_class ? PLAYER_CLASSES[player.player_class].maxHealth : 100
            const healthPercent = Math.min(100, Math.round((health / maxHealth) * 100))
            const isAlive = health > 0
            const isCurrentPlayer = player.id === currentPlayerId
            const isAttacked = attackResult?.targetId === player.id
            const isAttacker = attackResult?.attackerId === player.id
            const canSelectTarget = canAttack && isAlive && !isCurrentPlayer
            const classVisual = player.player_class ? CLASS_VISUALS[player.player_class] : null
            const ClassIcon = classVisual?.Icon

            return (
              <motion.button
                key={player.id}
                type="button"
                onClick={() => {
                  if (canSelectTarget && onPlayerClick) {
                    onPlayerClick(player.id)
                  }
                }}
                disabled={!canSelectTarget}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: isAlive ? 1 : 0.44,
                  y: 0,
                  scale: isAttacked ? [1, 1.02, 1] : 1,
                }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: index * 0.035 }}
                whileHover={canSelectTarget ? { y: -2 } : {}}
                className={`relative overflow-hidden rounded-[8px] border p-3 text-left transition-all ${
                  isCurrentPlayer
                    ? 'border-amber-200 bg-amber-50/[0.12] shadow-lg shadow-amber-300/10'
                    : canSelectTarget
                      ? 'border-teal-200/70 bg-white/[0.16] hover:border-teal-100 hover:bg-white/[0.22]'
                      : isAlive
                        ? 'border-white/[0.12] bg-white/10'
                        : 'border-white/[0.08] bg-white/[0.06] grayscale'
                } ${isAttacked ? 'ring-2 ring-rose-300/80' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-sm font-black ${getRankTone(index, isAlive)}`}>
                    {isAlive ? index + 1 : 'OUT'}
                  </div>

                  <PlayerAvatar
                    avatar={player.avatar}
                    nickname={player.nickname}
                    isAlive={isAlive}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex min-w-0 flex-wrap items-center gap-2">
                      <span className={`truncate text-sm font-black ${
                        isCurrentPlayer ? 'text-amber-100' : 'text-white'
                      }`}>
                        {player.nickname}
                      </span>
                      {isCurrentPlayer && (
                        <span className="rounded-full border border-amber-200/40 bg-amber-100/[0.18] px-2 py-0.5 text-[10px] font-black text-amber-100">
                          ME
                        </span>
                      )}
                      {ClassIcon && classVisual && isAlive && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${classVisual.tone}`}>
                          <ClassIcon className="h-3 w-3" />
                          {PLAYER_CLASSES[player.player_class!].name}
                        </span>
                      )}
                      {isAttacker && (
                        <motion.span
                          initial={{ scale: 0, rotate: -20 }}
                          animate={{ scale: [0, 1.1, 1], rotate: [-20, 8, 0] }}
                          className="inline-flex items-center text-cyan-100"
                        >
                          <Snowflake className="h-4 w-4" />
                        </motion.span>
                      )}
                      {canSelectTarget && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-400 px-2 py-0.5 text-[10px] font-black text-teal-950">
                          <Crosshair className="h-3 w-3" />
                          공격
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 shrink-0 text-cyan-100/70" />
                      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-950/[0.36]">
                        <motion.div
                          initial={{ width: `${healthPercent}%` }}
                          animate={{ width: `${healthPercent}%` }}
                          transition={{ duration: 0.35 }}
                          className={`h-full rounded-full bg-gradient-to-r ${getHealthBar(healthPercent)}`}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-black tabular-nums text-cyan-50">
                        {Math.round(health)}°
                      </span>
                    </div>

                    {isAttacked && attackResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black ${
                          attackResult.isCritical
                            ? 'bg-amber-300 text-amber-950'
                            : 'bg-rose-400 text-white'
                        }`}
                      >
                        {attackResult.isCritical ? <Flame className="h-3.5 w-3.5" /> : <Snowflake className="h-3.5 w-3.5" />}
                        -{attackResult.damage}°
                      </motion.div>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="flex items-center justify-end gap-1 text-sm font-black text-white">
                      <Medal className="h-4 w-4 text-amber-200" />
                      {player.score ?? 0}
                    </div>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isAlive ? 'bg-emerald-300/[0.18] text-emerald-100' : 'bg-slate-200/[0.14] text-slate-300'
                    }`}>
                      {isAlive && <BadgeCheck className="h-3 w-3" />}
                      {isAlive ? '생존' : '탈락'}
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="relative z-10 mt-4 flex justify-center">
        <div className="rounded-full border border-white/[0.12] bg-white/10 px-3 py-1.5 text-sm font-black text-cyan-50">
          {aliveCount} / {sortedPlayers.length} alive
        </div>
      </div>
    </section>
  )
}
