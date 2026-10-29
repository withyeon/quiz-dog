'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { VISIBLE_GAME_MODES, type GameModeId } from '@/lib/game/modes'
import { gameModesData } from '@/components/landing/gameModesData'
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
  const [hoveredMode, setHoveredMode] = useState<GameModeId | null>(null)
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6 lg:gap-3 xl:gap-4">
        {modes.map((mode) => {
          const isSelected = selectedMode === mode.id
          const isHovered = hoveredMode === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode.id)}
              // 터치는 누르면 바로 고르기라 영상은 마우스로 올렸을 때만 튼다
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHoveredMode(mode.id) }}
              onPointerLeave={() => setHoveredMode((current) => (current === mode.id ? null : current))}
              className={`relative flex flex-col items-center overflow-hidden rounded-xl border-2 p-3 text-center transition-all xl:p-4 ${
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
                  className="h-24 w-24 max-w-full object-contain sm:h-28 sm:w-28 xl:h-32 xl:w-32"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center text-5xl sm:h-28 sm:w-28 xl:h-32 xl:w-32">{mode.emoji}</div>
              )}
              {/* 그림이 작아지면 그림 안의 제목이 안 읽히므로 이름을 따로 적는다 */}
              <span
                className="mt-2 w-full text-xs font-bold leading-snug text-gray-900 sm:text-sm"
                style={{ fontFamily: mode.fontFamily ?? "'DNFBitBitv2', sans-serif" }}
              >
                {mode.label}
              </span>
              {/* 추천 학년 · 개인전/협동전 — 카드가 좁아 조작 난도까지 넣으면 두 줄이 넘친다 */}
              <span className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-500 xl:text-xs">
                {getGameModeGuide(mode.id).grades} · {getGameModeGuide(mode.id).play}
              </span>
              <HoverPreview modeId={mode.id} label={mode.label} active={isHovered} />
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

const PREVIEWS = new Map(gameModesData.map((game) => [game.modeId, game]))

/**
 * 마우스를 올리면 카드 전체를 덮고 플레이 영상을 튼다 (랜딩 게임 카드와 같은 영상).
 * 영상은 첫 프레임이 나온 뒤에 드러내서 검은 화면이 번쩍이지 않게 한다. 영상이 없으면 플레이 화면 캡처를 보여 준다.
 */
function HoverPreview({ modeId, label, active }: { modeId: GameModeId; label: string; active: boolean }) {
  const preview = PREVIEWS.get(modeId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      void video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
      setPlaying(false)
    }
  }, [active])

  if (!preview?.previewVideo && !preview?.previewImage) return null
  const visible = active && (playing || !preview.previewVideo)

  return (
    <span
      className="pointer-events-none absolute inset-0 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      {preview.previewVideo ? (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          onPlaying={() => setPlaying(true)}
          className="absolute inset-0 h-full w-full object-cover"
        >
          {preview.previewVideo.webm && <source src={preview.previewVideo.webm} type="video/webm" />}
          <source src={preview.previewVideo.mp4} type="video/mp4" />
        </video>
      ) : (
        <Image src={preview.previewImage!} alt="" fill sizes="(max-width: 1024px) 33vw, 17vw" className="object-cover" />
      )}
      {/* 영상 위에서도 무슨 게임인지 읽히게 아래에 이름만 다시 얹는다 */}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-2 pb-2 pt-6 text-xs font-bold text-white sm:text-sm">
        {label}
      </span>
    </span>
  )
}
