'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Flame, Lock, Snowflake, Sword, Users } from 'lucide-react'
import type { Database } from '@/types/database.types'
import BossStage from '@/components/raid/BossStage'
import { RAID_ROLE_ICON_SRC, RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import { useRaidEvents, useRaidFrenzyClock, useRaidHitPopups } from '@/hooks/useRaidEffects'
import {
  RAID,
  RAID_ROLES,
  computeRaidState,
  getRaidFrenzyState,
  getRaidRole,
  parseRaidSettings,
} from '@/lib/game/raid'
import { formatTime } from '@/lib/utils/formatTime'

type Player = Database['public']['Tables']['players']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface RaidDashboardProps {
  players: Player[]
  room: Room
}

type FeedItem = { id: string; nickname: string; damage: number; at: number }

/**
 * 선생님 화면(프로젝터) — 반 전체가 같이 보는 보스 무대.
 * 학생 화면과 같은 computeRaidState 로 같은 보스를 보고, 타격·사건은 players 스냅샷 차이로 띄운다.
 * 데미지 피드는 기여만 보여준다. 누가 못 맞혔는지는 어디에도 나오지 않는다.
 */
export default function RaidDashboard({ players, room }: RaidDashboardProps) {
  const isPlaying = room.status === 'playing'
  const settings = useMemo(() => parseRaidSettings(room.settings), [room.settings])
  const activePlayers = useMemo(() => players.filter((player) => !player.is_kicked), [players])
  const raidState = useMemo(() => computeRaidState(activePlayers, settings), [activePlayers, settings])
  const frenzy = useRaidFrenzyClock(room.started_at, isPlaying, getRaidFrenzyState)
  const { hits } = useRaidHitPopups(activePlayers, isPlaying)
  const events = useRaidEvents(raidState, frenzy, isPlaying)

  // 남은 시간
  const [remaining, setRemaining] = useState<number | null>(null)
  useEffect(() => {
    if (!isPlaying || !room.started_at || !room.duration_seconds) {
      setRemaining(null)
      return
    }
    const started = new Date(room.started_at).getTime()
    const total = Number(room.duration_seconds)
    const update = () => setRemaining(Math.max(0, total - Math.floor((Date.now() - started) / 1000)))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [isPlaying, room.duration_seconds, room.started_at])

  // 최근 공격 피드 — score 증가분
  const [feed, setFeed] = useState<FeedItem[]>([])
  const previousScoresRef = useRef<Map<string, number> | null>(null)
  useEffect(() => {
    const previous = previousScoresRef.current
    const next = new Map(activePlayers.map((player) => [player.id, player.score ?? 0]))
    if (previous && isPlaying) {
      const added: FeedItem[] = []
      activePlayers.forEach((player) => {
        const before = previous.get(player.id)
        if (before === undefined) return
        const diff = (player.score ?? 0) - before
        if (diff > 0) added.push({ id: `${player.id}-${Date.now()}-${diff}`, nickname: player.nickname, damage: diff, at: Date.now() })
      })
      if (added.length > 0) setFeed((prev) => [...added.reverse(), ...prev].slice(0, 10))
    }
    previousScoresRef.current = next
  }, [activePlayers, isPlaying])

  const roster = useMemo(
    () => [...activePlayers].sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')),
    [activePlayers],
  )
  const shield = raidState.current?.shield ?? null

  return (
    <section className="overflow-hidden rounded-lg border border-sky-200/30 bg-slate-950 text-white shadow-2xl shadow-sky-950/30">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-sky-950/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">🐧 황제 펭귄을 막아라! LIVE</h2>
          <p className="mt-1 text-sm font-bold text-sky-100/75">반 전체가 한 편. 정답마다 펭귄의 체력이 줄어요</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-black">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-sky-100">
            <Users className="h-4 w-4" /> {raidState.activePlayerCount}명
          </span>
          <span className="rounded-full bg-emerald-400 px-3 py-2 text-emerald-950">
            처치 {raidState.defeatedCount}/{raidState.roster.length}
          </span>
          <span className="rounded-full bg-amber-300 px-3 py-2 text-amber-950">
            반 전체 {raidState.totalDamage.toLocaleString()} 데미지
          </span>
          {remaining !== null && (
            <span className={`rounded-full px-3 py-2 ${remaining <= 30 ? 'animate-pulse bg-rose-500 text-white' : 'bg-white/10 text-sky-100'}`}>
              남은 시간 {formatTime(remaining)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <BossStage
          boss={raidState.current}
          bossCount={raidState.roster.length}
          defeatedCount={raidState.defeatedCount}
          frenzy={frenzy}
          hits={hits}
          events={events}
          size="large"
        />

        <div className="flex flex-col gap-3">
          {/* 집중 공격 */}
          <div className={`rounded-xl border p-4 ${frenzy.active ? 'border-orange-300 bg-orange-500/20' : 'border-white/10 bg-white/[0.06]'}`}>
            <div className="flex items-center gap-2 text-sm font-black text-orange-200">
              <Flame className="h-4 w-4" /> 집중 공격
            </div>
            {frenzy.active ? (
              <div className="mt-1 text-3xl font-black text-orange-300">데미지 {RAID.FRENZY_MULTIPLIER}배 · {frenzy.secondsLeft}초</div>
            ) : (
              <div className="mt-1 text-2xl font-black text-white">{frenzy.nextIn}초 뒤</div>
            )}
            <p className="mt-1 text-xs font-bold text-white/60">{RAID.FRENZY_PERIOD}초마다 {RAID.FRENZY_DURATION}초 동안</p>
          </div>

          {/* 얼음 방패 */}
          <div className={`rounded-xl border p-4 ${shield?.active ? 'border-cyan-300 bg-cyan-400/15' : 'border-white/10 bg-white/[0.06]'}`}>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-200">
              <Lock className="h-4 w-4" /> 얼음 방패
            </div>
            {shield?.active ? (
              <>
                <div className="mt-1 text-3xl font-black text-cyan-100">{shield.points} / {shield.required}</div>
                <p className="mt-1 text-xs font-bold text-white/70">친구 {shield.remaining}명이 더 맞히면 깨져요</p>
              </>
            ) : (
              <p className="mt-1 text-sm font-bold text-white/60">
                {shield?.broken ? '이번 펭귄의 방패는 깨졌어요' : '체력이 절반 아래로 떨어지면 올라와요'}
              </p>
            )}
          </div>

          {/* 펭귄 진행 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-sky-200">
              <Snowflake className="h-4 w-4" /> 펭귄 군단
            </div>
            <div className="flex flex-wrap gap-2">
              {raidState.bosses.map((boss) => {
                const isCurrent = raidState.current?.def.index === boss.def.index
                return (
                  <div
                    key={boss.def.index}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-black ${
                      boss.defeated ? 'bg-emerald-400/20 text-emerald-200' : isCurrent ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/60' : 'bg-white/5 text-white/50'
                    }`}
                  >
                    <img
                      src={boss.defeated ? RAID_SPRITE_SRC[boss.def.sprite].down : RAID_SPRITE_SRC[boss.def.sprite].idle}
                      alt=""
                      width={20}
                      height={25}
                      style={{ width: 20, height: 25 }}
                    />
                    {boss.def.name}
                    {boss.defeated && <Check className="h-3.5 w-3.5" />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 최근 공격 */}
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-black text-sky-200">
              <Sword className="h-4 w-4" /> 최근 공격
            </div>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {feed.slice(0, 6).map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: Math.max(0.45, 1 - index * 0.12), x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold"
                  >
                    <span>{item.nickname}</span>
                    <span className="font-black text-amber-300">-{item.damage}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {feed.length === 0 && <p className="text-xs font-bold text-white/40">아직 공격이 없어요</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 참가자 — 이름순. 기여(데미지·명중)만 보여준다 */}
      <div className="border-t border-white/10 bg-white/[0.04] p-4">
        <h3 className="mb-3 text-sm font-black text-sky-100">참가자 {roster.length}명 · 기여</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {roster.map((player) => {
            const role = getRaidRole(player)
            return (
              <div key={player.id} className="rounded-lg border border-white/10 bg-white/10 px-3 py-2">
                <div className="truncate text-sm font-black">{player.nickname}</div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] font-bold text-sky-100/70">
                  <span className="flex items-center gap-1">
                    {role && <img src={RAID_ROLE_ICON_SRC[role]} alt="" width={14} height={14} className="h-3.5 w-3.5" />}
                    {role ? RAID_ROLES[role].shortName : '역할 고르는 중'}
                  </span>
                  <span className="text-amber-200">{(player.score ?? 0).toLocaleString()} · {player.gold ?? 0}명중</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
