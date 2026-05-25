'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import type { BoxEvent } from '@/lib/game/goldQuest'
import { BOX_EVENT_IMAGE } from '@/lib/game/goldQuest'

interface ChestViewProps {
  onChestSelect: (chestIndex: number) => void
  selectedChest: number | null 
  reward: BoxEvent | null
  isProcessing: boolean
}

export default function ChestView({
  onChestSelect,
  selectedChest,
  reward,
  isProcessing,
}: ChestViewProps) {
  const [revealedChests, setRevealedChests] = useState<boolean[]>([false, false, false])

  // 컴포넌트가 마운트되거나 selectedChest가 null이 되면 초기화
  useEffect(() => {
    if (selectedChest === null) {
      setRevealedChests([false, false, false])
    }
  }, [selectedChest])

  // reward가 null이 되면 상태 초기화 (새로운 문제로 이동시)
  useEffect(() => {
    if (reward === null) {
      setRevealedChests([false, false, false])
    }
  }, [reward])

  useEffect(() => {
    if (selectedChest !== null && reward) {
      setRevealedChests((prev) => {
        const newRevealed = [...prev]
        newRevealed[selectedChest] = true
        return newRevealed
      })
    }
  }, [selectedChest, reward])

  const getRewardImage = (event: BoxEvent) => {
    if (event.image) return event.image
    if (event.itemName === '방어권') return '/gold-quest/shield.svg'
    return BOX_EVENT_IMAGE[event.type]
  }

  const getRewardTone = (event: BoxEvent | null) => {
    if (!event) return 'border-amber-300/70 bg-white/80 text-[#20333a]'
    if (event.type === 'GOLD_STACK' || event.type === 'JESTER' || event.type === 'UNICORN') {
      return 'border-emerald-300/70 bg-emerald-50 text-emerald-950'
    }
    if (event.type === 'SLIME_MONSTER' || event.type === 'DRAGON') {
      return 'border-red-300/70 bg-red-50 text-red-950'
    }
    if (event.type === 'KING' || event.type === 'ELF' || event.type === 'WIZARD') {
      return 'border-amber-300/80 bg-amber-50 text-amber-950'
    }
    return 'border-teal-300/70 bg-teal-50 text-teal-950'
  }

  const getChestIconSrc = (index: number) => {
    if (!revealedChests[index]) return null
    if (selectedChest !== index) return null
    if (!reward) return null
    return getRewardImage(reward)
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="gold-quest-panel p-5 sm:p-7 max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h2 className="gold-quest-title flex items-center gap-3 text-3xl sm:text-4xl font-black text-[#17262a]">
          <Image src="/gold-quest/gold-stack.svg" alt="" width={36} height={36} className="h-9 w-9 flex-shrink-0 object-contain" />
          보물 상자 선택
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
        {[0, 1, 2].map((index) => (
          <motion.button
            key={index}
            type="button"
            whileHover={!isProcessing && !revealedChests[index] ? { y: -6 } : {}}
            whileTap={!isProcessing && !revealedChests[index] ? { scale: 0.98 } : {}}
            onClick={() => {
              if (!isProcessing && !revealedChests[index]) {
                onChestSelect(index)
              }
            }}
            disabled={isProcessing || revealedChests[index]}
            className={`group relative min-h-[220px] overflow-hidden rounded-lg border p-5 text-left transition-all ${
              getRewardTone(revealedChests[index] && selectedChest === index ? reward : null)
            } ${isProcessing || revealedChests[index]
              ? 'cursor-not-allowed'
              : 'cursor-pointer shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:shadow-slate-900/[0.18]'
            }`}
            aria-label={`${index + 1}번 보물상자 선택`}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-2xl sm:text-3xl font-black tracking-normal text-slate-600">
                {index + 1}
              </span>
            </div>

            <div className="mb-5 flex h-[168px] items-center justify-center">
              {getChestIconSrc(index) ? (
                <Image
                  src={getChestIconSrc(index)!}
                  alt={reward?.itemName ?? '아이템'}
                  width={180}
                  height={180}
                  className="h-[168px] w-[168px] drop-shadow-xl"
                />
              ) : (
                <Image
                  src="/gold-quest/quest.svg"
                  alt="보물상자"
                  width={120}
                  height={120}
                  className="h-28 w-28 drop-shadow-xl transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>
            {(revealedChests[index] && selectedChest === index && reward) || (isProcessing && selectedChest === index) ? (
              <div className="min-h-[44px] text-base font-black leading-snug text-[#17262a]">
                {revealedChests[index] && selectedChest === index && reward
                  ? reward.itemName || reward.message
                  : '개봉 중'}
              </div>
            ) : null}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {reward && selectedChest !== null && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className={`w-full max-w-md rounded-lg border p-6 text-center shadow-2xl ${getRewardTone(reward)}`}
            >
              <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-lg border border-white/70 bg-white/72 shadow-lg">
                <Image
                  src={getRewardImage(reward)}
                  alt={reward.itemName}
                  width={132}
                  height={132}
                  className="h-[120px] w-[120px] drop-shadow-xl"
                />
              </div>
              <h3 className="gold-quest-title text-2xl font-black text-[#17262a]">
                {reward.itemName}
              </h3>
              <p className="mt-3 text-lg font-black leading-snug">
                {reward.message}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}
