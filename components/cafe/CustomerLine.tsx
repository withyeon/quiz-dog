'use client'

import type React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CustomerCard from '@/components/cafe/CustomerCard'
import { MENU_ITEMS, type Customer } from '@/lib/game/cafe'

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

                return (
                  <CustomerCard
                    key={customer.id}
                    characterImage={customer.characterImage}
                    menu={menu}
                    patience={patience}
                    secondsLeft={Math.ceil(patience * customer.patience)}
                    price={getDisplayPrice(menu.sellPrice)}
                    priceCrashed={priceCrashed}
                    onClick={(e) => onCustomerClick(customer, e)}
                    style={{ order: index }}
                  />
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  )
}
