'use client'

import { motion } from 'framer-motion'
import PomeMascot from '@/components/PomeMascot'

/** 선생님이 시작하기 전 대기 패널. AnimatePresence 아래에 key 를 주고 둔다. */
export default function WaitingPanel() {
  return (
    <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
      <div>
        <div className="mb-4 flex justify-center">
          <PomeMascot className="h-24 w-24" />
        </div>
        <h1 className="text-4xl font-black">선생님이 시작하면 출발!</h1>
        <p className="mt-3 text-lg font-bold text-slate-500">TV 화면을 보고 잠깐만 기다려요.</p>
      </div>
    </motion.section>
  )
}
