'use client'

import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Sparkles, Zap } from 'lucide-react'
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
  DOUBLE_SCORE: { icon: '⚡', label: '2배 점수', color: 'bg-yellow-500/30 border-yellow-400' },
  LUCKY_BOOST: { icon: '⭐', label: '행운 부스트', color: 'bg-violet-500/30 border-violet-400' },
  COIN_RAIN: { icon: '🪙', label: '보너스 코인', color: 'bg-amber-500/30 border-amber-400' },
  EXTRA_PULL: { icon: '🎰', label: '복습 티켓', color: 'bg-green-500/30 border-green-400' },
  SHIELD: { icon: '🍀', label: '꽝 방지', color: 'bg-teal-500/30 border-teal-400' },
}

// 조준 등급 시각 스타일
const AIM_STYLE = {
  perfect: { label: '정중앙! ★', textColor: 'text-yellow-300', barColor: 'bg-yellow-400', glow: 'shadow-[0_0_16px_rgba(250,204,21,0.9)]' },
  great: { label: '좋은 조준', textColor: 'text-purple-300', barColor: 'bg-purple-400', glow: 'shadow-[0_0_12px_rgba(167,139,250,0.8)]' },
  good: { label: '안정 조준', textColor: 'text-sky-300', barColor: 'bg-sky-400', glow: 'shadow-[0_0_8px_rgba(56,189,248,0.7)]' },
  safe: { label: '아슬아슬', textColor: 'text-green-400', barColor: 'bg-green-500', glow: '' },
}

const TIER_GLOW: Record<string, string> = {
  일반: '',
  희귀: 'drop-shadow-[0_0_10px_rgba(56,189,248,0.7)]',
  영웅: 'drop-shadow-[0_0_14px_rgba(167,139,250,0.8)]',
  전설: 'drop-shadow-[0_0_20px_rgba(250,204,21,1)]',
}

// 조준 트랙 높이 (px) — 유리 내부 상단에 배치
const AIM_TRACK_H = 44

