'use client'

import { useState } from 'react'
import Image from 'next/image'

// 여러 게임 모드가 함께 쓰는 픽셀 아이콘. 모드 전용이 아니므로 public/icons 아래에 둔다.
export const PIXEL_ICON = {
  correct: { src: '/icons/correct.webp', emoji: '✅', label: '정답' },
  wrong: { src: '/icons/wrong.webp', emoji: '❌', label: '오답' },
  scan: { src: '/icons/scan.webp', emoji: '🔍', label: '조사' },
  time: { src: '/icons/time.webp', emoji: '⏰', label: '시간' },
  gold: { src: '/icons/gold-stack.webp', emoji: '💰', label: '돈' },
  streak: { src: '/icons/streak.webp', emoji: '🔥', label: '연속 정답' },
  rare: { src: '/icons/rare.webp', emoji: '✨', label: '희귀' },
  people: { src: '/icons/people.webp', emoji: '👥', label: '인원' },
  dish: { src: '/icons/dish.webp', emoji: '🍽️', label: '음식' },
  waiting: { src: '/icons/waiting.webp', emoji: '⏳', label: '기다리는 중' },
  double: { src: '/icons/double.webp', emoji: '2️⃣', label: '점수 2배' },
  lucky: { src: '/icons/lucky.webp', emoji: '🍀', label: '행운' },
  ticket: { src: '/icons/ticket.webp', emoji: '🎟️', label: '티켓' },
  shield: { src: '/icons/shield.webp', emoji: '🛡️', label: '방어' },
  flip: { src: '/icons/flip.webp', emoji: '🙃', label: '화면 뒤집기' },
} as const

export type PixelIconName = keyof typeof PIXEL_ICON

type PixelIconProps = {
  name: PixelIconName
  size?: number
  className?: string
  alt?: string
}

export default function PixelIcon({ name, size = 80, className = '', alt }: PixelIconProps) {
  const [failed, setFailed] = useState(false)
  const icon = PIXEL_ICON[name]
  const label = alt ?? icon.label

  if (failed) {
    // 이미지를 못 불러오면 이모지로 대체해 화면이 비지 않게 한다.
    return (
      <span
        role="img"
        aria-label={label}
        className={`inline-flex items-center justify-center leading-none ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.7 }}
      >
        {icon.emoji}
      </span>
    )
  }

  return (
    <Image
      src={icon.src}
      alt={label}
      width={size}
      height={size}
      unoptimized
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-contain select-none ${className}`}
    />
  )
}
