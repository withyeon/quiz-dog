'use client'

import { motion } from 'framer-motion'
import {
  BadgeCheck,
  Coffee,
  Gauge,
  HeartPulse,
  Shield,
  Snowflake,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { PlayerClass } from '@/lib/game/battleRoyale'
import { PLAYER_CLASSES } from '@/lib/game/battleRoyale'

interface ClassSelectorProps {
  onSelect: (playerClass: PlayerClass) => void
  selectedClass?: PlayerClass
}

const CLASS_VISUALS: Record<PlayerClass, {
  Icon: LucideIcon
  tone: string
  line: string
  label: string
}> = {
  ice_fist: {
    Icon: Snowflake,
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    line: 'bg-cyan-400',
    label: '강한 한 방',
  },
  rapid_fire: {
    Icon: Zap,
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    line: 'bg-amber-400',
    label: '빠른 템포',
  },
  shield: {
    Icon: Shield,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    line: 'bg-emerald-400',
    label: '안정 운영',
  },
  hot_choco: {
    Icon: Coffee,
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    line: 'bg-rose-400',
    label: '회복 유지',
  },
}

export default function ClassSelector({
  onSelect,
  selectedClass,
}: ClassSelectorProps) {
  const classes: PlayerClass[] = ['ice_fist', 'rapid_fire', 'shield', 'hot_choco']

  return (
    <section className="battle-frost-panel mx-auto max-w-5xl overflow-hidden p-5 sm:p-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="battle-chip mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
            <Target className="h-3.5 w-3.5 text-teal-600" />
            LOADOUT
          </div>
          <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            오늘의 장비를 고르세요
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            공격력, 속도, 방어, 회복 중 하나에 힘을 실어 경기 흐름을 만듭니다.
          </p>
        </div>

        {selectedClass && (
          <div className="battle-chip inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-700">
            <BadgeCheck className="h-4 w-4 text-teal-600" />
            {PLAYER_CLASSES[selectedClass].name} 장착
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {classes.map((classId) => {
          const classInfo = PLAYER_CLASSES[classId]
          const isSelected = selectedClass === classId
          const visual = CLASS_VISUALS[classId]
          const Icon = visual.Icon
          const defense = Math.round((1 - classInfo.defense) * 100)

          return (
            <motion.button
              key={classId}
              onClick={() => onSelect(classId)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`group relative overflow-hidden rounded-[8px] border p-5 text-left transition-all ${
                isSelected
                  ? 'border-teal-400 bg-white shadow-xl shadow-teal-900/10'
                  : 'border-slate-200 bg-white/[0.72] shadow-sm hover:border-slate-300 hover:bg-white hover:shadow-lg'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${visual.line}`} />
              <div className="flex items-start gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[8px] border ${visual.tone}`}>
                  <Icon className="h-7 w-7" strokeWidth={2.4} />
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-slate-950">
                      {classInfo.name}
                    </h3>
                    <span className="battle-chip px-2.5 py-1 text-xs font-black text-slate-600">
                      {visual.label}
                    </span>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-white"
                      >
                        <BadgeCheck className="h-4 w-4" />
                      </motion.span>
                    )}
                  </div>
                  <p className="mb-4 text-sm font-semibold leading-relaxed text-slate-500">
                    {classInfo.description}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-4 text-xs">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-500">공격</div>
                        <div className="font-black text-slate-900">
                          {classInfo.damageMultiplier}x
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-500">체온</div>
                        <div className="font-black text-slate-900">
                          {classInfo.maxHealth}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-500">속도</div>
                        <div className="font-black text-slate-900">
                          {classInfo.attackSpeed}x
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-semibold text-slate-500">방어</div>
                        <div className="font-black text-slate-900">
                          {defense > 0 ? `${defense}%` : '기본'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
