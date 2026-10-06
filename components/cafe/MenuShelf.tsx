'use client'

import { motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
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
                  {/* 접시 */}
                  <div
                    className={`relative w-14 h-14 rounded-full border-2 shadow-md transition-all ${isUnlocked
                        ? stock > 0
                          ? hasOrder
                            ? 'bg-green-100 border-green-400 scale-105'
                            : 'bg-white border-amber-300'
                          : 'bg-white border-amber-300 opacity-60'
                        : 'bg-gray-300 border-gray-500 opacity-40'
                      }`}
                  >
                    {/* 메뉴 이미지 (해금되고 재고가 있을 때만) */}
                    {isUnlocked && stock > 0 && (
                      <div className="absolute inset-0 flex items-center justify-center p-1.5">
                        <CafeImage
                          src={menu.image}
                          alt={menu.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-contain"
                          fallbackEmoji={menu.emoji}
                          fallbackClassName="text-2xl"
                        />
                      </div>
                    )}

                    {/* 재고 수 (해금된 경우만) */}
                    {isUnlocked && (
                      <div
                        className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stock > 0
                            ? 'bg-blue-500 text-white border-blue-600'
                            : 'bg-gray-500 text-white border-gray-600'
                          }`}
                      >
                        {stock}
                      </div>
                    )}

                    {/* 주문 요청 표시 */}
                    {hasOrder && isUnlocked && (
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border border-yellow-600"
                      >
                        <span className="text-[10px]">⚡</span>
                      </motion.div>
                    )}
                  </div>

                  {/* 메뉴 이름 (해금된 경우만) */}
                  {isUnlocked && (
                    <div className="mt-1 text-[10px] font-bold text-gray-700 text-center max-w-[56px] truncate">
                      {menu.name}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
