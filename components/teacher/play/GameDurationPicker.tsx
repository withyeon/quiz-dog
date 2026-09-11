'use client'

import { Clock } from 'lucide-react'

const PRESET_MINUTES = [3, 5, 7, 10]
const MIN_MINUTES = 1
const MAX_MINUTES = 120

/** 게임 제한 시간 선택 (프리셋 + 직접 입력) */
export default function GameDurationPicker({
  minutes,
  onChange,
}: {
  minutes: number
  onChange: (minutes: number) => void
}) {
  const isCustom = !PRESET_MINUTES.includes(minutes)

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <label className="mb-2 flex items-center gap-2 text-lg font-bold text-amber-800">
        <Clock className="h-5 w-5" /> 게임 시간
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {PRESET_MINUTES.map((preset) => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`rounded-lg border-2 px-4 py-2 font-bold transition-all ${
              minutes === preset
                ? 'border-amber-500 bg-amber-200 text-amber-900'
                : 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
            }`}
          >
            {preset}분
          </button>
        ))}
        <label
          className={`flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 font-bold transition-all ${
            isCustom ? 'border-amber-500 bg-amber-200 text-amber-900' : 'border-amber-200 bg-white text-amber-800'
          }`}
        >
          <span className="text-sm">직접 입력</span>
          <input
            type="number"
            min={MIN_MINUTES}
            max={MAX_MINUTES}
            value={minutes}
            onChange={(event) => {
              const next = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.floor(Number(event.target.value) || 0)))
              onChange(next)
            }}
            className="w-14 rounded-md border-2 border-amber-200 bg-white px-2 py-1 text-center text-amber-900 focus:border-amber-400 focus:outline-none"
          />
          <span className="text-sm">분</span>
        </label>
      </div>
    </div>
  )
}
