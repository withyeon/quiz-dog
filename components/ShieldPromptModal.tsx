'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'

interface ShieldPromptModalProps {
  /** 상황 설명 (예: "홍길동님이 마법사 효과를 사용했습니다.") */
  message: string
  /** 자동으로 '사용 안 함' 처리되는 시각 (epoch ms) */
  expiresAt: number
  onAnswer: (useShield: boolean) => void
}

/**
 * 방어권 사용 여부를 묻는 게임 내 모달.
 * 네이티브 confirm()은 JS 스레드를 막아 타이머·realtime 수신이 멈추므로 사용하지 않는다.
 * 제한 시간이 지나면 자동으로 '사용 안 함'으로 처리된다(상대는 6초까지만 대기).
 */
export default function ShieldPromptModal({ message, expiresAt, onAnswer }: ShieldPromptModalProps) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, expiresAt - Date.now()))

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, expiresAt - Date.now()))
    tick()
    const timer = window.setInterval(tick, 100)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  const totalMs = 5000
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs))
  const seconds = Math.ceil(remainingMs / 1000)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-sm rounded-3xl border-4 border-sky-300 bg-white p-6 text-center shadow-2xl"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sky-100">
          <ShieldCheck className="h-9 w-9 text-sky-600" />
        </div>
        <h2 className="mb-2 text-xl font-black text-slate-900">방어권을 사용할까요?</h2>
        <p className="mb-4 text-sm font-bold leading-snug text-slate-600">{message}</p>

        {/* 남은 시간 게이지 */}
        <div className="mb-4">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
            <motion.div
              className="h-full rounded-full bg-sky-500"
              animate={{ width: `${ratio * 100}%` }}
              transition={{ ease: 'linear', duration: 0.1 }}
            />
          </div>
          <p className="mt-1.5 text-xs font-black text-slate-500">
            {seconds}초 뒤 자동으로 넘어가요
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAnswer(false)}
            className="flex-1 rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-700 transition hover:bg-slate-50 active:scale-95"
          >
            그냥 맞기
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            autoFocus
            className="flex-1 rounded-2xl bg-sky-500 px-4 py-3 text-base font-black text-white shadow-lg shadow-sky-200 transition hover:bg-sky-600 active:scale-95"
          >
            🛡️ 방어권 쓰기
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
