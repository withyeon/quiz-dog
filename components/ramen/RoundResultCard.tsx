'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { RAMEN, type RoundOutcome } from '@/lib/game/ramen'

type RoundResultCardProps = {
  outcome: RoundOutcome
  onClose: () => void
}

/**
 * 한 판 결과 카드: 손님마다 라면 평가·금액, 이번 판 매출, 목표 달성·세 냄비 완벽 축하.
 * 카드는 한 번만 닫히고(훅의 outcomeClosedRef) 닫으면 다음 문제로 간다.
 */
export default function RoundResultCard({ outcome, onClose }: RoundResultCardProps) {
  const best = outcome.results.length * 1000
  const allZero = outcome.money === 0
  const celebrate = outcome.goalReached !== null || outcome.tripleCrown

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      onClick={onClose}
    >
      {celebrate && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 0.2, 0.9, 0] }}
          transition={{ duration: 1.1, times: [0, 0.3, 0.5, 1] }}
          className="pointer-events-none absolute inset-0 bg-[#fff3b0]"
        />
      )}
      <motion.div
        initial={{ scale: 0.6, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
        className={`relative w-full max-w-md rounded-2xl border-4 bg-white p-5 text-center shadow-2xl sm:p-6 ${
          outcome.tripleCrown ? 'border-amber-400' : allZero ? 'border-stone-400' : 'border-violet-300'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {outcome.tripleCrown && (
          <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="mb-1 text-xl font-black text-amber-600">
            👑 세 냄비 완벽!! 👑
          </motion.div>
        )}
        <div className="text-sm font-black text-slate-500">이번 판 매출</div>
        <div className={`text-5xl font-black ${allZero ? 'text-stone-600' : 'text-violet-700'}`}>
          {allZero ? '0원' : `+${outcome.money.toLocaleString()}원`}
        </div>
        <div className="mt-1 text-xs font-bold text-slate-500">최대 {best.toLocaleString()}원 · 가진 돈 {(outcome.moneyBefore + outcome.money).toLocaleString()}원</div>

        <div className="mt-4 space-y-2 text-left">
          {outcome.results.map((result, index) => {
            const customer = outcome.customers[index]
            const good = result.money >= 800
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.12 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${good ? 'border-emerald-200 bg-emerald-50' : result.money > 0 ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-100'}`}
              >
                <div className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 bg-white ${good ? 'border-emerald-300' : result.money > 0 ? 'border-amber-300' : 'border-stone-300 grayscale'}`}>
                  <Image src={`/character/${customer?.avatar ?? 1}.webp`} alt="" width={96} height={96} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-slate-900">{result.title}</span>
                    <span className="text-[11px] font-bold text-slate-500">{index + 1}번 냄비</span>
                  </div>
                  <div className="truncate text-xs font-bold text-slate-600">{result.reason}</div>
                </div>
                <div className={`shrink-0 text-lg font-black ${good ? 'text-emerald-700' : result.money > 0 ? 'text-amber-700' : 'text-stone-500'}`}>
                  {result.money.toLocaleString()}원
                </div>
              </motion.div>
            )
          })}
        </div>

        {outcome.goalReached !== null && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-base font-black text-amber-800"
          >
            🎉 {outcome.goalReached.toLocaleString()}원 달성! {outcome.goalReached === RAMEN.GOAL_MONEY ? '오늘 장사 목표 성공!' : '가게가 더 커졌어요!'}
          </motion.div>
        )}

        {allZero && (
          <p className="mt-3 text-xs font-bold text-slate-500 break-keep">
            팁: 면·스프를 먼저 넣고 물을 붓고, 「끓는다!」가 뜨면 파·계란을 넣고 바로 쟁반에!
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-violet-600 py-4 text-lg font-black text-white shadow-lg transition-transform hover:bg-violet-500 active:scale-95"
        >
          다음 문제 →
        </button>
      </motion.div>
    </motion.div>
  )
}
