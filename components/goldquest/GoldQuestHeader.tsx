'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import QuizSetName from '@/components/game/QuizSetName'
import type { GoldQuestPlayer } from '@/hooks/useGoldQuestGame'

type Props = {
  questionSetTitle: string | null | undefined
  currentPlayer: GoldQuestPlayer | null
  hasShield: boolean
}

/** 제목·문제집 이름과 참가자/골드/방어권 칩. 폰에서는 칩 3개를 한 줄로 줄인다. */
export default function GoldQuestHeader({ questionSetTitle, currentPlayer, hasShield }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="gold-quest-ink-panel mb-4 p-3 sm:mb-6 sm:p-5 text-[#17262a]"
    >
      {/*
        폰(세로·가로)에서 헤더가 화면의 30~50%를 먹어 문제 선택지가 첫 화면에 안 보이던 문제:
        제목과 정보 칩을 sm(640px)부터 한 줄로 두고, 폰에서는 칩 3개를 한 줄(grid-cols-3)로 줄인다.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/60 bg-white/35 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:h-12 sm:w-12">
            <Image
              src="/title/gold-quest.webp"
              alt=""
              fill
              className="object-contain p-1"
              sizes="48px"
            />
          </div>
          <div>
            <h1 className="gold-quest-title text-xl sm:text-3xl font-black leading-none">
              해적왕의 보물찾기
            </h1>
            <QuizSetName title={questionSetTitle} className="mt-1.5" />
          </div>
        </div>
        {currentPlayer && (
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-stretch">
            <div className="gold-quest-glass-chip min-w-0 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
              <div className="text-xs font-bold text-slate-500">참가자</div>
              <div className="truncate text-base font-black sm:max-w-[180px] sm:text-lg">{currentPlayer.nickname}</div>
            </div>
            <div className="gold-quest-glass-chip min-w-0 rounded-lg px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <Image
                  src="/gold-quest/gold-stack.webp"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                />
                골드
              </div>
              <div className="text-base font-black text-amber-700 tabular-nums sm:text-lg">{currentPlayer.gold}</div>
            </div>
            <div className={`min-w-0 rounded-lg border px-3 py-2 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] sm:px-4 sm:py-3 ${
              hasShield
                ? 'border-emerald-200/70 bg-emerald-100/45 text-emerald-800'
                : 'gold-quest-glass-chip text-slate-500'
            }`}>
              <div className="flex items-center gap-2 text-xs font-bold">
                <Image
                  src="/gold-quest/shield.webp"
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 object-contain"
                />
                방어권
              </div>
              {hasShield && (
                <div className="text-base font-black sm:text-lg">보유</div>
              )}
              {!hasShield && <div className="text-base font-black sm:text-lg">없음</div>}
            </div>
          </div>
        )}
      </div>
    </motion.header>
  )
}
