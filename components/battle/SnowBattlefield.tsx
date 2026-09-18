'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { Crosshair } from 'lucide-react'
import { PLAYER_CLASSES, TEAM_INFO, type PlayerClass, type Team } from '@/lib/game/battleRoyale'
import {
  arcPeak,
  flightDuration,
  layoutBattlefield,
  maxPerRow,
  maxRows,
  type BattlefieldPlayer,
  type BattlefieldSprite,
  type FieldOrientation,
  type FieldPoint,
} from '@/lib/game/battlefield'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import { isAvatarPath, resolveAvatarSrc } from '@/lib/utils/playerDisplay'

/**
 * 눈밭 전장 — 학생 화면과 교사 대시보드가 같이 쓰는 실시간 스테이지.
 *
 * 방 안에서 일어나는 모든 공격(battle:attacked)을 받아서 공격자 → 타깃으로
 * 눈뭉치를 날리고, 맞은 자리에 터짐·피해 숫자·휘청임을 그린다. 체온 변화로
 * 탈락(눈사람)·부활을 감지해 가운데 스탬프와 속보로 알린다.
 */

type AttackPayload = {
  attackerId?: string
  attackerNickname?: string
  targetId?: string
  damage?: number
  isCritical?: boolean
  itemType?: 'giant_ball' | 'blizzard' | 'heater' | null
}

interface Projectile {
  id: string
  from: FieldPoint
  to: FieldPoint
  peak: FieldPoint
  duration: number
  team: Team | null
  isCritical: boolean
  isGiant: boolean
  targetId: string
  damage: number
  attackerNickname: string
}

interface Hit {
  id: string
  damage: number
  isCritical: boolean
  point: FieldPoint
}

interface Stamp {
  id: string
  text: string
  tone: 'crit' | 'out' | 'revive' | 'last' | 'storm'
}

interface TickerItem {
  id: string
  text: string
  tone: 'attack' | 'crit' | 'out' | 'revive'
}

interface SnowBattlefieldProps {
  players: BattlefieldPlayer[]
  /** null이면 관전(교사 화면·대기실) */
  currentPlayerId?: string | null
  lockedTarget?: string | null
  onTargetSelect?: (playerId: string) => void
  canAttack?: boolean
  zoneLevel?: number
  orientation?: FieldOrientation
  /** 높이는 호출부가 정한다 (예: h-[clamp(280px,42dvh,460px)]) */
  className?: string
  showTicker?: boolean
  compact?: boolean
}

const AMBIENT_SNOW = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: (index * 23 + 5) % 100,
  delay: (index % 6) * 0.45,
  duration: 6 + (index % 5) * 0.5,
  drift: ((index % 5) - 2) * 14,
  size: 4 + (index % 4) * 2,
}))

const SPLAT_ANGLES = Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2)

