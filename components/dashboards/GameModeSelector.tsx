'use client'

import Image from 'next/image'
import { VISIBLE_GAME_MODES, type GameModeId } from '@/lib/game/modes'

interface GameModeSelectorProps {
  selectedMode: GameModeId
  onSelectMode: (mode: GameModeId) => void
}

export default function GameModeSelector({ selectedMode, onSelectMode }: GameModeSelectorProps) {
  // 공부 모드는 게임이 아니라 문제만 차근차근 푸는 화면이다. 게임 카드와 섞이지 않게 따로 둔다.
  const studyMode = VISIBLE_GAME_MODES.find((mode) => mode.id === 'study')
  const gameModes = VISIBLE_GAME_MODES.filter((mode) => mode.id !== 'study')
  const selectedDescription = selectedMode === 'study'
    ? undefined
    : gameModes.find((mode) => mode.id === selectedMode)?.description

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-900 mb-4">게임 모드 선택</label>
      {studyMode && (
        <button
          type="button"
          onClick={() => onSelectMode('study')}
          aria-pressed={selectedMode === 'study'}
          className={`mb-3 flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
            selectedMode === 'study'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-3xl">{studyMode.emoji}</span>
          <span className="min-w-0">
            <span
              className="block text-base font-bold text-gray-900"
              style={{ fontFamily: studyMode.fontFamily ?? "'DNFBitBitv2', sans-serif" }}
            >
              {studyMode.label}
            </span>
            <span className="block text-sm font-medium text-slate-500">{studyMode.description}</span>
          </span>
        </button>
      )}
      {/* 게임 수(6개)가 딱 나뉘는 열 수만 쓴다 — auto-fill 로 두면 5+1 처럼 어정쩡하게 끊긴다 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {gameModes.map((mode) => {
          const isSelected = selectedMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              className={`flex flex-col items-center rounded-xl border-2 p-3 text-center transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              {mode.image ? (
                <Image
                  src={mode.image}
                  alt={mode.label}
                  width={256}
                  height={256}
                  className="h-24 w-24 max-w-full object-contain"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center text-5xl">{mode.emoji}</div>
              )}
              {/* 그림이 작아지면 그림 안의 제목이 안 읽히므로 이름을 따로 적는다 */}
              <span
                className="mt-2 w-full text-xs font-bold leading-snug text-gray-900 sm:text-sm"
                style={{ fontFamily: mode.fontFamily ?? "'DNFBitBitv2', sans-serif" }}
              >
                {mode.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* 카드마다 넣던 설명은 고른 게임 것만 아래에 보여준다 */}
      {selectedDescription && (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
          {selectedDescription}
        </p>
      )}
    </div>
  )
}
