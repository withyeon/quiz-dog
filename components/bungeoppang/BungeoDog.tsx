'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

export type DogMood = 'idle' | 'happy' | 'sweat' | 'wow'

const BUBBLE: Record<DogMood, string | null> = {
  idle: null,
  happy: '완벽해요! ✨',
  sweat: '앗, 탔다… 💦',
  wow: '황금 붕어빵!! 👑',
}

/** 빨간 목도리를 두르고 뒤집개를 든 퀴즈독. 완벽이면 눈 반짝·꼬리 흔들기, 태우면 식은땀 */
export default function BungeoDog({ mood = 'idle', size = 88 }: { mood?: DogMood; size?: number }) {
  const bubble = BUBBLE[mood]
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size + 24 }}>
      {bubble && (
        <motion.div
          key={mood}
          initial={{ opacity: 0, y: 6, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute -top-8 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-black text-slate-800 shadow-md sm:text-sm"
        >
          {bubble}
        </motion.div>
      )}
      <motion.div
        key={`${mood}-body`}
        animate={
          mood === 'happy' || mood === 'wow'
            ? { rotate: [0, -8, 8, -8, 0], y: [0, -6, 0] }
            : mood === 'sweat'
              ? { x: [0, -3, 3, -3, 0] }
              : { y: [0, -2, 0] }
        }
        transition={{ duration: mood === 'idle' ? 2.4 : 0.6, repeat: mood === 'idle' ? Infinity : 0 }}
        className="relative"
        style={{ width: size, height: size }}
      >
        <Image src="/assets/icons/mascot-pome-128.png" alt="퀴즈독" width={128} height={128} className="h-full w-full object-contain drop-shadow-md" />
        {/* 비니 */}
        <span className="pointer-events-none absolute left-1/2 top-[-6%] h-[26%] w-[62%] -translate-x-1/2 rounded-t-full rounded-b-md bg-[#dc2626] shadow-sm" aria-hidden>
          <span className="absolute left-1/2 top-[-32%] h-3 w-3 -translate-x-1/2 rounded-full bg-white" />
        </span>
        {/* 목도리 */}
        <span className="pointer-events-none absolute bottom-[14%] left-1/2 h-[14%] w-[70%] -translate-x-1/2 rounded-full bg-[#dc2626] shadow-sm" aria-hidden />
        {/* 뒤집개 */}
        <span className="pointer-events-none absolute -right-2 bottom-[8%] rotate-[25deg] text-2xl" aria-hidden>🍳</span>
        {mood === 'happy' && <span className="pointer-events-none absolute -left-2 top-1 text-xl" aria-hidden>✨</span>}
        {mood === 'wow' && <span className="pointer-events-none absolute -left-3 -top-1 text-2xl" aria-hidden>👑</span>}
        {mood === 'sweat' && <span className="pointer-events-none absolute -right-1 top-2 text-xl" aria-hidden>💦</span>}
      </motion.div>
    </div>
  )
}
