'use client'

import { Snowflake } from 'lucide-react'
import { RAID_BOSS_COUNT_OPTIONS, type RaidSettings } from '@/lib/game/raid'

type RaidOptionsFieldsProps = {
  value: RaidSettings
  onChange: (next: RaidSettings) => void
}

const HINTS: Record<number, string> = {
  2: '짧게 한 판. 3분 정도면 충분해요',
  3: '기본. 5분 수업에 맞춰 두었어요',
  5: '긴 수업용. 8~10분을 잡아 주세요',
}

/**
 * 황제 펭귄을 막아라 방 옵션. 게임 시간 아래, 시작 전에 고른다.
 * 펭귄 체력은 시작 때 참가 인원에 맞춰 자동으로 정해지므로 여기서는 마릿수만 고른다.
 */
export default function RaidOptionsFields({ value, onChange }: RaidOptionsFieldsProps) {
  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-lg font-bold text-sky-900">
        <Snowflake className="h-5 w-5" />
        쓰러뜨릴 펭귄 수
      </div>
      <p className="mb-3 text-sm text-sky-800/80">
        마지막은 항상 황제 펭귄이에요. 체력은 시작할 때 참가 인원에 맞춰 자동으로 정해져요.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {RAID_BOSS_COUNT_OPTIONS.map((count) => {
          const active = value.bossCount === count
          return (
            <button
              key={count}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, bossCount: count })}
              className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                active
                  ? 'border-sky-500 bg-sky-100 text-sky-900'
                  : 'border-sky-200 bg-white text-sky-800 hover:border-sky-400'
              }`}
            >
              <span className="block font-black">펭귄 {count}마리</span>
              <span className="mt-1 block text-xs font-medium opacity-80">{HINTS[count]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
