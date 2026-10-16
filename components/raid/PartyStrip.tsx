'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { Users } from 'lucide-react'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import { getRaidRole, type RaidPlayerLike, type RaidRole } from '@/lib/game/raid'
import { getDisplayNickname, isAvatarPath, resolveAvatarSrc } from '@/lib/utils/playerDisplay'

export type PartyMember = RaidPlayerLike & { avatar?: string | null }

/** 맞힌 친구 아바타가 빛나는 시간 (ms). 짧게 반짝이고 사라져야 "누가 안 빛나나"를 찾게 되지 않는다 */
const GLOW_MS = 1000

const GLOW_SHADOW = '0 0 0 2px rgba(103, 232, 249, 0.95), 0 0 10px 2px rgba(34, 211, 238, 0.8)'
const IDLE_SHADOW = '0 1px 3px rgba(15, 23, 42, 0.25)'

/** 이모지 아바타인지 (옛 데이터는 닉네임 글자가 avatar 에 들어 있기도 해서 그림 문자일 때만 그대로 쓴다) */
function isEmojiAvatar(value: string): boolean {
  // 대부분의 이모지는 UTF-16 대리쌍이고, 기호 이모지는 U+2190~2BFF 안에 있다
  return value.length > 0 && !isAvatarPath(value) && /[\u2190-\u2BFF\uD800-\uDFFF]/.test(value) && Array.from(value).length <= 4
}

type RaidAvatarProps = {
  avatar?: string | null
  nickname: string
  /** 한 변 px */
  size?: number
  role?: RaidRole | null
  /** 내 아바타 (고리) */
  mine?: boolean
  /** 값이 바뀔 때마다 한 번 빛나며 튄다 (0 이면 가만히). 점수가 오른 순간의 번호를 넣는다 */
  pulse?: number
  className?: string
}

/**
 * 레이드 아바타: 캐릭터 그림(또는 이모지/첫 글자) + 역할 아이콘 뱃지.
 * 파티 띠와 대기실이 같이 쓴다.
 */
