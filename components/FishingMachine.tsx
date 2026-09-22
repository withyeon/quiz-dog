'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Gamepad2, Gift, Zap } from 'lucide-react'
import {
  AIM_ACCURACY_SCALE,
  getAimGrade,
  getAimGradeZoneWidth,
  getAimGradeLabel,
  type Doll,
  type FishingResult,
  type FishingState,
  type MachineRank,
  type SpecialItemType,
} from '@/lib/game/fishing'
import { SpecialItemIcon } from '@/components/fishing/FishingPanels'

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

const ITEM_BADGES: Record<SpecialItemType, { label: string; color: string }> = {
  DOUBLE_SCORE: { label: '2배 점수', color: 'border-amber-200 bg-amber-50' },
  LUCKY_BOOST: { label: '행운 부스트', color: 'border-violet-200 bg-violet-50' },
  COIN_RAIN: { label: '보너스 코인', color: 'border-yellow-200 bg-yellow-50' },
  EXTRA_PULL: { label: '복습 티켓', color: 'border-emerald-200 bg-emerald-50' },
  SHIELD: { label: '꽝 방지', color: 'border-teal-200 bg-teal-50' },
  SCREEN_FLIP: { label: '화면 뒤집기', color: 'border-violet-200 bg-violet-50' },
  SCREEN_SHRINK: { label: '화면 축소', color: 'border-violet-200 bg-violet-50' },
}

const AIM_STYLE = {
  perfect: { label: '보물 목표', textColor: 'treasure-text', barColor: 'bg-amber-400', glow: 'shadow-[0_0_18px_rgba(250,204,21,0.9)]' },
  great: { label: '특별 구간', textColor: 'text-violet-700', barColor: 'bg-violet-500', glow: 'shadow-[0_0_12px_rgba(167,139,250,0.48)]' },
  good: { label: '인기 구간', textColor: 'text-sky-700', barColor: 'bg-sky-500', glow: 'shadow-[0_0_8px_rgba(56,189,248,0.45)]' },
  safe: { label: '기본 구간', textColor: 'text-emerald-700', barColor: 'bg-emerald-500', glow: '' },
}

const TIER_GLOW: Record<string, string> = {
  기본: '',
  인기: 'drop-shadow-[0_0_10px_rgba(56,189,248,0.58)]',
  특별: 'drop-shadow-[0_0_14px_rgba(167,139,250,0.62)]',
  보물: 'treasure-glow',
}

const STAGE_BG = '/fishing/machine/case-bg.webp'
const CLAW_OPEN = '/fishing/machine/claw-open.webp'
const CLAW_CLOSED = '/fishing/machine/claw-closed.webp'

const AIM_TRACK_H = 44
const CLAW_WIDTH = 112
/** 무대 기본 높이(px). 폰/낮은 화면은 CSS(.fishing-stage)로 줄이고, 집게 하강 거리는 실제 높이에 맞춰 계산한다 */
const DEFAULT_STAGE_H = 340
/** 무대 높이에서 이 값을 뺀 만큼 집게가 내려간다 (340px 무대에서 185px) */
const CLAW_DROP_OFFSET = 155

// 바닥에 깔린 미스터리 상자. 그림 8종을 자리마다 돌려 쓴다 (public/fishing/machine).
const MYSTERY_FLOOR = [
  { left: '4%', size: 40, image: '/fishing/machine/box-pink.webp', rotate: -8 },
  { left: '13%', size: 46, image: '/fishing/machine/box-purple.webp', rotate: 5 },
  { left: '23%', size: 38, image: '/fishing/machine/box-skyblue.webp', rotate: -4 },
  { left: '33%', size: 44, image: '/fishing/machine/box-mint.webp', rotate: 7 },
  { left: '43%', size: 50, image: '/fishing/machine/box-gold.webp', rotate: -3 },
  { left: '54%', size: 42, image: '/fishing/machine/box-red.webp', rotate: 6 },
  { left: '64%', size: 38, image: '/fishing/machine/box-blue.webp', rotate: -6 },
  { left: '73%', size: 46, image: '/fishing/machine/box-shine.webp', rotate: 4 },
  { left: '83%', size: 40, image: '/fishing/machine/box-pink.webp', rotate: -5 },
  { left: '91%', size: 44, image: '/fishing/machine/box-purple.webp', rotate: 3 },
]

function getClawLeft(fishingState: FishingState, aimPosition: number) {
  if (fishingState === 'return' || fishingState === 'release') return '10%'
  if (fishingState === 'idle') return '50%'
  return `${aimPosition}%`
}

