'use client'

import { motion } from 'framer-motion'
import type { BungeoNotice } from '@/lib/game/bungeoppang'

const TONE_CLASS: Record<BungeoNotice['tone'], { ring: string; badge: string; button: string }> = {
  cold: { ring: 'border-sky-200', badge: 'bg-sky-100 text-sky-800', button: 'bg-sky-500 hover:bg-sky-400' },
  fire: { ring: 'border-red-200', badge: 'bg-red-100 text-red-800', button: 'bg-red-500 hover:bg-red-400' },
  butter: { ring: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', button: 'bg-yellow-500 hover:bg-yellow-400' },
  gold: { ring: 'border-amber-300', badge: 'bg-amber-200 text-amber-900', button: 'bg-amber-500 hover:bg-amber-400' },
  dog: { ring: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', button: 'bg-orange-500 hover:bg-orange-400' },
  item: { ring: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800', button: 'bg-emerald-500 hover:bg-emerald-400' },
}

type NoticeModalProps = {
  notice: BungeoNotice
  onClose: () => void
}

/** 랜덤 이벤트·아이템 알림. 둘 다 같은 모양이라 어느 쪽이 "도움"인지 겉으로 드러나지 않는다 */
export default function NoticeModal({ notice, onClose }: NoticeModalProps) {
  const tone = TONE_CLASS[notice.tone]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.5, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className={`w-full max-w-sm rounded-2xl border-4 ${tone.ring} bg-white p-7 text-center shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`mb-3 inline-block rounded-full px-3 py-1 text-sm font-black ${tone.badge}`}>
          {notice.kind === 'event' ? '랜덤 이벤트' : '아이템 획득'}
        </div>
        <motion.div
          animate={{ y: [0, -8, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="mb-3 text-7xl leading-none"
        >
          {notice.emoji}
        </motion.div>
        <h2 className="mb-2 text-3xl font-black text-slate-900 break-keep">{notice.title}</h2>
        <p className="mb-6 text-base font-bold text-slate-600 break-keep">{notice.description}</p>
        <button
          type="button"
          onClick={onClose}
          className={`w-full rounded-xl py-4 text-lg font-black text-white shadow-lg transition-transform active:scale-95 ${tone.button}`}
        >
          확인!
        </button>
      </motion.div>
    </motion.div>
  )
}
