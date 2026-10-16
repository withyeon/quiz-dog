'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { AlertTriangle, Flame, Sword, Users } from 'lucide-react'
import QuizSetName from '@/components/game/QuizSetName'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import {
  RAID,
  RAID_ROLES,
  getComboBonus,
  type RaidRole,
  type RaidSkillState,
  type RaidState,
} from '@/lib/game/raid'

type RaidHeaderProps = {
  questionSetTitle?: string | null
  role: RaidRole | null
  streak: number
  myDamage: number
  myHits: number
  raidState: RaidState
  skill: RaidSkillState
  /**
   * hud: 전투 중 얇은 한 줄 바 (폰에서도 한 줄) · intro: 대기실·역할 선택·결과의 제목 줄.
   * 기본값은 hud.
   */
  variant?: 'hud' | 'intro'
  /** 전체 남은 시간 배지(GameTimeBadge)가 화면 위 가운데에 떠 있을 때 HUD 가운데를 비워 둔다 */
  reserveTimeBadge?: boolean
}

const ROLE_TONE: Record<RaidRole, string> = {
  warrior: 'border-rose-200 bg-rose-50 text-rose-700',
  mage: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  guardian: 'border-cyan-200 bg-cyan-50 text-cyan-700',
}

/** 이어 맞힌 수에 따라 켜지는 콤보 점 (3·5·8연속). 폰에서는 작은 점, sm 부터는 숫자가 보이는 동그라미 */
function ComboPips({ streak, warm }: { streak: number; warm: boolean }) {
  return (
    <span className="flex items-center gap-0.5">
      {RAID.COMBO_STEPS.map((step) => {
        const on = streak >= step.streak
        return (
          <span
            key={step.streak}
            title={`${step.streak}연속 보너스 +${step.bonus}`}
            className={`grid h-1.5 w-1.5 place-items-center rounded-full text-[9px] font-black leading-none transition-colors sm:h-4 sm:w-4 ${
              on
                ? warm ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
                : warm ? 'bg-white/30 text-white/80' : 'bg-slate-300 text-slate-500'
            }`}
          >
            <span className="hidden sm:inline">{step.streak}</span>
          </span>
        )
      })}
    </span>
  )
}

/**
 * 레이드 상단 바.
 * - hud: 제목 아이콘 · 내 데미지 · 연속 정답(콤보 점) · 역할. 폰에서 한 줄(약 44px)이라 퀴즈가 첫 화면에 들어온다.
 *   화면이 넓어질수록 제목·명중 수(sm)·문제집 이름(md)·필살기 칩(lg)·반 전체 데미지(xl)가 같은 줄에 덧붙는다.
 * - intro: 로비·역할 선택·결과 화면 위에 놓는 제목 줄.
 */
