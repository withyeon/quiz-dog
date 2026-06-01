'use client'

import { useState } from 'react'
import Image from 'next/image'
import { STORE_PRODUCT_EMOJI_FALLBACK } from '@/lib/game/storeAssets'

type StoreProductIconProps = {
  src: string
  alt: string
  emoji?: string
  baseId?: string
  size?: number
  className?: string
}

export default function StoreProductIcon({
  src,
  alt,
  emoji,
  baseId,
  size = 80,
  className = '',
}: StoreProductIconProps) {
  const fallbackEmoji = emoji ?? (baseId ? STORE_PRODUCT_EMOJI_FALLBACK[baseId] : undefined)
  const [failed, setFailed] = useState(false)

  if (failed && fallbackEmoji) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: Math.round(size * 0.55), width: size, height: size }}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        {fallbackEmoji}
      </span>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      onError={() => {
        if (fallbackEmoji) setFailed(true)
      }}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
