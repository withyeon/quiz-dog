'use client'

import { motion } from 'framer-motion'
import { Crown, ShieldCheck, Swords, Users, Zap } from 'lucide-react'
import { RaidAvatar } from '@/components/raid/PartyStrip'
import { RAID_ROLE_ICON_SRC, RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import { RAID, RAID_ROLES, RAID_ROLE_ORDER, getRaidBossRoster, getRaidRole, type RaidSettings } from '@/lib/game/raid'
import { ARENA } from '@/lib/game/raidArena'

type RaidLobbyPanelProps = {
  players: Array<{
    id: string
    nickname: string
    avatar?: string | null
    player_class?: string | null
    is_kicked?: boolean | null
  }>
  settings: RaidSettings
}

const percent = (ratio: number) => `${Math.round(ratio * 100)}%`

/**
 * 시작 전 대기실 — 레이드 파티 모집 화면처럼 오늘 맞설 펭귄 군단, 먼저 입장한 파티원, 핵심 규칙 세 줄을 보여 준다.
 * 파티원은 입장한 순서대로 나열되고 점수·순위는 없다.
 */
export default function RaidLobbyPanel({ players, settings }: RaidLobbyPanelProps) {
  const activePlayers = players.filter((player) => !player.is_kicked)
  const roster = getRaidBossRoster(settings, activePlayers.length)

  const rules = [
    {
      Icon: Swords,
      tone: 'bg-rose-50 text-rose-600 border-rose-200',
      title: '정답 = 물풍선',
      body: `문제를 맞히면 물풍선 ${ARENA.BALLOONS_PER_ANSWER}개! 아레나에서 물풍선을 놓아 물줄기로 펭귄을 맞히면 ${RAID.BASE_DAMAGE} 데미지예요. ${RAID.COMBO_STEPS[0].streak}연속 정답부터는 한 방이 더 세져요. 틀려도 잃는 건 없어요.`,
    },
    {
      Icon: ShieldCheck,
      tone: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      title: '스노우몬은 얼려서 깨기',
      body: `펭귄이 떨어뜨린 알에서 스노우몬이 나와요. 물줄기로 얼린 뒤 몸으로 부딪혀 깨요. ${ARENA.FREEZE_TIME}초 안에 못 깨면 녹아서 폭주해요! 스노우몬·물줄기·펭귄에 닿으면 물방울에 갇혔다가 출발 칸에서 다시 시작해요.`,
    },
    {
      Icon: Zap,
      tone: 'bg-amber-50 text-amber-600 border-amber-200',
      title: '방패·필살기는 다 같이',
      body: `펭귄 체력이 ${percent(RAID.SHIELD_HP_RATIO)} 아래면 얼음 방패 — 반 친구 ${percent(RAID.SHIELD_REQUIRED_RATIO)}가 한 번씩 맞혀야 깨져요. 필살기 예고 ${RAID.SKILL_CHARGE}초 동안 ${percent(RAID.INTERRUPT_REQUIRED_RATIO)}가 맞히면 펭귄이 기절(데미지 ${RAID.GROGGY_MULTIPLIER}배), 못 끊으면 눈보라 물줄기가 지나가요.`,
    },
  ]

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="battle-frost-panel mx-auto max-w-4xl p-4 sm:p-7"
    >
      {/* 펭귄 군단 — 앞에서부터 차례로, 마지막은 황제 */}
      <div className="mb-5 text-center">
        <div className="battle-chip mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          파티 모집 중 · 선생님이 시작하면 역할을 고르고 출발해요
        </div>
        <h2 className="text-2xl font-black text-slate-950 sm:text-4xl">오늘의 펭귄 군단</h2>
        <p className="mt-1.5 text-sm font-semibold text-slate-500">
          앞의 펭귄부터 차례로 쓰러뜨려요. 체력은 파티 인원에 맞춰 정해져요.
        </p>
      </div>

      <div className="mb-6 flex items-end justify-center gap-2 sm:gap-5">
        {roster.map((boss, order) => (
          <div key={boss.index} className="flex min-w-0 flex-col items-center gap-1">
            <div className="relative">
              {boss.isFinal && (
                <div
                  className="absolute inset-0 scale-125 rounded-full bg-gradient-to-t from-rose-400/45 to-transparent blur-xl"
                  aria-hidden
                />
              )}
              <motion.img
                src={RAID_SPRITE_SRC[boss.sprite].idle}
                alt={boss.name}
                draggable={false}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.2 + order * 0.3, repeat: Infinity, ease: 'easeInOut', delay: order * 0.2 }}
                className={`relative aspect-[4/5] object-contain drop-shadow-lg ${
                  boss.isFinal ? 'h-[5.5rem] sm:h-32' : 'h-16 sm:h-24'
                }`}
              />
              <span
                className={`absolute -left-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black shadow ${
                  boss.isFinal ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'
                }`}
              >
                {boss.isFinal ? <Crown className="h-3 w-3" /> : order + 1}
              </span>
            </div>
            <span className="break-keep text-center text-[11px] font-black leading-tight text-slate-800 sm:text-sm">{boss.name}</span>
            <span className="text-[10px] font-bold text-slate-500 sm:text-xs">체력 {boss.maxHp.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 파티원 — 입장하면 팝 하고 나타난다 */}
      <div className="mb-5 rounded-[8px] border border-slate-200 bg-white/[0.72] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-sm font-black text-slate-700">
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-600" />
            우리 파티 {activePlayers.length}명
          </span>
          <span className="text-xs font-bold text-slate-400">친구가 들어오면 여기에 나타나요</span>
        </div>
        {activePlayers.length > 0 ? (
          <div className="grid grid-cols-5 gap-x-1.5 gap-y-2.5 sm:grid-cols-8 md:grid-cols-10">
            {activePlayers.map((player) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 20 }}
                className="flex min-w-0 flex-col items-center gap-1"
              >
                <RaidAvatar avatar={player.avatar} nickname={player.nickname} size={44} role={getRaidRole(player)} />
                <span className="w-full truncate text-center text-[10px] font-bold text-slate-600">{player.nickname}</span>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-sm font-semibold text-slate-400">아직 아무도 없어요</p>
        )}
      </div>

      {/* 규칙 세 가지 */}
      <ul className="mb-5 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {rules.map(({ Icon, tone, title, body }) => (
          <li key={title} className="flex gap-3 rounded-[8px] border border-slate-200 bg-white/[0.72] p-3 sm:flex-col sm:gap-2 sm:p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-black text-slate-900 sm:text-base">{title}</div>
              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-500 sm:text-[13px]">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* 역할 미리보기 — 고르는 건 시작할 때 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {RAID_ROLE_ORDER.map((roleId) => {
          const info = RAID_ROLES[roleId]
          return (
            <div key={roleId} className="flex flex-col items-center gap-1 rounded-[8px] border border-slate-200 bg-white/[0.72] px-1.5 py-2.5 text-center sm:flex-row sm:gap-3 sm:px-3 sm:text-left">
              <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={36} height={36} className="h-9 w-9 shrink-0" draggable={false} />
              <div className="min-w-0">
                <div className="text-xs font-black text-slate-900 sm:text-sm">{info.name}</div>
                <div className="break-keep text-[10px] font-semibold text-slate-500 sm:text-xs">{info.tagline}</div>
              </div>
            </div>
          )
        })}
      </div>
    </motion.section>
  )
}
