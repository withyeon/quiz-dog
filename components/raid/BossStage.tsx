'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import type { RaidBossDef, RaidBossState, RaidSkillState } from '@/lib/game/raid'
import type { RaidEvent, RaidHitPopup } from '@/hooks/useRaidEffects'
import { RAID_ARENA_SRC, RAID_EFFECT_SRC, RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import BossHpBar from '@/components/raid/stage/BossHpBar'
import BossIntroCard, { BOSS_INTRO_MS } from '@/components/raid/stage/BossIntroCard'
import BossNameplate from '@/components/raid/stage/BossNameplate'
import BossSprite from '@/components/raid/stage/BossSprite'
import DamageNumbers from '@/components/raid/stage/DamageNumbers'
import EventBanners from '@/components/raid/stage/EventBanners'
import { SkillChip, SkillTelegraph } from '@/components/raid/stage/SkillTelegraph'
import StageBackdrop from '@/components/raid/stage/StageBackdrop'
import {
  BlizzardOverlay,
  ChargeVignette,
  Confetti,
  EnrageAura,
  GroggyStars,
  SnowField,
  SpotlightShadow,
} from '@/components/raid/stage/StageFx'

/** 보스를 쓰러뜨린 뒤 쓰러진 그림을 보여 주는 시간 (그다음 등장 카드가 나온다) */
const DOWN_SCENE_MS = 1600

/**
 * 스프라이트 가로폭(px). 마지막 황제만 한 단계 크다.
 * 폰(compact)은 무대 전체 높이가 300px 안팎에 머물도록 이 폭에서 맞췄다.
 */
const SPRITE_WIDTH = {
  compact: { soldier: 144, final: 148 },
  large: { soldier: 236, final: 262 },
} as const

/** 스프라이트 발끝이 무대 바닥에서 떠 있는 높이 (발밑 그림자가 들어갈 자리) */
const GROUND_PAD = { compact: 8, large: 14 } as const

/** 그림 비율이 4:5 라서 높이는 폭의 1.25배 */
const SPRITE_RATIO = 1.25

type BossStageProps = {
  /** 지금 싸우는 보스. null 이면 전부 쓰러뜨린 상태 */
  boss: RaidBossState | null
  bossCount: number
  defeatedCount: number
  skill: RaidSkillState
  hits: RaidHitPopup[]
  events?: RaidEvent[]
  /** compact: 학생 폰 화면 위쪽, large: 선생님 프로젝터 */
  size?: 'compact' | 'large'
  className?: string
}

/**
 * 보스 무대 — 펭귄 스프라이트·체력 바·얼음 방패·필살기 예고/기절/눈보라·등장 카드·승리 장면.
 * 학생 화면(compact)과 선생님 화면(large)이 같은 컴포넌트를 쓴다. 상태는 전부 props 로 받고
 * 여기서는 연출(흔들림·아픈 표정·타격 숫자·사건 배너)만 한다. 조각은 components/raid/stage/ 에 나눠 두었다.
 */
export default function BossStage({
  boss,
  bossCount,
  defeatedCount,
  skill,
  hits,
  events = [],
  size = 'compact',
  className = '',
}: BossStageProps) {
  const isLarge = size === 'large'
  const reduceMotion = useReducedMotion() ?? false
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

  // 보스를 쓰러뜨리면 쓰러진 그림을 잠깐 보여 주고(downBoss), 이어서 다음 펭귄의 등장 카드(introBoss)를 띄운다.
  // def 객체는 players 가 바뀔 때마다 새로 만들어지므로 순번으로만 바뀜을 감지한다.
  // 처음 화면에 들어왔을 때(이미 몇 마리째인 경우)는 "바뀐 것"이 아니므로 장면도 카드도 없다.
  const [downBoss, setDownBoss] = useState<RaidBossDef | null>(null)
  const [introBoss, setIntroBoss] = useState<RaidBossDef | null>(null)
  const bossDefRef = useRef<RaidBossDef | null>(boss?.def ?? null)
  const previousBossRef = useRef<RaidBossDef | null>(boss?.def ?? null)
  bossDefRef.current = boss?.def ?? null
  const bossIndex = boss?.def.index ?? -1
  useEffect(() => {
    const previous = previousBossRef.current
    const next = bossDefRef.current
    previousBossRef.current = next
    // 전부 쓰러뜨린 경우(next 없음)는 아래 승리 화면이 쓰러진 황제를 보여 준다. 남은 장면은 정리한다
    if (!next) {
      setDownBoss(null)
      setIntroBoss(null)
      return
    }
    if (!previous || next.index <= previous.index) return
    setIntroBoss(null)
    setDownBoss(previous)
    const downTimer = window.setTimeout(() => {
      setDownBoss(null)
      setIntroBoss(next)
    }, DOWN_SCENE_MS)
    const introTimer = window.setTimeout(() => setIntroBoss(null), DOWN_SCENE_MS + BOSS_INTRO_MS)
    return () => {
      window.clearTimeout(downTimer)
      window.clearTimeout(introTimer)
    }
  }, [bossIndex])

  const isVictory = !boss
  // 쓰러진 장면 동안은 이름·체력도 쓰러진 펭귄 것(체력 0)을 보여 준다. 다음 펭귄은 장면이 끝난 뒤에 소개한다.
  const standing = boss && !downBoss ? boss : null
  const shownDef: RaidBossDef | null = downBoss ?? boss?.def ?? null
  const sprite = standing ? RAID_SPRITE_SRC[standing.def.sprite] : null

  const sizes = SPRITE_WIDTH[size]
  // 승리 화면(shownDef 없음)은 쓰러진 황제라 큰 쪽
  const spriteWidth = shownDef && !shownDef.isFinal ? sizes.soldier : sizes.final
  const spriteHeight = spriteWidth * SPRITE_RATIO
  const groundPad = GROUND_PAD[size]
  // 무대 높이는 가장 큰 펭귄(황제) 기준으로 고정해 보스가 바뀌어도 아래 퀴즈가 출렁이지 않는다
  const zoneHeight = sizes.final * SPRITE_RATIO + groundPad + (isLarge ? 8 : 0)

  const phase = standing ? skill.phase : 'idle'
  const charging = phase === 'charging'
  const groggy = phase === 'groggy'
  const blizzard = phase === 'blizzard'
  const enraged = Boolean(standing?.enraged)
  const shieldActive = Boolean(standing?.shield.active)
  const showIntro = Boolean(introBoss && boss && introBoss.index === boss.def.index)

  const arenaSrc = shownDef ? RAID_ARENA_SRC[shownDef.sprite] : RAID_EFFECT_SRC.victory
  const spotlightTone = groggy || isVictory ? 'groggy' : enraged ? 'enraged' : 'calm'

  const hpView = downBoss
    ? { hp: 0, maxHp: downBoss.maxHp, isFinal: downBoss.isFinal, shield: null }
    : boss
      ? { hp: boss.hp, maxHp: boss.def.maxHp, isFinal: boss.def.isFinal, shield: boss.shield }
      : null

  const nameplateLabel = downBoss
    ? `${downBoss.index + 1} / ${bossCount}번째 펭귄`
    : boss
      ? `${boss.def.index + 1} / ${bossCount}번째 펭귄`
      : `${bossCount}마리 모두 처치`

  // 등장 카드가 이미 소개하므로 그동안은 "등장!" 배너가 겹쳐 뜨지 않게 접고, 카드가 떠 있는 동안은 모든 배너를 쉰다
  // 폰 무대는 낮아서 배너가 둘만 쌓여도 체력 바를 덮는다. 폰에서는 가장 최근 것 하나만 띄운다
  const visibleEvents = showIntro
    ? []
    : events.filter((event) => !(event.kind === 'boss_appeared' && downBoss)).slice(isLarge ? -2 : -1)

  // 지금 무슨 일이 일어나는지 테두리 색으로도 알려 준다
  const frameTone = charging
    ? 'border-red-400/80 shadow-red-600/40'
    : groggy
      ? 'border-amber-300/90 shadow-amber-400/40'
      : enraged
        ? 'border-red-500/70 shadow-red-900/50'
        : shieldActive
          ? 'border-cyan-200/70 shadow-cyan-900/30'
          : isVictory
            ? 'border-amber-200/70 shadow-amber-900/30'
            : 'border-sky-200/30 shadow-sky-950/30'

  return (
    <section
      className={`relative isolate overflow-hidden rounded-2xl border text-white shadow-xl transition-colors duration-300 ${frameTone} ${className}`}
    >
      <StageBackdrop src={arenaSrc} victory={isVictory} enraged={enraged} reduceMotion={reduceMotion} />
      <SnowField isLarge={isLarge} reduceMotion={reduceMotion} />

      <div className={`relative z-10 flex flex-col ${isLarge ? 'gap-4 p-6' : 'gap-0.5 px-2 pb-2 pt-1.5'}`}>
        <BossNameplate
          label={nameplateLabel}
          name={shownDef ? shownDef.name : '승리!'}
          isFinal={shownDef ? shownDef.isFinal : true}
          bossCount={bossCount}
          filledCount={isVictory ? bossCount : defeatedCount}
          currentIndex={standing ? standing.def.index : -1}
          chip={standing ? <SkillChip skill={skill} isLarge={isLarge} reduceMotion={reduceMotion} /> : null}
          // 폰에서는 예고 띠가 이름표 자리를 덮는다. 자리는 그대로 두고 투명하게만 해서 높이가 변하지 않는다
          covered={charging && !isLarge}
          isLarge={isLarge}
          reduceMotion={reduceMotion}
        />

        {/* 가운데: 스프라이트 + 효과 + 타격 숫자 */}
        <div
          className="relative flex items-end justify-center"
          style={{ height: zoneHeight, paddingBottom: groundPad }}
        >
          <SpotlightShadow
            spriteWidth={spriteWidth}
            spriteHeight={spriteHeight}
            groundPad={groundPad}
            tone={spotlightTone}
          />

          <AnimatePresence>
            {enraged && (
              <EnrageAura
                key="enrage-aura"
                spriteWidth={spriteWidth}
                spriteHeight={spriteHeight}
                groundPad={groundPad}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>

          <AnimatePresence mode="popLayout">
            {downBoss && boss ? (
              <motion.div
                key={`down-${downBoss.index}`}
                className="relative"
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
                  style={{ width: spriteWidth, height: spriteHeight, imageRendering: 'pixelated' }}
                />
              </motion.div>
            ) : standing && sprite ? (
              <motion.div
                key={standing.def.index}
                className="relative"
                initial={{ opacity: 0, scale: 0.5, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                // 쓰러지는 연출은 쓰러진 그림이 맡으므로 서 있는 그림은 바로 사라진다
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ type: 'spring', bounce: 0.45, duration: 0.8 }}
              >
                <BossSprite
                  idleSrc={sprite.idle}
                  hurtSrc={sprite.hurt}
                  name={standing.def.name}
                  width={spriteWidth}
                  height={spriteHeight}
                  hurt={hurt}
                  shakeKey={shakeKey}
                  groggy={groggy}
                  enraged={enraged}
                  isFinal={standing.def.isFinal}
                  reduceMotion={reduceMotion}
                />
              </motion.div>
            ) : (
              // 마지막 보스는 항상 황제 펭귄이라 승리 화면은 쓰러진 황제를 보여 준다
              <motion.div
                key="victory"
                className="relative"
                initial={{ opacity: 0, y: -14, rotate: -6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.6 }}
              >
                <img
                  src={RAID_SPRITE_SRC.emperor.down}
                  alt="쓰러진 황제 펭귄"
                  width={spriteWidth}
                  height={spriteHeight}
                  draggable={false}
                  style={{ width: spriteWidth, height: spriteHeight, imageRendering: 'pixelated' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 기절 별 */}
          <AnimatePresence>
            {groggy && standing && (
              <GroggyStars
                key="groggy-stars"
                spriteWidth={spriteWidth}
                spriteHeight={spriteHeight}
                groundPad={groundPad}
                isLarge={isLarge}
                reduceMotion={reduceMotion}
              />
            )}
          </AnimatePresence>

          {/* 얼음 방패 고리 — 가운데가 빈 그림이라 펭귄 앞에 겹친다 */}
          {standing && shieldActive && (
            <motion.img
              src={RAID_EFFECT_SRC.iceShield}
              alt=""
              aria-hidden
              draggable={false}
              className="pointer-events-none absolute z-10"
              style={{
                width: spriteHeight * 1.1,
                height: spriteHeight * 1.1,
                left: '50%',
                marginLeft: -(spriteHeight * 1.1) / 2,
                bottom: groundPad - spriteHeight * 0.05,
              }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          )}

          {/* 타격 효과 — 타격마다 key 가 바뀌어 한 번 터지고 투명하게 남는다 */}
          {standing && latestHitId > 0 && (
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
                bottom: groundPad + spriteHeight * 0.28,
              }}
              initial={{ opacity: 0, scale: 0.3, rotate: -25 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.1, 1.25], rotate: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
          )}

          <DamageNumbers hits={hits} isLarge={isLarge} reduceMotion={reduceMotion} />
        </div>

        {/* 체력 바 / 승리 문구 */}
        {hpView ? (
          <BossHpBar hp={hpView.hp} maxHp={hpView.maxHp} isFinal={hpView.isFinal} shield={hpView.shield} isLarge={isLarge} />
        ) : (
          <motion.div
            className={`flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 font-black text-amber-950 shadow-lg shadow-amber-900/40 ring-2 ring-white/60 ${
              isLarge ? 'min-h-[4.5rem] text-3xl' : 'min-h-[2.625rem] text-sm'
            }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Trophy className={isLarge ? 'h-8 w-8' : 'h-4 w-4'} />
            펭귄 군단을 모두 물리쳤어요!
          </motion.div>
        )}

        {/* 필살기 예고 띠 — 이름표 위를 덮는다 */}
        <AnimatePresence>
          {charging && standing && (
            <SkillTelegraph key="telegraph" skill={skill} isLarge={isLarge} reduceMotion={reduceMotion} />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {charging && standing && (
          <ChargeVignette key="charge-vignette" urgent={skill.secondsLeft <= 5} reduceMotion={reduceMotion} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {blizzard && standing && <BlizzardOverlay key="blizzard" isLarge={isLarge} reduceMotion={reduceMotion} />}
      </AnimatePresence>

      {isVictory && <Confetti isLarge={isLarge} reduceMotion={reduceMotion} />}

      <AnimatePresence>
        {showIntro && introBoss && (
          <BossIntroCard key={`intro-${introBoss.index}`} boss={introBoss} isLarge={isLarge} reduceMotion={reduceMotion} />
        )}
      </AnimatePresence>

      <EventBanners events={visibleEvents} isLarge={isLarge} reduceMotion={reduceMotion} />
    </section>
  )
}
