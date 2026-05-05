'use client'

import Image from 'next/image'
import { GAME_MODES, type GameModeId } from '@/lib/game/modes'

interface GameModeSelectorProps {
  selectedMode: GameModeId
  onSelectMode: (mode: GameModeId) => void
}

export default function GameModeSelector({ selectedMode, onSelectMode }: GameModeSelectorProps) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-900 mb-4">게임 모드 선택</label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GAME_MODES.map((mode) => {
          const isSelected = selectedMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              className={`p-6 rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[360px] ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {mode.image ? (
                <Image
                  src={mode.image}
                  alt={mode.label}
                  width={500}
                  height={500}
                  className="w-64 h-64 object-contain mb-4"
                />
              ) : (
                <div className="text-8xl mb-4">{mode.emoji}</div>
              )}
              <div
                className="font-bold text-xl text-gray-900 mb-2"
                style={{ fontFamily: mode.fontFamily ?? 'DNFBitBitv2, sans-serif' }}
              >
                {mode.emoji} {mode.label}
              </div>
              <div
                className="text-base text-gray-600 text-center px-2"
                style={{ fontFamily: mode.fontFamily ?? 'DNFBitBitv2, sans-serif' }}
              >
                {mode.description}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
