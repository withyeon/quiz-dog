'use client'

import { motion } from 'framer-motion'
import AnswerReveal from '@/components/AnswerReveal'
import PixelIcon from '@/components/ui/PixelIcon'
import { useCurrentQuestionSetTitle } from '@/hooks/useQuestionSetTitle'
import { getWrongScreenMs } from '@/lib/quiz/multiSelect'

/** 오답 화면: 정답 공개 후 3초(구성치기 문제집은 5초) 뒤 다음 문제로 넘어간다(useGameBase). */
export default function WrongAnswerPanel({
  revealedAnswer,
  revealedExplanation = null,
}: {
  revealedAnswer: string | null
  /** 구성치기 문제집이면 정답 아래에 보인다(AnswerReveal) */
  revealedExplanation?: string | null
}) {
  // 넘어가는 시간은 useGameBase 가 같은 규칙(getWrongScreenMs)으로 정한다. 문구도 그 시간에 맞춘다.
  const seconds = getWrongScreenMs(useCurrentQuestionSetTitle(), 3000) / 1000
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="gold-quest-panel p-8 sm:p-12 text-center border-red-200"
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 0] }}
        transition={{ duration: 0.5 }}
        className="mx-auto mb-6 flex justify-center"
      >
        <PixelIcon name="wrong" size={112} />
      </motion.div>
      <h2 className="gold-quest-title text-4xl sm:text-5xl font-black text-red-700 mb-4">틀렸습니다</h2>
      <AnswerReveal answer={revealedAnswer} explanation={revealedExplanation} />
      <p className="text-gray-700 text-lg font-semibold">{seconds}초 후 다음 문제로 이동합니다.</p>
      <div className="mt-6 flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-red-500 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}
