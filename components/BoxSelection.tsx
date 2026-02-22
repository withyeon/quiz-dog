'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { BoxEvent } from '@/lib/game/goldQuest'
import { BOX_EVENT_IMAGE } from '@/lib/game/goldQuest'

interface BoxSelectionProps {
  onBoxSelect: (boxIndex: number) => void
  selectedBox: number | null
  boxEvent: BoxEvent | null
  isSelecting: boolean
}

export default function BoxSelection({
  onBoxSelect,
  selectedBox,
  boxEvent,
  isSelecting,
}: BoxSelectionProps) {
  const [revealedBoxes, setRevealedBoxes] = useState<boolean[]>([false, false, false])

  useEffect(() => {
    if (selectedBox !== null && boxEvent) {
      // 선택된 상자만 열기
      setRevealedBoxes((prev) => {
        const newRevealed = [...prev]
        newRevealed[selectedBox] = true
        return newRevealed
      })
    }
  }, [selectedBox, boxEvent])

  const getBoxIconSrc = (index: number) => {
    if (!revealedBoxes[index]) return null
    if (selectedBox !== index) return null
    if (!boxEvent) return null
    return BOX_EVENT_IMAGE[boxEvent.type]
  }

  const getBoxColor = (index: number) => {
    if (!revealedBoxes[index]) return 'bg-yellow-100 border-yellow-300'
    if (selectedBox !== index) return 'bg-gray-100 border-gray-300 opacity-50'

    if (!boxEvent) return 'bg-yellow-100 border-yellow-300'
    switch (boxEvent.type) {
      case 'GOLD_STACK':
      case 'JESTER':
      case 'UNICORN':
      case 'ELF':
      case 'WIZARD':
        return 'bg-green-100 border-green-500' // 골드 획득 이벤트
      case 'SLIME_MONSTER':
      case 'DRAGON':
        return 'bg-red-100 border-red-500' // 골드 손실 이벤트
      case 'KING':
        return 'bg-purple-100 border-purple-500' // 교환 이벤트
      case 'FAIRY':
        return 'bg-gray-100 border-gray-400' // 아무 일도 없음
      default:
        return 'bg-yellow-100 border-yellow-300'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
        상자를 선택하세요!
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((index) => (
          <button
            key={index}
            onClick={() => !isSelecting && onBoxSelect(index)}
            disabled={isSelecting || revealedBoxes[index]}
            className={`p-8 rounded-lg border-4 transition-all transform ${isSelecting || revealedBoxes[index]
              ? 'cursor-not-allowed'
              : 'hover:scale-105 hover:shadow-lg cursor-pointer'
              } ${getBoxColor(index)}`}
          >
            <div className="text-6xl mb-2 flex items-center justify-center">
              {getBoxIconSrc(index) ? (
                <Image
                  src={getBoxIconSrc(index)!}
                  alt={boxEvent?.itemName ?? '아이템'}
                  width={64}
                  height={64}
                  className="w-16 h-16"
                />
              ) : (
                <Image
                  src="/gold-quest/quest.svg"
                  alt="보물상자"
                  width={64}
                  height={64}
                  className="w-16 h-16"
                />
              )}
            </div>
            <div className="text-sm font-medium text-gray-700">
              {revealedBoxes[index] && selectedBox === index && boxEvent
                ? boxEvent.message
                : '상자'}
            </div>
          </button>
        ))}
      </div>

      {boxEvent && selectedBox !== null && (
        <div
          className={`p-4 rounded-lg text-center font-semibold ${boxEvent.type === 'GOLD_STACK' ||
              boxEvent.type === 'JESTER' ||
              boxEvent.type === 'UNICORN' ||
              boxEvent.type === 'ELF' ||
              boxEvent.type === 'WIZARD'
              ? 'bg-green-50 text-green-800'
              : boxEvent.type === 'SLIME_MONSTER' || boxEvent.type === 'DRAGON'
                ? 'bg-red-50 text-red-800'
                : boxEvent.type === 'KING'
                  ? 'bg-purple-50 text-purple-800'
                  : 'bg-gray-50 text-gray-800'
            }`}
        >
          {boxEvent.message}
        </div>
      )}
    </div>
  )
}
