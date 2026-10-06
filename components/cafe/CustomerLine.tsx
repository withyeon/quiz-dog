'use client'

import type React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
import { MENU_ITEMS, CUSTOMER_FALLBACK_EMOJI, formatCafeMoneyDelta, type Customer } from '@/lib/game/cafe'

type Props = {
  customersInLine: Customer[]
  badReviewActive: boolean
  badReviewSeconds: number
  priceCrashed: boolean
  getCustomerPatience: (customer: Customer) => number
  getDisplayPrice: (sellPrice: number) => number
  onCustomerClick: (customer: Customer, event: React.MouseEvent) => void
}

/** 카운터 위에 줄 선 손님들: 캐릭터, 주문 말풍선(판매가), 인내심 게이지. 손님을 누르면 서빙한다. */
export default function CustomerLine({
  customersInLine,
  badReviewActive,
  badReviewSeconds,
  priceCrashed,
  getCustomerPatience,
  getDisplayPrice,
  onCustomerClick,
}: Props) {
  return (
    <>
      {/* 손님 영역 - 카운터 위쪽에 줄지어 배치 */}
      {/* 폰: 손님 5명 말풍선이 화면보다 넓어 잘리던 것 → 가로 스크롤. 가로 폰(높이≤500)은 줄 높이를 줄여 HUD·매대와 겹치지 않게 */}
      <div className="absolute bottom-56 [@media(max-height:500px)]:bottom-32 left-0 right-0 z-10">
        <div className="max-w-5xl mx-auto px-2 sm:px-4 overflow-x-auto overscroll-x-contain">
          <div className="relative flex items-end justify-center gap-2 sm:gap-3 h-56 [@media(max-height:500px)]:h-32 w-max min-w-full mx-auto">
            {badReviewActive && customersInLine.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex flex-col items-center gap-1 rounded-2xl border-4 border-rose-400 bg-white/95 px-5 py-3 text-center shadow-xl"
              >
                <span className="text-lg font-black text-rose-600">악성 리뷰 때문에 손님이 안 와요</span>
                <span className="text-sm font-bold text-slate-600">{badReviewSeconds}초 뒤 다시 손님이 와요</span>
              </motion.div>
            )}
            <AnimatePresence>
              {customersInLine.map((customer, index) => {
                const menu = MENU_ITEMS.find((m) => m.id === customer.order)
                if (!menu) return null

                const patience = getCustomerPatience(customer)
                const isUrgentCustomer = patience < 0.3

                return (
                  <motion.div
                    key={customer.id}
                    initial={{ opacity: 0, y: 100, scale: 0.5 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.5, x: 200 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="relative flex flex-col items-center cursor-pointer group"
                    onClick={(e) => onCustomerClick(customer, e)}
                    style={{ order: index }}
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
                          src={customer.characterImage}
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
                          {formatCafeMoneyDelta(getDisplayPrice(menu.sellPrice))}
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
                      {Math.ceil(patience * customer.patience)}초
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}
