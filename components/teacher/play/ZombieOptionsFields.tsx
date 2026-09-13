'use client'

import { Eye, EyeOff } from 'lucide-react'
import type { ZombieSettings } from '@/lib/game/zombie'

type ZombieOptionsFieldsProps = {
  value: ZombieSettings
  onChange: (next: ZombieSettings) => void
}

/**
 * 좀비를 피해라 방 옵션. 게임 시간 아래, 시작 전에 고른다.
 * 옵션 뜻은 lib/game/zombie.ts 의 ZombieSettings 참고.
 */
export default function ZombieOptionsFields({ value, onChange }: ZombieOptionsFieldsProps) {
  const options: Array<{ id: boolean; label: string; hint: string; icon: React.ReactNode }> = [
    {
      id: true,
      label: '보여주기',
      hint: '좀비가 체력이 낮은 친구를 골라 집중 공격할 수 있어요',
      icon: <Eye className="h-4 w-4" />,
    },
    {
      id: false,
      label: '숨기기',
      hint: '누가 약한지 드러나지 않아요. 공격은 이름만 보고 골라요',
      icon: <EyeOff className="h-4 w-4" />,
    },
  ]

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="mb-1 text-lg font-bold text-emerald-900">좀비에게 인간의 체력·방어막 표시</div>
      <p className="mb-3 text-sm text-emerald-800/80">
        체력은 좀비의 공격으로만 줄어요. 틀린 문제 때문에 체력이 깎이지는 않아요.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = value.showHumanStatus === option.id
          return (
            <button
              key={String(option.id)}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...value, showHumanStatus: option.id })}
              className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                active
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                  : 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400'
              }`}
            >
              <span className="flex items-center gap-2 font-black">{option.icon}{option.label}</span>
              <span className="mt-1 block text-xs font-medium opacity-80">{option.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
