'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { PUPPY_ICON } from '@/components/강아지대소동/puppyIcons'

/** 제한 시간이 끝난 뒤 한 번 주어지는 보너스 라운드 안내와 시작 버튼. */
export default function BonusPanel({ onStart }: { onStart: () => void }) {
  return (
    <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex flex-1 items-center justify-center overflow-hidden rounded-[28px] border-4 border-slate-900 bg-sky-50 p-7 text-center shadow-[5px_5px_0_#0f172a]">
      <div className="relative w-full max-w-md">
        <div className="pointer-events-none absolute -left-14 -top-14 h-32 w-32 rounded-full bg-sky-300/35 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 -right-12 h-36 w-36 rounded-full bg-cyan-300/30 blur-2xl" />
        <div className="relative rounded-[26px] border-4 border-slate-900 bg-white/90 px-5 py-7 shadow-[4px_4px_0_#0f172a]">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-[22px] border-4 border-slate-900 bg-sky-100 shadow-[3px_3px_0_#0f172a]">
            <Image
              src={PUPPY_ICON.randomBox}
              alt="보너스"
              width={72}
              height={72}
              className="h-[72px] w-[72px] object-contain"
              unoptimized
            />
          </div>
          <h2 className="text-4xl font-black text-slate-950">보너스 라운드!</h2>
          <p className="mx-auto mt-3 max-w-sm text-base font-bold leading-7 text-slate-500">
            문제는 끝! 마지막 대소동을 버티고 보너스 점수를 받아요.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="group relative mt-6 w-full overflow-hidden rounded-[24px] border-4 border-slate-900 bg-sky-400 px-8 py-5 text-3xl font-black text-slate-950 shadow-[5px_5px_0_#0f172a] transition active:translate-x-1 active:translate-y-1 active:shadow-[2px_2px_0_#0f172a]"
        >
          <span className="absolute inset-x-0 top-0 h-1/2 bg-white/25 transition group-hover:bg-white/35" />
          <span className="relative inline-flex items-center justify-center gap-3">
            보너스 시작
            <Image
              src={PUPPY_ICON.play}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              unoptimized
            />
          </span>
        </button>
      </div>
    </motion.section>
  )
}
