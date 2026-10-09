'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
import { CUSTOMER_FALLBACK_EMOJI, formatCafeMoneyDelta, type MenuItem } from '@/lib/game/cafe'

type Props = {
  characterImage: string
  menu: MenuItem
  /** 남은 인내심 비율 0~1. 0.3 아래면 급한 손님으로 깜빡인다. */
  patience: number
  /** 게이지 아래 "N초" 에 보여 줄 남은 초 */
  secondsLeft: number
  /** 말풍선에 보여 줄 판매가 (업그레이드·가격 폭락 반영 후) */
  price: number
  priceCrashed?: boolean
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  style?: React.CSSProperties
  /** 튜토리얼 데모에서 손님이 빠질 때 남은 손님이 미끄러지게 */
  layout?: boolean
  /** 손가락 포인터 같은 덧그림 */
  children?: React.ReactNode
}

/**
 * 손님 한 명: 캐릭터, 주문 말풍선, 인내심 게이지.
 * 실제 카페 손님 줄(CustomerLine)과 카페 튜토리얼 데모가 같이 쓴다.
 * 루트가 motion.div 라서 AnimatePresence 바로 아래에 key 를 주고 두면 나가는 애니메이션이 돈다.
 */
export default function CustomerCard({
  characterImage,
  menu,
  patience,
  secondsLeft,
  price,
  priceCrashed = false,
  onClick,
  style,
  layout,
  children,
}: Props) {
  const isUrgentCustomer = patience < 0.3

  return (
    <motion.div
      layout={layout}
      initial={{ opacity: 0, y: 100, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 100, scale: 0.5, x: 200 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="relative flex flex-col items-center cursor-pointer group"
      onClick={onClick}
      style={style}
    >
      {/* 손님 */}
      <motion.div
        animate={{
          y: [0, -5, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`mb-1.5 transition-all flex items-center justify-center ${isUrgentCustomer
            ? 'animate-pulse scale-110'
            : 'group-hover:scale-110'
          }`}
      >
        <div className="relative w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] [@media(max-height:500px)]:w-10 [@media(max-height:500px)]:h-10">
          <CafeImage
            src={characterImage}
            alt="손님"
            width={72}
            height={72}
            className="w-full h-full object-contain"
            fallbackEmoji={CUSTOMER_FALLBACK_EMOJI}
            fallbackClassName="w-full h-full text-5xl"
          />
        </div>
      </motion.div>

      {/* 주문 말풍선 */}
      <motion.div
        whileHover={{ scale: 1.04 }}
        className={`bg-white rounded-2xl px-2 py-2 sm:px-4 sm:py-3 shadow-xl border-4 min-w-[92px] sm:min-w-[120px] [@media(max-height:500px)]:py-1 transition-all ${isUrgentCustomer
            ? 'border-red-500 bg-red-50 animate-pulse'
            : 'border-amber-400 group-hover:border-amber-500'
          }`}
      >
        <div className="text-center">
          <div className="mb-1.5 flex items-center justify-center">
            <CafeImage
              src={menu.image}
              alt={menu.name}
              width={56}
              height={56}
              className="w-10 h-10 sm:w-14 sm:h-14 [@media(max-height:500px)]:w-7 [@media(max-height:500px)]:h-7 object-contain"
              fallbackEmoji={menu.emoji}
              fallbackClassName="text-3xl"
            />
          </div>
          <div className="text-xs sm:text-sm font-bold text-gray-800 mb-0.5 sm:mb-1 whitespace-nowrap">{menu.name}</div>
          <div className={`text-xs font-semibold ${priceCrashed ? 'text-rose-600' : 'text-green-600'}`}>
            {formatCafeMoneyDelta(price)}
          </div>
        </div>
      </motion.div>

      {/* 인내심 게이지 */}
      <div className="mt-1.5 sm:mt-2 w-20 sm:w-28 h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-400">
        <motion.div
          initial={{ width: '100%' }}
          animate={{
            width: `${patience * 100}%`,
            backgroundColor: patience > 0.5 ? '#10b981' : patience > 0.3 ? '#f59e0b' : '#ef4444',
          }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-full"
        />
      </div>
      <div className="text-xs text-gray-600 mt-1 font-semibold">
        {secondsLeft}초
      </div>

      {children}
    </motion.div>
  )
}
