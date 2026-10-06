'use client'

import { motion } from 'framer-motion'
import { Flame, ShieldCheck, Snowflake, Users } from 'lucide-react'
import { RAID, RAID_ROLES, RAID_ROLE_ORDER, getRaidBossRoster, type RaidSettings } from '@/lib/game/raid'
import { RAID_ROLE_ICON_SRC, RAID_SPRITE_SRC } from '@/components/raid/raidAssets'

type RaidLobbyPanelProps = {
  players: Array<{ id: string; nickname: string; is_kicked?: boolean | null }>
  settings: RaidSettings
}

/** 시작 전 대기 화면. 오늘 쓰러뜨릴 펭귄들과 규칙, 참가자를 보여준다. */
export default function RaidLobbyPanel({ players, settings }: RaidLobbyPanelProps) {
  const activePlayers = players.filter((player) => !player.is_kicked)
  const roster = getRaidBossRoster(settings, activePlayers.length)

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="battle-frost-panel mx-auto max-w-4xl p-5 sm:p-7"
    >
      <div className="mb-5 text-center">
        <div className="battle-chip mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
          <Snowflake className="h-3.5 w-3.5 text-sky-600" />
          선생님이 시작하면 역할을 고르고 바로 출발해요
        </div>
        <h2 className="text-3xl font-black text-slate-950 sm:text-4xl">오늘의 펭귄 군단</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          앞의 펭귄부터 차례로 쓰러뜨려요. 마지막은 황제 펭귄! 체력은 참가 인원에 맞춰 정해져요.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-center gap-4">
        {roster.map((boss) => (
          <div key={boss.index} className="flex flex-col items-center gap-1">
            <img
              src={RAID_SPRITE_SRC[boss.sprite].idle}
              alt={boss.name}
              width={boss.isFinal ? 88 : 64}
              height={boss.isFinal ? 110 : 80}
              draggable={false}
              style={{ width: boss.isFinal ? 88 : 64, height: boss.isFinal ? 110 : 80 }}
            />
            <span className="text-sm font-black text-slate-800">{boss.name}</span>
            <span className="text-xs font-bold text-slate-500">체력 {boss.maxHp.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {RAID_ROLE_ORDER.map((roleId) => {
          const info = RAID_ROLES[roleId]
          return (
            <div key={roleId} className="rounded-[8px] border border-slate-200 bg-white/[0.72] p-4">
              <div className="flex items-center gap-2 text-base font-black text-slate-900">
                <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={28} height={28} className="h-7 w-7" draggable={false} />
                {info.name}
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{info.description}</div>
            </div>
          )
        })}
      </div>

      <ul className="mb-6 space-y-2 text-sm font-semibold text-slate-600">
        <li className="flex items-start gap-2">
          <Snowflake className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
          정답 하나에 {RAID.BASE_DAMAGE} 데미지. 틀려도 펭귄은 반격하지 않아요. 연속 정답만 끊겨요.
        </li>
        <li className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />
          펭귄 체력이 절반 아래로 떨어지면 얼음 방패! 반의 절반 넘는 친구가 한 번씩 맞혀야 깨져요.
        </li>
        <li className="flex items-start gap-2">
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          {RAID.FRENZY_PERIOD}초마다 {RAID.FRENZY_DURATION}초 동안 집중 공격 시간. 그때 맞히면 데미지 {RAID.FRENZY_MULTIPLIER}배!
        </li>
      </ul>

      <div className="rounded-[8px] border border-slate-200 bg-white/[0.72] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-700">
          <Users className="h-4 w-4 text-sky-600" />
          참가자 {activePlayers.length}명
        </div>
        <div className="flex flex-wrap gap-2">
          {activePlayers.map((player) => (
            <span key={player.id} className="battle-chip px-3 py-1.5 text-sm font-bold text-slate-700">
              {player.nickname}
            </span>
          ))}
          {activePlayers.length === 0 && <span className="text-sm text-slate-400">아직 아무도 없어요</span>}
        </div>
      </div>
    </motion.section>
  )
}
