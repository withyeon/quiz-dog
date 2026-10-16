'use client'

import type { ComponentType } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Flame, Shield, ShieldOff, Sparkles, Swords, Trophy, TriangleAlert, Wind, Zap } from 'lucide-react'
import type { RaidEvent } from '@/hooks/useRaidEffects'

type BannerStyle = {
  /** 배너 바탕·글자색 */
  className: string
  icon: ComponentType<{ className?: string }>
  /** 두근거리듯 커졌다 작아지게 할 사건(필살기 예고·분노) */
  pulse?: boolean
}

/** 사건 종류별 배너 — 색만 봐도 좋은 일(금·하늘)과 위험(붉은 계열)이 갈리게 한다 */
const EVENT_STYLE: Record<RaidEvent['kind'], BannerStyle> = {
  boss_defeated: {
    className: 'bg-gradient-to-r from-amber-300 to-yellow-400 text-amber-950 ring-2 ring-amber-100/70',
    icon: Swords,
  },
  boss_appeared: {
    className: 'bg-slate-950 text-white ring-2 ring-red-400/70',
    icon: TriangleAlert,
  },
  shield_up: {
    className: 'bg-gradient-to-r from-cyan-200 to-sky-300 text-cyan-950 ring-2 ring-white/70',
    icon: Shield,
  },
  shield_broken: {
    className: 'bg-gradient-to-r from-sky-500 to-blue-500 text-white ring-2 ring-sky-100/70',
    icon: ShieldOff,
  },
  skill_charge: {
    className: 'bg-gradient-to-r from-red-600 to-orange-500 text-white ring-2 ring-yellow-200/70',
    icon: Zap,
    pulse: true,
  },
  skill_interrupted: {
    className: 'bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 text-amber-950 ring-2 ring-white/80',
    icon: Sparkles,
  },
  skill_blizzard: {
    className: 'bg-gradient-to-r from-slate-100 to-sky-200 text-sky-950 ring-2 ring-white/80',
    icon: Wind,
  },
  boss_enraged: {
    className: 'bg-gradient-to-r from-red-800 to-rose-700 text-red-50 ring-2 ring-red-300/70',
    icon: Flame,
    pulse: true,
  },
  victory: {
    className: 'bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 text-amber-950 ring-2 ring-white/80',
    icon: Trophy,
  },
}

type EventBannersProps = {
  events: RaidEvent[]
  isLarge: boolean
  reduceMotion: boolean
}

/**
 * 사건 배너 — 무대 위쪽 가운데에 쌓인다. 종류마다 색과 아이콘이 달라
 * 글을 읽기 전에 "좋은 일인지 위험한 일인지"가 먼저 보인다.
 */
export default function EventBanners({ events, isLarge, reduceMotion }: EventBannersProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2 px-3 ${isLarge ? 'top-36' : 'top-[3.9rem]'}`}
    >
      <AnimatePresence>
        {events.map((event) => {
          const style = EVENT_STYLE[event.kind]
          const Icon = style.icon
          const pulse = Boolean(style.pulse) && !reduceMotion
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -16, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: pulse ? [1, 1.05, 1] : 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{
                duration: 0.25,
                scale: pulse ? { duration: 0.7, repeat: Infinity } : { duration: 0.25 },
              }}
              className={`flex max-w-full items-center justify-center gap-2 rounded-2xl text-center font-black shadow-2xl ${style.className} ${
                isLarge ? 'px-6 py-3 text-2xl sm:text-3xl' : 'px-3 py-1.5 text-sm'
              }`}
            >
              <Icon className={`shrink-0 ${isLarge ? 'h-8 w-8' : 'h-4 w-4'}`} />
              <span className="min-w-0 break-keep">{event.text}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
