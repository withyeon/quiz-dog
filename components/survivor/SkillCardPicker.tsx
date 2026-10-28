'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { SKILLS, SKILL_MAX_LEVEL, type SkillCard } from '@/lib/game/survivor'
import SkillIcon from '@/components/survivor/SkillIcon'

type SkillCardPickerProps = {
  cards: SkillCard[]
  onPick: (index: number) => void
}

/** 레벨업 정답 보상: 스킬 카드 3장 중 하나 고르기 (1·2·3 키로도 고를 수 있다) */
export default function SkillCardPicker({ cards, onPick }: SkillCardPickerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code)
      if (index >= 0 && index < cards.length) onPick(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cards.length, onPick])

  return (
    <div className="w-full max-w-4xl">
      <h2 className="mb-1 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#0f172a] sm:text-4xl">정답! 스킬을 골라요</h2>
      <p className="mb-4 text-center text-sm font-bold text-white/85 sm:text-base">하나를 고르면 바로 다시 싸워요</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card, index) => {
          const isNew = card.skillId !== 'snack' && card.level === 1
          const def = card.skillId === 'snack' ? null : SKILLS[card.skillId]
          return (
            <motion.button
              key={`${card.skillId}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, type: 'spring', stiffness: 320, damping: 22 }}
              onClick={() => onPick(index)}
              className="group relative flex items-center gap-3 rounded-2xl border-4 border-slate-900 bg-white p-3 text-left shadow-[0_6px_0_#0f172a] transition hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#0f172a] sm:flex-col sm:p-5 sm:text-center"
            >
              <span className="absolute left-2 top-2 hidden rounded-md bg-slate-100 px-1.5 text-xs font-black text-slate-500 sm:block">{index + 1}</span>
              {isNew && (
                <span className="absolute -top-3 right-3 rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-black text-white shadow">NEW</span>
              )}
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl p-1.5 sm:h-24 sm:w-24 ${def?.kind === 'passive' ? 'bg-sky-100' : 'bg-amber-100'}`}>
                <SkillIcon id={card.skillId} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-900 sm:text-xl">{def ? def.label : '간식 타임'}</div>
                {def && (
                  <div className="mt-0.5 text-xs font-black text-slate-500">
                    {def.kind === 'weapon' ? '공격' : '능력'} · {card.level === SKILL_MAX_LEVEL ? 'MAX' : `Lv.${card.level}`}
                  </div>
                )}
                <div className="mt-1 text-sm font-bold break-keep text-slate-700">
                  {def ? def.describe(card.level) : '체력을 가득 채우고 점수 +50'}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
