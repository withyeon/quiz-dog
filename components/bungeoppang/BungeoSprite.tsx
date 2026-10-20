import Image from 'next/image'
import type { GradeId } from '@/lib/game/bungeoppang'

/** public/bungeoppang/*.webp — scripts/make-bungeoppang-sprites.mjs 가 만든다 */
export type BungeoSpriteState = 'dough' | 'underdone' | 'baked' | 'crispy' | 'burnt' | 'golden'

export function gradeToSprite(grade: GradeId): BungeoSpriteState {
  if (grade === 'underdone') return 'underdone'
  if (grade === 'tasty' || grade === 'perfect') return 'baked'
  if (grade === 'crispy') return 'crispy'
  return 'burnt'
}

type BungeoSpriteProps = {
  state: BungeoSpriteState
  /** 가로 px (세로는 5:8 비율) */
  width?: number
  className?: string
  alt?: string
}

export default function BungeoSprite({ state, width = 96, className = '', alt = '' }: BungeoSpriteProps) {
  return (
    <Image
      src={`/bungeoppang/${state}.webp`}
      alt={alt}
      width={256}
      height={160}
      unoptimized
      draggable={false}
      className={`select-none object-contain ${className}`}
      style={{ width, height: Math.round(width * 0.625), imageRendering: 'pixelated' }}
    />
  )
}
