'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CafeImage from '@/components/cafe/CafeImage'
import PixelIcon from '@/components/ui/PixelIcon'
import QuizSetName from '@/components/game/QuizSetName'
import { formatCafeMoney, formatTime } from '@/lib/game/cafe'
import { CAFE_ITEMS, type ItemId } from '@/lib/game/cafeItems'
import { GoldenSpatulaChip } from '@/components/cafe/GoldenSpatula'

type Props = {
  timeRemaining: number
  isUrgent: boolean
  cash: number
  customersServed: number
  questionSetTitle?: string | null
  activeBuffs: Array<{ itemId: ItemId; expiresAt: number }>
  goldenSpatulaActive: boolean
  currentTime: number
  onOpenShop: () => void
}

/** 상단 정보 줄: 남은 시간·돈·문제집·손님 수·걸린 아이템 칩과 상점 버튼. */
export default function CafeHud({
  timeRemaining,
  isUrgent,
  cash,
  customersServed,
  questionSetTitle,
  activeBuffs,
  goldenSpatulaActive,
  currentTime,
  onOpenShop,
}: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {/* 폰: 칩 4개 + 상점 버튼이 360px를 넘어 상점 버튼이 화면 밖으로 밀리던 문제 → 칩 축소, 손님 수 칩은 sm부터 */}
      <div className="max-w-7xl mx-auto px-2 py-2 sm:px-4 sm:py-4 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <div className="flex items-center gap-1.5 sm:gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-2 py-1 sm:px-4 sm:py-2 border-2 border-white/30">
            <PixelIcon name="time" size={24} alt="" className="sm:hidden" />
            <PixelIcon name="time" size={36} alt="" className="hidden sm:inline-block" />
            <span
              className={`text-lg sm:text-3xl font-bold font-mono whitespace-nowrap ${isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'
                }`}
            >
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-2 py-1 sm:px-4 sm:py-2 border-2 border-white/30">
            <PixelIcon name="gold" size={22} alt="" className="sm:hidden" />
            <PixelIcon name="gold" size={32} alt="" className="hidden sm:inline-block" />
            <span className="text-lg sm:text-3xl font-bold text-slate-700 whitespace-nowrap">{formatCafeMoney(cash)}</span>
          </div>
          <QuizSetName title={questionSetTitle} className="hidden lg:flex" />
          <div className="hidden sm:flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
            <PixelIcon name="people" size={28} alt="" />
            <span className="text-xl font-bold text-slate-700 whitespace-nowrap">{customersServed}명</span>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>
              {activeBuffs.map(buff => {
                const item = CAFE_ITEMS[buff.itemId]
                const remaining = Math.max(0, Math.ceil((buff.expiresAt - currentTime) / 1000))
                return (
                  <motion.div
                    key={buff.itemId}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-black ${
                      item.type === 'buff' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                    }`}
                  >
                    <CafeImage
                      src={item.image}
                      alt={item.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                      fallbackEmoji={item.emoji}
                      fallbackClassName="h-5 w-5 text-sm"
                    />
                    <span>{remaining}초</span>
                  </motion.div>
                )
              })}
              {goldenSpatulaActive && <GoldenSpatulaChip key="golden-spatula" />}
            </AnimatePresence>
          </div>
        </div>
        <Button
          onClick={onOpenShop}
          className="shrink-0 bg-white text-amber-700 hover:bg-amber-50 font-bold text-sm sm:text-lg px-3 py-2 sm:px-6 sm:py-3 shadow-xl border-4 border-amber-800"
        >
          <ShoppingCart className="mr-1.5 sm:mr-2 h-5 w-5" />
          상점
        </Button>
      </div>
    </div>
  )
}
