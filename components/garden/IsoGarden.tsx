'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import {
  CROP_BY_ID,
  GARDEN,
  MUTATIONS,
  UNLOCK_ORDER,
  getCropProgress,
  getCropStage,
  getRemainingMs,
  isRipe,
  nextExpandPrice,
  type GardenState,
  type Mutation,
} from '@/lib/game/garden'
import type { ActiveCrow, HarvestFloat } from '@/hooks/useGardenGame'

/**
 * 땅 블록 그림(public/garden/tile-*.webp, scripts/make-garden-assets.mjs 로 같은 상자로 자름)의 마름모 위치.
 * 모두 블록 그림 너비(W)에 대한 비율이다.
 */
const TILE_GEOMETRY = {
  /** 그림 높이 */
  height: 260 / 320,
  /** 윗면 마름모 가운데(작물을 세우는 곳) */
  centerY: 113.3 / 320,
  /** 윗면 마름모 위아래 반 높이 */
  halfH: 99.5 / 320,
}

/** 작물이 블록 위로 솟는 높이만큼 위쪽 여유 (W 비율) */
const TOP_PAD = 0.45

const STAGE_IMAGE = {
  seed: '/garden/stage-seed.webp',
  sprout: '/garden/stage-sprout.webp',
  young: '/garden/stage-young.webp',
} as const

/** 단계별 그림 크기(W 비율) */
const STAGE_SIZE = { seed: 0.34, sprout: 0.36, young: 0.5, ripe: 0.72 } as const

export function mutationClass(mutation: Mutation | null | undefined): string {
  if (mutation === 'gold') return 'garden-gold'
  if (mutation === 'rainbow') return 'garden-rainbow'
  if (mutation === 'wet') return 'garden-wet'
  return ''
}

type IsoGardenProps = {
  garden: GardenState
  raining?: boolean
  /** false 면 보기만 (퀴즈 화면 옆 미리보기) */
  interactive?: boolean
  activeCrow?: ActiveCrow | null
  floats?: HarvestFloat[]
  onTapPlot?: (index: number) => void
  onTapCrow?: () => void
  onExpand?: () => void
  className?: string
}

/**
 * 블록 텃밭 쿼터뷰. 4×4 칸을 마름모로 깔고(뒤 → 앞 순서로 겹침), 칸마다 작물 그림을 세운다.
 * 칸 클릭: 다 자란 작물이면 수확, 빈 칸이면 심기 (훅의 tapPlot). 다음에 열릴 잠긴 칸엔 값 배지가 붙는다.
 */
