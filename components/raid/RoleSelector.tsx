'use client'

import { motion } from 'framer-motion'
import { BadgeCheck, Sword } from 'lucide-react'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import { RAID, RAID_ROLES, RAID_ROLE_ORDER, type RaidRole } from '@/lib/game/raid'

type RoleSelectorProps = {
  onSelect: (role: RaidRole) => void
  selectedRole?: RaidRole | null
}

const ROLE_VISUALS: Record<RaidRole, { tone: string; line: string; stat: string }> = {
  warrior: {
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    line: 'bg-rose-400',
    stat: `정답 데미지 ${Math.round(RAID.BASE_DAMAGE * RAID_ROLES.warrior.damageMultiplier)} (기본 ${RAID.BASE_DAMAGE})`,
  },
  mage: {
    tone: 'bg-violet-50 text-indigo-700 border-indigo-200',
    line: 'bg-indigo-400',
    stat: `${RAID.COMBO_STEPS[0].streak}연속부터 보너스 +${RAID.COMBO_STEPS[0].bonus * RAID_ROLES.mage.comboMultiplier}`,
  },
  guardian: {
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    line: 'bg-cyan-400',
    stat: `얼음 방패를 한 번에 ${RAID_ROLES.guardian.shieldPower}칸`,
  },
}

/** 시작 카운트다운 전에 고르는 역할 세 가지. 눈싸움의 장비 선택과 같은 자리에서 뜬다. */
export default function RoleSelector({ onSelect, selectedRole }: RoleSelectorProps) {
  return (
    <section className="battle-frost-panel mx-auto max-w-4xl overflow-hidden p-5 sm:p-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="battle-chip mb-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600">
            <Sword className="h-3.5 w-3.5 text-sky-600" />
            역할 선택
          </div>
          <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            오늘의 역할을 고르세요
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            어느 역할이든 정답마다 펭귄을 때려요. 셋이 섞여 있어야 방패도 빨리 깨집니다.
          </p>
        </div>
        {selectedRole && (
          <div className="battle-chip inline-flex items-center gap-2 px-3 py-2 text-sm font-black text-slate-700">
            <BadgeCheck className="h-4 w-4 text-sky-600" />
            {RAID_ROLES[selectedRole].name}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {RAID_ROLE_ORDER.map((roleId) => {
          const info = RAID_ROLES[roleId]
          const visual = ROLE_VISUALS[roleId]
          const isSelected = selectedRole === roleId
          return (
            <motion.button
              key={roleId}
              type="button"
              onClick={() => onSelect(roleId)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`group relative overflow-hidden rounded-[8px] border p-5 text-left transition-all ${
                isSelected
                  ? 'border-sky-400 bg-white shadow-xl shadow-sky-900/10'
                  : 'border-slate-200 bg-white/[0.72] shadow-sm hover:border-slate-300 hover:bg-white hover:shadow-lg'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${visual.line}`} />
              <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-[8px] border ${visual.tone}`}>
                <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={44} height={44} className="h-11 w-11" draggable={false} />
              </div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-slate-950">{info.name}</h3>
                <span className="battle-chip px-2.5 py-1 text-xs font-black text-slate-600">{info.tagline}</span>
                {isSelected && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white"
                  >
                    <BadgeCheck className="h-4 w-4" />
                  </motion.span>
                )}
              </div>
              <p className="text-sm font-semibold leading-relaxed text-slate-500">{info.description}</p>
              <p className="mt-3 border-t border-slate-200 pt-3 text-xs font-black text-slate-700">{visual.stat}</p>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
