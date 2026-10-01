'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Lock, Snowflake, Sparkles, Trophy } from 'lucide-react'
import type { RaidBossSprite, RaidBossState, RaidFrenzyState } from '@/lib/game/raid'
import type { RaidEvent, RaidHitPopup } from '@/hooks/useRaidGame'

export const RAID_SPRITE_SRC: Record<RaidBossSprite, { idle: string; hurt: string }> = {
  guard: { idle: '/raid/penguin-guard.webp', hurt: '/raid/penguin-guard-hurt.webp' },
  knight: { idle: '/raid/penguin-knight.webp', hurt: '/raid/penguin-knight-hurt.webp' },
  general: { idle: '/raid/penguin-general.webp', hurt: '/raid/penguin-general-hurt.webp' },
  emperor: { idle: '/raid/penguin-emperor.webp', hurt: '/raid/penguin-emperor-hurt.webp' },
}

type BossStageProps = {
  /** 지금 싸우는 보스. null 이면 전부 쓰러뜨린 상태 */
  boss: RaidBossState | null
  bossCount: number
  defeatedCount: number
  frenzy: RaidFrenzyState
  hits: RaidHitPopup[]
  events?: RaidEvent[]
  /** compact: 학생 폰 화면 위쪽, large: 선생님 프로젝터 */
  size?: 'compact' | 'large'
  className?: string
}

function hpTone(ratio: number) {
  if (ratio > 0.5) return 'from-emerald-400 to-green-500'
  if (ratio > 0.25) return 'from-amber-300 to-orange-500'
  return 'from-rose-400 to-red-600'
}

const EVENT_STYLE: Record<RaidEvent['kind'], string> = {
  boss_defeated: 'bg-amber-400 text-amber-950',
  boss_appeared: 'bg-slate-900 text-white ring-2 ring-white/40',
  shield_up: 'bg-cyan-300 text-cyan-950',
  shield_broken: 'bg-sky-500 text-white',
  frenzy_start: 'bg-gradient-to-r from-orange-500 to-rose-500 text-white',
  victory: 'bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950',
}

/**
 * 보스 무대 — 펭귄 스프라이트·체력 바·얼음 방패·집중 공격 표시.
 * 학생 화면(compact)과 선생님 화면(large)이 같은 컴포넌트를 쓴다. 상태는 전부 props 로 받고
 * 여기서는 연출(흔들림·아픈 표정·타격 숫자·사건 배너)만 한다.
 */
