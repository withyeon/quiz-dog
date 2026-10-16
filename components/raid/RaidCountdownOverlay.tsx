'use client'

import { motion } from 'framer-motion'
import Countdown from '@/components/Countdown'
import { RAID_SPRITE_SRC } from '@/components/raid/raidAssets'
import type { RaidBossDef } from '@/lib/game/raid'

type RaidCountdownOverlayProps = {
  onComplete: () => void
  /** 첫 번째로 맞설 펭귄 (raidState.roster[0]). 없으면 황제 펭귄 실루엣을 보여 준다 */
  firstBoss?: RaidBossDef | null
}

const SILHOUETTE = 'brightness(0) drop-shadow(0 0 14px rgba(244, 63, 94, 0.85))'
const REVEALED = 'brightness(1) drop-shadow(0 0 0px rgba(244, 63, 94, 0))'

/**
 * 역할을 고른 뒤 뜨는 시작 카운트다운 — "출정!" 띠와 첫 상대의 실루엣이 숫자 위아래를 감싼다.
 * fixed 오버레이라 ScreenShake 같은 transform 안에 두지 않는다.
 *
 * 안쪽 <Countdown> 은 자체 z-50 어둠막(fixed)을 깔기 때문에, 우리 글씨가 흐려지지 않도록
 * 연출 층은 그보다 높은 z-[60] 에 둔다. 숫자는 정중앙이라 위·아래 블록과 겹치지 않는다.
 */
export default function RaidCountdownOverlay({ onComplete, firstBoss = null }: RaidCountdownOverlayProps) {
  const sprite = firstBoss ? RAID_SPRITE_SRC[firstBoss.sprite] : RAID_SPRITE_SRC.emperor
  const bossName = firstBoss?.name ?? '황제 펭귄'

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur">
      <div className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-between px-4 py-[7vh] text-center text-white">
        <motion.div
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <motion.div
            initial={{ scale: 2.2, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: -3, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
            className="mb-2 inline-block rounded-[6px] border-2 border-amber-200 bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-1 text-2xl font-black tracking-widest text-white shadow-lg shadow-rose-900/40 sm:text-3xl"
          >
            출정!
          </motion.div>
          <h1 className="text-3xl font-black drop-shadow-lg sm:text-5xl">황제 펭귄을 막아라!</h1>
          <p className="mt-1.5 text-base font-bold text-cyan-200 sm:text-xl">반 친구들과 함께 펭귄의 체력을 깎아요</p>
        </motion.div>

        {/* 첫 상대 — 카운트다운이 끝나갈 즈음 실루엣에서 본모습으로 드러난다 */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="[@media(max-height:560px)]:hidden"
        >
          <motion.img
            src={sprite.idle}
            alt=""
            width={112}
            height={140}
            draggable={false}
            initial={{ filter: SILHOUETTE }}
            animate={{ filter: [SILHOUETTE, SILHOUETTE, REVEALED] }}
            transition={{ duration: 3.4, times: [0, 0.78, 1] }}
            className="mx-auto h-[140px] w-[112px] object-contain sm:h-[180px] sm:w-[144px]"
          />
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1 text-sm font-black text-white ring-1 ring-white/30 sm:text-base">
            <span className="text-rose-300">첫 상대</span>
            {bossName}
          </div>
        </motion.div>
      </div>
      <Countdown onComplete={onComplete} />
    </div>
  )
}
