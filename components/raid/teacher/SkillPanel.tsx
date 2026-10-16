'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Snowflake, Swords, TriangleAlert, Zap } from 'lucide-react'
import { RAID, type RaidSkillState } from '@/lib/game/raid'
import { withJosa } from '@/lib/utils/korean'
import PipRow from './PipRow'
import RaidWidget, { type RaidWidgetTone } from './RaidWidget'

type SkillPanelProps = {
  skill: RaidSkillState
  /** 게임이 멈춰 있을 때(일시정지) 시간표를 보여 주지 않는다 */
  paused: boolean
}

const TONE_BY_PHASE: Record<RaidSkillState['phase'], RaidWidgetTone> = {
  idle: 'neutral',
  charging: 'danger',
  groggy: 'gold',
  blizzard: 'ice',
}

/**
 * 펭귄의 필살기 패널 — 예고 → 끊기 게이지(익명 칸) → 기절/눈보라.
 * 끊기 게이지는 "몇 칸 찼는지"만 보여 준다. 누가 채웠는지, 누가 안 했는지는 없다.
 */
export default function SkillPanel({ skill, paused }: SkillPanelProps) {
  const phase = paused ? 'idle' : skill.phase
  const idleSpan = skill.cycle < 0 ? RAID.SKILL_FIRST_AT : RAID.SKILL_PERIOD
  const idleRatio = Math.max(0, Math.min(1, 1 - skill.nextIn / idleSpan))

  return (
    <RaidWidget title="펭귄의 필살기" icon={Swords} tone={paused ? 'neutral' : TONE_BY_PHASE[skill.phase]} className="min-h-[232px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {phase === 'idle' && (
            <>
              <p className="text-sm font-bold text-sky-100/70">{paused ? '잠시 멈춰 있어요' : '다음 필살기까지'}</p>
              <p className="mt-0.5 text-5xl font-black tabular-nums text-white">
                {paused ? '--' : skill.nextIn}
                <span className="ml-1.5 text-xl text-sky-100/80">초</span>
              </p>
              <p className="mt-1 text-sm font-bold text-sky-200/70">{withJosa(skill.skillName, '을/를')} 모으기 시작해요</p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-rose-400 transition-[width] duration-500"
                  style={{ width: `${paused ? 0 : idleRatio * 100}%` }}
                />
              </div>
              {/* 학생들이 프로젝터를 보고 규칙을 알 수 있게 — 예고가 뜨기 전에도 끊는 법을 알려 준다 */}
              <p className="mt-3 break-keep rounded-lg bg-black/25 px-3 py-2 text-sm font-bold text-sky-100/80">
                예고 중에 친구 {skill.required}명이 맞히면 필살기를 끊고, 펭귄이 기절해요 (데미지 ×{RAID.GROGGY_MULTIPLIER})
              </p>
            </>
          )}

          {phase === 'charging' && (
            <>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex animate-pulse items-center gap-1.5 text-sm font-black text-rose-300">
                    <TriangleAlert className="h-4 w-4" /> 필살기 예고!
                  </p>
                  <p className="break-keep text-2xl font-black leading-tight text-white 2xl:text-3xl">{skill.skillName}</p>
                </div>
                <p className="text-6xl font-black leading-none tabular-nums text-rose-300">
                  {skill.secondsLeft}
                  <span className="ml-1 text-lg">초</span>
                </p>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, skill.chargeRatio * 100)}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm font-black text-rose-100">
                <span>끊기 게이지</span>
                <span className="tabular-nums">{skill.points} / {skill.required}</span>
              </div>
              <div className="mt-1.5">
                <PipRow filled={skill.points} total={skill.required} tone="rose" />
              </div>
              <p className="mt-2.5 break-keep text-sm font-bold text-rose-100/90">
                친구 {skill.remaining}명이 더 맞히면 끊어요!
              </p>
            </>
          )}

          {phase === 'groggy' && (
            <>
              <p className="flex items-center gap-1.5 text-sm font-black text-amber-200">
                <Zap className="h-4 w-4" /> 필살기를 끊었어요!
              </p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-4xl font-black leading-none text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.7)] 2xl:text-5xl">
                  기절! ×{RAID.GROGGY_MULTIPLIER}
                </p>
                <p className="text-5xl font-black leading-none tabular-nums text-white">
                  {skill.secondsLeft}
                  <span className="ml-1 text-lg">초</span>
                </p>
              </div>
              <p className="mt-2.5 break-keep text-sm font-bold text-amber-100/90">지금 맞히면 데미지가 {RAID.GROGGY_MULTIPLIER}배예요!</p>
              <div className="mt-2">
                <PipRow filled={skill.points} total={skill.required} tone="rose" />
              </div>
            </>
          )}

          {phase === 'blizzard' && (
            <>
              <p className="flex items-center gap-1.5 text-sm font-black text-cyan-200">
                <Snowflake className="h-4 w-4" /> 눈보라가 지나가요
              </p>
              <p className="mt-1 text-5xl font-black tabular-nums text-white">
                {skill.secondsLeft}
                <span className="ml-1.5 text-xl text-cyan-100/80">초</span>
              </p>
              <p className="mt-2 break-keep text-sm font-bold text-cyan-100/80">
                점수도 체력도 그대로예요. 다음 필살기는 꼭 끊어 봐요!
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </RaidWidget>
  )
}
