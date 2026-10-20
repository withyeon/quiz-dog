'use client'

import Image from 'next/image'
import { INGREDIENTS, canAddIngredient, type IngredientId, type Pot } from '@/lib/game/ramen'

type IngredientBarProps = {
  /** 지금 선택된 냄비 (없으면 전부 비활성) */
  pot: Pot | null
  onAdd: (id: IngredientId) => void
  disabled?: boolean
}

/**
 * 재료 선반: 면 · 스프 · 물 · 파 · 계란. 선택된 냄비에 들어간다.
 * 이미 들어간 재료는 눌러도 안 들어가므로 흐리게. 키보드 Q/W/E/R/T.
 */
export default function IngredientBar({ pot, onAdd, disabled = false }: IngredientBarProps) {
  return (
    <div className="rounded-2xl border-4 border-[#5b3a1e] bg-[#8b5a2b] p-2 shadow-[inset_0_4px_10px_rgba(0,0,0,0.35)] sm:p-3">
      <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-black text-amber-100 sm:text-xs">
        <span>🧺 재료 선반 {pot ? `→ ${pot.index + 1}번 냄비에 넣기` : ''}</span>
        <span className="hidden opacity-80 sm:inline">냄비 번호 1·2·3 · 쟁반 스페이스</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {INGREDIENTS.map((item) => {
          const enabled = !disabled && pot !== null && canAddIngredient(pot, item.id)
          const timingHot = item.id === 'leek' || item.id === 'egg'
          return (
            <button
              key={item.id}
              type="button"
              disabled={!enabled}
              onClick={() => onAdd(item.id)}
              className={`flex flex-col items-center rounded-xl border-2 border-[#1f1a17] px-1 py-2 text-center shadow-[0_4px_0_#1f1a17] transition-transform active:translate-y-0.5 active:shadow-none disabled:translate-y-0.5 disabled:opacity-45 disabled:shadow-none sm:py-2.5 ${
                timingHot ? 'bg-emerald-50 hover:bg-emerald-100' : 'bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <Image
                src={`/ramen/icon-${item.id}.webp`}
                alt={item.label}
                width={128}
                height={128}
                unoptimized
                draggable={false}
                className="h-9 w-9 select-none object-contain sm:h-12 sm:w-12"
                style={{ imageRendering: 'pixelated' }}
              />
              <span className="mt-1 text-xs font-black text-slate-800 sm:text-sm">{item.label}</span>
              <span className="mt-0.5 hidden text-[10px] font-bold text-slate-500 sm:block">{item.hint}</span>
              <span className="mt-0.5 hidden rounded bg-slate-200 px-1 text-[10px] font-black text-slate-600 sm:block">{item.key}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
