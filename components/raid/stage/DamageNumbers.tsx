'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RAID } from '@/lib/game/raid'
import type { RaidHitPopup } from '@/hooks/useRaidEffects'
import { getRoleHitColor, outlinedText } from './stageTheme'

/** compact 에서 이만큼 넘게 떠 있으면 친구 숫자를 한 덩어리 "+N" 으로 묶는다 */
const COLLAPSE_ABOVE = 4

const MINE_COLOR = '#fde047'
const GROGGY_COLOR = '#ffc42e'

type DamageNumbersProps = {
  hits: RaidHitPopup[]
  isLarge: boolean
  reduceMotion: boolean
}

function hitLook(hit: RaidHitPopup, isLarge: boolean) {
  // 기절 중 타격과 콤보 타격은 한 단계 크게 — 반 전체가 "지금 세다"를 한눈에 보게
  const emphasised = hit.groggy || hit.comboBonus > 0
  const base = hit.mine ? (isLarge ? 54 : 32) : (isLarge ? 28 : 17)
  return {
    fontSize: Math.round(base * (emphasised ? 1.35 : 1)),
    color: hit.groggy ? GROGGY_COLOR : hit.mine ? MINE_COLOR : getRoleHitColor(hit.role),
    emphasised,
    rise: (hit.mine ? 74 : 56) * (isLarge ? 1.6 : 1),
  }
}

/** 내 숫자는 가운데 근처, 친구 숫자는 좌우로 갈라 서로 겹치지 않게 흩뿌린다 */
function hitLeft(hit: RaidHitPopup): number {
  if (hit.mine) return 38 + ((hit.id * 29) % 24)
  return hit.id % 2 === 0 ? 12 + ((hit.id * 13) % 22) : 66 + ((hit.id * 17) % 22)
}

/**
 * 타격 숫자. 굵은 외곽선 + 역할 색(내 것은 노랑, 기절 중은 금색 ×2).
 * 친구 이름은 숫자 위에 아주 작게. 폰에서 숫자가 너무 많이 뜨면 친구 숫자를 "+N" 합계 하나로 묶는다.
 */
export default function DamageNumbers({ hits, isLarge, reduceMotion }: DamageNumbersProps) {
  // 개수가 4 언저리에서 오르내릴 때 묶음이 깜박이지 않게, 한 번 묶으면 거의 다 사라질 때까지 유지한다
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    if (isLarge) return
    if (hits.length > COLLAPSE_ABOVE) setCollapsed(true)
    else if (hits.length <= 1) setCollapsed(false)
  }, [hits.length, isLarge])

  const showTotal = !isLarge && (collapsed || hits.length > COLLAPSE_ABOVE)
  const visible = showTotal ? hits.filter((hit) => hit.mine) : hits
  const friendTotal = showTotal ? hits.reduce((sum, hit) => sum + (hit.mine ? 0 : hit.damage), 0) : 0

  return (
    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
      <AnimatePresence>
        {visible.map((hit) => {
          const look = hitLook(hit, isLarge)
          return (
            <div
              key={hit.id}
              className="absolute -translate-x-1/2"
              style={{ left: `${hitLeft(hit)}%`, bottom: isLarge ? '36%' : '34%' }}
            >
              <motion.div
                className="flex flex-col items-center whitespace-nowrap font-black leading-none"
                initial={{ opacity: 0, y: 8, scale: 0.6 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  y: reduceMotion ? [0, 0, 0, 0] : [8, -look.rise * 0.35, -look.rise * 0.7, -look.rise],
                  scale: reduceMotion ? 1 : hit.mine || look.emphasised ? [0.6, 1.3, 1.1, 1] : [0.8, 1, 1, 0.95],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.35, ease: 'easeOut' }}
              >
                {hit.nickname && (
                  <span
                    className={`mb-0.5 max-w-[88px] truncate text-white/95 ${isLarge ? 'text-xs' : 'text-[9px]'}`}
                    style={outlinedText(isLarge ? 3 : 2)}
                  >
                    {hit.nickname}
                  </span>
                )}
                <span
                  style={{
                    fontSize: look.fontSize,
                    color: look.color,
                    ...outlinedText(Math.max(3, Math.round(look.fontSize / 5))),
                    ...(hit.groggy ? { filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.85))' } : null),
                  }}
                >
                  -{hit.damage}
                  {hit.groggy && (
                    <span className="ml-0.5 text-[0.62em] text-orange-300">×{RAID.GROGGY_MULTIPLIER}</span>
                  )}
                </span>
                {hit.mine && hit.comboBonus > 0 && (
                  <span
                    className={`mt-0.5 text-orange-300 ${isLarge ? 'text-base' : 'text-[11px]'}`}
                    style={outlinedText(isLarge ? 4 : 3)}
                  >
                    콤보 +{hit.comboBonus}
                  </span>
                )}
              </motion.div>
            </div>
          )
        })}
      </AnimatePresence>

      <AnimatePresence>
        {friendTotal > 0 && (
          <motion.div
            key="friend-total"
            className="absolute right-2 flex items-baseline gap-1 whitespace-nowrap rounded-full bg-slate-950/60 px-2.5 py-1 font-black ring-1 ring-white/20"
            style={{ bottom: '30%' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <span className="text-[10px] text-sky-100/80">친구들</span>
            {/* 합계가 바뀔 때마다 숫자만 톡 튀어 굴러가는 느낌을 준다 */}
            <motion.span
              key={friendTotal}
              className="text-base tabular-nums text-sky-50"
              initial={{ y: -6, opacity: 0.4, scale: 1.25 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ duration: 0.18 }}
            >
              +{friendTotal}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
