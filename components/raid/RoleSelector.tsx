'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BadgeCheck, Sword, Users } from 'lucide-react'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import { RAID_ROLES, RAID_ROLE_ORDER, getRaidRole, type RaidRole, type RaidRoleInfo } from '@/lib/game/raid'

type RoleSelectorProps = {
  onSelect: (role: RaidRole) => void
  selectedRole?: RaidRole | null
  /** 반 전체 구성 막대용. 역할(player_class)만 보며 누가 무엇을 골랐는지는 그리지 않는다 */
  players?: Array<{ id: string; player_class?: string | null; is_kicked?: boolean | null }>
}

const ROLE_VISUALS: Record<RaidRole, { tone: string; line: string; bar: string; segment: string }> = {
  warrior: {
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
    line: 'bg-rose-400',
    bar: 'bg-rose-400',
    segment: 'bg-rose-400',
  },
  mage: {
    tone: 'bg-violet-50 text-indigo-700 border-indigo-200',
    line: 'bg-indigo-400',
    bar: 'bg-indigo-400',
    segment: 'bg-indigo-400',
  },
  guardian: {
    tone: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    line: 'bg-cyan-400',
    bar: 'bg-cyan-400',
    segment: 'bg-cyan-400',
  },
}

/** 막대 칸 수. 기본(×1)을 3칸으로 두고 배율만큼 늘려, 숫자를 몰라도 "더 센 쪽"이 한눈에 보이게 한다 */
const STAT_SEGMENTS = 5
const BASELINE_SEGMENTS = 3
function toSegments(multiplier: number): number {
  return Math.max(1, Math.min(STAT_SEGMENTS, Math.round(BASELINE_SEGMENTS * multiplier)))
}

type RoleStat = { label: string; segments: number; value: string }

/** RAID_ROLES 의 수치에서 카드의 세 막대를 만든다. 역할 수치가 바뀌어도 카드가 저절로 따라간다 */
function buildStats(info: RaidRoleInfo): RoleStat[] {
  const defenseMultiplier = Math.max(info.shieldPower, info.interruptPower)
  let defenseValue = '기본'
  if (info.shieldPower > 1 && info.interruptPower > 1) defenseValue = `방패·끊기 ×${defenseMultiplier}`
  else if (info.shieldPower > 1) defenseValue = `방패 ×${info.shieldPower}`
  else if (info.interruptPower > 1) defenseValue = `끊기 ×${info.interruptPower}`
  return [
    { label: '공격', segments: toSegments(info.damageMultiplier), value: info.damageMultiplier > 1 ? `×${info.damageMultiplier}` : '기본' },
    { label: '연속', segments: toSegments(info.comboMultiplier), value: info.comboMultiplier > 1 ? `보너스 ×${info.comboMultiplier}` : '기본' },
    { label: '방패·끊기', segments: toSegments(defenseMultiplier), value: defenseValue },
  ]
}

/** 이 역할이 모자랄 때 건네는 말. 탓하지 않고 "이렇게 되기 쉬워요"로만 알린다 */
const SCARCE_HINT: Record<RaidRole, { none: string; few: string }> = {
  warrior: {
    none: '전사가 없어요: 한 방이 조금 약해질 수 있어요',
    few: '전사가 적어요: 한 방이 조금 약해질 수 있어요',
  },
  mage: {
    none: '마법사가 없어요: 필살기 끊기가 어려울 수 있어요',
    few: '마법사가 적어요: 필살기 끊기가 어려울 수 있어요',
  },
  guardian: {
    none: '수호자가 없어요: 얼음 방패가 늦게 깨질 수 있어요',
    few: '수호자가 적어요: 얼음 방패가 늦게 깨질 수 있어요',
  },
}

/** 역할을 고른 친구가 이 수 이상일 때부터 "적어요"를 말한다 (초반 한두 명으로는 판단하지 않는다) */
const FEW_MIN_DECIDED = 5
/** 고른 친구 중 이 비율 미만이면 "적어요" */
const FEW_RATIO = 0.2