let seq = 0
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${(seq += 1)}`

function healthOf(p: BattlefieldPlayer) {
  return Math.max(0, p.health ?? 100)
}

function maxHealthOf(p: BattlefieldPlayer) {
  const cls = p.player_class as PlayerClass | null | undefined
  return cls && PLAYER_CLASSES[cls] ? PLAYER_CLASSES[cls].maxHealth : 100
}

export default function SnowBattlefield({
  players,
  currentPlayerId = null,
  lockedTarget = null,
  onTargetSelect,
  canAttack = false,
  zoneLevel = 1,
  orientation = 'vertical',
  className = '',
  showTicker = true,
  compact = false,
}: SnowBattlefieldProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [projectiles, setProjectiles] = useState<Projectile[]>([])
  const [hits, setHits] = useState<Record<string, Hit>>({})
  const [stamp, setStamp] = useState<Stamp | null>(null)
  const [ticker, setTicker] = useState<TickerItem[]>([])
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timersRef.current.delete(t)
      fn()
    }, ms)
    timersRef.current.add(t)
  }

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
      timers.clear()
    }
  }, [])

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStageSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sprites = useMemo(
    () => layoutBattlefield(players, { currentPlayerId, orientation }),
    [players, currentPlayerId, orientation],
  )
  const spriteById = useMemo(() => {
    const map = new Map<string, BattlefieldSprite>()
    sprites.forEach((s) => map.set(s.player.id, s))
    return map
  }, [sprites])
  const spriteByIdRef = useRef(spriteById)
  spriteByIdRef.current = spriteById
  const playersRef = useRef(players)
  playersRef.current = players

  const me = currentPlayerId ? players.find((p) => p.id === currentPlayerId) ?? null : null
  const myTeam = me?.team ?? null
  const isTeamGame = players.some((p) => p.team === 'red' || p.team === 'blue')

  // 스프라이트 크기: 한 줄 인원과 줄 수를 모두 보고 결정
  const perRow = maxPerRow(sprites)
  const rows = maxRows(sprites)
  const along = orientation === 'vertical' ? stageSize.w : stageSize.h
  const across = orientation === 'vertical' ? stageSize.h : stageSize.w
  const unit = stageSize.w === 0
    ? 44
    : Math.round(Math.max(30, Math.min(compact ? 52 : 68, along / (perRow * 1.45), across / (rows * 2 + 4))))

  // 스탬프/속보 헬퍼
  const pushStamp = (next: Omit<Stamp, 'id'>) => {
    const id = nextId('stamp')
    setStamp({ id, ...next })
    later(() => setStamp((cur) => (cur?.id === id ? null : cur)), 1500)
  }
  const pushTicker = (next: Omit<TickerItem, 'id'>) => {
    const id = nextId('tick')
    setTicker((prev) => [{ id, ...next }, ...prev].slice(0, 3))
    later(() => setTicker((prev) => prev.filter((t) => t.id !== id)), 6000)
  }

  // 공격 이벤트 → 눈뭉치 비행
  useEffect(() => {
    return subscribeRoomRuntimeEvent((event) => {
      if (event.type !== 'battle:attacked') return
      const payload = event.payload as AttackPayload | undefined
      if (!payload?.targetId) return

      const attackerId = payload.attackerId ?? event.playerId ?? null
      const target = spriteByIdRef.current.get(payload.targetId)
      if (!target) return
      const attacker = attackerId ? spriteByIdRef.current.get(attackerId) : undefined
      // 공격자가 전장에 없으면(늦게 들어온 학생 등) 타깃 반대편 가장자리에서 날린다
      const from: FieldPoint = attacker
        ? attacker.slot
        : orientation === 'vertical'
          ? { x: target.slot.x, y: target.slot.y < 50 ? 92 : 8 }
          : { x: target.slot.x < 50 ? 92 : 8, y: target.slot.y }
      const to = target.slot
      const duration = flightDuration(from, to)
      const damage = payload.damage ?? 0
      const isCritical = Boolean(payload.isCritical)
      const attackerNickname = payload.attackerNickname
        || playersRef.current.find((p) => p.id === attackerId)?.nickname
        || '누군가'

      const projectile: Projectile = {
        id: nextId('ball'),
        from,
        to,
        peak: arcPeak(from, to),
        duration,
        team: attacker?.player.team ?? null,
        isCritical,
        isGiant: payload.itemType === 'giant_ball',
        targetId: payload.targetId,
        damage,
        attackerNickname,
      }
      setProjectiles((prev) => [...prev, projectile])

      later(() => {
        setProjectiles((prev) => prev.filter((p) => p.id !== projectile.id))
        const hit: Hit = { id: projectile.id, damage, isCritical, point: to }
        setHits((prev) => ({ ...prev, [projectile.targetId]: hit }))
        later(() => {
          setHits((prev) => {
            if (prev[projectile.targetId]?.id !== hit.id) return prev
            const next = { ...prev }
            delete next[projectile.targetId]
            return next
          })
        }, 1100)

        const targetName = target.player.nickname
        if (isCritical) {
          pushStamp({ text: `💥 크리티컬! ${attackerNickname} → ${targetName}`, tone: 'crit' })
          pushTicker({ text: `💥 ${attackerNickname} → ${targetName} -${damage}° 크리티컬`, tone: 'crit' })
        } else {
          pushTicker({ text: `❄️ ${attackerNickname} → ${targetName} -${damage}°`, tone: 'attack' })
        }
      }, duration)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orientation])

  // 체온 변화로 탈락·부활·마지막 생존자 감지
  const prevHealthRef = useRef<Map<string, number> | null>(null)
  const prevTeamAliveRef = useRef<Record<Team, number> | null>(null)
  useEffect(() => {
    const prev = prevHealthRef.current
    const next = new Map<string, number>()
    players.forEach((p) => next.set(p.id, healthOf(p)))

    if (prev) {
      players.forEach((p) => {
        const before = prev.get(p.id)
        if (before === undefined) return
        const after = healthOf(p)
        if (before > 0 && after <= 0) {
          pushStamp({ text: `⛄ ${p.nickname} 눈사람이 됐다!`, tone: 'out' })
          pushTicker({ text: `⛄ ${p.nickname} 탈락`, tone: 'out' })
        } else if (before <= 0 && after > 0) {
          pushStamp({ text: `🔥 ${p.nickname} 부활!`, tone: 'revive' })
          pushTicker({ text: `🔥 ${p.nickname} 부활`, tone: 'revive' })
        }
      })
    }
    prevHealthRef.current = next

    if (isTeamGame) {
      const alive: Record<Team, number> = { red: 0, blue: 0 }
      players.forEach((p) => {
        if (healthOf(p) > 0 && (p.team === 'red' || p.team === 'blue')) alive[p.team] += 1
      })
      const before = prevTeamAliveRef.current
      if (before) {
        ;(['red', 'blue'] as Team[]).forEach((team) => {
          if (before[team] > 1 && alive[team] === 1) {
            later(() => pushStamp({ text: `${TEAM_INFO[team].emoji} ${TEAM_INFO[team].name} 마지막 생존자!`, tone: 'last' }), 1600)
          }
        })
      }
      prevTeamAliveRef.current = alive
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, isTeamGame])

  // 폭설 단계가 오르면 알린다
  const prevZoneRef = useRef(zoneLevel)
  useEffect(() => {
    if (zoneLevel > prevZoneRef.current && zoneLevel > 1) {
      pushStamp({ text: `🌨️ 폭설 주의보 ${zoneLevel}단계`, tone: 'storm' })
    }
    prevZoneRef.current = zoneLevel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneLevel])

  // 팀 체온 줄다리기
  const teamPower = useMemo(() => {
    if (!isTeamGame) return null
    const sum: Record<Team, { hp: number; max: number; alive: number; total: number }> = {
      red: { hp: 0, max: 0, alive: 0, total: 0 },
      blue: { hp: 0, max: 0, alive: 0, total: 0 },
    }
    players.forEach((p) => {
      if (p.is_kicked || (p.team !== 'red' && p.team !== 'blue')) return
      const hp = healthOf(p)
      sum[p.team].hp += hp
      sum[p.team].max += maxHealthOf(p)
      sum[p.team].total += 1
      if (hp > 0) sum[p.team].alive += 1
    })
    const total = sum.red.hp + sum.blue.hp
    const redShare = total === 0 ? 50 : (sum.red.hp / total) * 100
    return { ...sum, redShare }
  }, [players, isTeamGame])

  const windOpacity = Math.min(0.55, Math.max(0, zoneLevel - 1) * 0.18)
  const isVertical = orientation === 'vertical'
  const topLabel = isTeamGame
    ? (myTeam ? TEAM_INFO[myTeam === 'red' ? 'blue' : 'red'] : TEAM_INFO.red)
    : null
  const bottomLabel = isTeamGame
    ? (myTeam ? TEAM_INFO[myTeam] : TEAM_INFO.blue)
    : null

  const latest = ticker[0] ?? null

  return (
    <div className={`flex w-full flex-col gap-1 ${className}`}>
    <div
      ref={stageRef}
      className="battle-field relative min-h-0 w-full flex-1 select-none overflow-hidden rounded-[8px]"
      data-testid="snow-battlefield"
    >
      {/* 눈 내리는 배경 */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        {AMBIENT_SNOW.map((flake) => (
          <motion.span
            key={flake.id}
            className="absolute rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.8)]"
            style={{ left: `${flake.left}%`, top: '-6%', width: flake.size, height: flake.size }}
            animate={{ y: ['0%', '3000%'], x: [0, flake.drift], opacity: [0, 0.9, 0.9, 0] }}
            transition={{ duration: flake.duration / (zoneLevel > 1 ? 1.6 : 1), repeat: Infinity, delay: flake.delay, ease: 'linear' }}
          />
        ))}
      </div>
      {windOpacity > 0 && (
        <div className="battle-wind pointer-events-none absolute inset-0" style={{ opacity: windOpacity }} />
      )}

      {/* 눈 요새 (양 진영 앞) */}
      {isVertical ? (
        <>
          <div className="battle-fort pointer-events-none absolute inset-x-[4%]" style={{ top: '47%', height: `${Math.max(10, unit * 0.28)}px` }} />
          <div className="battle-fort battle-fort--flip pointer-events-none absolute inset-x-[4%]" style={{ top: '53%', height: `${Math.max(10, unit * 0.28)}px`, transform: 'translateY(-100%)' }} />
        </>
      ) : (
        <>
          <div className="battle-fort battle-fort--side pointer-events-none absolute inset-y-[6%]" style={{ left: '47%', width: `${Math.max(10, unit * 0.28)}px` }} />
          <div className="battle-fort battle-fort--side battle-fort--flip pointer-events-none absolute inset-y-[6%]" style={{ left: '53%', width: `${Math.max(10, unit * 0.28)}px`, transform: 'translateX(-100%)' }} />
        </>
      )}

      {/* 진영 라벨 */}
      {topLabel && bottomLabel && (
        <>
          <div className={`pointer-events-none absolute z-20 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow ${
            isVertical ? 'left-2 top-2' : 'left-2 top-2'
          } ${topLabel === TEAM_INFO.red ? 'bg-rose-500' : 'bg-sky-500'}`}>
            {topLabel.emoji} {topLabel.name}
          </div>
          <div className={`pointer-events-none absolute z-20 rounded-full px-2 py-0.5 text-[10px] font-black text-white shadow ${
            isVertical ? 'bottom-2 right-2' : 'right-2 top-2'
          } ${bottomLabel === TEAM_INFO.red ? 'bg-rose-500' : 'bg-sky-500'}`}>
            {bottomLabel.emoji} {bottomLabel.name}{myTeam ? ' (우리 팀)' : ''}
          </div>
        </>
      )}

      {/* 팀 체온 줄다리기 */}
      {teamPower && (
        <div className={`pointer-events-none absolute z-20 ${isVertical ? 'left-1/2 top-1.5 w-[58%] -translate-x-1/2' : 'left-1/2 top-1.5 w-[42%] -translate-x-1/2'}`}>
          <div className="flex items-center gap-1.5 text-[10px] font-black">
            <span className="shrink-0 text-rose-600 tabular-nums">🐕 {teamPower.red.alive}</span>
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/70 shadow-inner ring-1 ring-white/70">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-rose-400"
                animate={{ width: `${teamPower.redShare}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <motion.div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-sky-500 to-sky-400"
                animate={{ width: `${100 - teamPower.redShare}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
              <div className="absolute inset-y-0 left-1/2 w-px bg-white/80" />
            </div>
            <span className="shrink-0 text-sky-700 tabular-nums">{teamPower.blue.alive} 🐺</span>
          </div>
        </div>
      )}

      {/* 스프라이트 */}
      {sprites.map((sprite) => {
        const { player, slot } = sprite
        const isMe = player.id === currentPlayerId
        const isEnemy = isTeamGame ? Boolean(myTeam) && player.team !== myTeam : Boolean(me) && !isMe
        const alive = healthOf(player) > 0
        const selectable = canAttack && alive && !isMe && isEnemy
        return (
          <Sprite
            key={player.id}
            player={player}
            x={slot.x}
            y={slot.y}
            unit={unit}
            maxWidth={Math.max(unit + 8, Math.floor((stageSize.w || 1000) * sprite.slotWidth / 100) - 4)}
            isMe={isMe}
            isEnemy={isEnemy}
            isLocked={lockedTarget === player.id}
            selectable={selectable}
            hit={hits[player.id] ?? null}
            onSelect={selectable && onTargetSelect ? () => onTargetSelect(player.id) : undefined}
          />
        )
      })}

      {/* 눈뭉치 */}
      <AnimatePresence>
        {projectiles.map((ball) => (
          <Snowball key={ball.id} ball={ball} unit={unit} />
        ))}
      </AnimatePresence>

      {/* 터짐 + 피해 숫자 */}
      <AnimatePresence>
        {Object.entries(hits).map(([playerId, hit]) => (
          <Splat key={`${playerId}-${hit.id}`} hit={hit} unit={unit} />
        ))}
      </AnimatePresence>

      {/* 가운데 스탬프 */}
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={stamp.id}
            initial={{ opacity: 0, scale: 0.4, rotate: -8, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scale: [0.4, 1.15, 1], rotate: [-8, 3, 0], x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scale: 1.2, y: '-70%', x: '-50%' }}
            transition={{ duration: 0.45 }}
            className={`pointer-events-none absolute left-1/2 top-1/2 z-40 whitespace-nowrap rounded-[8px] border-2 px-3 py-1.5 text-center text-sm font-black shadow-xl sm:px-5 sm:py-2.5 sm:text-xl ${
              stamp.tone === 'crit'
                ? 'border-amber-300 bg-amber-400 text-amber-950'
                : stamp.tone === 'out'
                  ? 'border-slate-300 bg-slate-800 text-white'
                  : stamp.tone === 'revive'
                    ? 'border-orange-200 bg-orange-500 text-white'
                    : stamp.tone === 'storm'
                      ? 'border-sky-200 bg-sky-700 text-white'
                      : 'border-rose-200 bg-rose-600 text-white'
            }`}
          >
            {stamp.text}
          </motion.div>
        )}
      </AnimatePresence>

    </div>

      {/* 전투 속보 + 조준 안내 — 스테이지 밖 한 줄 띠(스프라이트를 가리지 않게) */}
      {showTicker && (
        <div className="relative flex h-6 items-center justify-between gap-2 px-0.5 text-[10px] font-black sm:text-xs">
          <div className="relative min-w-0 flex-1 self-stretch">
            <AnimatePresence initial={false}>
              {latest && (
                <motion.div
                  key={latest.id}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  className={`absolute inset-y-0 left-0 flex max-w-full items-center truncate rounded-full px-2.5 shadow-sm ${
                    latest.tone === 'crit'
                      ? 'bg-amber-300 text-amber-950'
                      : latest.tone === 'out'
                        ? 'bg-slate-800 text-white'
                        : latest.tone === 'revive'
                          ? 'bg-orange-500 text-white'
                          : 'bg-white/85 text-slate-800'
                  }`}
                >
                  <span className="truncate">{latest.text}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {onTargetSelect && canAttack && !lockedTarget && (
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-500 px-2.5 py-0.5 text-white shadow"
            >
              <Crosshair className="h-3 w-3" />
              상대를 눌러 조준
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── 스프라이트 ─────────────────────────── */

function Sprite({
  player,
  x,
  y,
  unit,
  maxWidth,
  isMe,
  isEnemy,
  isLocked,
  selectable,
  hit,
  onSelect,
}: {
  player: BattlefieldPlayer
  x: number
  y: number
  unit: number
  maxWidth: number
  isMe: boolean
  isEnemy: boolean
  isLocked: boolean
  selectable: boolean
  hit: Hit | null
  onSelect?: () => void
}) {
  const controls = useAnimationControls()
  const health = healthOf(player)
  const maxHealth = maxHealthOf(player)
  const pct = Math.min(100, Math.round((health / maxHealth) * 100))
  const alive = health > 0
  const cold = alive && pct <= 30
  const hpColor = pct > 60 ? '#22c55e' : pct > 30 ? '#f59e0b' : '#ef4444'
  const avatar = String(player.avatar || '').trim()
  const isImage = isAvatarPath(avatar)
  const team = player.team

  useEffect(() => {
    if (!hit) return
    const kick = hit.isCritical ? 12 : 7
    void controls.start({
      x: [0, -kick, kick, -kick / 2, 0],
      rotate: [0, -8, 8, -3, 0],
      transition: { duration: 0.45 },
    })
  }, [hit, controls])

  const ringClass = isLocked
    ? 'ring-[3px] ring-red-500'
    : isMe
      ? 'ring-[3px] ring-amber-400'
      : team === 'red'
        ? 'ring-2 ring-rose-400'
        : team === 'blue'
          ? 'ring-2 ring-sky-400'
          : 'ring-2 ring-slate-300'

  const nameWidth = Math.min(maxWidth, Math.round(unit * 1.9))
  const fontSize = unit < 40 ? 9 : unit < 52 ? 10 : 11

  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%`, width: nameWidth }}
    >
    <motion.button
      type="button"
      disabled={!selectable}
      onClick={onSelect}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      whileHover={selectable ? { scale: 1.08 } : undefined}
      whileTap={selectable ? { scale: 0.95 } : undefined}
      className={`relative flex w-full flex-col items-center ${
        selectable ? 'cursor-pointer' : 'cursor-default'
      }`}
      aria-label={`${player.nickname} ${alive ? `체온 ${Math.round(health)}` : '탈락'}`}
    >
      {/* 조준 링 */}
      {isLocked && (
        <motion.span
          className="pointer-events-none absolute rounded-full border-[3px] border-dashed border-red-500"
          style={{ width: unit + 18, height: unit + 18, top: -9 }}
          animate={{ rotate: 360, scale: [1, 1.08, 1] }}
          transition={{ rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, scale: { duration: 0.9, repeat: Infinity } }}
        />
      )}
      {selectable && !isLocked && (
        <motion.span
          className="pointer-events-none absolute rounded-full border-2 border-red-400/70"
          style={{ width: unit + 10, height: unit + 10, top: -5 }}
          animate={{ opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 1.3, repeat: Infinity }}
        />
      )}

      <motion.div
        animate={controls}
        className={`relative ${cold ? 'battle-shiver' : ''} ${alive ? '' : 'grayscale'}`}
        style={{ width: unit, height: unit }}
      >
        <div
          className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-md ${ringClass} ${
            alive ? '' : 'opacity-60'
          }`}
        >
          {isImage ? (
            <Image src={resolveAvatarSrc(avatar)} alt="" fill sizes={`${unit}px`} className="object-contain p-0.5" />
          ) : (
            <span style={{ fontSize: unit * 0.55 }}>{avatar || '🐶'}</span>
          )}
          {/* 얼어붙는 오버레이 */}
          {alive && pct < 60 && (
            <div
              className="pointer-events-none absolute inset-0 bg-sky-200 mix-blend-multiply"
              style={{ opacity: ((60 - pct) / 60) * 0.7 }}
            />
          )}
          {hit && (
            <div className={`pointer-events-none absolute inset-0 ${hit.isCritical ? 'bg-amber-200/70' : 'bg-white/70'}`} />
          )}
        </div>
        {!alive && (
          <span
            className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 drop-shadow"
            style={{ fontSize: unit * 0.7 }}
          >
            ⛄
          </span>
        )}
        {isMe && (
          <span className="pointer-events-none absolute -right-2 -top-2 rounded-full bg-amber-400 px-1.5 text-[9px] font-black text-amber-950 shadow">
            나
          </span>
        )}
        {isLocked && (
          <span className="pointer-events-none absolute -left-2 -top-2 rounded-full bg-red-500 px-1.5 text-[9px] font-black text-white shadow">
            조준
          </span>
        )}
      </motion.div>

      {/* 체온 바 */}
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/80 shadow-inner" style={{ width: unit }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${alive ? pct : 0}%`, backgroundColor: hpColor }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* 이름표 */}
      <span
        className={`mt-0.5 max-w-full truncate rounded-full px-1.5 leading-tight ${
          isMe
            ? 'bg-amber-400 text-amber-950'
            : alive
              ? isEnemy
                ? 'bg-white/90 text-slate-900'
                : 'bg-white/80 text-slate-700'
              : 'bg-slate-200/80 text-slate-500'
        } font-black`}
        style={{ fontSize }}
      >
        {player.nickname}
      </span>
    </motion.button>
    </div>
  )
}

