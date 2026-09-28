'use client'

import { Backpack } from 'lucide-react'
import ItemGlyph from '@/components/ItemGlyph'
import { TOWER_QUIZZES_PER_WAVE } from '@/lib/game/tower'
import type { Skill } from '@/lib/game/skills'

export type TowerItemEntry = {
    index: number
    skill: Skill
    /** 지금 못 쓰는 이유. null 이면 쓸 수 있다 */
    blockReason: string | null
}

interface TowerItemBarProps {
    items: TowerItemEntry[]
    onUseItem: (index: number) => void
}

/**
 * 퀴즈로 얻은 아이템 보관함. 아이템은 뽑는 순간 쓰이지 않고 여기 쌓였다가, 학생이 원할 때 누른다.
 */
export default function TowerItemBar({ items, onUseItem }: TowerItemBarProps) {
    return (
        <section
            data-testid="tower-item-bar"
            className="mb-3 rounded-lg border border-white/70 bg-white/80 p-2.5 shadow-xl shadow-slate-200/70 backdrop-blur-xl"
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex shrink-0 items-center gap-1.5 text-sm font-black text-slate-950">
                    <Backpack className="h-4 w-4 text-rose-500" />
                    <span className="whitespace-nowrap">아이템</span>
                    <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] text-white">{items.length}</span>
                </div>

                {items.length === 0 ? (
                    <p className="text-xs font-bold text-slate-500">
                        퀴즈 {TOWER_QUIZZES_PER_WAVE}문제를 다 맞히면 아이템을 받아요. 받은 아이템은 여기서 원할 때 써요.
                    </p>
                ) : (
                    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
                        {items.map(({ index, skill, blockReason }) => {
                            const disabled = blockReason !== null
                            return (
                                <button
                                    key={`${skill.id}-${index}`}
                                    type="button"
                                    data-testid={`tower-item-${skill.id}`}
                                    onClick={() => onUseItem(index)}
                                    disabled={disabled}
                                    title={blockReason ?? skill.description}
                                    aria-label={`${skill.name} ${disabled ? blockReason : '사용'}`}
                                    className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-transform ${
                                        disabled
                                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-70'
                                            : 'border-rose-200 bg-white shadow-md shadow-rose-100 hover:-translate-y-0.5 active:scale-95'
                                    }`}
                                >
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${skill.color} shadow`}>
                                        <ItemGlyph item={skill} size={20} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block whitespace-nowrap text-sm font-black text-slate-950">{skill.name}</span>
                                        <span className={`block whitespace-nowrap text-[11px] font-bold ${disabled ? 'text-slate-500' : 'text-rose-600'}`}>
                                            {blockReason ?? '눌러서 사용'}
                                        </span>
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}
