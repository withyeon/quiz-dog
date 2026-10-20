'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Users } from 'lucide-react'
import {
  RAID_ROLES,
  getRaidRole,
  getRaidTitles,
  type RaidPlayerLike,
  type RaidRole,
  type RaidState,
} from '@/lib/game/raid'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import AnimatedNumber from '@/components/raid/result/AnimatedNumber'
import BossPips from '@/components/raid/result/BossPips'
import CeremonyParticles from '@/components/raid/result/CeremonyParticles'
import RaidAvatar from '@/components/raid/result/RaidAvatar'
import RaidTeamStars from '@/components/raid/result/RaidTeamStars'
import RaidTitleBadge from '@/components/raid/result/RaidTitleBadge'
import { getCeremonyBackdrop } from '@/components/raid/result/ceremonyBackdrop'
import { getRaidOutcome } from '@/components/raid/result/raidOutcome'

type RaidResultPlayer = RaidPlayerLike & { avatar?: string | null }

type RaidResultPanelProps = {
  raidState: RaidState
  /** 같은 방 전원(강퇴된 친구는 안에서 걸러 낸다) */
  players: RaidResultPlayer[]
  playerId: string | null
  role: RaidRole | null
  onShowResult: () => void
}

/** 폰 한 화면에 다 보이도록 친구 아바타는 이 수까지만 늘어놓고 나머지는 +N */
const MAX_MATE_AVATARS = 40

/**
 * 학생 결과 화면. 협동 게임이라 "반 전체가 어디까지 갔는지"(별·저지율)를 먼저 보여주고,
 * 내 카드(칭호·기여)와 함께 싸운 친구들 얼굴을 그 아래에 둔다.
 * 순위표는 없다 — 다른 친구의 데미지·명중 숫자는 여기에 나오지 않고, 칭호도 내 것만 보인다.
 */
