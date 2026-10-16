'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Users } from 'lucide-react'
import { getRaidTitles, type RaidPlayerLike, type RaidState, type RaidTitle } from '@/lib/game/raid'
import { getPlayerDisplayNickname } from '@/lib/utils/playerDisplay'
import AnimatedNumber from '@/components/raid/result/AnimatedNumber'
import BossPips from '@/components/raid/result/BossPips'
import CeremonyParticles from '@/components/raid/result/CeremonyParticles'
import RaidAvatar from '@/components/raid/result/RaidAvatar'
import RaidTeamStars from '@/components/raid/result/RaidTeamStars'
import { getCeremonyBackdrop } from '@/components/raid/result/ceremonyBackdrop'
import { getRaidOutcome } from '@/components/raid/result/raidOutcome'
import { RAID_TITLE_VISUAL, isSpecialTitle, titleRank } from '@/components/raid/result/titleStyle'

type CeremonyPlayer = RaidPlayerLike & { avatar?: string | null }

type RaidCeremonyProps = {
  raidState: RaidState
  players: CeremonyPlayer[]
}

// getRaidTitles 는 모든 참가자에게 하나 이상 주지만, 타입상 비어 있을 수 있어 같은 문구로 받쳐 둔다
const FALLBACK_TITLE: RaidTitle = { id: 'together', name: '함께한 용사', description: '반 친구들과 끝까지 함께했어요' }

/**
 * 레이드가 끝났을 때 프로젝터에 띄우는 의식 화면.
 * 팀 별·저지율을 크게 보여 주고, 오른쪽에 모든 친구의 대표 칭호를 한꺼번에 공개한다.
 * 특별 칭호(최강의 일격·명중왕·필살기 저지왕)가 앞에 오고 나머지는 이름순 — 칭호 없는 친구는 없다.
 * 개인 숫자(데미지·명중)는 여기에도 없다. 칭호 설명도 화면에 풀어 쓰지 않는다.
 */
export default function RaidCeremony({ raidState, players }: RaidCeremonyProps) {
  const outcome = getRaidOutcome(raidState)

  const entries = useMemo(() => {
    const activePlayers = players.filter((player) => !player.is_kicked)
    const titles = getRaidTitles(activePlayers)
    return activePlayers
      .map((player) => {
        const list = titles.get(player.id) ?? []
        const primary = list[0] ?? FALLBACK_TITLE
        return {
          id: player.id,
          nickname: getPlayerDisplayNickname(player.nickname, player.avatar),
          avatar: player.avatar ?? null,
          primary,
          extra: Math.max(0, list.length - 1),
        }
      })
      .sort(
        (a, b) =>
          titleRank(a.primary.id) - titleRank(b.primary.id) ||
          a.nickname.localeCompare(b.nickname, 'ko') ||
          a.id.localeCompare(b.id),
      )
  }, [players])

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative isolate overflow-hidden rounded-xl text-white"
      style={{ background: getCeremonyBackdrop(outcome.victory) }}
    >
      <CeremonyParticles kind={outcome.victory ? 'confetti' : 'snow'} />

      <div className="relative z-10 grid gap-5 p-5 xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] xl:items-start xl:gap-8 xl:p-8">
        {/* 팀 결과 */}
        <div className="flex flex-col items-center text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-black ${
              outcome.victory ? 'bg-amber-300 text-amber-950' : 'bg-white/15 text-sky-100 ring-1 ring-white/25'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {outcome.victory ? '황제 펭귄을 막아라! 승리' : '황제 펭귄을 막아라! 결과'}
          </span>

          <RaidTeamStars stars={outcome.stars} size="xl" className="mt-4" />

          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="mt-4 break-keep text-4xl font-black leading-tight drop-shadow-[0_3px_8px_rgba(0,0,0,0.65)] 2xl:text-5xl"
          >
            {outcome.headline}
          </motion.h2>
          <p className="mt-2 max-w-sm break-keep text-base font-bold text-sky-50/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)] 2xl:text-lg">
            {outcome.message}
          </p>

          <BossPips
            bosses={raidState.bosses}
            width={44}
            currentIndex={raidState.current?.def.index ?? null}
            showNames
            className="mt-5"
          />

          <div className="mt-6 grid w-full grid-cols-3 gap-2">
            <div className="rounded-xl bg-black/30 px-2 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-xs font-bold text-sky-100/80">반 전체 데미지</div>
              <AnimatedNumber value={raidState.totalDamage} fromZero durationMs={1600} className="mt-1 block text-2xl font-black text-amber-200 2xl:text-3xl" />
            </div>
            <div className="rounded-xl bg-black/30 px-2 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-xs font-bold text-sky-100/80">명중 합</div>
              <AnimatedNumber value={raidState.totalHits} fromZero durationMs={1600} className="mt-1 block text-2xl font-black text-white 2xl:text-3xl" />
            </div>
            <div className="rounded-xl bg-black/30 px-2 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <div className="break-keep text-xs font-bold text-sky-100/80">함께한 친구</div>
              <div className="mt-1 text-2xl font-black text-emerald-200 2xl:text-3xl">{raidState.activePlayerCount}명</div>
            </div>
          </div>
        </div>

        {/* 칭호 격자 — 전원을 한꺼번에 공개 */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="rounded-2xl border border-white/15 bg-slate-950/55 p-4 backdrop-blur-sm 2xl:p-5"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xl font-black text-amber-200">
              <Users className="h-5 w-5" /> 오늘의 칭호
            </h3>
            <p className="text-sm font-bold text-sky-100/70">모든 친구에게 칭호가 하나씩 있어요</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
            {entries.map((entry) => {
              const special = isSpecialTitle(entry.primary.id)
              const { Icon, dark } = RAID_TITLE_VISUAL[entry.primary.id]
              return (
                <div
                  key={entry.id}
                  className={`flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                    special
                      ? 'border-amber-300/80 bg-gradient-to-br from-amber-300/25 to-amber-500/10 shadow-[0_0_18px_rgba(251,191,36,0.3)]'
                      : 'border-white/10 bg-white/[0.07]'
                  }`}
                >
                  <RaidAvatar avatar={entry.avatar} nickname={entry.nickname} size="md" className={special ? 'ring-2 ring-amber-300' : 'ring-1 ring-white/20'} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white 2xl:text-base">{entry.nickname}</div>
                    <div className={`flex min-w-0 items-center gap-1 text-xs font-black 2xl:text-sm ${dark}`}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{entry.primary.name}</span>
                      {entry.extra > 0 && <span className="shrink-0 text-white/60">+{entry.extra}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}
