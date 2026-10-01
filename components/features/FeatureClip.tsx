'use client'

import { useEffect, useRef } from 'react'

/**
 * 기능 소개 페이지의 짧은 반복 클립(16:10, 5~7초).
 * 파일은 public/main/mp4/features/<name>.webm|mp4 와 포스터 <name>-poster.webp — 랜딩 홍보 영상처럼 코드로 그린 장면을
 * 프레임 단위로 렌더한 것이라 실제 화면이 바뀌면 같은 구도로 다시 만든다(장면 소스는 영상 제작 메모 참고).
 *
 * 한 페이지에 클립이 여덟 개라 화면에 보이는 것만 재생하고, '움직임 줄이기' 설정이면 포스터만 보여 준다.
 * Shot(정지 캡처)과 같은 자리에 쓰도록 bleed·caption 을 똑같이 받는다.
 */
export default function FeatureClip({
  name,
  alt,
  caption,
  bleed = false,
}: {
  name: string
  /** 화면 낭독기용 설명 */
  alt: string
  caption?: string
  /** 카드 상단에 여백 없이 붙일 때 (모서리 둥글기·테두리 없음) */
  bleed?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // React 가 muted 를 속성으로 안 써 주는 경우가 있어 재생 전에 직접 끈다 (소리 없는 영상만 자동 재생된다)
    video.muted = true
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.2 }
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <figure className="m-0">
      <div
        className={
          bleed
            ? 'relative aspect-[16/10] w-full overflow-hidden border-b border-slate-100 bg-[#e6f5fb]'
            : 'relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-slate-200 bg-[#e6f5fb]'
        }
      >
        <video
          ref={videoRef}
          poster={`/main/mp4/features/${name}-poster.webp`}
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-label={alt}
          className="absolute inset-0 h-full w-full object-cover"
        >
          {/* 이 클립들은 H.264 쪽이 20~60% 작아서 mp4 를 먼저 둔다 */}
          <source src={`/main/mp4/features/${name}.mp4`} type="video/mp4" />
          <source src={`/main/mp4/features/${name}.webm`} type="video/webm" />
        </video>
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-center text-[13px] font-bold text-slate-400">{caption}</figcaption>
      )}
    </figure>
  )
}
