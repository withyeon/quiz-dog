'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import PomeMascot from '@/components/PomeMascot'
import { PUPPY_ICON } from '@/components/강아지대소동/puppyIcons'
import type { RoundSummary } from '@/hooks/usePuppyChaosGame'

/** 한 라운드 결과: 제목, 얻은 점수, 미니게임 보상·뼈다귀. 한 번도 안 맞았으면 트로피가 뜬다. */
export default function RoundResultPanel({ summary }: { summary: RoundSummary }) {
  return (
    <motion.section initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      className="flex flex-1 items-center justify-center rounded-[28px] border-4 border-slate-900 bg-white p-8 text-center shadow-[5px_5px_0_#0f172a]">
      <div>
        <div className="mb-3 flex justify-center">
          {summary.hits === 0 ? (
            <div className="relative">
              <Image
                src={PUPPY_ICON.trophy}
                alt="성공"
                width={48}
                height={48}
                className="absolute -top-7 left-1/2 h-12 w-12 -translate-x-1/2 object-contain"
                unoptimized
              />
              <PomeMascot className="h-24 w-24" />
            </div>
          ) : (
            <PomeMascot className="h-24 w-24" />
          )}
        </div>
        <h2 className="text-4xl font-black">{summary.title}</h2>
        <div className="mt-5 rounded-[24px] bg-amber-100 px-6 py-4 text-4xl font-black text-amber-700">
          +{summary.scoreDelta}
        </div>
        <p className="mt-3 text-lg font-bold text-slate-500">
          미니게임 보상 +{summary.dodgeReward}
          {summary.bones > 0 ? ` · 뼈다귀 ${summary.bones}개` : ''}
        </p>
      </div>
    </motion.section>
  )
}
