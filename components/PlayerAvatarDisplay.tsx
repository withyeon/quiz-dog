'use client'

import Image from 'next/image'
import { isAvatarPath } from '@/lib/utils/playerDisplay'

type PlayerAvatarDisplayProps = {
  avatar?: string | null
  nickname?: string | null
  fallback?: string
  className?: string
  imageClassName?: string
  sizes?: string
}

export default function PlayerAvatarDisplay({
  avatar,
  nickname,
  fallback = '🐶',
  className = 'relative h-10 w-10 overflow-hidden rounded-full bg-white text-2xl',
  imageClassName = 'object-contain scale-125',
  sizes = '40px',
}: PlayerAvatarDisplayProps) {
  const normalizedAvatar = String(avatar || '').trim()

  if (isAvatarPath(normalizedAvatar)) {
    return (
      <span className={`inline-flex items-center justify-center ${className}`}>
        <Image
          src={normalizedAvatar.startsWith('/') ? normalizedAvatar : `/${normalizedAvatar}`}
          alt={nickname || '플레이어'}
          fill
          className={imageClassName}
          sizes={sizes}
        />
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {avatar || fallback}
    </span>
  )
}
