'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'

interface GenerationProgressProps {
  title: string
  stages: string[]
  /** 지금 진행 중인 단계. stages.length 이상이면 모두 끝난 것 */
  activeIndex: number
  elapsedSec: number
  onCancel?: () => void
}

/**
 * 문제를 만드는 동안 보여 주는 화면. 요청 한 번으로 끝나서 진짜 진행률은 없지만,
 * 단계와 지난 시간을 보여 주면 "멈춘 건가?" 하고 새로고침하는 일이 줄어든다.
 */
export default function GenerationProgress({ title, stages, activeIndex, elapsedSec, onCancel }: GenerationProgressProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm rounded-3xl border border-white/60 bg-white p-6 text-center shadow-2xl"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto h-24 w-24"
        >
          <Image
            src="/assets/icons/mascot-pome-256.webp"
            alt=""
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 object-contain"
            priority
          />
        </motion.div>
        <h2 className="mt-3 text-xl font-black tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {elapsedSec}초 지남 · 보통 10~30초 걸려요
        </p>

        <ol className="mt-5 space-y-2 text-left">
          {stages.map((stage, index) => {
            const done = index < activeIndex
            const active = index === activeIndex
            return (
              <li
                key={stage}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                  active ? 'bg-sky-50 text-sky-800' : done ? 'text-slate-500' : 'text-slate-300'
                }`}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                    done ? 'bg-emerald-500 text-white' : active ? 'bg-sky-500 text-white' : 'border-2 border-slate-200'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                </span>
                {stage}
              </li>
            )
          })}
        </ol>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 text-sm font-bold text-slate-400 underline-offset-4 transition hover:text-slate-700 hover:underline"
          >
            그만두기
          </button>
        )}
      </motion.div>
    </div>
  )
}
