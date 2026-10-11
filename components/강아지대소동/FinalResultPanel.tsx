'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { PUPPY_ICON } from '@/components/강아지대소동/puppyIcons'

/** 게임이 끝났을 때(또는 내보내졌을 때) 최종 점수. */
export default function FinalResultPanel({ score, isKicked }: { score: number; isKicked: boolean }) {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
      <div>
        <Image
          src={isKicked ? PUPPY_ICON.exit : PUPPY_ICON.trophy}
          alt={isKicked ? '나감' : '우승'}
          width={96}
          height={96}
          className="mx-auto mb-4 h-24 w-24 object-contain"
          unoptimized
        />
        <h1 className="text-4xl font-black">{isKicked ? '게임에서 나갔어요' : '게임 종료!'}</h1>
        <div className="mt-6 rounded-[24px] bg-amber-100 px-8 py-5 text-5xl font-black text-amber-700">
          {score.toLocaleString()}
        </div>
        <p className="mt-3 text-lg font-bold text-slate-500">최종 점수</p>
      </div>
    </motion.section>
  )
}