export function RaidAvatar({ avatar, nickname, size = 36, role = null, mine = false, pulse = 0, className = '' }: RaidAvatarProps) {
  const controls = useAnimationControls()
  const reduceMotion = useReducedMotion()
  const [lit, setLit] = useState(false)

  useEffect(() => {
    if (!pulse) return
    setLit(true)
    if (!reduceMotion) {
      void controls.start({ y: [0, -6, 0], scale: [1, 1.16, 1], transition: { duration: 0.5, ease: 'easeOut' } })
    }
    const timer = window.setTimeout(() => setLit(false), GLOW_MS)
    return () => window.clearTimeout(timer)
  }, [controls, pulse, reduceMotion])

  const value = String(avatar ?? '').trim()
  const displayName = getDisplayNickname(nickname, '친구')
  const initial = Array.from(displayName)[0] ?? '?'
  const badgeSize = Math.max(12, Math.round(size * 0.4))

  return (
    <motion.div animate={controls} className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white transition-shadow duration-300 ${
          mine ? 'border-2 border-amber-400' : 'border border-white/80'
        }`}
        style={{ boxShadow: lit ? GLOW_SHADOW : IDLE_SHADOW }}
      >
        {isAvatarPath(value) ? (
          <Image src={resolveAvatarSrc(value)} alt="" fill sizes={`${size}px`} className="object-contain p-0.5" />
        ) : isEmojiAvatar(value) ? (
          <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{value}</span>
        ) : (
          <span className="font-black text-slate-600" style={{ fontSize: size * 0.45, lineHeight: 1 }}>{initial}</span>
        )}
      </div>
      {role && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm"
          style={{ width: badgeSize, height: badgeSize }}
        >
          <img
            src={RAID_ROLE_ICON_SRC[role]}
            alt=""
            width={badgeSize - 3}
            height={badgeSize - 3}
            draggable={false}
            style={{ width: badgeSize - 3, height: badgeSize - 3 }}
          />
        </span>
      )}
    </motion.div>
  )
}

type PartyStripProps = {
  players: PartyMember[]
  playerId: string | null
  className?: string
}

/**
 * 파티 띠 — 같이 싸우는 반 친구들의 아바타가 한 줄로 늘어선다.
 *
 * 낙인 방지 원칙: 순위·점수·"아직 못 맞힌 친구" 표시는 없다. 순서는 닉네임 가나다순으로 고정이라
 * (데미지순이 아니다) 누가 앞서는지 알 수 없고, 점수가 오르는 순간 그 친구가 잠깐 빛날 뿐이다.
 */
export default function PartyStrip({ players, playerId, className = '' }: PartyStripProps) {
  const members = useMemo(
    () => [...players].sort((a, b) => (
      getDisplayNickname(a.nickname).localeCompare(getDisplayNickname(b.nickname), 'ko') || a.id.localeCompare(b.id)
    )),
    [players],
  )

  // 점수가 오른 친구에게 번호를 붙여 준다. 실시간 이벤트가 아니라 스냅샷 차이라서 useRaidHitPopups 와 같은 방식이다.
  const previousScoresRef = useRef<Map<string, number> | null>(null)
  const pulseSeqRef = useRef(0)
  const [pulses, setPulses] = useState<Record<string, number>>({})
  useEffect(() => {
    const next = new Map(players.map((player) => [player.id, Math.max(0, player.score ?? 0)]))
    const previous = previousScoresRef.current
    previousScoresRef.current = next
    if (!previous) return
    const raised: string[] = []
    next.forEach((score, id) => {
      const before = previous.get(id)
      if (before !== undefined && score > before) raised.push(id)
    })
    if (raised.length === 0) return
    setPulses((current) => {
      const updated = { ...current }
      raised.forEach((id) => { updated[id] = ++pulseSeqRef.current })
      return updated
    })
  }, [players])

  // 처음 한 번만 내 아바타가 보이는 자리로 띠를 밀어 둔다 (페이지 스크롤은 건드리지 않는다)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const myRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)
  const hasMe = members.some((member) => member.id === playerId)
  useEffect(() => {
    if (centeredRef.current || !hasMe) return
    const scroller = scrollerRef.current
    const me = myRef.current
    if (!scroller || !me) return
    centeredRef.current = true
    scroller.scrollLeft = Math.max(0, me.offsetLeft - (scroller.clientWidth - me.offsetWidth) / 2)
  }, [hasMe])

  return (
    <section
      aria-label="함께 싸우는 친구들"
      className={`flex items-center gap-2 rounded-[10px] border border-white/60 bg-white/65 px-2 py-1 shadow-sm backdrop-blur-md ${className}`}
    >
      <div className="flex shrink-0 items-center gap-1 text-[11px] font-black text-slate-700 sm:text-xs">
        <Users className="h-3.5 w-3.5 text-sky-600" />
        {members.length}명 함께
      </div>
      {/* 빛과 튀는 움직임이 잘리지 않게 위아래 여백을 두고, 그만큼 바깥 여백을 음수로 되돌려 높이를 아낀다 */}
      <div
        ref={scrollerRef}
        className="relative -my-1 flex min-w-0 flex-1 gap-2 overflow-x-auto py-2 pl-2 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,#000_6px,#000_calc(100%_-_14px),transparent)]"
      >
        {members.map((member) => {
          const mine = member.id === playerId
          return (
            <div key={member.id} ref={mine ? myRef : undefined} className="shrink-0" title={mine ? '나' : getDisplayNickname(member.nickname)}>
              <RaidAvatar
                avatar={member.avatar}
                nickname={member.nickname}
                size={32}
                role={getRaidRole(member)}
                mine={mine}
                pulse={pulses[member.id] ?? 0}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
