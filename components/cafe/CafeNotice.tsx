'use client'

import { motion, AnimatePresence } from 'framer-motion'

type Notice = { id: number; text: string; tone: 'good' | 'bad' }

/**
 * 아이템 결과 안내 (카피캣으로 무엇을 가져왔는지 등).
 * 가운데 정렬은 바깥 div 가 맡는다. motion 의 y 애니메이션이 -translate-x-1/2 를 덮어써서 오른쪽으로 밀렸다.
 */
export default function CafeNotice({ notice }: { notice: Notice | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <div className={`rounded-xl border-4 px-5 py-2 text-center text-base font-black shadow-xl sm:text-lg ${
              notice.tone === 'good' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
            }`}>
              {notice.text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
