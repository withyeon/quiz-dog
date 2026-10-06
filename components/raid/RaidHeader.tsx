'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Flame, Snowflake, Sword, Target, Users } from 'lucide-react'
import { HudTile } from '@/components/battle/BattleHud'
import QuizSetName from '@/components/game/QuizSetName'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import { RAID_ROLES, getComboBonus, type RaidFrenzyState, type RaidRole, type RaidState } from '@/lib/game/raid'

type RaidHeaderProps = {
  questionSetTitle?: string | null
  role: RaidRole | null
  streak: number
  myDamage: number
  myHits: number
  raidState: RaidState
  frenzy: RaidFrenzyState
}

/** 레이드 상단 패널: 제목 · HUD 타일 4개(내 데미지·명중·연속 정답·역할) · 상태 칩(처치·반 전체·집중 공격). */
export default function RaidHeader({
  questionSetTitle,
  role,
  streak,
  myDamage,
  myHits,
  raidState,
  frenzy,
}: RaidHeaderProps) {
  const roleInfo = role ? RAID_ROLES[role] : null
  const comboBonus = getComboBonus(streak) * (roleInfo?.comboMultiplier ?? 1)

  return (
    <div className="mx-auto mb-4 max-w-7xl">
      <header className="battle-frost-panel overflow-hidden p-3 sm:p-5">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:items-start">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-lg sm:h-14 sm:w-14">
              <Image
                src="/title/raid.webp"
                alt="황제 펭귄을 막아라!"
                width={56}
                height={56}
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div>
              <div className="mb-2 hidden flex-wrap items-center gap-2 sm:flex">
                <span className="battle-chip px-3 py-1 text-xs font-black text-slate-600">협동 레이드</span>
              </div>
              <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-4xl">황제 펭귄을 막아라!</h1>
              <QuizSetName title={questionSetTitle} className="mt-1.5" />
              <p className="mt-1 hidden text-sm font-semibold text-slate-500 sm:block">
                정답을 맞히면 펭귄의 체력이 줄어요. 반 전체가 한 편입니다.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 xl:min-w-[620px]">
            <HudTile
              icon={<Target className="h-3.5 w-3.5" />}
              label="내 데미지"
              value={myDamage.toLocaleString()}
              detail={`명중 ${myHits}번`}
              tone="good"
            />
            <HudTile
              icon={<Flame className="h-3.5 w-3.5" />}
              label="연속 정답"
              value={`${streak}`}
              detail={comboBonus > 0 ? `보너스 +${comboBonus}` : '3연속부터 보너스'}
              tone={streak >= 3 ? 'warm' : 'default'}
            />
            <HudTile
              icon={<Snowflake className="h-3.5 w-3.5" />}
              label="펭귄 처치"
              value={`${raidState.defeatedCount}/${raidState.roster.length}`}
              detail={raidState.current ? raidState.current.def.name : '전부 처치!'}
            />
            <HudTile
              icon={role
                ? <img src={RAID_ROLE_ICON_SRC[role]} alt="" width={14} height={14} className="h-3.5 w-3.5" draggable={false} />
                : <Sword className="h-3.5 w-3.5" />}
              label="역할"
              value={roleInfo ? roleInfo.shortName : '미선택'}
              detail={roleInfo ? roleInfo.tagline : '시작할 때 골라요'}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-4">
          <div className="battle-chip inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-700">
            <Users className="h-4 w-4 text-sky-600" />
            {raidState.activePlayerCount}명이 함께 · 반 전체 {raidState.totalDamage.toLocaleString()} 데미지
          </div>

          {frenzy.active ? (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-2 text-sm font-black text-white shadow-lg shadow-orange-300/40"
            >
              <Flame className="h-4 w-4" />
              집중 공격! 데미지 2배 · {frenzy.secondsLeft}초
            </motion.div>
          ) : frenzy.nextIn <= 10 ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-black text-orange-800">
              <Flame className="h-4 w-4" />
              집중 공격까지 {frenzy.nextIn}초
            </div>
          ) : null}

          {raidState.current?.shield.active && (
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm font-black text-cyan-800">
              <Snowflake className="h-4 w-4" />
              얼음 방패 · 친구 {raidState.current.shield.remaining}명이 더 때려야 깨져요
            </div>
          )}

          {streak >= 2 && (
            <motion.div
              key={streak}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 font-black text-white shadow-lg shadow-orange-300/30"
            >
              🔥 {streak}연속!{comboBonus > 0 ? ` 보너스 +${comboBonus}` : ''}
            </motion.div>
          )}
        </div>
      </header>
    </div>
  )
}
