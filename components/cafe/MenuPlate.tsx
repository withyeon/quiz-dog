'use client'

import { motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'
import type { MenuItem } from '@/lib/game/cafe'

type Props = {
  menu: MenuItem
  isUnlocked: boolean
  stock: number
  /** 줄 선 손님 중 이 메뉴를 주문한 사람이 있는지 */
  hasOrder: boolean
  /** 튜토리얼 데모: 재고가 막 바뀐 접시를 한 번 튀게 한다 */
  pop?: boolean
}

/**
 * 메뉴 접시 하나와 그 아래 이름. 바깥 래퍼(위치·등장 애니메이션)는 부르는 쪽이 감싼다.
 * 실제 카페 매대(MenuShelf)와 카페 튜토리얼 데모가 같이 쓴다.
 */
export default function MenuPlate({ menu, isUnlocked, stock, hasOrder, pop = false }: Props) {
  return (
    <>
      {/* 접시 */}
      <motion.div
        animate={pop ? { scale: [1, 1.18, 1] } : undefined}
        transition={{ duration: 0.5 }}
        className={`relative w-14 h-14 rounded-full border-2 shadow-md ${pop ? '' : 'transition-all'} ${isUnlocked
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
          <motion.div
            key={stock}
            initial={pop ? { scale: 1.6 } : false}
            animate={pop ? { scale: 1 } : undefined}
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stock > 0
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-gray-500 text-white border-gray-600'
              }`}
          >
            {stock}
          </motion.div>
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
      </motion.div>

      {/* 메뉴 이름 (해금된 경우만) */}
      {isUnlocked && (
        <div className="mt-1 text-[10px] font-bold text-gray-700 text-center max-w-[56px] truncate">
          {menu.name}
        </div>
      )}
    </>
  )
}
