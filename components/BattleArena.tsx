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
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Database } from '@/types/database.types'
import { PLAYER_CLASSES, TEAM_INFO, type PlayerClass, type Team } from '@/lib/game/battleRoyale'
import { isAvatarPath } from '@/lib/utils/playerDisplay'

type Player = Database['public']['Tables']['players']['Row'] & {
  health?: number
  player_class?: PlayerClass
  team?: Team | null
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
  lockedTarget?: string | null
  onTargetSelect?: (playerId: string) => void
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
  const normalizedAvatar = String(avatar || '').trim()
  const isImageAvatar = isAvatarPath(normalizedAvatar)
  const avatarSrc = normalizedAvatar.startsWith('/') ? normalizedAvatar : `/${normalizedAvatar}`

  return (
    <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border bg-white shadow-sm ${
      isAlive ? 'border-slate-200' : 'border-slate-200 grayscale'
    }`}>
      {isImageAvatar ? (
        <Image
          src={avatarSrc}
          alt={nickname}
          fill
          sizes="48px"
          className="object-contain p-1"
        />
      ) : (
        <span className="text-2xl">{isAlive ? normalizedAvatar || '❄️' : '⛄'}</span>
      )}
    </div>
  )
}

export default function BattleArena({
  players,
  currentPlayerId,
  attackResult,
  lockedTarget = null,
  onTargetSelect,
  onPlayerClick,
  canAttack = false,
}: BattleArenaProps) {
  const me = players.find((p) => p.id === currentPlayerId)
  const myTeam = me?.team ?? null
  const isTeamGame = players.some((p) => p.team === 'red' || p.team === 'blue')

  // 팀전이면 우리팀 먼저, 그 다음 상대팀; 각 그룹 내에서는 체온 내림차순
  const sortedPlayers = [...players].sort((a, b) => {
    if (isTeamGame && myTeam) {
      const aMine = a.team === myTeam ? 0 : 1
      const bMine = b.team === myTeam ? 0 : 1
      if (aMine !== bMine) return aMine - bMine
    }
    return (b.health ?? 100) - (a.health ?? 100)
  })
  const aliveCount = sortedPlayers.filter((player) => (player.health ?? 100) > 0).length

  return (
    <section className="battle-sky-panel battle-snowline overflow-hidden p-4 text-slate-800 sm:p-5">
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
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-black text-sky-800">
            <Users className="h-3.5 w-3.5" />
            {aliveCount}명 생존
          </div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-normal text-slate-900">
            <Image src="/trophy.svg" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
            생존자 현황판
          </h2>
        </div>

        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black ${
          canAttack
            ? 'battle-status-ready text-white battle-pulse'
            : 'border border-sky-200 bg-white/70 text-sky-800'
        }`}>
          <Crosshair className="h-4 w-4" />
          {lockedTarget ? '타깃 조준 완료' : canAttack ? '타깃 선택 가능' : '관전 모드'}
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence>
          {sortedPlayers.map((player, index) => {
            const health = Math.max(0, player.health ?? 100)
            const maxHealth = player.player_class ? PLAYER_CLASSES[player.player_class].maxHealth : 100
            const healthPercent = Math.min(100, Math.round((health / maxHealth) * 100))
            const isAlive = health > 0
            const isCurrentPlayer = player.id === currentPlayerId
            const isLocked = player.id === lockedTarget
            const isDangerous = healthPercent <= 25 && isAlive
            const isAttacked = attackResult?.targetId === player.id
            const isAttacker = attackResult?.attackerId === player.id
            const isTeammate = isTeamGame && myTeam && player.team === myTeam && !isCurrentPlayer
            const canSelectTarget =
              canAttack &&
              isAlive &&
              !isCurrentPlayer &&
              (!isTeamGame || (myTeam && player.team && player.team !== myTeam))
            const classVisual = player.player_class ? CLASS_VISUALS[player.player_class] : null
            const ClassIcon = classVisual?.Icon
            const hpColor = healthPercent > 60 ? '#22c55e' : healthPercent > 30 ? '#f59e0b' : '#ef4444'
            const teamInfo = player.team ? TEAM_INFO[player.team] : null

            return (
              <motion.button
                key={player.id}
                type="button"
                onClick={() => {
                  if (canSelectTarget) {
                    if (onTargetSelect) {
                      onTargetSelect(player.id)
                    } else if (onPlayerClick) {
                      onPlayerClick(player.id)
                    }
                  }
                }}
                disabled={!canSelectTarget}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: isAlive ? 1 : 0.44,
                  y: 0,
                  scale: isAttacked ? [1, 1.02, 1] : 1,
                  boxShadow: isLocked
                    ? ['0 0 0 2px #ef4444', '0 0 0 7px rgba(239,68,68,0.72)', '0 0 0 2px #ef4444']
                    : isDangerous
                      ? ['0 0 0 1px rgba(239,68,68,0.4)', '0 0 0 5px rgba(239,68,68,0.24)', '0 0 0 1px rgba(239,68,68,0.4)']
                      : '0 0 0 0 rgba(0,0,0,0)',
                }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{
                  delay: index * 0.035,
                  boxShadow: isLocked || isDangerous ? { duration: 0.8, repeat: Infinity } : undefined,
                }}
                whileHover={canSelectTarget ? { y: -2 } : {}}
                className={`relative min-h-[180px] overflow-hidden rounded-[8px] border-2 p-4 text-left transition-all duration-300 ${
                  isCurrentPlayer
                    ? 'border-sky-200 bg-sky-300/[0.16] shadow-lg shadow-sky-300/10'
                    : isLocked
                      ? 'border-red-300 bg-red-500/[0.18]'
                    : isTeammate && isAlive
                      ? player.team === 'red'
                        ? 'border-rose-300/60 bg-rose-500/[0.16]'
                        : 'border-sky-300/60 bg-sky-500/[0.16]'
                    : canSelectTarget
                      ? player.team === 'red'
                        ? 'border-rose-300/70 bg-rose-500/[0.10] hover:border-rose-200 hover:bg-rose-500/[0.20]'
                        : player.team === 'blue'
                          ? 'border-sky-300/70 bg-sky-500/[0.10] hover:border-sky-200 hover:bg-sky-500/[0.20]'
                          : 'border-sky-200 bg-white/70 hover:border-sky-300 hover:bg-white/85'
                      : isAlive
                        ? 'border-sky-200 bg-white/60'
                        : 'border-slate-200 bg-white/40 grayscale'
                } ${isAttacked ? 'ring-2 ring-sky-300/80' : ''} ${isDangerous ? 'border-red-300' : ''}`}
              >
                {isLocked && (
                  <>
                    <div className="absolute right-2 top-2 z-10 rounded bg-red-50 px-2 py-1 text-xs font-black text-red-600">
                      🎯 조준
                    </div>
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-red-300/40" />
                      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-red-300/40" />
                    </div>
                  </>
                )}

                <div className="flex h-full flex-col items-center justify-between gap-3 text-center">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-sm font-black ${getRankTone(index, isAlive)}`}>
                    {isAlive ? index + 1 : '탈락'}
                  </div>

                  <PlayerAvatar
                    avatar={player.avatar}
                    nickname={player.nickname}
                    isAlive={isAlive}
                  />

                  <div className="min-w-0 w-full">
                    <div className="mb-2 flex min-w-0 flex-wrap items-center justify-center gap-2">
                      {teamInfo && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                            player.team === 'red'
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-sky-200 text-sky-900'
                          }`}
                          title={teamInfo.name}
                        >
                          <span>{teamInfo.emoji}</span>
                          {teamInfo.name}
                        </span>
                      )}
                      <span className={`max-w-full truncate text-base font-black ${
                        isCurrentPlayer ? 'text-sky-800' : 'text-slate-900'
                      }`}>
                        {player.nickname}
                      </span>
                      {isCurrentPlayer && (
                        <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">
                          나
                        </span>
                      )}
                      {isTeammate && isAlive && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                          아군
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
                          className="inline-flex items-center text-sky-600"
                        >
                          <Snowflake className="h-4 w-4" />
                        </motion.span>
                      )}
                      {canSelectTarget && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-black text-cyan-950">
                          <Crosshair className="h-3 w-3" />
                          조준
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 shrink-0 text-sky-700" />
                      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-sky-200">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${healthPercent}%`, backgroundColor: hpColor }}
                        />
                      </div>
                      <span className="w-20 text-right text-xs font-black tabular-nums text-slate-700">
                        {Math.round(health)}° / {maxHealth}°
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

                  <div className="w-full shrink-0 text-center">
                    <div className="flex items-center justify-center gap-1 text-sm font-black text-slate-800">
                      <Medal className="h-4 w-4 text-amber-500" />
                      {player.score ?? 0}
                    </div>
                    <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isAlive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {isAlive && <BadgeCheck className="h-3 w-3" />}
                      {isAlive ? '생존' : '탈락'}
                    </div>
                  </div>
                </div>
                {!isAlive && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-slate-200/80 backdrop-blur-[1px]">
                    <span className="text-4xl">⛄</span>
                  </div>
                )}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="relative z-10 mt-4 flex justify-center">
        <div className="rounded-full border border-sky-200 bg-white/70 px-3 py-1.5 text-sm font-black text-sky-800">
          {aliveCount} / {sortedPlayers.length} 생존
        </div>
      </div>
    </section>
  )
}