export default function BossStage({
  boss,
  bossCount,
  defeatedCount,
  frenzy,
  hits,
  events = [],
  size = 'compact',
  className = '',
}: BossStageProps) {
  const isLarge = size === 'large'
  const latestHitId = hits.length > 0 ? hits[hits.length - 1].id : 0

  // 타격이 들어올 때마다 잠깐 아픈 표정 + 흔들림
  const [hurt, setHurt] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  useEffect(() => {
    if (!latestHitId) return
    setHurt(true)
    setShakeKey((key) => key + 1)
    const timer = window.setTimeout(() => setHurt(false), 420)
    return () => window.clearTimeout(timer)
  }, [latestHitId])

  const sprite = boss ? RAID_SPRITE_SRC[boss.def.sprite] : null
  const spriteWidth = (isLarge ? 208 : 96) * (boss?.def.isFinal ? 1.18 : 1)
  const spriteHeight = spriteWidth * 1.25
  const shield = boss?.shield
  const shieldActive = Boolean(shield?.active)
  const hpPercent = boss ? Math.max(0, Math.min(100, (boss.hp / boss.def.maxHp) * 100)) : 0

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border text-white shadow-xl ${
        frenzy.active
          ? 'border-orange-300/80 shadow-orange-500/30'
          : shieldActive
            ? 'border-cyan-200/70 shadow-cyan-900/30'
            : 'border-sky-200/30 shadow-sky-950/30'
      } ${className}`}
      style={{
        background: frenzy.active
          ? 'linear-gradient(160deg, #3b0f1f 0%, #6b1d2c 45%, #1b2742 100%)'
          : 'linear-gradient(160deg, #0b2d4d 0%, #134b6e 55%, #0f3a5c 100%)',
      }}
    >
      {/* 눈발 */}
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
        {Array.from({ length: isLarge ? 22 : 12 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: i % 3 === 0 ? 4 : 2,
              height: i % 3 === 0 ? 4 : 2,
              left: `${(i * 47) % 100}%`,
              top: `${(i * 29) % 90}%`,
            }}
            animate={{ y: [0, 14, 0], opacity: [0.2, 0.9, 0.2] }}
            transition={{ duration: 2.4 + (i % 4) * 0.6, repeat: Infinity, delay: i * 0.17 }}
          />
        ))}
      </div>

      {/* 집중 공격 테두리 불꽃 */}
      {frenzy.active && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: 'inset 0 0 60px rgba(251, 146, 60, 0.55)' }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}

      <div className={`relative z-10 flex flex-col ${isLarge ? 'gap-4 p-5 sm:p-7' : 'gap-2 p-3'}`}>
        {/* 상단: 이름 · 진행 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={`flex items-center gap-2 font-black text-sky-100/80 ${isLarge ? 'text-sm' : 'text-[11px]'}`}>
              <Snowflake className={isLarge ? 'h-4 w-4' : 'h-3 w-3'} />
              {boss ? `${defeatedCount + 1} / ${bossCount}번째 펭귄` : `${bossCount}마리 모두 처치`}
              {boss?.def.isFinal && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">최종 보스</span>}
            </div>
            <h2 className={`truncate font-black leading-tight ${isLarge ? 'text-3xl sm:text-4xl' : 'text-lg'}`}>
              {boss ? boss.def.name : '승리!'}
            </h2>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            {frenzy.active ? (
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className={`inline-flex items-center gap-1 rounded-full bg-orange-500 font-black text-white shadow-lg shadow-orange-500/40 ${isLarge ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-[11px]'}`}
              >
                <Flame className={isLarge ? 'h-4 w-4' : 'h-3 w-3'} />
                집중 공격 ×2 · {frenzy.secondsLeft}초
              </motion.div>
            ) : (
              <div className={`inline-flex items-center gap-1 rounded-full bg-white/10 font-bold text-sky-100 ${isLarge ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-[11px]'}`}>
                <Flame className={isLarge ? 'h-4 w-4' : 'h-3 w-3'} />
                집중 공격까지 {frenzy.nextIn}초
              </div>
            )}
          </div>
        </div>

        {/* 가운데: 스프라이트 + 타격 숫자 */}
        <div
          className="relative flex items-end justify-center"
          style={{ height: spriteHeight + (isLarge ? 36 : 14) }}
        >
          {/* 얼음 방패 고리 */}
          {boss && shieldActive && (
            <motion.div
              className="pointer-events-none absolute rounded-full border-4 border-cyan-200/80"
              style={{
                width: spriteWidth * 1.35,
                height: spriteWidth * 1.35,
                bottom: isLarge ? 0 : -6,
                background: 'radial-gradient(circle, rgba(165,243,252,0.28) 0%, rgba(165,243,252,0.06) 60%, transparent 72%)',
                boxShadow: '0 0 40px rgba(103, 232, 249, 0.45)',
              }}
              animate={{ scale: [1, 1.04, 1], rotate: [0, 6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          )}

          <AnimatePresence mode="popLayout">
            {boss && sprite ? (
              <motion.div
                key={boss.def.index}
                initial={{ opacity: 0, scale: 0.5, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, y: 70, rotate: 100, scale: 0.8, transition: { duration: 0.7 } }}
                transition={{ type: 'spring', bounce: 0.45, duration: 0.8 }}
                className="relative"
              >
                <motion.div
                  key={shakeKey}
                  animate={shakeKey ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }}
                  transition={{ duration: 0.38 }}
                >
                  <motion.img
                    src={hurt ? sprite.hurt : sprite.idle}
                    alt={boss.def.name}
                    width={spriteWidth}
                    height={spriteHeight}
                    draggable={false}
                    className={`select-none ${hurt ? 'brightness-150 saturate-150' : ''}`}
                    style={{
                      imageRendering: 'pixelated',
                      width: spriteWidth,
                      height: spriteHeight,
                      filter: boss.def.isFinal && !hurt ? 'drop-shadow(0 0 18px rgba(255, 210, 63, 0.55))' : undefined,
                    }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="victory"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 pb-2 text-center"
              >
                <Trophy className={isLarge ? 'h-20 w-20 text-amber-300' : 'h-10 w-10 text-amber-300'} />
                <p className={`font-black ${isLarge ? 'text-2xl' : 'text-sm'}`}>펭귄 군단을 모두 물리쳤어요!</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 타격 숫자 */}
          <AnimatePresence>
            {hits.map((hit) => (
              <motion.div
                key={hit.id}
                initial={{ opacity: 0, y: 10, scale: hit.mine ? 0.6 : 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, -30, -60, -90], scale: hit.mine ? [0.6, 1.25, 1.1, 1] : [0.8, 1, 1, 0.95] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, ease: 'easeOut' }}
                className="pointer-events-none absolute whitespace-nowrap font-black drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]"
                style={{
                  left: `${20 + ((hit.id * 37) % 60)}%`,
                  bottom: '38%',
                  fontSize: hit.mine ? (isLarge ? 40 : 26) : (isLarge ? 22 : 14),
                  color: hit.frenzy ? '#fb923c' : hit.mine ? '#fde047' : '#e0f2fe',
                }}
              >
                {hit.nickname ? `${hit.nickname} ` : ''}-{hit.damage}
                {hit.mine && hit.comboBonus > 0 && <span className="ml-1 text-[0.6em] text-orange-300">콤보 +{hit.comboBonus}</span>}
                {hit.frenzy && <span className="ml-1 text-[0.6em]">×2</span>}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* 체력 바 */}
        {boss && (
          <div>
            <div className={`mb-1 flex items-center justify-between font-black ${isLarge ? 'text-base' : 'text-xs'}`}>
              <span className="flex items-center gap-1 text-sky-100">
                체력
                {shieldActive && <Lock className={isLarge ? 'h-4 w-4 text-cyan-200' : 'h-3 w-3 text-cyan-200'} />}
              </span>
              <span className="tabular-nums">{boss.hp.toLocaleString()} / {boss.def.maxHp.toLocaleString()}</span>
            </div>
            <div className={`relative overflow-hidden rounded-full bg-slate-950/60 ring-1 ring-white/15 ${isLarge ? 'h-6' : 'h-3.5'}`}>
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${hpTone(boss.hpRatio)}`}
                initial={false}
                animate={{ width: `${hpPercent}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
              />
              {shieldActive && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(135deg, rgba(165,243,252,0.55) 0 8px, transparent 8px 16px)',
                  }}
                />
              )}
            </div>

            {/* 방패 상태 */}
            {shield && (shieldActive || (shield.broken && boss.hpRatio <= 0.5)) && (
              <div className={`mt-2 flex items-center gap-2 rounded-xl px-3 font-black ${isLarge ? 'py-2 text-base' : 'py-1.5 text-xs'} ${
                shieldActive ? 'bg-cyan-200/20 text-cyan-100 ring-1 ring-cyan-200/50' : 'bg-white/10 text-sky-100'
              }`}>
                {shieldActive ? <Lock className={isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'} /> : <Sparkles className={isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'} />}
                {shieldActive ? (
                  <span>
                    얼음 방패 {shield.points}/{shield.required} · 친구 {shield.remaining}명이 더 때리면 깨져요
                  </span>
                ) : (
                  <span>방패가 깨졌어요! 마음껏 공격하세요</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 사건 배너 */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex flex-col items-center gap-2 px-3">
        <AnimatePresence>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -16, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`rounded-2xl px-4 py-2 text-center font-black shadow-2xl ${EVENT_STYLE[event.kind]} ${isLarge ? 'text-2xl sm:text-3xl' : 'text-sm'}`}
            >
              {event.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}
