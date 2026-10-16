'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Sword } from 'lucide-react'
import { isRaidRole } from '@/lib/game/raid'
import { RAID_ROLE_ICON_SRC } from '@/components/raid/raidAssets'
import RaidWidget from './RaidWidget'
import type { RaidFeedItem } from './useRaidScoreActivity'

const SHOWN = 6

/** 최근 공격 — 기여(데미지)만. 누가 못 맞혔는지는 어디에도 나오지 않는다 */
export default function RecentFeed({ feed }: { feed: RaidFeedItem[] }) {
  return (
    <RaidWidget title="최근 공격" icon={Sword} className="flex-1">
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {feed.slice(0, SHOWN).map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: Math.max(0.45, 1 - index * 0.11), x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {item.role && isRaidRole(item.role) && (
                  <img src={RAID_ROLE_ICON_SRC[item.role]} alt="" width={16} height={16} className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{item.nickname}</span>
              </span>
              <span className="shrink-0 font-black text-amber-300">-{item.damage}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {feed.length === 0 && <p className="text-sm font-bold text-white/40">아직 공격이 없어요</p>}
      </div>
    </RaidWidget>
  )
}
