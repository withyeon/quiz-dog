'use client'

import { AnimatePresence, motion } from 'framer-motion'
import CafeImage from '@/components/cafe/CafeImage'

interface AttackAlertProps {
  attack: {
    /** 공격마다 다른 값. 연달아 맞으면 배너가 새로 들어오는 연출을 다시 한다 */
    id: number
    attackerNickname: string
    itemName: string
    itemEmoji: string
    itemImage: string
    /** 효과 한 줄 (세금으로 낸 금액 등). 없으면 "○○ 발동!" */
    detail?: string
  } | null
}

export default function AttackAlert({ attack }: AttackAlertProps) {
  return (
    // 가운데 정렬은 바깥 일반 div가 맡는다. motion에 -translate-x-1/2를 같이 주면
    // framer가 y 애니메이션용 transform으로 덮어써서 배너가 오른쪽으로 밀린다.
    // 위치는 상단 HUD(시간·돈·아이템 칩) 바로 아래 — 예전엔 top-4라 3초 동안 아이템 칩을 가렸다.
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4 sm:top-20">
      <AnimatePresence>
        {attack && (
          <motion.div
            key={attack.id}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            className="flex items-center gap-3 rounded-lg border-4 border-rose-800 bg-rose-600 px-6 py-3 text-white shadow-2xl"
          >
            <CafeImage
              src={attack.itemImage}
              alt={attack.itemName}
              width={40}
              height={40}
              className="h-10 w-10 object-contain"
              fallbackEmoji={attack.itemEmoji}
              fallbackClassName="h-10 w-10 text-3xl"
            />
            <div>
              <div className="text-base font-black">{attack.attackerNickname}의 공격!</div>
              <div className="text-sm font-bold text-rose-200">{attack.detail ?? `${attack.itemName} 발동!`}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
