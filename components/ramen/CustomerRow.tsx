'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import type { Customer, Pot } from '@/lib/game/ramen'

type CustomerRowProps = {
  customers: Customer[]
  pots: Pot[]
  patienceTotalMs: number
  patienceLeftMs: number
  /** 아바타 크기(px) */
  size?: number
}

/**
 * 카운터 앞에 선 손님들. 냄비 번호와 같은 자리의 손님이 그 냄비를 받는다.
 * 주문 말풍선 → 서빙되면 반응 말풍선 + 금액. 위에는 손님 인내심 막대(다 떨어지면 남은 손님이 떠난다).
 */
export default function CustomerRow({ customers, pots, patienceTotalMs, patienceLeftMs, size = 64 }: CustomerRowProps) {
  const ratio = patienceTotalMs > 0 ? Math.max(0, Math.min(1, patienceLeftMs / patienceTotalMs)) : 0
  const allDone = pots.every((pot) => pot.result)
  const barColor = ratio > 0.5 ? 'bg-emerald-400' : ratio > 0.25 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-black text-amber-100 sm:text-sm">⏳ 손님 인내심</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[#1f1a17] bg-white/80">
          <div className={`h-full transition-[width] duration-100 ${allDone ? 'bg-slate-400' : barColor}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-black text-amber-100">{Math.ceil(patienceLeftMs / 1000)}초</span>
      </div>

      <div className={`grid gap-2 ${customers.length === 1 ? 'grid-cols-1' : customers.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {customers.map((customer, index) => {
          const result = pots[index]?.result ?? null
          const bubble = result ? result.reaction : customer.order
          const tone = !result ? 'bg-white text-slate-800' : result.money >= 800 ? 'bg-emerald-100 text-emerald-900' : result.money > 0 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'
          return (
            <motion.div
              key={`${customer.avatar}-${index}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.12 }}
              className="flex flex-col items-center"
            >
              <motion.div
                key={result ? `${result.verdict}-bubble` : 'order-bubble'}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`relative mb-2 w-full rounded-xl px-2 py-1.5 text-center text-[11px] font-black leading-snug shadow-md break-keep sm:text-xs ${tone}`}
              >
                {bubble}
                {result && result.money > 0 && (
                  <span className="ml-1 inline-block rounded-full bg-white/80 px-1.5 text-emerald-700">+{result.money.toLocaleString()}원</span>
                )}
                <span className={`absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 ${tone.split(' ')[0]}`} aria-hidden />
              </motion.div>
              <motion.div
                animate={result ? (result.money >= 800 ? { y: [0, -8, 0], rotate: [0, -6, 6, 0] } : result.money === 0 ? { x: [0, -4, 4, -4, 0] } : { y: 0 }) : { y: [0, -3, 0] }}
                transition={result ? { duration: 0.6 } : { duration: 1.6, repeat: Infinity, delay: index * 0.3 }}
                className={`relative overflow-hidden rounded-full border-[3px] bg-white shadow-lg ${result ? (result.money > 0 ? 'border-emerald-300' : 'border-slate-300 grayscale') : 'border-white'}`}
                style={{ width: size, height: size }}
              >
                <Image src={`/character/${customer.avatar}.webp`} alt="" width={128} height={128} className="h-full w-full object-cover" draggable={false} />
              </motion.div>
              <div className="mt-1 text-[11px] font-black text-amber-100 sm:text-xs">{customer.name}</div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