// 바닥에 깔린 미스터리 박스들 (뭐가 나올지 모름을 표현)
const MYSTERY_FLOOR = [
  { left: '4%',  size: 38, color: '#f59e0b', rotate: -8  },
  { left: '13%', size: 44, color: '#7c3aed', rotate:  5  },
  { left: '23%', size: 36, color: '#0ea5e9', rotate: -4  },
  { left: '33%', size: 42, color: '#ec4899', rotate:  7  },
  { left: '43%', size: 48, color: '#facc15', rotate: -3  },
  { left: '54%', size: 40, color: '#7c3aed', rotate:  6  },
  { left: '64%', size: 36, color: '#0ea5e9', rotate: -6  },
  { left: '73%', size: 44, color: '#f59e0b', rotate:  4  },
  { left: '83%', size: 38, color: '#ec4899', rotate: -5  },
  { left: '91%', size: 42, color: '#facc15', rotate:  3  },
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
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border-4 border-pink-500 bg-[#0d1525] shadow-[0_0_50px_rgba(236,72,153,0.25)]"
      style={{ fontFamily: 'OkDanDan, sans-serif' }}
    >
      {/* ── 상단 헤더 ── */}
      <div className={`relative flex items-center justify-between px-5 py-3 ${isFrenzy ? 'bg-gradient-to-r from-yellow-500 via-pink-500 to-violet-500' : 'bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600'}`}>
        <div className="flex items-center gap-2 text-white">
          <Sparkles size={18} />
          <span className="text-xl font-black tracking-wider">DOKI DOKI CLAW</span>
          {isFrenzy && <Zap size={16} className="text-yellow-200" />}
        </div>
        <div className="flex items-center gap-2">
          {/* 활성 아이템 배지 */}
          {activeItems.map((item, i) => (
            <span
              key={`${item}-${i}`}
              title={ITEM_BADGES[item].label}
              className={`rounded-full border px-2 py-0.5 text-xs font-bold text-white ${ITEM_BADGES[item].color}`}
            >
              {ITEM_BADGES[item].icon}
            </span>
          ))}
          <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-black text-pink-100">
            Rank {machineRank}
          </span>
        </div>
      </div>

      {/* ── 상태 메시지 ── */}
      <div className="bg-slate-950/70 px-4 py-1.5 text-center text-sm font-bold text-cyan-100 tracking-wide">
        {message}
      </div>

      {/* ── 유리 공간 (기계 내부) ── */}
      <div className="relative h-[340px] overflow-hidden border-b border-t border-cyan-300/20 bg-gradient-to-b from-[#141f38] via-[#0d1525] to-[#060d1a]">
        {/* 격자 배경 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:30px_30px]" />

        {/* ── 조준 트랙 (유리 최상단 — 크레인과 같은 컨테이너로 완벽 정렬) ── */}
        <div
          className="absolute inset-x-0 top-0 z-30 overflow-hidden border-b border-cyan-300/20"
          style={{ height: AIM_TRACK_H }}
        >
          {/* 존 색상 */}
          <div className="absolute inset-0 flex">
            <div className="flex-[2] bg-gradient-to-r from-green-800/60 to-green-700/50" />
            <div className="flex-[1.5] bg-gradient-to-r from-sky-800/60 to-sky-700/60" />
            <div className="flex-1 bg-gradient-to-r from-purple-800/70 to-purple-700/70" />
            <div className="w-10 flex-none bg-yellow-500/70" />
            <div className="flex-1 bg-gradient-to-l from-purple-800/70 to-purple-700/70" />
            <div className="flex-[1.5] bg-gradient-to-l from-sky-800/60 to-sky-700/60" />
            <div className="flex-[2] bg-gradient-to-l from-green-800/60 to-green-700/50" />
          </div>

          {/* 존 레이블 */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-around text-[9px] font-black text-white/35">
            <span>SAFE</span>
            <span className="text-sky-300/50">GOOD</span>
            <span className="text-purple-300/60">GREAT</span>
            <span className="text-yellow-200/80">PERFECT</span>
            <span className="text-purple-300/60">GREAT</span>
            <span className="text-sky-300/50">GOOD</span>
            <span>SAFE</span>
          </div>

          {/* 목표 구역 브래킷 */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 w-[14%] -translate-x-1/2 border-x-2 border-yellow-300/60"
            style={{ left: `${targetPosition}%` }}
          />

          {/* 커서 — 크레인과 동일한 left% 값 → 완벽 정렬 */}
          <motion.div
            className={`absolute top-0 bottom-0 w-[3px] -translate-x-1/2 ${aimStyle.barColor} ${aimStyle.glow}`}
            animate={{ left: `${aimPosition}%` }}
            transition={{ duration: 0.04 }}
          />
        </div>

        {/* 목표 수직 하이라이트 (트랙 아래부터) */}
        {(fishingState === 'idle' || fishingState === 'aim') && (
          <motion.div
            className="pointer-events-none absolute bottom-0 w-24 -translate-x-1/2"
            style={{ left: `${targetPosition}%`, top: AIM_TRACK_H }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div
              className="h-full w-full"
              style={{ background: 'linear-gradient(to bottom, rgba(250,204,21,0.15), rgba(250,204,21,0.25) 50%, rgba(250,204,21,0.05))' }}
            />
          </motion.div>
        )}

        {/* 크레인 — top을 AIM_TRACK_H로 맞춰 트랙 바로 아래에서 시작 */}
        <motion.div
          className="absolute z-20 flex -translate-x-1/2 flex-col items-center"
          style={{ top: AIM_TRACK_H }}
          animate={{
            left: getClawLeft(fishingState, aimPosition),
            y: getClawY(fishingState),
          }}
          transition={{
            duration: fishingState === 'aim' ? 0.04 : 0.75,
            ease: fishingState === 'aim' ? 'linear' : 'easeInOut',
          }}
        >
          {/* 와이어 */}
          <div className="h-14 w-0.5 rounded-b-full bg-slate-200 shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
          {/* 집게 본체 */}
          <div className="relative h-24 w-28">
            <div className="absolute left-1/2 top-0 h-9 w-12 -translate-x-1/2 rounded-md border-4 border-slate-300 bg-slate-600 shadow-lg" />
            <motion.div
              className="absolute left-[18px] top-[26px] h-[68px] w-[46px] rounded-bl-[36px] border-b-[7px] border-l-[7px] border-slate-200"
              animate={{ rotate: (fishingState === 'grab' || fishingState === 'up' || fishingState === 'return') ? 16 : -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute right-[18px] top-[26px] h-[68px] w-[46px] rounded-br-[36px] border-b-[7px] border-r-[7px] border-slate-200"
              animate={{ rotate: (fishingState === 'grab' || fishingState === 'up' || fishingState === 'return') ? -16 : 10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />

            {/* 잡은 인형 */}
            <AnimatePresence>
              {caughtItem && isInAction && fishingState !== 'aim' && fishingState !== 'down' && fishingState !== 'release' && (
                <motion.div
                  initial={{ scale: 0, y: 12 }}
                  animate={{ scale: 1, y: 40 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute left-1/2 top-8 -translate-x-1/2"
                >
                  {caughtItem.image ? (
                    <Image
                      src={caughtItem.image}
                      alt={caughtItem.name}
                      width={68} height={68}
                      unoptimized
                      className={`h-16 w-16 object-contain ${TIER_GLOW[caughtItem.tier] ?? ''}`}
                    />
                  ) : (
                    <span className="text-5xl">{caughtItem.emoji}</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* 바닥 미스터리 박스들 (인형이 있다는 암시 — 종류는 모름) */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-2 pb-2">
          {MYSTERY_FLOOR.map((box, i) => (
            <div
              key={i}
              className="relative flex items-center justify-center rounded-md text-white font-black text-sm select-none"
              style={{
                width: box.size,
                height: box.size,
                background: `linear-gradient(135deg, ${box.color}88, ${box.color}44)`,
                border: `2px solid ${box.color}66`,
                transform: `rotate(${box.rotate}deg)`,
                boxShadow: `0 0 8px ${box.color}44`,
              }}
            >
              ?
            </div>
          ))}
        </div>

        {/* 획득 결과 오버레이 */}
        <AnimatePresence>
          {isReleasing && fishingResult?.doll && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.4, rotate: -12, y: 30 }}
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
                      width={100} height={100}
                      unoptimized
                      className={`mx-auto h-24 w-24 object-contain ${TIER_GLOW[fishingResult.doll.tier] ?? ''}`}
                    />
                  </motion.div>
                ) : (
                  <span className="text-8xl">{fishingResult.doll.emoji}</span>
                )}
                <motion.p
                  className="mt-2 text-xl font-black text-white drop-shadow-lg"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  {fishingResult.doll.name}
                </motion.p>
                <p className="mt-1 text-sm font-bold text-amber-300">+{fishingResult.points.toLocaleString()}점</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 유리 반사 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-white/5 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-white/5 to-transparent" />
      </div>

      {/* 조준 등급 + 존 힌트 */}
      <div className="flex items-center justify-between px-5 pt-3 pb-1">
        <div className="flex gap-2.5 text-[9px] font-bold">
          <span className="text-green-500">■ 일반</span>
          <span className="text-sky-400">■ 희귀</span>
          <span className="text-purple-400">■ 영웅</span>
          <span className="text-yellow-400">■ 전설</span>
        </div>
        <motion.span
          key={aimGrade}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs font-black ${aimStyle.textColor}`}
        >
          {fishingState === 'aim' ? aimStyle.label : getAimGradeLabel(aimGrade)}
        </motion.span>
      </div>

      {/* ── 내리기 버튼 ── */}
      <div className="px-5 pb-5 pt-2">
        <motion.button
          type="button"
          onClick={onDropClaw}
          disabled={!canDrop}
          className="relative w-full overflow-hidden rounded-xl border-b-[5px] bg-red-500 py-5 text-2xl font-black text-white transition-colors
            border-red-800
            disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-700 disabled:text-slate-500"
          whileTap={canDrop ? { y: 4, borderBottomWidth: '1px' } : {}}
        >
          {/* 반짝 스윕 */}
          {canDrop && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              animate={{ x: ['-120%', '120%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
          <motion.div
            className="relative flex items-center justify-center gap-3"
            animate={canDrop ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Crosshair size={24} />
            <span>내리기</span>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-sm font-bold">SPACE</span>
          </motion.div>
        </motion.button>
      </div>

      {/* ── 최근 획득 인형 ── */}
      {recentDolls.length > 0 && (
        <div className="border-t border-slate-700/60 bg-slate-950/60 px-5 py-3">
          <p className="mb-2 text-xs font-bold text-slate-400">최근 획득</p>
          <div className="flex flex-wrap gap-1.5">
            {recentDolls.slice(-10).reverse().map((doll, i) => (
              <div
                key={`${doll.id}-${i}`}
                title={`${doll.name} (+${doll.score}점)`}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 ring-1 ring-slate-700"
              >
                {doll.image ? (
                  <Image src={doll.image} alt={doll.name} width={32} height={32} unoptimized className="h-8 w-8 object-contain" />
                ) : (
                  <span className="text-xl">{doll.emoji}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 기계 사이드 장식 */}
      <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-8 border-r border-t border-pink-500/40 rounded-tr-lg" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-8 border-l border-t border-pink-500/40 rounded-tl-lg" />
    </div>
  )
}
