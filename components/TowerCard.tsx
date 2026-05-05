'use client'

import NextImage from 'next/image'
import { motion } from 'framer-motion'
import { TowerType, TowerTypeId } from '@/lib/game/tower'
import { useState, useEffect } from 'react'

interface TowerCardProps {
    tower: TowerType
    isSelected: boolean
    canAfford: boolean
    onSelect: () => void
}

const towerImagePaths: Record<TowerTypeId, string> = {
    BASIC: '/tower/basic.svg',
    MAGIC: '/tower/magic.svg',
    BOMB: '/tower/bomb.svg',
    LASER: '/tower/laser.svg',
    SLOW: '/tower/slow.svg',
}

export default function TowerCard({ tower, isSelected, canAfford, onSelect }: TowerCardProps) {
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)
    
    useEffect(() => {
        const img = new window.Image()
        img.src = towerImagePaths[tower.id]
        img.onload = () => setImageLoaded(true)
        img.onerror = () => setImageError(true)
    }, [tower.id])
    return (
        <motion.div
            whileHover={canAfford ? { scale: 1.05, y: -5 } : {}}
            whileTap={canAfford ? { scale: 0.95 } : {}}
            onClick={canAfford ? onSelect : undefined}
            className={`relative rounded-xl p-4 cursor-pointer transition-all border-4 ${isSelected
                    ? 'border-yellow-500 bg-gradient-to-br from-yellow-100 to-orange-100 shadow-xl shadow-yellow-500/50'
                    : canAfford
                        ? 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg'
                        : 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                }`}
        >
            {/* 선택 표시 */}
            {isSelected && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-yellow-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-lg"
                >
                    ✓
                </motion.div>
            )}

            {/* 타워 아이콘 */}
            <div className="text-center mb-2">
                <motion.div
                    animate={isSelected ? { rotate: [0, -10, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className="flex items-center justify-center mb-2 h-16"
                >
                    {imageLoaded && !imageError ? (
                        <NextImage
                            src={towerImagePaths[tower.id]}
                            alt={tower.name}
                            width={64}
                            height={64}
                            unoptimized
                            className="w-16 h-16 object-contain"
                        />
                    ) : (
                        <span className="text-5xl">{tower.emoji}</span>
                    )}
                </motion.div>
                <h3 className="font-bold text-lg text-gray-900">{tower.name}</h3>
            </div>

            {/* 비용 */}
            <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-yellow-600 text-xl">💰</span>
                <span className={`text-2xl font-bold ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
                    {tower.cost}
                </span>
            </div>

            {/* 스탯 */}
            <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">공격력:</span>
                    <span className="font-bold text-gray-900">{tower.damage}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">사거리:</span>
                    <span className="font-bold text-gray-900">{tower.range}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-gray-600">공격속도:</span>
                    <span className="font-bold text-gray-900">{tower.attackSpeed}/s</span>
                </div>
            </div>

            {/* 특수 효과 */}
            {tower.special && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                    <div className="text-xs font-semibold text-purple-600 text-center">
                        {tower.special === 'splash' && '💥 범위 공격'}
                        {tower.special === 'explosion' && '💣 폭발 데미지'}
                        {tower.special === 'pierce' && '⚡ 관통 공격'}
                        {tower.special === 'slow' && '❄️ 둔화 효과'}
                    </div>
                </div>
            )}

            {/* 설명 */}
            <p className="text-xs text-gray-500 text-center mt-2">{tower.description}</p>

            {/* 골드 부족 경고 */}
            {!canAfford && (
                <div className="absolute inset-0 bg-gray-900/50 rounded-xl flex items-center justify-center">
                    <div className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">
                        골드 부족
                    </div>
                </div>
            )}
        </motion.div>
    )
}
