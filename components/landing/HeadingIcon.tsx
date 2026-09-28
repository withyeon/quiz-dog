'use client'

import Image from 'next/image'

/** 섹션 제목 끝에 붙는 픽셀 아이콘 하나. 글자 크기(1em)에 맞춰 커지고 줄어든다. */
export default function HeadingIcon({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={64}
      height={64}
      unoptimized
      className="ml-2 inline-block h-[1.1em] w-[1.1em] object-contain align-[-0.15em]"
    />
  )
}
