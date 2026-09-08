'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import { type GameModeInfo } from '@/components/landing/gameModesData'

/**
 * 게임 모드 카드 — 랜딩 '게임 라인업'과 기능 소개(/features) 게임 섹션이 함께 쓴다.
 * 기본은 게임색 패널 + 타이틀, 마우스를 올리면 실제 플레이 화면(영상 또는 배경)이 드러난다.
 */
export default function GameCard({
  game,
  index,
  animationsReady,
}: {
  game: GameModeInfo
  index: number
  animationsReady: boolean
}) {
  const [active, setActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (active) {
      void video.play().catch(() => {})
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [active])

  return (
    <motion.div
      initial={animationsReady ? { opacity: 0, y: 20 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(index, 7) * 0.05 }}
      whileHover={{ y: -6 }}
      onHoverStart={() => setActive(true)}
      onHoverEnd={() => setActive(false)}
      onTouchStart={() => setActive(true)}
      className="group"
    >
      <div
        className="flex h-full flex-col overflow-hidden rounded-[22px] transition-shadow duration-300"
        style={{
          backgroundColor: '#FFFFFF',
          border: `2px solid ${active ? game.color : 'rgba(226,232,240,0.9)'}`,
          boxShadow: active
            ? `0 14px 32px ${game.bg}, 0 4px 12px rgba(15,23,42,0.10)`
            : '0 4px 20px rgba(15,23,42,0.06)',
        }}
      >
        {/* 미디어 — 기본은 색 패널 + 타이틀, 올리면 실제 플레이 화면 */}
        <div
          className="relative aspect-[16/10] overflow-hidden"
          style={{ background: `linear-gradient(160deg, ${game.bg}, rgba(255,255,255,0.9))` }}
        >
          {game.previewImage && (
            <Image
              src={game.previewImage}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-all duration-500"
              style={{ opacity: active ? 1 : 0.42 }}
            />
          )}

          {game.previewVideo && (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              poster={game.previewImage}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
              style={{ opacity: active ? 1 : 0 }}
            >
              {game.previewVideo.webm && <source src={game.previewVideo.webm} type="video/webm" />}
              <source src={game.previewVideo.mp4} type="video/mp4" />
            </video>
          )}

          {/* 타이틀 가독성용 스크림 */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.18) 60%, rgba(255,255,255,0.42) 100%)',
              opacity: active ? 0.45 : 1,
            }}
            aria-hidden
          />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Image
              src={game.titleImage}
              alt={game.name}
              width={420}
              height={140}
              className="h-full max-h-[86px] w-auto max-w-[88%] object-contain transition-transform duration-500 group-hover:scale-[1.06]"
              style={{ filter: 'drop-shadow(0 3px 6px rgba(15,23,42,0.25))' }}
            />
          </div>

          {game.previewVideo && (
            <span
              className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black"
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#0369A1' }}
            >
              <Play className="h-3 w-3 fill-current" />
              영상
            </span>
          )}
        </div>

        {/* 설명 */}
        <div className="flex flex-1 flex-col gap-1 border-t px-4 py-3.5" style={{ borderColor: 'rgba(226,232,240,0.9)' }}>
          <p className="flex items-center gap-1.5 text-sm font-black sm:text-[15px]" style={{ color: '#0F172A' }}>
            <span aria-hidden>{game.emoji}</span>
            {game.name}
          </p>
          <p className="text-xs leading-relaxed sm:text-[13px]" style={{ color: '#64748B' }}>
            {game.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
