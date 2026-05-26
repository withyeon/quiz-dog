'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ZOMBIE_ICON,
  ZOMBIE_ICON_EMOJI_FALLBACK,
  type ZombieIconName,
} from '@/lib/game/zombieAssets'

type ZombieIconProps = {
  name: ZombieIconName
  size?: number
  className?: string
  alt?: string
}

export default function ZombieIcon({
  name,
  size = 24,
  className = '',
  alt = '',
}: ZombieIconProps) {
  const emojiFallback = ZOMBIE_ICON_EMOJI_FALLBACK[name]
  const [failed, setFailed] = useState(false)

  if (failed && emojiFallback) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: Math.round(size * 0.9), width: size, height: size }}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        {emojiFallback}
      </span>
    )
  }

  return (
    <Image
      src={ZOMBIE_ICON[name]}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      onError={() => {
        if (emojiFallback) setFailed(true)
      }}
      className={`object-contain ${className}`}
    />
  )
}
