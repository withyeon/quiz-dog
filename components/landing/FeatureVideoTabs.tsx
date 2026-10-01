'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

/**
 * 기능별 탭 영상 — 큰 영상 한 개 + 아래 기능 카드 3개.
 * 재생 중인 카드 위쪽 막대가 영상 진행만큼 차오르고, 영상이 끝나면 다음 카드로 넘어간다. 카드를 누르면 바로 바뀐다.
 *
 * 역할 분담: 히어로 영상은 "얼마나 재미있나"(게임 11개 몽타주), 여기는 "어떻게 쓰나"(만들기 → 입장 → 결과).
 * 게임 소개는 히어로와 아래 게임 카드가 맡으므로 게임 탭은 두지 않는다 (같은 장면이 두 번 나오지 않게).
 *
 * 영상은 1920×1080(16:9)인데 내용은 가운데 1440(4:3) 안에만 있다 → 폰에서는 4:3 으로 양옆만 잘라 크게 보여준다.
 * 코드로 그린 장면을 기능별로 렌더한 것(public/main/mp4/feature-*.webm|mp4, 포스터 webp).
 */
const FEATURES = [
  {
    id: 'ai',
    icon: '/icons/rare.webp',
    title: 'AI 문제 생성',
    description: '수업 자료만 올리면 AI가 객관식, O/X, 빈칸 문제를 만들어요',
  },
  {
    id: 'code',
    icon: '/icons/ticket.webp',
    title: '코드로 입장',
    description: '학생은 회원가입이나 설치 없이 6자리 코드나 QR로 들어와요',
  },
  {
    id: 'report',
    icon: '/trophy.webp',
    title: '결과 리포트',
    description: '문제별 정답률과 학생별 기록을 한눈에 확인해요',
  },
] as const

export default function FeatureVideoTabs() {
  const [index, setIndex] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const feature = FEATURES[index]

  const showNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % FEATURES.length)
  }, [])

  // 진행 막대 — 매 프레임 리렌더하지 않도록 DOM 에 직접 쓴다. 탭이 바뀌면 모든 막대를 비우고 새 탭만 채운다.
  useEffect(() => {
    barRefs.current.forEach((bar) => {
      if (bar) bar.style.transform = 'scaleX(0)'
    })
    let frame = 0
    const tick = () => {
      const video = videoRef.current
      const bar = barRefs.current[index]
      if (video && bar && video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [index])

  // 화면 밖에서는 멈춘다 (안 보이는 동안 다음 탭으로 넘어가지도 않는다)
  useEffect(() => {
    const panel = panelRef.current
    const video = videoRef.current
    if (!panel || !video) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {})
        else video.pause()
      },
      { threshold: 0.25 }
    )
    observer.observe(panel)
    return () => observer.disconnect()
  }, [index])

  return (
    <div>
      <div
        ref={panelRef}
        id="feature-video-panel"
        role="tabpanel"
        aria-label={feature.title}
        className="relative aspect-[4/3] overflow-hidden rounded-[22px] sm:aspect-video sm:rounded-[28px]"
        style={{
          backgroundColor: '#E6F5FB',
          border: '3px solid rgba(255,255,255,0.95)',
          boxShadow: '0 8px 48px rgba(14,165,233,0.14), 0 2px 8px rgba(0,0,0,0.05)',
          transform: 'translateZ(0)',
        }}
      >
        <video
          key={feature.id}
          ref={videoRef}
          poster={`/main/mp4/feature-${feature.id}-poster.webp`}
          autoPlay
          muted
          playsInline
          preload="metadata"
          onEnded={showNext}
          aria-label={`${feature.title} 소개 영상`}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={`/main/mp4/feature-${feature.id}.webm`} type="video/webm" />
          <source src={`/main/mp4/feature-${feature.id}.mp4`} type="video/mp4" />
        </video>
      </div>

      <div role="tablist" aria-label="퀴즈독 기능" className="mt-3 grid grid-cols-1 gap-2.5 sm:mt-4 sm:grid-cols-3 sm:gap-3.5">
        {FEATURES.map((item, i) => {
          const active = i === index
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="feature-video-panel"
              onClick={() => setIndex(i)}
              className="relative flex flex-col items-start justify-start overflow-hidden rounded-[18px] border-2 p-3.5 text-left transition-[background-color,box-shadow,border-color] duration-300 sm:rounded-[22px] sm:p-5"
              style={{
                backgroundColor: active ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                borderColor: active ? '#BAE6FD' : 'transparent',
                boxShadow: active ? '0 10px 28px rgba(14,165,233,0.16)' : 'none',
              }}
            >
              <span
                ref={(el) => {
                  barRefs.current[i] = el
                }}
                className="absolute left-0 top-0 h-[5px] w-full origin-left"
                style={{ background: 'linear-gradient(90deg, #7DD3FC, #0EA5E9)', transform: 'scaleX(0)' }}
                aria-hidden
              />
              <span
                className="flex items-center gap-2 text-[17px] transition-colors duration-300 sm:gap-2.5 sm:text-[22px]"
                style={{ color: active ? '#0284C7' : '#64748B' }}
              >
                <Image
                  src={item.icon}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-[26px] w-[26px] shrink-0 object-contain transition-opacity duration-300 sm:h-[34px] sm:w-[34px]"
                  style={{ opacity: active ? 1 : 0.55 }}
                />
                {item.title}
              </span>
              <span
                className="mt-1.5 block text-[13px] leading-relaxed transition-colors duration-300 sm:mt-2.5 sm:text-[15px]"
                style={{ color: active ? '#334155' : '#94A3B8' }}
              >
                {item.description}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
