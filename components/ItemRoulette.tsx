'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { type ItemType, ITEM_DEFS } from '@/lib/game/간식런'

interface ItemRouletteProps {
  item: ItemType
  onComplete: () => void
}

// 전체 아이템 목록 (룰렛용)
const ALL_ITEMS: ItemType[] = [
  'booster', 'shield', 'double_score', 'magnet',
  'golden_rain', 'score_steal', 'big_dog', 'drone',
  'screen_flip', 'screen_shrink', 'golden_mode',
]

const RARITY_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  common:    { bg: 'linear-gradient(135deg, #374151, #4b5563)', border: '#6b7280', glow: 'rgba(107,114,128,0.4)' },
  rare:      { bg: 'linear-gradient(135deg, #1e40af, #3b82f6)', border: '#60a5fa', glow: 'rgba(59,130,246,0.5)' },
  epic:      { bg: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: '#c084fc', glow: 'rgba(168,85,247,0.5)' },
  legendary: { bg: 'linear-gradient(135deg, #b45309, #f59e0b)', border: '#fbbf24', glow: 'rgba(251,191,36,0.6)' },
}

export default function ItemRoulette({ item, onComplete }: ItemRouletteProps) {
  const [phase, setPhase] = useState<'spinning' | 'reveal' | 'done'>('spinning')
  const [displayIndex, setDisplayIndex] = useState(0)
  const [spinSpeed] = useState(34) // ms per tick
  const tickRef = useRef<ReturnType<typeof setTimeout>>()
  const spinCountRef = useRef(0)

  // 셔플된 순서 생성 (마지막은 실제 아이템)
  const sequenceRef = useRef<ItemType[]>((() => {
    const shuffled: ItemType[] = []
    // 짧고 강하게 돌리고 마지막에 실제 아이템 배치
    for (let i = 0; i < 8; i++) {
      shuffled.push(ALL_ITEMS[Math.floor(Math.random() * ALL_ITEMS.length)])
    }
    shuffled.push(item)
    return shuffled
  })())

  // 스피닝 로직
  useEffect(() => {
    if (phase !== 'spinning') return

    const seq = sequenceRef.current
    const totalSteps = seq.length

    const tick = () => {
      spinCountRef.current++
      const idx = spinCountRef.current

      if (idx >= totalSteps) {
        // 최종 아이템에 도달
        setDisplayIndex(totalSteps - 1)
        setPhase('reveal')
        return
      }

      setDisplayIndex(idx)

      // 점점 느려지는 속도 (easing)
      const progress = idx / totalSteps
      const easedDelay = 34 + Math.pow(progress, 2.1) * 85
      tickRef.current = setTimeout(tick, easedDelay)
    }

    tickRef.current = setTimeout(tick, spinSpeed)
    return () => { if (tickRef.current) clearTimeout(tickRef.current) }
  }, [phase])

  // 리빌 후 자동 닫기
  useEffect(() => {
    if (phase === 'reveal') {
      const t = setTimeout(() => setPhase('done'), 650)
      return () => clearTimeout(t)
    }
    if (phase === 'done') {
      onComplete()
    }
  }, [phase, onComplete])

  const seq = sequenceRef.current
  const currentItem = seq[displayIndex] || item
  const currentDef = ITEM_DEFS[currentItem]
  const isRevealed = phase === 'reveal'
  const rarityStyle = RARITY_COLORS[currentDef.rarity]

  // 룰렛에서 보여줄 아이템 5개 (현재 중심 ±2)
  const getVisibleItems = () => {
    const items: { type: ItemType; offset: number }[] = []
    for (let offset = -2; offset <= 2; offset++) {
      const idx = displayIndex + offset
      if (idx >= 0 && idx < seq.length) {
        items.push({ type: seq[idx], offset })
      } else {
        items.push({ type: ALL_ITEMS[Math.abs(idx) % ALL_ITEMS.length], offset })
      }
    }
    return items
  }

  const visibleItems = getVisibleItems()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ fontFamily: 'BMJUA, sans-serif' }}
    >
      {/* 배경 오버레이 */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(circle at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%)',
      }} />

      {/* 룰렛 컨테이너 */}
      <motion.div
        className="relative z-10"
        animate={isRevealed ? { scale: [1, 1.16, 1] } : {}}
        transition={{ duration: 0.24 }}
      >
        {/* 카트라이더 스타일 아이템 박스 */}
        <div className="relative" style={{ width: 280 }}>
          {/* 상단 라벨 */}
          <motion.div
            className="text-center mb-3"
            animate={phase === 'spinning' ? { opacity: [0.45, 1, 0.45] } : { opacity: 1 }}
            transition={{ duration: 0.34, repeat: phase === 'spinning' ? Infinity : 0 }}
          >
            <span className="text-sm font-bold px-4 py-1 rounded-full" style={{
              background: 'rgba(139,92,246,0.3)',
              color: '#c4b5fd',
              border: '1px solid rgba(139,92,246,0.4)',
            }}>
              {phase === 'spinning' ? '🎲 아이템 선택 중...' : '✨ 아이템 획득!'}
            </span>
          </motion.div>

          {/* 룰렛 슬롯 */}
          <div className="relative overflow-hidden rounded-2xl" style={{
            background: 'linear-gradient(180deg, rgba(10,10,30,0.95), rgba(20,10,50,0.98))',
            border: isRevealed ? `2px solid ${rarityStyle.border}` : '2px solid rgba(139,92,246,0.3)',
            boxShadow: isRevealed
              ? `0 0 30px ${rarityStyle.glow}, 0 0 60px ${rarityStyle.glow}`
              : '0 0 20px rgba(139,92,246,0.2)',
            padding: '4px',
          }}>
            {/* 슬롯 머신 스타일 아이템 스트립 */}
            <div className="relative h-20 overflow-hidden rounded-xl" style={{
              background: 'rgba(0,0,0,0.4)',
            }}>
              {/* 중앙 선택 표시선 */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[60px] z-10" style={{
                borderLeft: '2px solid rgba(251,191,36,0.6)',
                borderRight: '2px solid rgba(251,191,36,0.6)',
                background: 'rgba(251,191,36,0.05)',
              }} />

              {/* 아이템 스트립 */}
              <div className="absolute inset-0 flex items-center justify-center gap-0">
                {visibleItems.map((vi, i) => {
                  const def = ITEM_DEFS[vi.type]
                  const isCenter = vi.offset === 0
                  const dist = Math.abs(vi.offset)
                  const opacity = isCenter ? 1 : Math.max(0.15, 1 - dist * 0.35)
                  const itemScale = isCenter ? 1.15 : Math.max(0.6, 1 - dist * 0.2)

                  return (
                    <div
                      key={`${i}-${displayIndex}`}
                      className="flex-shrink-0 flex items-center justify-center transition-all"
                      style={{
                        width: 56,
                        height: 56,
                        opacity,
                        transform: `scale(${itemScale})`,
                        transition: 'all 0.08s ease-out',
                      }}
                    >
                      <span className="text-3xl">{def.emoji}</span>
                    </div>
                  )
                })}
              </div>

              {/* 좌우 페이드 */}
              <div className="absolute inset-y-0 left-0 w-16 z-20" style={{
                background: 'linear-gradient(90deg, rgba(10,10,30,0.9), transparent)',
              }} />
              <div className="absolute inset-y-0 right-0 w-16 z-20" style={{
                background: 'linear-gradient(-90deg, rgba(10,10,30,0.9), transparent)',
              }} />
            </div>

            {/* 결과 정보 패널 */}
            <AnimatePresence>
              {isRevealed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  transition={{ delay: 0.08, duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 text-center" style={{
                    background: rarityStyle.bg,
                    borderRadius: '0 0 12px 12px',
                    marginTop: 4,
                  }}>
                    {/* 등급 뱃지 */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-4xl">{currentDef.emoji}</span>
                    </div>
                    <div className="font-bold text-xl text-white mb-0.5">{currentDef.name}</div>
                    <div className="text-xs text-white/70 mb-2">{currentDef.description}</div>
                    <div className="inline-block px-3 py-0.5 rounded-full text-xs font-bold" style={{
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.25)',
                      textTransform: 'uppercase',
                    }}>
                      {currentDef.rarity}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 리빌 시 폭죽 파티클 */}
          {isRevealed && (
            <>
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full"
                  initial={{
                    x: 140,
                    y: 60,
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: 140 + Math.cos((i / 12) * Math.PI * 2) * (80 + Math.random() * 40),
                    y: 60 + Math.sin((i / 12) * Math.PI * 2) * (60 + Math.random() * 30),
                    scale: [0, 1.5, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{ duration: 0.48, delay: i * 0.018 }}
                  style={{
                    width: 6 + (i % 3) * 3,
                    height: 6 + (i % 3) * 3,
                    background: ['#fbbf24', '#a78bfa', '#f472b6', '#34d399', '#60a5fa'][i % 5],
                    boxShadow: `0 0 6px ${['#fbbf24', '#a78bfa', '#f472b6', '#34d399', '#60a5fa'][i % 5]}`,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