export default function RaidResultPanel({ raidState, players, playerId, role, onShowResult }: RaidResultPanelProps) {
  const outcome = getRaidOutcome(raidState)

  const activePlayers = useMemo(() => players.filter((player) => !player.is_kicked), [players])
  const titles = useMemo(() => getRaidTitles(activePlayers), [activePlayers])
  const mates = useMemo(
    () =>
      activePlayers
        .map((player) => ({ player, name: getPlayerDisplayNickname(player.nickname, player.avatar) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.player.id.localeCompare(b.player.id)),
    [activePlayers],
  )

  const me = playerId ? activePlayers.find((player) => player.id === playerId) ?? null : null
  const myTitles = me ? titles.get(me.id) ?? [] : []
  const myRole = role ?? getRaidRole(me)
  const roleInfo = myRole ? RAID_ROLES[myRole] : null
  const myName = me ? getPlayerDisplayNickname(me.nickname, me.avatar) : ''
  const myDamage = Math.max(0, me?.score ?? 0)
  const myHits = Math.max(0, me?.gold ?? 0)
  // position 은 깬 스노우몬 수다 (raid.ts 저장 규칙)
  const myKills = Math.max(0, me?.position ?? 0)

  const shownMates = mates.slice(0, MAX_MATE_AVATARS)
  const hiddenMates = mates.length - shownMates.length

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="battle-frost-panel mx-auto max-w-2xl p-3 sm:p-5"
    >
      {/* 팀 결과 — 승리면 승리 그림, 아니면 차분한 얼음 무대 */}
      <div
        className="relative isolate overflow-hidden rounded-2xl text-center text-white shadow-lg"
        style={{ background: getCeremonyBackdrop(outcome.victory) }}
      >
        <CeremonyParticles kind={outcome.victory ? 'confetti' : 'snow'} />
        <div className="relative z-10 px-3 pb-5 pt-5 sm:px-6 sm:pb-7 sm:pt-7">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${
              outcome.victory ? 'bg-amber-300 text-amber-950' : 'bg-white/15 text-sky-100 ring-1 ring-white/25'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {outcome.victory ? '승리!' : '시간 종료'}
          </span>

          <RaidTeamStars stars={outcome.stars} size="lg" className="mt-3" />

          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="mt-3 break-keep text-3xl font-black leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] sm:text-4xl"
          >
            {outcome.headline}
          </motion.h2>
          <p className="mx-auto mt-1.5 max-w-sm break-keep text-sm font-bold text-sky-50/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] sm:text-base">
            {outcome.message}
          </p>

          <BossPips
            bosses={raidState.bosses}
            width={30}
            currentIndex={raidState.current?.def.index ?? null}
            className="mt-4"
          />

          <div className="mt-4 grid grid-cols-3 gap-2">
            {/* 폰(3열)에서 낱말 중간이 끊기지 않게 break-keep */}
            <div className="rounded-xl bg-white/10 px-1.5 py-2 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-[11px] font-bold text-sky-100/80">반 전체 데미지</div>
              <AnimatedNumber value={raidState.totalDamage} fromZero className="mt-0.5 block text-xl font-black text-amber-200 sm:text-2xl" />
            </div>
            <div className="rounded-xl bg-white/10 px-1.5 py-2 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-[11px] font-bold text-sky-100/80">쓰러뜨린 펭귄</div>
              <div className="mt-0.5 text-xl font-black text-emerald-200 sm:text-2xl">
                {raidState.defeatedCount}/{raidState.roster.length}
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-1.5 py-2 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-[11px] font-bold text-sky-100/80">반 전체 명중</div>
              <AnimatedNumber value={raidState.totalHits} fromZero className="mt-0.5 block text-xl font-black text-white sm:text-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* 내 카드 — 칭호는 모두에게 하나 이상. 숫자는 내 것만 */}
      {me && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="mt-3 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-4 text-left shadow-sm"
        >
          <div className="flex items-center gap-3">
            <RaidAvatar avatar={me.avatar} nickname={myName} size="xl" className="ring-4 ring-amber-200" />
            <div className="min-w-0">
              <div className="text-xs font-black text-amber-700">내 카드</div>
              <div className="truncate text-2xl font-black leading-tight text-slate-900">{myName}</div>
              {roleInfo && myRole && (
                <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  <img src={RAID_ROLE_ICON_SRC[myRole]} alt="" width={20} height={20} className="h-5 w-5" />
                  {roleInfo.name}
                </div>
              )}
            </div>
          </div>

          {myTitles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {myTitles.map((title) => (
                <RaidTitleBadge key={title.id} title={title} />
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-1 py-2">
              <div className="break-keep text-[11px] font-bold text-amber-700">내 데미지</div>
              <div className="mt-0.5 text-xl font-black text-amber-900">{myDamage.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-1 py-2">
              <div className="break-keep text-[11px] font-bold text-rose-700">명중</div>
              <div className="mt-0.5 text-xl font-black text-rose-900">{myHits}번</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-1 py-2">
              <div className="break-keep text-[11px] font-bold text-violet-700">스노우몬</div>
              <div className="mt-0.5 text-xl font-black text-violet-900">{myKills}마리</div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 함께 싸운 친구들 — 얼굴만. 이름순이라 누가 앞서는지 알 수 없다 */}
      {mates.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="mt-3 rounded-2xl border border-sky-100 bg-white/70 p-3 text-left"
        >
          <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-sky-700">
            <Users className="h-3.5 w-3.5" />
            함께 싸운 친구 {raidState.activePlayerCount}명
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shownMates.map(({ player, name }) => (
              <RaidAvatar
                key={player.id}
                avatar={player.avatar}
                nickname={name}
                size="sm"
                className={player.id === playerId ? 'ring-2 ring-amber-400' : 'ring-1 ring-sky-100'}
              />
            ))}
            {hiddenMates > 0 && (
              <span className="inline-flex h-9 items-center rounded-full bg-sky-100 px-2.5 text-xs font-black text-sky-700">
                +{hiddenMates}
              </span>
            )}
          </div>
        </motion.div>
      )}

      <button
        type="button"
        onClick={onShowResult}
        className="mt-4 w-full rounded-xl bg-slate-900 px-6 py-4 text-lg font-black text-white transition hover:bg-slate-800 active:scale-[0.99]"
      >
        전체 결과 보기
      </button>
    </motion.section>
  )
}
