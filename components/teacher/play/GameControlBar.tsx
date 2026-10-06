'use client'

import { Play, Pause, Square, RotateCcw } from 'lucide-react'

type Props = {
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onReset: () => void
}

/** 게임 진행 중 버튼 줄: 일시정지(또는 다시 시작)·게임 종료·초기화. */
export default function GameControlBar({ isPaused, onPause, onResume, onEnd, onReset }: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {isPaused ? (
        <button
          onClick={onResume}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-emerald-600"
        >
          <Play className="h-5 w-5 fill-current" /> 다시 시작
        </button>
      ) : (
        <button
          onClick={onPause}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
        >
          <Pause className="h-5 w-5 fill-current" /> 일시정지
        </button>
      )}
      <button
        onClick={onEnd}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-red-600"
      >
        <Square className="h-5 w-5 fill-current" /> 게임 종료
      </button>
      <button
        onClick={onReset}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-500 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-slate-600"
      >
        <RotateCcw className="h-5 w-5" /> 초기화
      </button>
    </div>
  )
}
