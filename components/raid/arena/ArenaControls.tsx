'use client'

import { Droplets } from 'lucide-react'
import type { ArenaKey } from '@/components/raid/arena/useArenaInput'

type HoldButtonProps = {
  gameKey: ArenaKey
  label: string
  ariaLabel: string
  className: string
  onPress: (key: ArenaKey) => void
  onRelease: (key: ArenaKey) => void
}

function HoldButton({ gameKey, label, ariaLabel, className, onPress, onRelease }: HoldButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        onPress(gameKey)
      }}
      onPointerUp={() => onRelease(gameKey)}
      onPointerLeave={() => onRelease(gameKey)}
      onPointerCancel={() => onRelease(gameKey)}
      className={className}
    >
      {label}
    </button>
  )
}

const DPAD = 'flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl bg-white/90 text-2xl font-black text-slate-700 shadow-md active:bg-sky-100 sm:h-14 sm:w-14'

type ArenaControlsProps = {
  onPress: (key: ArenaKey) => void
  onRelease: (key: ArenaKey) => void
  onOpenQuiz: () => void
  balloons: number
  isTouch: boolean
}

/**
 * 아레나 조작부. 터치 기기엔 십자 방향키 + 물풍선 버튼, 키보드 기기엔 조작법 안내.
 * 퀴즈 버튼은 둘 다 있다 (폰에선 물풍선이 떨어졌을 때 가장 눈에 띄어야 한다).
 */
export default function ArenaControls({ onPress, onRelease, onOpenQuiz, balloons, isTouch }: ArenaControlsProps) {
  const quizButton = (
    <button
      type="button"
      onClick={onOpenQuiz}
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-black text-white shadow-lg transition sm:text-base ${
        balloons <= 0 ? 'animate-pulse bg-rose-500 active:bg-rose-600' : 'bg-sky-500 active:bg-sky-600'
      }`}
    >
      <Droplets className="h-4 w-4" />
      {balloons <= 0 ? '퀴즈 풀어 물풍선 채우기' : '퀴즈 풀기 (Q)'}
    </button>
  )

  if (!isTouch) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
        {quizButton}
        <div className="rounded-xl bg-slate-900/75 px-3 py-2 text-xs font-bold text-white sm:text-sm">
          방향키·WASD 이동 · 스페이스 물풍선 · Q 퀴즈
        </div>
      </div>
    )
  }

  return (
    <div className="flex select-none items-end justify-between gap-2 px-1 pt-2">
      <div className="grid grid-cols-3 gap-1" aria-label="이동">
        <span />
        <HoldButton gameKey="up" label="▲" ariaLabel="위로" className={DPAD} onPress={onPress} onRelease={onRelease} />
        <span />
        <HoldButton gameKey="left" label="◀" ariaLabel="왼쪽" className={DPAD} onPress={onPress} onRelease={onRelease} />
        <HoldButton gameKey="down" label="▼" ariaLabel="아래로" className={DPAD} onPress={onPress} onRelease={onRelease} />
        <HoldButton gameKey="right" label="▶" ariaLabel="오른쪽" className={DPAD} onPress={onPress} onRelease={onRelease} />
      </div>
      <div className="flex flex-col items-end gap-2">
        {quizButton}
        <HoldButton
          gameKey="balloon"
          label={`물풍선 ${balloons}`}
          ariaLabel="물풍선 놓기"
          className="flex h-16 w-24 touch-none items-center justify-center rounded-full bg-gradient-to-b from-sky-300 to-blue-500 text-base font-black text-white shadow-xl ring-2 ring-white/70 active:from-sky-400 active:to-blue-600 sm:h-20 sm:w-28"
          onPress={onPress}
          onRelease={onRelease}
        />
      </div>
    </div>
  )
}
