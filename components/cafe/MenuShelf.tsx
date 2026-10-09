'use client'

import { motion } from 'framer-motion'
import MenuPlate from '@/components/cafe/MenuPlate'
import { MENU_ITEMS, type Customer } from '@/lib/game/cafe'

type Props = {
  unlockedMenus: string[]
  menuStock: Record<string, number>
  customers: Customer[]
}

/** 카운터 아래 메뉴 접시 줄: 해금 여부, 재고 수, 주문이 들어온 메뉴 표시. */
export default function MenuShelf({ unlockedMenus, menuStock, customers }: Props) {
  return (
    <>
      {/* 접시 영역 - 카운터 아래에 모든 메뉴 슬롯 표시 (그리드 형태) */}
      <div className="absolute bottom-24 [@media(max-height:500px)]:bottom-10 left-0 right-0 z-15">
        <div className="max-w-5xl mx-auto px-4 pt-1">
          <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 justify-items-center">
            {MENU_ITEMS.map((menu, index) => {
              const isUnlocked = unlockedMenus.includes(menu.id)
              const stock = menuStock[menu.id] || 0
              const hasOrder = customers.some((c) => c.order === menu.id)

              return (
                <motion.div
                  key={menu.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative flex flex-col items-center"
                >
                  <MenuPlate menu={menu} isUnlocked={isUnlocked} stock={stock} hasOrder={hasOrder} />
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
