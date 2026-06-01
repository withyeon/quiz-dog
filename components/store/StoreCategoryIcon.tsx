'use client'

import { useState } from 'react'
import Image from 'next/image'
import type { ProductCategory } from '@/lib/game/convenienceStore'
import { getCategoryEmoji } from '@/lib/game/convenienceStore'
import { getCategoryImage } from '@/lib/game/storeAssets'

type StoreCategoryIconProps = {
  category: ProductCategory
  size?: number
  className?: string
}

export default function StoreCategoryIcon({
  category,
  size = 16,
  className = '',
}: StoreCategoryIconProps) {
  const [failed, setFailed] = useState(false)
  const emoji = getCategoryEmoji(category)

  if (failed) {
    return (
      <span className={`inline-flex items-center justify-center leading-none ${className}`} style={{ fontSize: size }}>
        {emoji}
      </span>
    )
  }

  return (
    <Image
      src={getCategoryImage(category)}
      alt={category}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className={`inline-block object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
