'use client'

import { useState } from 'react'
import Image from 'next/image'
import { VISIBLE_GAME_MODES, type GameModeId } from '@/lib/game/modes'
import GameRecommendationPicker from '@/components/landing/GameRecommendationPicker'
import GameGuideChips from '@/components/landing/GameGuideChips'
import { getGameModeGuide, matchesRecommendation, type RecommendationTag } from '@/lib/game/modeGuide'

interface GameModeSelectorProps {
  selectedMode: GameModeId
  onSelectMode: (mode: GameModeId) => void
  /** 보여줄 모드만 추린다 (과제로 내기는 혼자 할 수 있는 모드만). 순서는 VISIBLE_GAME_MODES 를 따른다. */
  allowedModes?: readonly GameModeId[]
  /** 카드 아래 안내 문구 */
  footnote?: string
}

export default function GameModeSelector({ selectedMode, onSelectMode, allowedModes, footnote }: GameModeSelectorProps) {
  // 상황(처음 쓰는 반·저학년·마무리·협동)으로 추려 보기. 고른 게임은 추림에서 빠져도 그대로 유지된다.
  const [pick, setPick] = useState<RecommendationTag | null>(null)
  const allModes = allowedModes
    ? VISIBLE_GAME_MODES.filter((mode) => allowedModes.includes(mode.id))
    : VISIBLE_GAME_MODES
  const modes = allModes.filter((mode) => mode.id === selectedMode || matchesRecommendation(mode.id, pick))
  const selectedDescription = allModes.find((mode) => mode.id === selectedMode)?.description

  return (
    <div className="mb-6">
      <label className="block text-sm font-semibold text-gray-900 mb-3">게임 모드 선택</label>
      <GameRecommendationPicker value={pick} onChange={setPick} compact />
      {/* 실시간(12개)이 딱 나뉘는 열 수 — auto-fill 로 두면 5+1 처럼 어정쩡하게 끊긴다. 과제(9개)는 6+3 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {modes.map((mode) => {
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
              {/* 추천 학년 · 시간 · 개인전/협동전 — 카드가 좁아 조작 난도까지 넣으면 두 줄이 넘쳐 세 가지만 */}
              <span className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-500">
                {getGameModeGuide(mode.id).grades} · {getGameModeGuide(mode.id).minutes} · {getGameModeGuide(mode.id).play}
              </span>
            </button>
          )
        })}
      </div>

      {/* 카드마다 넣던 설명은 고른 게임 것만 아래에 보여준다 */}
      {selectedDescription && (
        <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-600">{selectedDescription}</p>
          <div className="mt-2"><GameGuideChips modeId={selectedMode} /></div>
        </div>
      )}
      {footnote && <p className="mt-2 text-xs font-semibold text-slate-400">{footnote}</p>}
    </div>
  )
}
