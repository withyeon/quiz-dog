'use client'

import { useState } from 'react'
import Image from 'next/image'

type CafeImageProps = {
  src: string
  alt: string
  width: number
  height: number
  /** 이미지를 못 불러왔을 때 대신 보여줄 이모지 */
  fallbackEmoji: string
  className?: string
  /** 이모지로 대체됐을 때만 쓰는 클래스(주로 글자 크기) */
  fallbackClassName?: string
}

/**
 * 카페 게임에서 메뉴·손님 그림을 그린다.
 *
 * 예전에는 네 군데가 각자 onError에서 parentElement.innerHTML에 이모지를 꽂아 넣었다.
 * React가 들고 있던 DOM 노드를 밖에서 지워 버리는 방식이라, 다음 렌더에서 React가
 * 그 자리를 다시 만지면 어긋난다. 폴백은 상태로 관리하는 게 맞다.
 */
export default function CafeImage({
  src,
  alt,
  width,
  height,
  fallbackEmoji,
  className = '',
  fallbackClassName = '',
}: CafeImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={`inline-flex items-center justify-center leading-none ${fallbackClassName}`}
      >
        {fallbackEmoji}
      </span>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
