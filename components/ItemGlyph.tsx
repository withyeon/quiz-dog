'use client'

import PixelIcon, { type PixelIconName } from '@/components/ui/PixelIcon'

type ItemGlyphProps = {
  item: { emoji: string; icon?: PixelIconName }
  size: number // px. 이모지는 이 크기의 글자로, 픽셀 아이콘은 이 크기의 이미지로 그린다.
  className?: string
}

// 아이템 정의의 emoji/icon 중 있는 쪽을 그린다. 픽셀 아이콘이 있으면 이미지가 우선.
export default function ItemGlyph({ item, size, className = '' }: ItemGlyphProps) {
  if (item.icon) {
    return <PixelIcon name={item.icon} size={size} className={`inline-block ${className}`} alt={item.emoji ? '' : undefined} />
  }
  return (
    <span className={`inline-block leading-none ${className}`} style={{ fontSize: size }}>
      {item.emoji}
    </span>
  )
}
