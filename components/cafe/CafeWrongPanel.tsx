'use client'

import { motion } from 'framer-motion'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'

/** 오답 화면: 정답 공개 뒤 3초 후 훅이 다음 문제로 넘긴다. */
export default function CafeWrongPanel({ revealedAnswer }: { revealedAnswer: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute top-24 left-0 right-0 bottom-0 z-30 flex items-center justify-center p-4"
    >
      <div className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center max-w-md">
        <div className="mb-4 flex justify-center">
          <PixelIcon name="wrong" size={96} />
        </div>
        <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다.</h2>
        <AnswerReveal answer={revealedAnswer} />
        <p className="text-gray-700">다른 문제로 넘어갑니다.</p>
      </div>
    </motion.div>
  )
}
