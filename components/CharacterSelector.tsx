'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CHARACTERS, type Character, getCharacterDisplay } from '@/lib/utils/characters'

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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !selectedCategory
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSelectedCategory('default')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'default'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            기본
          </button>
          <button
            onClick={() => setSelectedCategory('premium')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === 'premium'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              className={`relative p-1 rounded-xl border-2 transition-all ${
                isTaken
                  ? 'border-gray-200 bg-gray-100 opacity-50 grayscale cursor-not-allowed'
                  : isSelected
                    ? 'border-indigo-500 bg-indigo-50 shadow-lg scale-105'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
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
                  className="absolute -top-2 -right-2 bg-indigo-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold"
                >
                  ✓
                </motion.div>
              )}

              {/* 이미 다른 친구가 선택한 캐릭터 표시 */}
              {isTaken && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/10">
                  <span className="rounded-full bg-gray-700/90 px-1.5 py-0.5 text-[9px] font-bold text-white">사용중</span>
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* 선택된 캐릭터 정보 */}
      {selectedCharacterId && (
        <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
          <p className="text-sm text-gray-700">
            선택된 캐릭터: <span className="font-semibold text-indigo-600">
              {CHARACTERS.find(c => c.id === selectedCharacterId)?.name}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
