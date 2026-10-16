'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { RAID_ROLES, RAID_ROLE_ORDER, getRaidRole, type RaidPlayerLike, type RaidRole } from '@/lib/game/raid'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import RaidAvatar from '@/components/raid/result/RaidAvatar'

type WallPlayer = RaidPlayerLike & { avatar?: string | null }

/** 친구가 때린 뒤 카드가 빛나는 시간(ms) */
const GLOW_MS = 1100

type PartyCardProps = {
  nickname: string
  avatar: string | null
  role: RaidRole | null
  /** 이 친구의 "방금 때렸다" 카운터. 올라갈 때마다 카드가 잠깐 빛난다 */
  pulse: number
}

/**
 * 파티 벽 카드 한 장. 숫자(데미지·명중)는 일부러 없다 — 프로젝터에서는 얼굴과 이름, 역할만 보이고
 * 때린 순간에만 빛난다. 빛나지 않는 것은 아무 표시도 아니라서(바로 꺼진다) 안 맞힌 친구가 드러나지 않는다.
 * memo 로 감싸서 다른 친구가 때릴 때 나머지 카드는 다시 그리지 않는다.
 */
const PartyCard = memo(function PartyCard({ nickname, avatar, role, pulse }: PartyCardProps) {
  const [lit, setLit] = useState(false)
  useEffect(() => {
    if (!pulse) return
    setLit(true)
    const timer = window.setTimeout(() => setLit(false), GLOW_MS)
    return () => window.clearTimeout(timer)
  }, [pulse])

  return (
    <div
      className={`relative flex flex-col items-center gap-1 rounded-xl border px-1 pb-1.5 pt-2 transition-all duration-300 ${
        lit
          ? '-translate-y-0.5 border-amber-300 bg-amber-300/25 shadow-[0_0_22px_rgba(251,191,36,0.8)]'
          : 'border-white/10 bg-white/[0.06]'
      }`}
    >
      <div className={`relative transition-transform duration-300 ${lit ? 'scale-110' : 'scale-100'}`}>
        <RaidAvatar avatar={avatar} nickname={nickname} size="md" className={lit ? 'ring-2 ring-amber-200' : 'ring-1 ring-white/20'} />
        {role && (
          <img
            src={RAID_ROLE_ICON_SRC[role]}
            alt={RAID_ROLES[role].shortName}
            width={20}
            height={20}
            className="absolute -bottom-1 -right-1.5 h-5 w-5 rounded-full bg-slate-900 p-0.5 ring-1 ring-white/30"
          />
        )}
      </div>
      <span className="w-full truncate px-0.5 text-center text-xs font-black leading-tight text-white 2xl:text-sm">{nickname}</span>
    </div>
  )
})

type PartyWallProps = {
  players: WallPlayer[]
  /** 친구별 "방금 때렸다" 카운터 (useRaidScoreActivity) */
  pulses: Record<string, number>
}

/**
 * 파티 벽 — 반 전체가 한 파티라는 걸 보여 주는 아바타 격자.
 * 순서는 닉네임순으로 고정이라 점수가 바뀌어도 카드가 자리를 옮기지 않는다(순위처럼 읽히지 않게).
 */
export default function PartyWall({ players, pulses }: PartyWallProps) {
  const roster = useMemo(
    () =>
      players
        .map((player) => ({
          id: player.id,
          nickname: getPlayerDisplayNickname(player.nickname, player.avatar),
          avatar: player.avatar ?? null,
          role: getRaidRole(player),
        }))
        .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko') || a.id.localeCompare(b.id)),
    [players],
  )

  const roleCounts = useMemo(() => {
    const counts: Record<RaidRole, number> = { warrior: 0, mage: 0, guardian: 0 }
    roster.forEach((member) => {
      if (member.role) counts[member.role] += 1
    })
    return counts
  }, [roster])

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-slate-800/60 to-slate-900/80 p-3 2xl:p-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-black text-sky-100">
          <Users className="h-5 w-5 text-sky-300" /> 우리 반 파티 · {roster.length}명
        </h3>
        {/* 역할 구성 — 방패가 느려질 수 있는지 한눈에 */}
        <div className="flex items-center gap-3 text-sm font-black text-sky-100/80">
          {RAID_ROLE_ORDER.map((roleId) => (
            <span key={roleId} className="inline-flex items-center gap-1">
              <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={18} height={18} className="h-[18px] w-[18px]" />
              {RAID_ROLES[roleId].shortName} {roleCounts[roleId]}
            </span>
          ))}
        </div>
      </div>
      {/* 30명이 프로젝터(1920×1080) 한 화면에 들어오도록 xl 에서 10열 */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {roster.map((member) => (
          <PartyCard key={member.id} nickname={member.nickname} avatar={member.avatar} role={member.role} pulse={pulses[member.id] ?? 0} />
        ))}
      </div>
      {roster.length === 0 && <p className="py-4 text-center text-sm font-bold text-white/40">아직 파티가 없어요</p>}
    </div>
  )
}
