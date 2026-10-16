'use client'

import { motion } from 'framer-motion'
import { Crown, Zap } from 'lucide-react'
import { getRaidSkillName, type RaidBossDef } from '@/lib/game/raid'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'

/** 등장 카드가 떠 있는 시간 (BossStage 가 이 시간 뒤에 카드를 내린다) */
export const BOSS_INTRO_MS = 2300

type BossIntroCardProps = {
  boss: RaidBossDef
  isLarge: boolean
  reduceMotion: boolean
}

/** 경고 띠: 노랑·검정 사선 + 붉은 띠 */
const HAZARD = 'repeating-linear-gradient(135deg, #fbbf24 0 10px, #111827 10px 20px)'

/**
 * 보스 등장 카드 — WARNING 띠가 지나가고, 검은 실루엣이 번쩍하며 정체를 드러낸 뒤 이름·필살기가 뜬다.
 * 무대 안쪽 전체를 덮는 약 2초짜리 연출이라 사건 배너와 겹치지 않게 BossStage 가 그동안 배너를 접어 둔다.
 */
export default function BossIntroCard({ boss, isLarge, reduceMotion }: BossIntroCardProps) {
  const sprite = RAID_SPRITE_SRC[boss.sprite]
  const spriteHeight = isLarge ? 250 : 104
  const spriteWidth = (spriteHeight * 4) / 5

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-2xl"
      style={{
        // 검은 실루엣이 어두운 바탕에 묻히지 않도록 가운데를 붉게 밝힌다
        background:
          'radial-gradient(ellipse at 50% 42%, rgba(248, 113, 113, 0.78) 0%, rgba(153, 27, 27, 0.7) 34%, rgba(8, 10, 24, 0.94) 78%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      transition={{ duration: 0.2 }}
    >
      {/* 실루엣 → 정체 공개: 검정 → 번쩍 → 제 색 */}
      <motion.img
        src={sprite.idle}
        alt=""
        draggable={false}
        width={spriteWidth}
        height={spriteHeight}
        style={{ width: spriteWidth, height: spriteHeight, imageRendering: 'pixelated' }}
        initial={{ opacity: 0, scale: 0.7, filter: 'brightness(0)' }}
        animate={
          reduceMotion
            ? { opacity: 1, scale: 1, filter: 'brightness(1)' }
            : {
                opacity: [0, 1, 1, 1, 1],
                scale: [0.7, 1, 1, 1.08, 1],
                filter: ['brightness(0)', 'brightness(0)', 'brightness(0)', 'brightness(2.6)', 'brightness(1)'],
              }
        }
        transition={reduceMotion ? { duration: 0.3 } : { duration: 1.5, times: [0, 0.25, 0.6, 0.72, 1], ease: 'easeOut' }}
      />

      <motion.div
        className="mt-1.5 flex flex-col items-center gap-1 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0.2 : 1.05, duration: 0.3 }}
      >
        <h3
          className={`flex items-center gap-1.5 font-black leading-none text-white [text-shadow:0_3px_0_rgba(0,0,0,0.6)] ${isLarge ? 'text-5xl' : 'text-2xl'}`}
        >
          {boss.isFinal && <Crown className={`text-amber-300 ${isLarge ? 'h-9 w-9' : 'h-5 w-5'}`} />}
          {boss.name}
        </h3>
        <p
          className={`inline-flex items-center gap-1 rounded-full bg-black/45 font-black text-red-100 ring-1 ring-red-300/50 ${
            isLarge ? 'px-4 py-1.5 text-xl' : 'px-2.5 py-0.5 text-xs'
          }`}
        >
          <Zap className={`fill-yellow-300 text-yellow-200 ${isLarge ? 'h-5 w-5' : 'h-3.5 w-3.5'}`} />
          필살기 · {getRaidSkillName(boss.sprite)}
        </p>
      </motion.div>

      {/* WARNING 띠 — 실루엣 가운데를 가로질러 들어왔다가 오른쪽으로 빠진다 */}
      <div className="absolute inset-x-0 top-[38%] -translate-y-1/2 overflow-hidden">
        <motion.div
          initial={{ x: '-102%' }}
          animate={reduceMotion ? { x: '0%' } : { x: ['-102%', '0%', '0%', '102%'] }}
          transition={reduceMotion ? { duration: 0.2 } : { duration: 1.35, times: [0, 0.2, 0.7, 1], ease: 'easeInOut' }}
        >
          <div className={isLarge ? 'h-3' : 'h-1.5'} style={{ background: HAZARD }} />
          <div className="flex items-center justify-center gap-3 bg-red-600 py-0.5 shadow-[0_0_24px_rgba(239,68,68,0.9)]">
            <motion.span
              className={`font-black uppercase tracking-[0.35em] text-white ${isLarge ? 'text-4xl' : 'text-xl'}`}
              animate={reduceMotion ? undefined : { opacity: [1, 0.35, 1, 0.35, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            >
              Warning
            </motion.span>
          </div>
          <div className={isLarge ? 'h-3' : 'h-1.5'} style={{ background: HAZARD }} />
        </motion.div>
      </div>
    </motion.div>
  )
}
