'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CHARACTERS, type Character, getCharacterDisplay } from '@/lib/utils/characters'

// 퀴즈독 브랜드(하늘 + 남색) 톤 — 학생 입장 화면의 다른 요소와 같은 언어
const CATEGORY_ACTIVE = 'bg-sky-500 text-white shadow-[0_3px_0_#0b8fc4]'
const CATEGORY_IDLE = 'border-2 border-sky-100 bg-white text-sky-700 hover:border-sky-300'

interface CharacterSelectorProps {
  selectedCharacterId?: string
  onSelect: (character: Character) => void
  showCategories?: boolean
  /** 같은 방 다른 친구들이 이미 고른 캐릭터 ID들(중복 선택 방지용). 본인 선택은 제외하고 전달한다. */
  takenCharacterIds?: Set<string>
}

export default function CharacterSelector({
  selectedCharacterId,
  onSelect,
  showCategories = false,
  takenCharacterIds,
}: CharacterSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<Character['category'] | undefined>(undefined)

  const filteredCharacters = selectedCategory
    ? CHARACTERS.filter(char => char.category === selectedCategory)
    : CHARACTERS

  return (
    <div className="space-y-4">
      {/* 카테고리 필터 (선택사항) */}
      {showCategories && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory(undefined)}
            className={`rounded-full px-4 py-2 text-sm font-black transition-all ${
              !selectedCategory ? CATEGORY_ACTIVE : CATEGORY_IDLE
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSelectedCategory('default')}
            className={`rounded-full px-4 py-2 text-sm font-black transition-all ${
              selectedCategory === 'default' ? CATEGORY_ACTIVE : CATEGORY_IDLE
            }`}
          >
            기본
          </button>
          <button
            onClick={() => setSelectedCategory('premium')}
            className={`rounded-full px-4 py-2 text-sm font-black transition-all ${
              selectedCategory === 'premium' ? CATEGORY_ACTIVE : CATEGORY_IDLE
            }`}
          >
            프리미엄
          </button>
        </div>
      )}

      {/* 캐릭터 그리드 */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {filteredCharacters.map((character) => {
          const isSelected = selectedCharacterId === character.id
          // 본인이 고른 건 제외하고, 다른 친구가 이미 쓰는 캐릭터는 선택 불가
          const isTaken = !isSelected && (takenCharacterIds?.has(character.id) ?? false)
          const display = getCharacterDisplay(character)

          return (
            <motion.button
              key={character.id}
              onClick={() => { if (!isTaken) onSelect(character) }}
              disabled={isTaken}
              aria-disabled={isTaken}
              whileHover={isTaken ? undefined : { scale: 1.1, y: -5 }}
              whileTap={isTaken ? undefined : { scale: 0.95 }}
              className={`relative rounded-2xl border-2 p-1 transition-all ${
                isTaken
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-50 grayscale'
                  : isSelected
                    ? 'scale-105 border-sky-400 bg-sky-50 shadow-[0_4px_0_rgba(186,230,253,0.9),0_10px_20px_rgba(14,165,233,0.18)]'
                    : 'border-sky-100 bg-white hover:border-sky-300 hover:bg-sky-50/60'
              }`}
              title={isTaken ? `${character.name} (이미 친구가 선택함)` : character.name}
            >
              {/* 이미지가 있는 경우 */}
              {display.hasImage ? (
                <div className="relative w-full aspect-square overflow-hidden flex items-center justify-center">
                  <Image
                    src={display.imageUrl!}
                    alt={character.name}
                    fill
                    className="object-contain scale-150"
                    sizes="(max-width: 768px) 80px, 120px"
                  />
                </div>
              ) : (
                /* 이모지 사용 */
                <div className="text-4xl flex items-center justify-center">
                  {display.emoji}
                </div>
              )}

              {/* 선택 표시 */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-black text-white"
                  style={{ background: 'linear-gradient(180deg, #4FC3F7 0%, #0ea5e9 100%)', boxShadow: '0 2px 0 #0b8fc4' }}
                >
                  ✓
                </motion.div>
              )}

              {/* 이미 다른 친구가 선택한 캐릭터 표시 */}
              {isTaken && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/10">
                  <span className="rounded-full bg-slate-700/90 px-1.5 py-0.5 text-[9px] font-black text-white">사용중</span>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* 선택된 캐릭터 정보 */}
      {selectedCharacterId && (
        <div className="mt-4 rounded-2xl border-2 border-sky-100 bg-sky-50 p-3">
          <p className="text-sm font-black" style={{ color: '#334155' }}>
            선택된 캐릭터: <span className="font-black" style={{ color: '#0369A1' }}>
              {CHARACTERS.find(c => c.id === selectedCharacterId)?.name}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