export default function IsoGarden({
  garden,
  raining = false,
  interactive = true,
  activeCrow = null,
  floats = [],
  onTapPlot,
  onTapCrow,
  onExpand,
  className = '',
}: IsoGardenProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  const grid = GARDEN.GRID
  // 전체 너비 = grid 개 블록 너비
  const W = width / grid
  const halfH = W * TILE_GEOMETRY.halfH
  const top = W * TOP_PAD
  const height = top + halfH * (grid - 1) * 2 + W * TILE_GEOMETRY.height
  const nextLocked = UNLOCK_ORDER.find((index) => !garden.plots[index]?.unlocked)
  const expandPrice = nextExpandPrice(garden)

  const tilePos = (index: number) => {
    const row = Math.floor(index / grid)
    const col = index % grid
    return {
      left: (col - row) * (W / 2) + (width / 2 - W / 2),
      top: top + (col + row) * halfH,
      depth: col + row,
    }
  }

  return (
    <div ref={ref} className={`relative w-full select-none ${className}`} style={{ height: height || undefined, minHeight: width ? undefined : 240 }}>
      {width > 0 && garden.plots.map((plot, index) => {
        const pos = tilePos(index)
        const crop = plot.crop
        const ripe = isRipe(plot, garden.clockMs)
        const stage = crop ? getCropStage(crop, garden.clockMs) : null
        const progress = crop ? getCropProgress(crop, garden.clockMs) : 0
        const def = crop ? CROP_BY_ID[crop.cropId] : null
        const isNext = !plot.unlocked && index === nextLocked && expandPrice !== null
        const affordable = isNext && garden.coins >= (expandPrice ?? Infinity)
        const tileImage = plot.unlocked ? '/garden/tile-soil.webp' : '/garden/tile-locked.webp'
        const centerX = pos.left + W / 2
        const centerY = pos.top + W * TILE_GEOMETRY.centerY

        // 작물 그림 크기: 자라는 중인 새싹은 진행도에 따라 조금씩 커진다
        let spriteSize = 0
        let spriteSrc = ''
        if (crop && stage && def) {
          if (stage === 'ripe') {
            spriteSize = W * STAGE_SIZE.ripe
            spriteSrc = def.image
          } else {
            spriteSize = W * STAGE_SIZE[stage] * (0.85 + progress * 0.3)
            spriteSrc = STAGE_IMAGE[stage]
          }
        }

        const handleClick = () => {
          if (!interactive) return
          if (isNext && onExpand) {
            onExpand()
            return
          }
          onTapPlot?.(index)
        }

        return (
          <div key={index}>
            {/* 블록 */}
            <Image unoptimized loading="eager" width={256} height={256}
              src={tileImage}
              alt=""
              draggable={false}
              className="pointer-events-none absolute"
              style={{ left: pos.left, top: pos.top, width: W, height: 'auto', zIndex: pos.depth * 3, filter: plot.unlocked ? undefined : 'saturate(0.75)' }}
            />
            {/* 클릭 영역: 윗면 마름모 */}
            <button
              type="button"
              aria-label={plot.unlocked ? (crop ? `${def?.label}${ripe ? ' 수확' : ''}` : '빈 칸에 심기') : '잠긴 칸'}
              onClick={handleClick}
              disabled={!interactive}
              className={`absolute transition-[filter] ${interactive ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
              style={{
                left: pos.left,
                top: centerY - halfH,
                width: W,
                height: halfH * 2,
                zIndex: pos.depth * 3 + 1,
                clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
                background: ripe ? 'rgba(253,224,71,0.18)' : 'transparent',
              }}
            />
            {/* 작물 */}
            {crop && spriteSrc && (
              <button
                type="button"
                tabIndex={-1}
                onClick={handleClick}
                disabled={!interactive}
                className={`absolute flex items-end justify-center ${ripe ? 'garden-ripe' : ''} ${interactive && ripe ? 'cursor-pointer' : 'pointer-events-none'}`}
                style={{
                  left: centerX - spriteSize / 2,
                  top: centerY - spriteSize * 0.92,
                  width: spriteSize,
                  height: spriteSize,
                  zIndex: pos.depth * 3 + 2,
                }}
              >
                <Image unoptimized loading="eager" width={256} height={256} src={spriteSrc} alt="" draggable={false} className={`max-h-full max-w-full object-contain ${ripe ? mutationClass(crop.mutation) : ''}`} />
              </button>
            )}
            {/* 다 자란 표시·남은 시간 */}
            {crop && def && interactive && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: centerX, top: centerY + halfH * 0.35, zIndex: 80 }}
              >
                {ripe ? (
                  <span className="rounded-full bg-yellow-300 px-1.5 py-0.5 text-[10px] font-black text-yellow-900 shadow sm:text-xs">
                    {crop.mutation && crop.mutation !== 'none' ? `${MUTATIONS[crop.mutation].emoji} ${MUTATIONS[crop.mutation].label}` : '수확!'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-black text-white sm:text-[11px]">
                    <span className="block h-1.5 w-8 overflow-hidden rounded-full bg-white/30">
                      <span className="block h-full rounded-full bg-lime-300" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                    {Math.ceil(getRemainingMs(crop, garden.clockMs) / 1000)}초
                  </span>
                )}
              </div>
            )}
            {/* 다음에 열 칸 값 */}
            {isNext && interactive && (
              <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: centerX, top: centerY, zIndex: 80 }}>
                <span className={`rounded-full border-2 px-2 py-0.5 text-[10px] font-black shadow sm:text-xs ${affordable ? 'border-amber-500 bg-amber-300 text-amber-950' : 'border-slate-300 bg-white/90 text-slate-500'}`}>
                  🔓 {expandPrice?.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )
      })}

      {/* 허수아비 (장식 겸 남은 개수 표시) */}
      {width > 0 && garden.scarecrows > 0 && (
        <Image unoptimized loading="eager" width={256} height={256}
          src="/garden/scarecrow.webp"
          alt="허수아비"
          className="pointer-events-none absolute"
          style={{ right: W * 0.05, top: top + halfH * 0.2, width: W * 0.55, height: 'auto', zIndex: 2 }}
        />
      )}

      {/* 수확 금액 */}
      {width > 0 && floats.map((item) => {
        const pos = tilePos(item.plotIndex)
        return (
          <div
            key={item.id}
            className="garden-float pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-sm font-black sm:text-lg"
            style={{ left: pos.left + W / 2, top: pos.top - W * 0.1, zIndex: 120 }}
          >
            <span className={`rounded-full px-2 py-0.5 shadow-lg ${item.mutation === 'none' ? 'bg-white text-amber-600' : 'bg-amber-300 text-amber-950'}`}>
              +{item.coins.toLocaleString()}
              {item.mutation !== 'none' && ` ${MUTATIONS[item.mutation].emoji}`}
            </span>
          </div>
        )
      })}

      {/* 까마귀 */}
      {width > 0 && activeCrow && (() => {
        const pos = tilePos(activeCrow.plotIndex)
        const size = W * 0.62
        return (
          <button
            type="button"
            onClick={onTapCrow}
            aria-label="까마귀 쫓기"
            className="absolute"
            style={{ left: pos.left + W / 2 - size / 2, top: pos.top - size * 0.55, width: size, zIndex: 130 }}
          >
            <Image unoptimized loading="eager" width={256} height={256} src="/garden/crow.webp" alt="" draggable={false} className="garden-flap h-auto w-full" />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white shadow-lg sm:text-xs">
              톡톡! {'●'.repeat(activeCrow.tapsLeft)}{'○'.repeat(GARDEN.CROW_SHOO_TAPS - activeCrow.tapsLeft)} · {Math.ceil(activeCrow.leftMs / 1000)}초
            </span>
          </button>
        )
      })()}

      {/* 비 */}
      {raining && <div className="garden-rain pointer-events-none absolute inset-0 z-[140] rounded-xl" />}
    </div>
  )
}