export default function RaidHeader({
  questionSetTitle,
  role,
  streak,
  myDamage,
  myHits,
  raidState,
  skill,
  variant = 'hud',
  reserveTimeBadge = false,
}: RaidHeaderProps) {
  const roleInfo = role ? RAID_ROLES[role] : null

  if (variant === 'intro') {
    return (
      <div className="mx-auto mb-3 max-w-7xl sm:mb-4">
        <header className="flex items-center gap-3 rounded-[10px] border border-slate-300/50 bg-white/80 px-3 py-2 shadow-[0_6px_18px_rgba(26,55,71,0.12)] backdrop-blur-md sm:px-4 sm:py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow-md sm:h-12 sm:w-12">
            <Image
              src="/title/raid.webp"
              alt=""
              width={48}
              height={48}
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black leading-tight text-slate-950 sm:text-2xl">황제 펭귄을 막아라!</h1>
            <QuizSetName title={questionSetTitle} className="mt-1" />
          </div>
          <span className="battle-chip ml-auto hidden shrink-0 px-3 py-1 text-xs font-black text-slate-600 sm:inline-block">협동 레이드</span>
        </header>
      </div>
    )
  }

  const comboBonus = getComboBonus(streak) * (roleInfo?.comboMultiplier ?? 1)
  const warm = streak >= RAID.COMBO_STEPS[0].streak

  // 필살기 칩(lg 이상): 예고 중·기절 중이거나 곧 예고가 올 때만
  const skillChip = skill.phase === 'charging'
    ? { text: `예고! ${skill.secondsLeft}초`, className: 'border-rose-300 bg-rose-50 text-rose-700', alert: true }
    : skill.phase === 'groggy'
      ? { text: `기절 ×${RAID.GROGGY_MULTIPLIER} · ${skill.secondsLeft}초`, className: 'border-amber-300 bg-amber-50 text-amber-800', alert: false }
      : skill.phase === 'idle' && skill.nextIn > 0 && skill.nextIn <= 10
        ? { text: `필살기까지 ${skill.nextIn}초`, className: 'border-orange-300 bg-orange-50 text-orange-800', alert: false }
        : null

  return (
    /*
      폰·태블릿에서는 화면 위에 붙어 따라다니고, xl 두 칸 배치에서는 무대가 따로 붙으므로 고정하지 않는다.
      가운데 열은 GameTimeBadge(fixed, 위 가운데)가 올라앉는 자리라 비워 둔다.
    */
    <div className="sticky top-1 z-30 mx-auto mb-2 max-w-7xl sm:top-2 sm:mb-3 xl:static">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center rounded-[10px] border border-slate-300/50 bg-white/85 px-1.5 py-1 shadow-[0_6px_18px_rgba(26,55,71,0.14)] backdrop-blur-md sm:px-3 sm:py-1.5">
        {/* 왼쪽: 제목 아이콘 + 내 데미지 */}
        <div className="flex min-w-0 items-center gap-2 pr-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white shadow sm:h-10 sm:w-10">
            <Image
              src="/title/raid.webp"
              alt="황제 펭귄을 막아라!"
              width={40}
              height={40}
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          <div className="min-w-0 leading-none">
            <div className="whitespace-nowrap text-[9px] font-black text-slate-500 sm:text-[10px]">
              내 데미지
              <span className="hidden sm:inline"> · 명중 {myHits}번</span>
            </div>
            <div className="mt-0.5 truncate text-base font-black tabular-nums text-slate-950 sm:text-xl">
              {myDamage.toLocaleString()}
            </div>
          </div>
          <div className="ml-2 hidden min-w-0 border-l border-slate-200 pl-3 md:block">
            <div className="truncate text-sm font-black leading-tight text-slate-900">황제 펭귄을 막아라!</div>
            <QuizSetName title={questionSetTitle} className="mt-0.5" />
          </div>
        </div>

        <div className={reserveTimeBadge ? 'w-24' : 'w-0'} aria-hidden />

        {/* 오른쪽: (lg+ 필살기 칩 · xl+ 반 전체) · 연속 정답 · 역할 */}
        <div className="flex min-w-0 items-center justify-end gap-1.5 pl-1 sm:gap-2">
          {skillChip && (
            <motion.span
              animate={skillChip.alert ? { scale: [1, 1.05, 1] } : undefined}
              transition={skillChip.alert ? { duration: 0.8, repeat: Infinity } : undefined}
              className={`hidden items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black lg:inline-flex ${skillChip.className}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {skillChip.text}
            </motion.span>
          )}
          <span className="battle-chip hidden items-center gap-1 px-2.5 py-1 text-xs font-black text-slate-700 xl:inline-flex">
            <Users className="h-3.5 w-3.5 text-sky-600" />
            반 전체 {raidState.totalDamage.toLocaleString()}
          </span>

          <div
            aria-label={`${streak}연속 정답${comboBonus > 0 ? `, 보너스 ${comboBonus}` : ''}`}
            className={`flex items-center gap-1 rounded-full px-1.5 py-1 transition-colors sm:gap-1.5 sm:px-2.5 ${
              warm ? 'bg-orange-500 text-white shadow shadow-orange-300/50' : 'bg-slate-100/90 text-slate-700'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <motion.span
              key={streak}
              initial={{ scale: streak > 0 ? 1.6 : 1 }}
              animate={{ scale: 1 }}
              className="min-w-[0.75rem] text-center text-sm font-black tabular-nums"
            >
              {streak}
            </motion.span>
            <ComboPips streak={streak} warm={warm} />
            {comboBonus > 0 && <span className="hidden text-[11px] font-black sm:inline">+{comboBonus}</span>}
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-0.5 sm:pr-2.5 ${role ? ROLE_TONE[role] : 'border-slate-200 bg-slate-50 text-slate-500'}`}
            title={roleInfo ? `${roleInfo.name} · ${roleInfo.tagline}` : '역할 미선택'}
          >
            {role ? (
              <img src={RAID_ROLE_ICON_SRC[role]} alt={roleInfo?.name ?? ''} width={28} height={28} className="h-7 w-7 shrink-0" draggable={false} />
            ) : (
              <Sword className="m-1 h-5 w-5 shrink-0" />
            )}
            <span className="hidden text-xs font-black sm:inline">{roleInfo ? roleInfo.shortName : '미선택'}</span>
          </div>
        </div>
      </header>
    </div>
  )
}
