'use client'

import { motion } from 'framer-motion'
import { Lock, Sparkles } from 'lucide-react'
import { RAID, type RaidShieldState } from '@/lib/game/raid'
import { hpTone, outlinedText, toSegments } from './stageTheme'

type BossHpBarProps = {
  hp: number
  maxHp: number
  /** 마지막 보스의 25% 선은 "분노선"이라 붉게 표시한다 */
  isFinal: boolean
  /** 방패 상태. 쓰러진 장면처럼 방패를 말하지 않을 때는 null */
  shield: RaidShieldState | null
  isLarge: boolean
}

/** 체력 구간 표시선(남은 체력 %). 50%는 얼음 방패가 올라오는 선이라 따로 꾸민다 */
const PHASE_MARKS = [75, RAID.SHIELD_HP_RATIO * 100, 25]

/**
 * 한 줄 체력 바 — 구간 표시선(75/50/25%), 깎일 때 늦게 따라 내려오는 흰 잔상,
 * 방패 구간 빗금, 막대 안 숫자. 방패 안내는 "친구 N명이 더"만 말하고 누가 했는지는 보여 주지 않는다.
 */
export default function BossHpBar({ hp, maxHp, isFinal, shield, isLarge }: BossHpBarProps) {
  const percent = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const shieldActive = Boolean(shield?.active)
  const shieldBroken = Boolean(shield?.broken)
  const gauge = shield ? toSegments(shield.points, shield.required, isLarge ? 14 : 8) : null

  return (
    <div>
      <div className="relative">
        <div
          className={`relative overflow-hidden rounded-full bg-slate-950/80 ring-1 transition-shadow duration-300 ${
            shieldActive ? 'ring-cyan-200/90 shadow-[0_0_10px_rgba(165,243,252,0.55)]' : 'ring-white/25'
          } ${isLarge ? 'h-8' : 'h-[18px]'}`}
        >
          {/* 잔상: 깎인 만큼이 흰색으로 남았다가 늦게 따라 내려온다. 체력이 늘 때는 진짜 막대에 가려 보이지 않는다 */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-white/85"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ delay: 0.45, duration: 0.6, ease: 'easeOut' }}
          />
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${hpTone(percent / 100)}`}
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          />
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />

          {shieldActive && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                backgroundImage: 'repeating-linear-gradient(135deg, rgba(165, 243, 252, 0.7) 0 6px, rgba(165, 243, 252, 0.18) 6px 12px)',
              }}
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
          )}
        </div>

        {/* 구간 표시선 — 이미 지나간 선은 흐리게 */}
        {PHASE_MARKS.map((mark) => {
          const isShieldLine = mark === RAID.SHIELD_HP_RATIO * 100
          const passed = percent < mark
          return (
            <span
              key={mark}
              className={`pointer-events-none absolute rounded-full transition-opacity duration-300 ${
                isShieldLine
                  ? 'bg-cyan-200 shadow-[0_0_6px_rgba(165,243,252,0.95)]'
                  : isFinal && mark === RAID.ENRAGE_HP_RATIO * 100
                    ? 'bg-red-300/90'
                    : 'bg-white/55'
              } ${passed ? 'opacity-40' : 'opacity-100'}`}
              style={{
                left: `${mark}%`,
                width: isShieldLine ? (isLarge ? 4 : 3) : 2,
                marginLeft: isShieldLine ? (isLarge ? -2 : -1.5) : -1,
                top: isShieldLine ? -3 : 1,
                bottom: isShieldLine ? -3 : 1,
              }}
              aria-hidden
            />
          )
        })}

        {/* 막대 안 글씨: 왼쪽 HP/방패 자물쇠, 가운데 숫자 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={`absolute left-2 flex items-center font-black text-white/90 ${isLarge ? 'text-sm' : 'text-[9px]'}`}
            style={outlinedText(isLarge ? 3 : 2)}
          >
            {shieldActive ? <Lock className={isLarge ? 'h-4 w-4 text-cyan-100' : 'h-3 w-3 text-cyan-100'} /> : 'HP'}
          </span>
          <span
            className={`font-black tabular-nums text-white ${isLarge ? 'text-lg' : 'text-[11px]'}`}
            style={outlinedText(isLarge ? 4 : 3)}
          >
            {hp.toLocaleString()} / {maxHp.toLocaleString()}
          </span>
        </div>
      </div>

      {/* 방패 안내 줄 — 높이를 늘 같게 잡아 방패가 올라와도 아래 퀴즈가 밀리지 않는다 */}
      <div className={`mt-1 flex items-center ${isLarge ? 'min-h-9' : 'min-h-5'}`}>
        {shield && shieldActive && gauge ? (
          <motion.div
            key="shield"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex w-full items-center gap-2 rounded-lg bg-cyan-300/15 font-black text-cyan-100 ring-1 ring-cyan-200/40 ${
              isLarge ? 'px-3 py-1.5 text-base' : 'px-2 py-[2px] text-[11px] leading-4'
            }`}
          >
            <Lock className={`shrink-0 ${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
            <span className="shrink-0">얼음 방패 · 친구 {shield.remaining}명이 더 맞히면 깨져요</span>
            <div
              className="flex min-w-0 flex-1 items-center gap-[2px]"
              role="img"
              aria-label={`방패 ${shield.points} / ${shield.required}`}
            >
              {Array.from({ length: gauge.total }).map((_, i) => (
                <span
                  key={i}
                  className={`block flex-1 rounded-sm transition-colors duration-300 ${
                    i < gauge.filled ? 'bg-cyan-200 shadow-[0_0_4px_rgba(165,243,252,0.9)]' : 'bg-black/35 ring-1 ring-inset ring-white/20'
                  } ${isLarge ? 'h-3' : 'h-1.5'}`}
                />
              ))}
            </div>
          </motion.div>
        ) : shield && shieldBroken && percent <= RAID.SHIELD_HP_RATIO * 100 && hp > 0 ? (
          <motion.div
            key="broken"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex w-full items-center gap-1.5 rounded-lg bg-white/10 font-black text-sky-100 ${
              isLarge ? 'px-3 py-1.5 text-base' : 'px-2 py-[2px] text-[11px] leading-4'
            }`}
          >
            <Sparkles className={`shrink-0 ${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
            방패가 깨졌어요! 마음껏 공격하세요
          </motion.div>
        ) : shield && percent > RAID.SHIELD_HP_RATIO * 100 ? (
          <p className={`px-1 font-bold text-sky-100/55 ${isLarge ? 'text-sm' : 'text-[10px]'}`}>
            체력이 {Math.round(RAID.SHIELD_HP_RATIO * 100)}%가 되면 얼음 방패가 올라와요
          </p>
        ) : null}
      </div>
    </div>
  )
}
