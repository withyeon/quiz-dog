'use client'

import { motion } from 'framer-motion'
import Countdown from '@/components/Countdown'

/**
 * 장비를 고른 뒤 뜨는 시작 카운트다운. fixed 오버레이는 ScreenShake 밖에 둔다.
 * 흔들림이 끝나도 남는 transform이 fixed의 기준 상자가 되어 오버레이가 화면 일부만 덮고 아래가 비어 보였다.
 */
export default function BattleCountdownOverlay({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 backdrop-blur">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="pointer-events-none absolute inset-x-0 top-[18vh] text-center text-white"
      >
        <div className="mb-4 text-8xl">❄️</div>
        <h1 className="mb-2 text-5xl font-black">눈싸움 대작전</h1>
        <p className="text-xl font-bold text-cyan-200">타겟을 조준하고 퀴즈로 눈뭉치를 날려라!</p>
      </motion.div>
      <Countdown onComplete={onComplete} />
    </div>
  )
}
