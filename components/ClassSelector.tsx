'use client'

import { motion } from 'framer-motion'
import type { PlayerClass, PlayerClassInfo } from '@/lib/game/battleRoyale'
import { PLAYER_CLASSES } from '@/lib/game/battleRoyale'

interface ClassSelectorProps {
  onSelect: (playerClass: PlayerClass) => void
  selectedClass?: PlayerClass
}

export default function ClassSelector({
  onSelect,
  selectedClass,
}: ClassSelectorProps) {
  const classes: PlayerClass[] = ['ice_fist', 'rapid_fire', 'shield', 'hot_choco']

  return (
    <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-white rounded-xl shadow-2xl p-8 max-w-4xl mx-auto border-4 border-blue-300">
      <motion.h2
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="text-3xl font-bold text-center mb-6 text-blue-800"
      >
        ❄️ 장갑(무기)을 선택하세요! ❄️
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {classes.map((classId) => {
          const classInfo = PLAYER_CLASSES[classId]
          const isSelected = selectedClass === classId

          return (
            <motion.button
              key={classId}
              onClick={() => onSelect(classId)}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className={`p-6 rounded-xl border-4 transition-all text-left ${
                isSelected
                  ? 'bg-blue-200 border-blue-500 shadow-lg'
                  : 'bg-white border-blue-300 hover:border-blue-500'
              }`}
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={isSelected ? { rotate: [0, 10, -10, 0] } : {}}
                  transition={{ duration: 1, repeat: isSelected ? Infinity : 0 }}
                  className="text-5xl"
                >
                  {classInfo.icon}
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {classInfo.name}
                    </h3>
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-2xl"
                      >
                        ✅
                      </motion.span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {classInfo.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-gray-600">데미지</div>
                      <div className="font-bold text-blue-700">
                        {classInfo.damageMultiplier}x
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-gray-600">체력</div>
                      <div className="font-bold text-blue-700">
                        {classInfo.maxHealth}
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-gray-600">공격속도</div>
                      <div className="font-bold text-blue-700">
                        {classInfo.attackSpeed}x
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded p-2">
                      <div className="text-gray-600">방어력</div>
                      <div className="font-bold text-blue-700">
                        {Math.round((1 - classInfo.defense) * 100)}% 감소
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
