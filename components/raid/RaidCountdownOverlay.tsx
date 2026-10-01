'use client'

import { motion } from 'framer-motion'
import Countdown from '@/components/Countdown'

/** 역할을 고른 뒤 뜨는 시작 카운트다운. fixed 오버레이라 ScreenShake 같은 transform 안에 두지 않는다. */
export default function RaidCountdownOverlay({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pointer-events-none absolute inset-x-0 top-[16vh] px-4 text-center text-white"
      >
        <img
          src="/raid/penguin-emperor.webp"
          alt=""
          width={96}
          height={120}
          draggable={false}
          className="mx-auto mb-3 h-[120px] w-[96px]"
          style={{ imageRendering: 'pixelated' }}
        />
        <h1 className="mb-2 text-4xl font-black sm:text-5xl">황제 펭귄을 막아라!</h1>
        <p className="text-lg font-bold text-cyan-200 sm:text-xl">정답을 맞혀 반 전체가 함께 펭귄의 체력을 깎아요</p>
      </motion.div>
      <Countdown onComplete={onComplete} />
    </div>
  )
}
