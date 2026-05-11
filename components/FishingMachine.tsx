'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Gamepad2, Gift, Zap } from 'lucide-react'
import {
  getAimGrade,
  getAimGradeLabel,
  type Doll,
  type FishingResult,
  type FishingState,
  type MachineRank,
  type SpecialItemType,
} from '@/lib/game/fishing'

interface FishingMachineProps {
  fishingState: FishingState
  caughtItem: Doll | null
  fishingResult: FishingResult | null
  message: string
  onDropClaw: () => void
  canDrop: boolean
  aimPosition: number
  targetPosition: number
  machineRank: MachineRank
  activeItems: SpecialItemType[]
  recentDolls: Doll[]
  isFrenzy?: boolean
}

const ITEM_BADGES: Record<SpecialItemType, { icon: string; label: string; color: string }> = {
  DOUBLE_SCORE: { icon: '2x', label: '2배 점수', color: 'border-amber-200 bg-amber-50 text-amber-700' },
  LUCKY_BOOST: { icon: 'LU', label: '행운 부스트', color: 'border-violet-200 bg-violet-50 text-violet-700' },
  COIN_RAIN: { icon: 'CR', label: '보너스 코인', color: 'border-yellow-200 bg-yellow-50 text-yellow-700' },
  EXTRA_PULL: { icon: 'EX', label: '복습 티켓', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  SHIELD: { icon: 'SH', label: '꽝 방지', color: 'border-teal-200 bg-teal-50 text-teal-700' },
}

const AIM_STYLE = {
  perfect: { label: '정중앙', textColor: 'text-amber-700', barColor: 'bg-amber-400', glow: 'shadow-[0_0_14px_rgba(251,191,36,0.58)]' },
  great: { label: '좋은 조준', textColor: 'text-violet-700', barColor: 'bg-violet-400', glow: 'shadow-[0_0_12px_rgba(167,139,250,0.48)]' },
  good: { label: '안정 조준', textColor: 'text-sky-700', barColor: 'bg-sky-400', glow: 'shadow-[0_0_8px_rgba(56,189,248,0.45)]' },
  safe: { label: '아슬아슬', textColor: 'text-emerald-700', barColor: 'bg-emerald-500', glow: '' },
}

const TIER_GLOW: Record<string, string> = {
  일반: '',
  희귀: 'drop-shadow-[0_0_10px_rgba(56,189,248,0.58)]',
  영웅: 'drop-shadow-[0_0_14px_rgba(167,139,250,0.62)]',
  전설: 'drop-shadow-[0_0_18px_rgba(250,204,21,0.86)]',
}

const AIM_TRACK_H = 44
const CLAW_WIDTH = 112

const MYSTERY_FLOOR = [
  { left: '4%', size: 38, color: '#f59e0b', rotate: -8 },
  { left: '13%', size: 44, color: '#7c3aed', rotate: 5 },
  { left: '23%', size: 36, color: '#0ea5e9', rotate: -4 },
  { left: '33%', size: 42, color: '#ec4899', rotate: 7 },
  { left: '43%', size: 48, color: '#facc15', rotate: -3 },
  { left: '54%', size: 40, color: '#7c3aed', rotate: 6 },
  { left: '64%', size: 36, color: '#0ea5e9', rotate: -6 },
  { left: '73%', size: 44, color: '#f59e0b', rotate: 4 },
  { left: '83%', size: 38, color: '#ec4899', rotate: -5 },
  { left: '91%', size: 42, color: '#facc15', rotate: 3 },
]

function getClawLeft(fishingState: FishingState, aimPosition: number) {
  if (fishingState === 'return' || fishingState === 'release') return '10%'
  if (fishingState === 'idle') return '50%'
  return `${aimPosition}%`
}

function getClawY(fishingState: FishingState) {
  if (fishingState === 'down' || fishingState === 'grab') return 185
  return 0
}

export default function FishingMachine({
  fishingState,
  caughtItem,
  fishingResult,
  message,
  onDropClaw,
  canDrop,
  aimPosition,
  targetPosition,
  machineRank,
  activeItems,
  recentDolls,
  isFrenzy = false,
}: FishingMachineProps) {
  const currentAccuracy = fishingState === 'aim'
    ? Math.max(0, Math.min(1, 1 - Math.abs(aimPosition - targetPosition) / 36))
    : (fishingResult?.accuracy ?? 0)
  const aimGrade = getAimGrade(currentAccuracy)
  const aimStyle = AIM_STYLE[aimGrade]

  const isInAction = fishingState !== 'idle'
  const isReleasing = fishingState === 'release'

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70">
      <div className="h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300" />

      <div className="relative flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-2 text-slate-900">
          <Gamepad2 size={18} className={isFrenzy ? 'text-amber-500' : 'text-sky-500'} />
          <span className="truncate text-lg font-extrabold tracking-normal">DOKI DOKI CLAW</span>
          {isFrenzy && <Zap size={16} className="text-amber-500" />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeItems.map((item, i) => (
            <span
              key={`${item}-${i}`}
              title={ITEM_BADGES[item].label}
              className={`rounded-md border px-2 py-0.5 text-xs font-bold ${ITEM_BADGES[item].color}`}
            >
              {ITEM_BADGES[item].icon}
            </span>
          ))}
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-extrabold text-slate-700">
            Rank {machineRank}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-center text-sm font-bold text-slate-600">
        {message}
      </div>

      <div className="relative h-[340px] overflow-hidden border-b border-slate-200 bg-gradient-to-b from-sky-50 via-white to-rose-50">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.11)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.11)_1px,transparent_1px)] bg-[size:30px_30px]" />

        <div className="absolute bottom-0 left-0 right-0 top-0">
          <div className="absolute bottom-0 top-0 left-12 right-12 sm:left-14 sm:right-14">
            <div
              className="absolute inset-x-0 top-0 z-30 overflow-hidden rounded-b-lg border-x border-b border-slate-200 bg-white/75 shadow-sm"
              style={{ height: AIM_TRACK_H }}
            >
              <div className="absolute inset-0 flex">
                <div className="flex-[2] bg-gradient-to-r from-emerald-50 to-emerald-100" />
                <div className="flex-[1.5] bg-gradient-to-r from-sky-50 to-sky-100" />
                <div className="flex-1 bg-gradient-to-r from-violet-50 to-violet-100" />
                <div className="w-10 flex-none bg-amber-200" />
                <div className="flex-1 bg-gradient-to-l from-violet-50 to-violet-100" />
                <div className="flex-[1.5] bg-gradient-to-l from-sky-50 to-sky-100" />
                <div className="flex-[2] bg-gradient-to-l from-emerald-50 to-emerald-100" />
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-around text-[9px] font-extrabold text-slate-500">
                <span>SAFE</span>
                <span className="text-sky-700">GOOD</span>
                <span className="text-violet-700">GREAT</span>
                <span className="text-amber-700">PERFECT</span>
                <span className="text-violet-700">GREAT</span>
                <span className="text-sky-700">GOOD</span>
                <span>SAFE</span>
              </div>

              <div
                className="pointer-events-none absolute bottom-0 top-0 w-[14%] -translate-x-1/2 border-x-2 border-amber-500/70 bg-amber-200/20"
                style={{ left: `${targetPosition}%` }}
              />

              <motion.div
                className={`absolute bottom-0 top-0 w-[3px] ${aimStyle.barColor} ${aimStyle.glow}`}
                style={{ marginLeft: -1.5 }}
                animate={{ left: `${aimPosition}%` }}
                transition={{ duration: 0.04 }}
              />
            </div>

            {(fishingState === 'idle' || fishingState === 'aim') && (
              <motion.div
                className="pointer-events-none absolute bottom-0 w-24 -translate-x-1/2"
                style={{ left: `${targetPosition}%`, top: AIM_TRACK_H }}
                animate={{ opacity: [0.35, 0.72, 0.35] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="h-full w-full bg-gradient-to-b from-amber-200/24 via-amber-200/18 to-transparent" />
              </motion.div>
            )}

            <motion.div
              className="absolute z-20 flex flex-col items-center"
              style={{ top: AIM_TRACK_H, width: CLAW_WIDTH, marginLeft: -CLAW_WIDTH / 2 }}
              animate={{
                left: getClawLeft(fishingState, aimPosition),
                y: getClawY(fishingState),
              }}
              transition={{
                duration: fishingState === 'aim' ? 0.04 : 0.75,
                ease: fishingState === 'aim' ? 'linear' : 'easeInOut',
              }}
            >
              <div className="h-14 w-0.5 rounded-b-full bg-slate-400 shadow-[0_0_4px_rgba(148,163,184,0.35)]" />
              <div className="relative h-24 w-28">
                <div className="absolute left-1/2 top-0 h-9 w-12 -translate-x-1/2 rounded-md border-4 border-slate-300 bg-slate-100 shadow-lg" />
                <motion.div
                  className="absolute left-[18px] top-[26px] h-[68px] w-[46px] rounded-bl-[36px] border-b-[7px] border-l-[7px] border-slate-400"
                  animate={{ rotate: (fishingState === 'grab' || fishingState === 'up' || fishingState === 'return') ? 16 : -10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute right-[18px] top-[26px] h-[68px] w-[46px] rounded-br-[36px] border-b-[7px] border-r-[7px] border-slate-400"
                  animate={{ rotate: (fishingState === 'grab' || fishingState === 'up' || fishingState === 'return') ? -16 : 10 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>

              <AnimatePresence>
                {caughtItem && isInAction && fishingState !== 'aim' && fishingState !== 'down' && fishingState !== 'release' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="absolute left-1/2 flex w-20 justify-center"
                    style={{ top: 132, marginLeft: -40 }}
                  >
                    {caughtItem.image ? (
                      <Image
                        src={caughtItem.image}
                        alt={caughtItem.name}
                        width={72}
                        height={72}
                        unoptimized
                        className={`h-[72px] w-[72px] object-contain ${TIER_GLOW[caughtItem.tier] ?? ''}`}
                      />
                    ) : (
                      <Gift size={46} className="text-slate-400" />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-2 pb-2">
          {MYSTERY_FLOOR.map((box, i) => (
            <div
              key={i}
              className="relative flex select-none items-center justify-center rounded-md text-sm font-extrabold text-slate-700"
              style={{
                width: box.size,
                height: box.size,
                backgroundImage: `linear-gradient(135deg, ${box.color}45, ${box.color}16)`,
                border: `1px solid ${box.color}50`,
                transform: `rotate(${box.rotate}deg)`,
                boxShadow: `0 8px 18px ${box.color}18`,
              }}
            >
              ?
            </div>
          ))}
        </div>

        <AnimatePresence>
          {isReleasing && fishingResult?.doll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-white/72 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.4, rotate: -10, y: 30 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                className="text-center"
              >
                {fishingResult.doll.image ? (
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Image
                      src={fishingResult.doll.image}
                      alt={fishingResult.doll.name}
                      width={100}
                      height={100}
                      unoptimized
                      className={`mx-auto h-24 w-24 object-contain ${TIER_GLOW[fishingResult.doll.tier] ?? ''}`}
                    />
                  </motion.div>
                ) : (
                  <Gift size={72} className="text-slate-400" />
                )}
                <motion.p
                  className="mt-2 text-xl font-extrabold text-slate-900"
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  {fishingResult.doll.name}
                </motion.p>
                <p className="mt-1 text-sm font-bold text-amber-600">+{fishingResult.points.toLocaleString()}점</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white/70 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white/70 to-transparent" />
      </div>

      <div className="flex items-center justify-between px-5 pb-1 pt-3">
        <div className="flex gap-2.5 text-[9px] font-bold">
          <span className="text-emerald-500">■ 일반</span>
          <span className="text-sky-400">■ 희귀</span>
          <span className="text-violet-400">■ 영웅</span>
          <span className="text-amber-400">■ 전설</span>
        </div>
        <motion.span
          key={aimGrade}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs font-extrabold ${aimStyle.textColor}`}
        >
          {fishingState === 'aim' ? aimStyle.label : getAimGradeLabel(aimGrade)}
        </motion.span>
      </div>

      <div className="px-5 pb-5 pt-2">
        <motion.button
          type="button"
          onClick={onDropClaw}
          disabled={!canDrop}
          className="relative w-full overflow-hidden rounded-lg border-b-4 border-red-700 bg-red-500 py-4 text-xl font-extrabold text-white transition-colors disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
          whileTap={canDrop ? { y: 4, borderBottomWidth: '1px' } : {}}
        >
          {canDrop && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/22 to-transparent"
              animate={{ x: ['-120%', '120%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <motion.div
            className="relative flex items-center justify-center gap-3"
            animate={canDrop ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Crosshair size={22} />
            <span>내리기</span>
            <span className="rounded-md bg-white/18 px-2 py-0.5 text-sm font-bold">SPACE</span>
          </motion.div>
        </motion.button>
      </div>

      {recentDolls.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/90 px-5 py-3">
          <p className="mb-2 text-xs font-bold text-slate-500">최근 획득</p>
          <div className="flex flex-wrap gap-1.5">
            {recentDolls.slice(-10).reverse().map((doll, i) => (
              <div
                key={`${doll.id}-${i}`}
                title={`${doll.name} (+${doll.score}점)`}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 shadow-sm"
              >
                {doll.image ? (
                  <Image src={doll.image} alt={doll.name} width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
                ) : (
                  <Gift size={20} className="text-slate-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-8 rounded-tr-lg border-r border-t border-slate-200" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-8 rounded-tl-lg border-l border-t border-slate-200" />
    </div>
  )
}
