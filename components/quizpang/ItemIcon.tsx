'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ITEM_INFO, type ItemId } from '@/lib/game/quizpang'

/** 아이템 그림 (public/quizpang/item-*.webp). 그림이 없으면 이모지로 대신한다 */
export default function ItemIcon({ id, className = '' }: { id: ItemId; className?: string }) {
  const [broken, setBroken] = useState(false)
  const info = ITEM_INFO[id]
  if (broken) return <span className={`font-plain flex items-center justify-center ${className}`}>{info.emoji}</span>
  return (
    <Image
      src={info.icon}
      alt={info.label}
      width={128}
      height={128}
      unoptimized
      draggable={false}
      className={`object-contain ${className}`}
      onError={() => setBroken(true)}
    />
  )
}
