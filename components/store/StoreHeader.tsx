'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import QuizSetName from '@/components/game/QuizSetName'
import { QUIZZES_PER_PRODUCT, formatMoney } from '@/lib/game/convenienceStore'
import { STORE_BRAND_ICON } from '@/lib/game/storeAssets'
import type { StorePlayer } from '@/hooks/useConvenienceStoreGame'

type Props = {
  roomCode: string
  questionSetTitle: string | null
  remainingSeconds: number | null
  correctAnswersCount: number
  currentPlayer: StorePlayer | undefined
  money: number
}

/** 제목·방 코드·문제집 이름과 남은 시간/다음 상품까지/내 돈 칩. 폰에서는 칩 3개를 한 줄로 둔다. */
export default function StoreHeader({
  roomCode,
  questionSetTitle,
  remainingSeconds,
  correctAnswersCount,
  currentPlayer,
  money,
}: Props) {
  return (
    <div className="max-w-6xl mx-auto mb-4">
      <div className="rounded-xl border-2 border-emerald-200/90 bg-white/92 p-4 shadow-xl shadow-emerald-900/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-12 flex-shrink-0 sm:h-16 sm:w-16">
              <Image src={STORE_BRAND_ICON} alt="편의점" fill className="object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-emerald-950 sm:text-2xl">전설의 편의점</h1>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-xs font-bold text-emerald-700">방 코드: {roomCode}</p>
                <QuizSetName title={questionSetTitle} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            {/* 남은 시간 (선생님이 설정한 제한 시간) */}
            {remainingSeconds != null && (
              <div className="min-w-0 rounded-lg border-2 border-amber-300 bg-amber-50 px-2 py-1.5 sm:px-4 sm:py-2">
                <div className="mb-0.5 whitespace-nowrap text-xs font-semibold text-amber-800 sm:mb-1">남은 시간</div>
                <div className="text-center text-lg font-bold tabular-nums text-amber-950 sm:text-2xl">
                  {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                </div>
              </div>
            )}
            {/* 정답 카운터 */}
            <div className="min-w-0 rounded-lg border-2 border-sky-300 bg-sky-50 px-2 py-1.5 sm:px-4 sm:py-2">
              <div className="mb-0.5 truncate text-xs font-semibold text-sky-800 sm:mb-1">
                다음 상품까지
              </div>
              <motion.div
                key={correctAnswersCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="whitespace-nowrap text-center text-lg font-bold text-sky-950 sm:text-2xl"
              >
                {QUIZZES_PER_PRODUCT - (correctAnswersCount % QUIZZES_PER_PRODUCT)} 문제
              </motion.div>
            </div>

            {currentPlayer && (
              <div className="min-w-0 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-2 py-1.5 sm:px-4 sm:py-2">
                <div className="mb-0.5 truncate text-xs font-semibold text-emerald-800 sm:mb-1 sm:max-w-[120px] sm:text-sm">
                  {currentPlayer.nickname}
                </div>
                <motion.div
                  key={money}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="truncate text-lg font-bold text-emerald-950 sm:text-2xl"
                >
                  {formatMoney(money)}
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