/** 시작 카운트다운 전에 고르는 역할 세 가지. 눈싸움의 장비 선택과 같은 자리에서 뜬다. */
export default function RoleSelector({ onSelect, selectedRole, players = [] }: RoleSelectorProps) {
  const composition = useMemo(() => {
    const active = players.filter((player) => !player.is_kicked)
    const counts: Record<RaidRole, number> = { warrior: 0, mage: 0, guardian: 0 }
    let decided = 0
    active.forEach((player) => {
      const picked = getRaidRole(player)
      if (picked) {
        counts[picked] += 1
        decided += 1
      }
    })
    const hints: string[] = []
    if (decided > 0) {
      RAID_ROLE_ORDER.forEach((roleId) => {
        if (counts[roleId] === 0) hints.push(SCARCE_HINT[roleId].none)
        else if (decided >= FEW_MIN_DECIDED && counts[roleId] / decided < FEW_RATIO) hints.push(SCARCE_HINT[roleId].few)
      })
    }
    return { counts, decided, total: active.length, undecided: Math.max(0, active.length - decided), hints }
  }, [players])

  const barBase = Math.max(1, composition.total, composition.decided)

  return (
    <section className="battle-frost-panel mx-auto max-w-4xl overflow-hidden p-4 sm:p-7">
      <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <div className="battle-chip mb-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black text-slate-600 sm:mb-3">
            <Sword className="h-3.5 w-3.5 text-sky-600" />
            역할 선택
          </div>
          <h2 className="text-2xl font-black leading-tight text-slate-950 sm:text-4xl">
            오늘의 역할을 고르세요
          </h2>
          <p className="mt-1.5 text-sm font-semibold text-slate-500">
            어느 역할이든 정답마다 펭귄을 때려요. 셋이 섞여 있어야 방패도 필살기 끊기도 빨라요.
          </p>
        </div>
        {selectedRole && (
          <div className="battle-chip inline-flex items-center gap-2 self-start px-3 py-2 text-sm font-black text-slate-700 sm:self-auto">
            <BadgeCheck className="h-4 w-4 text-sky-600" />
            {RAID_ROLES[selectedRole].name}
          </div>
        )}
      </div>

      {/* 반 전체 구성 — 역할별 인원수만. 누가 어느 역할인지는 보이지 않는다 */}
      {composition.total > 0 && (
        <div className="mb-4 rounded-[8px] border border-slate-200 bg-white/70 p-3 sm:mb-5">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs font-black text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-sky-600" />
              우리 반 파티 {composition.total}명
            </span>
            {composition.undecided > 0 && <span className="text-slate-400">고르는 중 {composition.undecided}명</span>}
          </div>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-slate-200/80"
            role="img"
            aria-label={`전사 ${composition.counts.warrior}명, 마법사 ${composition.counts.mage}명, 수호자 ${composition.counts.guardian}명`}
          >
            {RAID_ROLE_ORDER.map((roleId) => (
              <motion.div
                key={roleId}
                className={ROLE_VISUALS[roleId].segment}
                initial={false}
                animate={{ width: `${(composition.counts[roleId] / barBase) * 100}%` }}
                transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {RAID_ROLE_ORDER.map((roleId) => (
              <div key={roleId} className="flex items-center justify-center gap-1 rounded-full bg-white/80 py-1 text-xs font-black text-slate-700">
                <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={18} height={18} className="h-[18px] w-[18px]" draggable={false} />
                <span>{RAID_ROLES[roleId].shortName}</span>
                <span className="tabular-nums">{composition.counts[roleId]}</span>
              </div>
            ))}
          </div>
          {composition.hints.length > 0 && (
            <ul className="mt-2 space-y-1">
              {composition.hints.map((hint) => (
                <li key={hint} className="rounded-[8px] bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">
                  {hint}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-3">
        {RAID_ROLE_ORDER.map((roleId) => {
          const info = RAID_ROLES[roleId]
          const visual = ROLE_VISUALS[roleId]
          const stats = buildStats(info)
          const isSelected = selectedRole === roleId
          return (
            <motion.button
              key={roleId}
              type="button"
              onClick={() => onSelect(roleId)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              aria-pressed={isSelected}
              className={`group relative flex items-stretch gap-3 overflow-hidden rounded-[8px] border p-3.5 text-left transition-all md:flex-col md:gap-0 md:p-5 ${
                isSelected
                  ? 'border-sky-400 bg-white shadow-xl shadow-sky-900/10'
                  : 'border-slate-200 bg-white/[0.72] shadow-sm hover:border-slate-300 hover:bg-white hover:shadow-lg'
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${visual.line}`} />
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-[8px] border md:mb-3 md:h-20 md:w-20 ${visual.tone}`}>
                <img src={RAID_ROLE_ICON_SRC[roleId]} alt="" width={64} height={64} className="h-12 w-12 md:h-16 md:w-16" draggable={false} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="text-lg font-black text-slate-950 md:text-xl">{info.name}</h3>
                  {isSelected && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-white"
                    >
                      <BadgeCheck className="h-4 w-4" />
                    </motion.span>
                  )}
                </div>
                <span className="battle-chip inline-block px-2.5 py-0.5 text-[11px] font-black text-slate-600">{info.tagline}</span>
                <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-500 md:text-sm">{info.description}</p>

                <dl className="mt-2.5 space-y-1 border-t border-slate-200 pt-2.5">
                  {stats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <dt className="w-[3.4rem] shrink-0 whitespace-nowrap text-[11px] font-black text-slate-600">{stat.label}</dt>
                      <dd className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="flex flex-1 gap-0.5" aria-hidden>
                          {Array.from({ length: STAT_SEGMENTS }).map((_, index) => (
                            <span
                              key={index}
                              className={`h-1.5 flex-1 rounded-full ${index < stat.segments ? visual.bar : 'bg-slate-200'}`}
                            />
                          ))}
                        </span>
                        <span className="w-[4.2rem] shrink-0 whitespace-nowrap text-right text-[10px] font-black text-slate-500">{stat.value}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}
