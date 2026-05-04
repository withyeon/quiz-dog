'use client'

import { useState, useEffect } from 'react'
import { useAudioContext } from '@/components/AudioProvider'

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
  const { playSFX } = useAudioContext()

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

  const getChestIconSrc = (index: number) => {
    if (!revealedChests[index]) return null
    if (selectedChest !== index) return null
    if (!reward) return null
    return BOX_EVENT_IMAGE[reward.type]
  }

  const getChestColor = (index: number) => {
    if (!revealedChests[index]) return 'bg-yellow-100 border-yellow-400'
    if (selectedChest !== index) return 'bg-gray-100 border-gray-300 opacity-50'

    if (!reward) return 'bg-yellow-100 border-yellow-400'

    // Gold Quest 색상
    if (reward.type === 'GOLD_STACK' || reward.type === 'JESTER' || reward.type === 'UNICORN') {
      return reward.type === 'UNICORN'
        ? 'bg-purple-100 border-purple-500'
        : reward.type === 'JESTER'
          ? 'bg-yellow-100 border-yellow-500'
          : 'bg-green-100 border-green-500'
    }

    if (reward.type === 'SLIME_MONSTER' || reward.type === 'DRAGON') {
      return 'bg-red-100 border-red-500'
    }

    if (reward.type === 'ELF' || reward.type === 'WIZARD' || reward.type === 'KING') {
      return 'bg-orange-100 border-orange-500'
    }

    return 'bg-gray-100 border-gray-400'
  }

  return (
    <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 rounded-xl shadow-2xl p-8 max-w-3xl mx-auto border-4 border-yellow-400">
      <h2 className="text-4xl font-bold text-center mb-8 text-yellow-800 flex items-center justify-center gap-3">
        <Image src="/gold-quest/gold-stack.svg" alt="골드" width={40} height={40} className="w-10 h-10" />
        보물상자를 선택하세요!
        <Image src="/gold-quest/gold-stack.svg" alt="골드" width={40} height={40} className="w-10 h-10" />
      </h2>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              if (!isProcessing && !revealedChests[index]) {
                playSFX('click')
                onChestSelect(index)
              }
            }}
            disabled={isProcessing || revealedChests[index]}
            className={`p-12 rounded-xl border-4 ${isProcessing || revealedChests[index]
              ? 'cursor-not-allowed'
              : 'cursor-pointer shadow-2xl'
              } ${getChestColor(index)}`}
          >
            <div className="text-8xl mb-4 flex items-center justify-center">
              {getChestIconSrc(index) ? (
                <Image
                  src={getChestIconSrc(index)!}
                  alt={reward?.itemName ?? '아이템'}
                  width={96}
                  height={96}
                  className="w-24 h-24"
                />
              ) : (
                <Image
                  src="/gold-quest/quest.svg"
                  alt="보물상자"
                  width={96}
                  height={96}
                  className="w-24 h-24"
                />
              )}
            </div>
            <div className="text-sm font-medium text-gray-700 font-semibold">
              {revealedChests[index] && selectedChest === index && reward
                ? reward.itemName || reward.message
                : '보물상자'}
            </div>
          </button>
        ))}
      </div>

      {reward && selectedChest !== null && (
        <div
          className={`p-6 rounded-xl text-center font-bold text-2xl shadow-2xl border-4 ${reward.type === 'GOLD_STACK' || reward.type === 'JESTER' || reward.type === 'UNICORN'
            ? reward.type === 'UNICORN'
              ? 'bg-purple-600 text-white border-purple-300'
              : reward.type === 'JESTER'
                ? 'bg-yellow-600 text-white border-yellow-300'
                : 'bg-green-600 text-white border-green-300'
            : reward.type === 'SLIME_MONSTER' || reward.type === 'DRAGON'
              ? 'bg-red-600 text-white border-red-300'
              : reward.type === 'ELF' || reward.type === 'WIZARD' || reward.type === 'KING'
                ? 'bg-orange-600 text-white border-orange-300'
                : 'bg-gray-500 text-white border-gray-300'
            }`}
        >
          <div className="flex items-center justify-center gap-3">
            <Image
              src={BOX_EVENT_IMAGE[reward.type]}
              alt={reward.itemName}
              width={48}
              height={48}
              className="w-12 h-12 flex-shrink-0"
            />
            <span>{reward.message}</span>
          </div>
        </div>
      )}
    </div>
  )
}
