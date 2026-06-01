'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  ZOMBIE_ICON,
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
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={!alt}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      />
    )
  }

  return (
    <Image
      src={ZOMBIE_ICON[name]}
      alt={alt}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  )
}
