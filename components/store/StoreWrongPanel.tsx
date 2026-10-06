'use client'

import { motion } from 'framer-motion'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import { formatMoney } from '@/lib/game/convenienceStore'

type Props = {
  revealedAnswer: string | null
  wrongPenalty: number | null
}

/** 오답 화면: 정답 공개와 매출 패널티 안내. 3초 뒤 훅이 다음 문제로 넘긴다. */
export default function StoreWrongPanel({ revealedAnswer, wrongPenalty }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center"
    >
      <div className="mx-auto mb-4 flex justify-center">
        <PixelIcon name="wrong" size={96} />
      </div>
      <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다!</h2>
      <AnswerReveal answer={revealedAnswer} />
      {wrongPenalty ? (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-700 font-bold text-lg"
        >
          매출 정산 실수! {formatMoney(wrongPenalty)}을 잃었습니다.
        </motion.p>
      ) : (
        <p className="text-gray-700">다음 문제로 넘어갑니다</p>
      )}
    </motion.div>
  )
}
