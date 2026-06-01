'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getPowerUpImagePath, POWERUP_EFFECTS, type PowerUpType } from '@/lib/game/dontlookdown'

type PowerUpIconProps = {
  type: PowerUpType
  size?: number
  className?: string
}

export default function PowerUpIcon({
  type,
  size = 32,
  className = '',
}: PowerUpIconProps) {
  const [failed, setFailed] = useState(false)
  const emoji = POWERUP_EFFECTS[type].icon

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ fontSize: Math.round(size * 0.65), width: size, height: size }}
        aria-hidden
      >
        {emoji}
      </span>
    )
  }

  return (
    <Image
      src={getPowerUpImagePath(type)}
      alt={POWERUP_EFFECTS[type].name}
      width={size}
      height={size}
      unoptimized
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
