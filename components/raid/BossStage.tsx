'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Lock, Snowflake, Sparkles, Trophy } from 'lucide-react'
import type { RaidBossDef, RaidBossState, RaidFrenzyState } from '@/lib/game/raid'
import type { RaidEvent, RaidHitPopup } from '@/hooks/useRaidGame'
import { RAID_EFFECT_SRC, RAID_SPRITE_SRC } from '@/components/raid/raidAssets'

/** 보스를 쓰러뜨린 뒤 쓰러진 그림을 보여 주는 시간 (그다음 펭귄이 들어온다) */
const DOWN_SCENE_MS = 1600

/** 무대 뒤 왕좌의 방 위에 덮는 어둠 — 위쪽 이름과 아래쪽 체력 바 글씨가 읽히게 위아래를 더 어둡게 */
const ARENA_OVERLAY = 'linear-gradient(180deg, rgba(6, 22, 44, 0.74) 0%, rgba(6, 22, 44, 0.34) 38%, rgba(6, 22, 44, 0.42) 68%, rgba(6, 22, 44, 0.86) 100%)'
const FRENZY_OVERLAY = 'linear-gradient(180deg, rgba(70, 10, 30, 0.8) 0%, rgba(120, 28, 40, 0.46) 42%, rgba(40, 10, 30, 0.9) 100%)'

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

  // 보스를 쓰러뜨리면 쓰러진 그림을 잠깐 보여 주고 다음 펭귄을 들인다.
  // def 객체는 players 가 바뀔 때마다 새로 만들어지므로 순번으로만 바뀜을 감지한다.
  const [downBoss, setDownBoss] = useState<RaidBossDef | null>(null)
  const bossDefRef = useRef<RaidBossDef | null>(boss?.def ?? null)
  const previousBossRef = useRef<RaidBossDef | null>(boss?.def ?? null)
  bossDefRef.current = boss?.def ?? null
  const bossIndex = boss?.def.index ?? -1
  useEffect(() => {
    const previous = previousBossRef.current
    const next = bossDefRef.current
    previousBossRef.current = next
    // 전부 쓰러뜨린 경우(next 없음)는 아래 승리 화면이 쓰러진 황제를 보여 준다
    if (!previous || !next || next.index <= previous.index) return
    setDownBoss(previous)
    const timer = window.setTimeout(() => setDownBoss(null), DOWN_SCENE_MS)
    return () => window.clearTimeout(timer)
  }, [bossIndex])

  const sprite = boss ? RAID_SPRITE_SRC[boss.def.sprite] : null
  const baseWidth = isLarge ? 208 : 112
  const shownIsFinal = downBoss ? downBoss.isFinal : boss ? boss.def.isFinal : true
  const spriteWidth = baseWidth * (shownIsFinal ? 1.18 : 1)
  const spriteHeight = spriteWidth * 1.25
  const shieldRing = spriteHeight * 1.1
  const shield = boss?.shield
  const shieldActive = Boolean(shield?.active)
  // 쓰러진 장면 동안은 이름·체력도 쓰러진 펭귄 것(체력 0)을 보여 준다. 다음 펭귄은 장면이 끝난 뒤에 소개한다.
  const hpView = downBoss
    ? { hp: 0, maxHp: downBoss.maxHp, ratio: 0 }
    : boss
      ? { hp: boss.hp, maxHp: boss.def.maxHp, ratio: boss.hpRatio }
      : null
  const hpPercent = hpView ? Math.max(0, Math.min(100, (hpView.hp / hpView.maxHp) * 100)) : 0
  const showShield = Boolean(shield) && !downBoss

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
        background: `${frenzy.active ? FRENZY_OVERLAY : ARENA_OVERLAY}, url('${RAID_EFFECT_SRC.arena}') center 62% / cover no-repeat, #0b2d4d`,
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
              {downBoss
                ? `${downBoss.index + 1} / ${bossCount}번째 펭귄`
                : boss ? `${defeatedCount + 1} / ${bossCount}번째 펭귄` : `${bossCount}마리 모두 처치`}
              {(downBoss ? downBoss.isFinal : boss?.def.isFinal) && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">최종 보스</span>}
            </div>
            <h2 className={`truncate font-black leading-tight ${isLarge ? 'text-3xl sm:text-4xl' : 'text-lg'}`}>
              {downBoss ? downBoss.name : boss ? boss.def.name : '승리!'}
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
          <AnimatePresence mode="popLayout">
            {downBoss && boss ? (
              <motion.div
                key={`down-${downBoss.index}`}
                initial={{ opacity: 0, y: -14, rotate: -6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, y: 24, transition: { duration: 0.3 } }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
              >
                <img
                  src={RAID_SPRITE_SRC[downBoss.sprite].down}
                  alt={`쓰러진 ${downBoss.name}`}
                  width={spriteWidth}
                  height={spriteHeight}
                  draggable={false}
                  style={{ width: spriteWidth, height: spriteHeight }}
                />
              </motion.div>
            ) : boss && sprite ? (
              <motion.div
                key={boss.def.index}
                initial={{ opacity: 0, scale: 0.5, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                // 쓰러지는 연출은 쓰러진 그림이 맡으므로 서 있는 그림은 바로 사라진다
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', bounce: 0.45, duration: 0.8 }}
                className="relative"
              >
                <motion.div
                  key={shakeKey}
                  animate={shakeKey ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }}
                  transition={{ duration: 0.38 }}
                >
                  {/*
                    맞은 표정은 처음부터 겹쳐 그려 두고 투명도만 바꾼다. src 를 바꾸면 첫 타격 때
                    아직 안 받은 그림(장당 50~70KB)을 기다리느라 펭귄이 잠깐 사라진다.
                  */}
                  <motion.div
                    className="relative select-none"
                    style={{
                      width: spriteWidth,
                      height: spriteHeight,
                      filter: boss.def.isFinal && !hurt ? 'drop-shadow(0 0 18px rgba(255, 210, 63, 0.55))' : undefined,
                    }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <img
                      src={sprite.idle}
                      alt={boss.def.name}
                      width={spriteWidth}
                      height={spriteHeight}
                      draggable={false}
                      className={`absolute inset-0 h-full w-full ${hurt ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <img
                      src={sprite.hurt}
                      alt=""
                      aria-hidden
                      width={spriteWidth}
                      height={spriteHeight}
                      draggable={false}
                      className={`absolute inset-0 h-full w-full ${hurt ? 'opacity-100 brightness-125' : 'opacity-0'}`}
                    />
                  </motion.div>
                </motion.div>
              </motion.div>
            ) : (
              // 마지막 보스는 항상 황제 펭귄이라 승리 화면은 쓰러진 황제를 보여 준다
              <motion.div
                key="victory"
                initial={{ opacity: 0, y: -14, rotate: -6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
                className="flex flex-col items-center text-center"
              >
                <img
                  src={RAID_SPRITE_SRC.emperor.down}
                  alt="쓰러진 황제 펭귄"
                  width={spriteWidth * 0.8}
                  height={spriteHeight * 0.8}
                  draggable={false}
                  style={{ width: spriteWidth * 0.8, height: spriteHeight * 0.8 }}
                />
                <p className={`flex items-center gap-1.5 font-black ${isLarge ? 'text-2xl' : 'text-sm'}`}>
                  <Trophy className={isLarge ? 'h-7 w-7 text-amber-300' : 'h-4 w-4 text-amber-300'} />
                  펭귄 군단을 모두 물리쳤어요!
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 얼음 방패 고리 — 가운데가 빈 그림이라 펭귄 앞에 겹친다 */}
          {boss && !downBoss && shieldActive && (
            <motion.img
              src={RAID_EFFECT_SRC.iceShield}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute z-10"
              style={{ width: shieldRing, height: shieldRing, left: '50%', marginLeft: -shieldRing / 2, bottom: 0 }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          )}

          {/* 타격 효과 — 타격마다 key 가 바뀌어 한 번 터지고 투명하게 남는다 */}
          {boss && !downBoss && latestHitId > 0 && (
            <motion.img
              key={`burst-${latestHitId}`}
              src={RAID_EFFECT_SRC.hit}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute z-10"
              style={{
                width: spriteWidth * 0.8,
                height: spriteWidth * 0.8,
                left: '50%',
                marginLeft: -spriteWidth * 0.4 + (((latestHitId * 53) % 41) - 20),
                bottom: spriteHeight * 0.28,
              }}
              initial={{ opacity: 0, scale: 0.3, rotate: -25 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 1.25], rotate: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          )}

          {/* 타격 숫자 */}
          <AnimatePresence>
            {hits.map((hit) => (
              <motion.div
                key={hit.id}
                initial={{ opacity: 0, y: 10, scale: hit.mine ? 0.6 : 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: [10, -30, -60, -90], scale: hit.mine ? [0.6, 1.25, 1.1, 1] : [0.8, 1, 1, 0.95] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, ease: 'easeOut' }}
                className="pointer-events-none absolute z-20 whitespace-nowrap font-black drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]"
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
        {hpView && (
          <div>
            <div className={`mb-1 flex items-center justify-between font-black ${isLarge ? 'text-base' : 'text-xs'}`}>
              <span className="flex items-center gap-1 text-sky-100">
                체력
                {showShield && shieldActive && <Lock className={isLarge ? 'h-4 w-4 text-cyan-200' : 'h-3 w-3 text-cyan-200'} />}
              </span>
              <span className="tabular-nums">{hpView.hp.toLocaleString()} / {hpView.maxHp.toLocaleString()}</span>
            </div>
            <div className={`relative overflow-hidden rounded-full bg-slate-950/60 ring-1 ring-white/15 ${isLarge ? 'h-6' : 'h-3.5'}`}>
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${hpTone(hpView.ratio)}`}
                initial={false}
                animate={{ width: `${hpPercent}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
              />
              {showShield && shieldActive && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(135deg, rgba(165,243,252,0.55) 0 8px, transparent 8px 16px)',
                  }}
                />
              )}
            </div>

            {/* 방패 상태 */}
            {showShield && shield && (shieldActive || (shield.broken && hpView.ratio <= 0.5)) && (
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