function getClawY(fishingState: FishingState, stageHeight: number) {
  if (fishingState === 'down' || fishingState === 'grab') return Math.max(80, stageHeight - CLAW_DROP_OFFSET)
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
    ? Math.max(0, Math.min(1, 1 - Math.abs(aimPosition - targetPosition) / AIM_ACCURACY_SCALE))
    : (fishingResult?.accuracy ?? 0)
  const aimGrade = getAimGrade(currentAccuracy, machineRank)
  const aimZoneWidth = getAimGradeZoneWidth(machineRank)
  const aimStyle = AIM_STYLE[aimGrade]

  const isGripping = fishingState === 'grab' || fishingState === 'up' || fishingState === 'return'
  const isInAction = fishingState !== 'idle'
  const isReleasing = fishingState === 'release'

  // 무대 실제 높이(반응형)에 맞춰 집게 하강 거리를 정한다
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageHeight, setStageHeight] = useState(DEFAULT_STAGE_H)
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const update = () => setStageHeight(el.clientHeight || DEFAULT_STAGE_H)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70">
      <div className="h-1 bg-gradient-to-r from-sky-400 via-violet-400 to-amber-300" />

      <div className="relative flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-2 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 text-slate-900">
          <Gamepad2 size={18} className={isFrenzy ? 'text-amber-500' : 'text-sky-500'} />
          <span className="truncate text-lg font-extrabold tracking-normal">인형뽑기</span>
          {isFrenzy && <Zap size={16} className="text-amber-500" />}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {activeItems.map((item, i) => (
            <span
              key={`${item}-${i}`}
              title={ITEM_BADGES[item].label}
              className={`flex items-center rounded-md border px-1.5 py-0.5 ${ITEM_BADGES[item].color}`}
            >
              <SpecialItemIcon type={item} size={18} />
            </span>
          ))}
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-extrabold text-slate-700">
            Rank {machineRank}
          </span>
        </div>
      </div>

      <div className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-xs font-bold text-slate-600 sm:px-4 sm:py-2 sm:text-sm">
        {message}
      </div>

      <div ref={stageRef} className="fishing-stage relative overflow-hidden border-b border-slate-200 bg-rose-50">
        {/* 유리 케이스 안쪽. 화면 비율이 제각각이라 바닥선을 아래에 고정하고 위쪽 벽을 잘라낸다 */}
        <Image
          src={STAGE_BG}
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 964px"
          className="object-cover object-bottom"
        />

        <div className="absolute bottom-0 left-0 right-0 top-0">
          <div className="absolute bottom-0 top-0 left-12 right-12 sm:left-14 sm:right-14">
            <div
              className="absolute inset-x-0 top-0 z-30 overflow-hidden rounded-b-lg border-x border-b border-slate-200 bg-slate-100/90 shadow-sm"
              style={{ height: AIM_TRACK_H }}
            >
              {/* 등급 구간 — 목표 위치를 따라 이동 */}
              {/* 기본 구간: 트랙 전체가 기본값이므로 바탕을 초록으로 깐다 */}
              <div className="pointer-events-none absolute inset-0 bg-emerald-100/55" />
              <div
                className="pointer-events-none absolute bottom-0 top-0 -translate-x-1/2 border border-sky-200/70 bg-sky-100/45"
                style={{ left: `${targetPosition}%`, width: `${aimZoneWidth.good}%` }}
              />
              <div
                className="pointer-events-none absolute bottom-0 top-0 -translate-x-1/2 border border-violet-200/70 bg-violet-100/50"
                style={{ left: `${targetPosition}%`, width: `${aimZoneWidth.great}%` }}
              />
              <div
                className="pointer-events-none absolute bottom-0 top-0 -translate-x-1/2 border-x-2 border-amber-500/80 bg-amber-200/55"
                style={{ left: `${targetPosition}%`, width: `${aimZoneWidth.perfect}%` }}
              />
              <div
                className="pointer-events-none absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.7)]"
                style={{ left: `${targetPosition}%` }}
              />
              <div
                className="pointer-events-none absolute top-1 flex -translate-x-1/2 items-center justify-center rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-950 shadow-sm"
                style={{ left: `${targetPosition}%` }}
              >
                PERFECT
              </div>

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
                <div className="h-full w-full bg-gradient-to-b from-amber-200/[0.24] via-amber-200/[0.18] to-transparent" />
              </motion.div>
            )}

            <motion.div
              className="absolute z-20 flex flex-col items-center"
              style={{ top: AIM_TRACK_H, width: CLAW_WIDTH, marginLeft: -CLAW_WIDTH / 2 }}
              animate={{
                left: getClawLeft(fishingState, aimPosition),
                y: getClawY(fishingState, stageHeight),
              }}
              transition={{
                duration: fishingState === 'aim' ? 0.04 : 0.75,
                ease: fishingState === 'aim' ? 'linear' : 'easeInOut',
              }}
            >
              {/* 줄은 길이가 변하니 그대로 CSS로 그리고, 집게 머리만 그림 두 장을 바꿔 끼운다 */}
              <div className="h-10 w-0.5 rounded-b-full bg-slate-400 shadow-[0_0_4px_rgba(148,163,184,0.35)]" />
              <div className="relative h-28 w-28">
                <Image
                  src={isGripping ? CLAW_CLOSED : CLAW_OPEN}
                  alt=""
                  fill
                  sizes="112px"
                  unoptimized
                  draggable={false}
                  className="select-none object-contain"
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
            <Image
              key={i}
              src={box.image}
              alt=""
              width={box.size}
              height={box.size}
              unoptimized
              draggable={false}
              className="select-none object-contain"
              style={{ width: box.size, height: box.size, transform: `rotate(${box.rotate}deg)` }}
            />
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

      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-2 sm:px-5 sm:pt-3">
        <div className="flex gap-2.5 text-[9px] font-bold">
          <span className="text-emerald-500">■ 기본</span>
          <span className="text-sky-400">■ 인기</span>
          <span className="text-violet-400">■ 특별</span>
          <span className="treasure-text">■ 보물</span>
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

      <div className="px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        <motion.button
          type="button"
          onClick={onDropClaw}
          disabled={!canDrop}
          className="relative w-full overflow-hidden rounded-lg border-b-4 border-red-700 bg-red-500 py-3 text-xl font-extrabold sm:py-4 text-white transition-colors disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
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
