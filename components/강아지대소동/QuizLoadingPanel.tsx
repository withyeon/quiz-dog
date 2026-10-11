'use client'

import { motion } from 'framer-motion'
import PomeMascot from '@/components/PomeMascot'

/** 퀴즈 단계인데 보여줄 문제가 아직 없을 때: 불러오는 중이거나 불러오기 실패. */
export default function QuizLoadingPanel({ questionsError }: { questionsError: string | null }) {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
      <div>
        <PomeMascot className="mx-auto mb-4 h-20 w-20" />
        <h2 className="text-3xl font-black">
        {questionsError ? '문제를 불러오지 못했어요' : '문제를 불러오는 중'}
      </h2>
        {questionsError && <p className="mt-3 text-sm font-bold text-rose-600">{questionsError}</p>}
      </div>
    </motion.section>
  )
}