/* ─────────────────────────── 눈뭉치 ─────────────────────────── */

function Snowball({ ball, unit }: { ball: Projectile; unit: number }) {
  const size = Math.round(unit * (ball.isGiant ? 0.85 : ball.isCritical ? 0.5 : 0.38))
  const duration = ball.duration / 1000
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ left: `${ball.from.x}%`, top: `${ball.from.y}%`, scale: 0.5, opacity: 0.9 }}
      animate={{
        left: [`${ball.from.x}%`, `${ball.peak.x}%`, `${ball.to.x}%`],
        top: [`${ball.from.y}%`, `${ball.peak.y}%`, `${ball.to.y}%`],
        scale: [0.6, 1.3, 0.95],
        rotate: [0, 260, 540],
        opacity: 1,
      }}
      exit={{ opacity: 0, scale: 0.2, transition: { duration: 0.08 } }}
      transition={{ duration, times: [0, 0.5, 1], ease: ['easeOut', 'easeIn'] }}
    >
      <div
        className={`battle-snowball h-full w-full rounded-full ${
          ball.isCritical || ball.isGiant ? 'battle-snowball--hot' : ''
        }`}
      />
      {(ball.isGiant || ball.isCritical) && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-black text-amber-700">
          {ball.isGiant ? '왕눈덩이' : 'CRIT'}
        </span>
      )}
    </motion.div>
  )
}

/* ─────────────────────────── 터짐 ─────────────────────────── */

function Splat({ hit, unit }: { hit: Hit; unit: number }) {
  const radius = unit * (hit.isCritical ? 1.3 : 0.9)
  return (
    <motion.div
      className="pointer-events-none absolute z-30"
      style={{ left: `${hit.point.x}%`, top: `${hit.point.y}%` }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
    >
      {/* 퍼지는 링 */}
      <motion.span
        className={`absolute left-0 top-0 rounded-full border-4 ${hit.isCritical ? 'border-amber-300' : 'border-white'}`}
        style={{ width: radius, height: radius, marginLeft: -radius / 2, marginTop: -radius / 2 }}
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 1.6, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      {/* 눈 파편 */}
      {SPLAT_ANGLES.map((angle, i) => {
        const dist = radius * (0.7 + ((i * 7) % 5) * 0.12)
        const s = Math.max(4, unit * (0.12 + ((i * 3) % 4) * 0.03))
        return (
          <motion.span
            key={i}
            className="absolute left-0 top-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
            style={{ width: s, height: s, marginLeft: -s / 2, marginTop: -s / 2 }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist + unit * 0.35,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 0.55 + (i % 3) * 0.1, ease: 'easeOut' }}
          />
        )
      })}
      {/* 피해 숫자 */}
      <motion.div
        className={`absolute left-0 top-0 whitespace-nowrap font-black drop-shadow-[0_2px_0_rgba(0,0,0,0.35)] ${
          hit.isCritical ? 'text-amber-300' : 'text-white'
        }`}
        style={{ fontSize: hit.isCritical ? Math.max(18, unit * 0.55) : Math.max(14, unit * 0.4), textShadow: '0 0 6px rgba(0,0,0,0.5)' }}
        initial={{ x: '-50%', y: -unit * 0.2, opacity: 0, scale: 0.6 }}
        animate={{ x: '-50%', y: -unit * 1.1, opacity: [0, 1, 1, 0], scale: [0.6, 1.3, 1, 1] }}
        transition={{ duration: 1, times: [0, 0.15, 0.7, 1] }}
      >
        -{hit.damage}°{hit.isCritical ? '!' : ''}
      </motion.div>
    </motion.div>
  )
}
