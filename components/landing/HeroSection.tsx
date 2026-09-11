'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import { heroShowcaseGames, visibleGameModeCount } from '@/components/landing/gameModesData'
import { gameAssets } from '@/assets/game-assets'

/**
 * 영상이 재생을 못 하는 경우(자동재생 차단 등)에도 화면이 한 게임에 멈춰 있지 않도록 두는 최후 타이머.
 * 정상 재생될 때는 onEnded가 먼저 넘기므로 쓰이지 않는다.
 */
const STUCK_FALLBACK_MS = 90000

/** 히어로 우측 — 실제 플레이 영상을 한 편씩 끝까지 보여주고 다음 게임으로 넘어가는 카드 */
function HeroPreview() {
  const [index, setIndex] = useState(0)
  const games = heroShowcaseGames
  const showNext = useCallback(() => {
    setIndex((prev) => (prev + 1) % games.length)
  }, [games.length])

  useEffect(() => {
    if (games.length < 2) return
    const timer = setTimeout(showNext, STUCK_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [index, games.length, showNext])

  if (games.length === 0) return null
  const game = games[index]

  return (
    <div className="relative">
      {/* 뒤에 살짝 겹쳐 보이는 카드 — 여러 게임이 쌓여 있는 느낌 */}
      <div
        className="absolute inset-x-6 -bottom-3 top-6 rounded-[28px]"
        style={{ backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.9)' }}
        aria-hidden
      />

      <div
        className="toss-card texture-grain relative aspect-[4/3] overflow-hidden rounded-[28px]"
        style={{
          backgroundColor: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.9)',
          transform: 'translateZ(0)',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.video
            key={game.previewVideo?.mp4}
            poster={game.previewImage}
            autoPlay
            muted
            playsInline
            preload="metadata"
            loop={games.length < 2}
            onEnded={showNext}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 h-full w-full object-cover"
          >
            {game.previewVideo?.webm && <source src={game.previewVideo.webm} type="video/webm" />}
            {game.previewVideo && <source src={game.previewVideo.mp4} type="video/mp4" />}
          </motion.video>
        </AnimatePresence>

        {/* 상단 광택 라인 */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
          aria-hidden
        />

        {/* 게임 타이틀 배지 */}
        <div
          className="toss-depth-plastic absolute bottom-4 left-4 flex items-center rounded-full px-4 py-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.95)',
          }}
        >
          <Image
            src={game.titleImage}
            alt={game.name}
            width={360}
            height={108}
            className="h-9 w-auto max-w-[150px] object-contain sm:h-11 sm:max-w-[180px]"
          />
        </div>

        {/* 재생 중인 게임 인디케이터 */}
        <div className="absolute bottom-5 right-5 flex items-center gap-1.5">
          {games.map((item, i) => (
            <button
              key={item.name}
              onClick={() => setIndex(i)}
              aria-label={`${item.name} 미리보기`}
              className="rounded-full"
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                backgroundColor: i === index ? '#0ea5e9' : 'rgba(255,255,255,0.85)',
                boxShadow: '0 1px 3px rgba(12,32,77,0.25)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* 마스코트 장식 */}
      <motion.div
        className="pointer-events-none absolute -bottom-8 -left-4 hidden sm:flex sm:items-end sm:gap-1"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      >
        <Image
          src={gameAssets['mascot-pome'].tight}
          alt=""
          width={84}
          height={84}
          unoptimized
          className="pixelated h-[74px] w-[74px] object-contain drop-shadow-lg"
        />
        <Image
          src={gameAssets.mascot_sigol.tight}
          alt=""
          width={84}
          height={84}
          unoptimized
          className="pixelated h-[64px] w-[64px] object-contain drop-shadow-lg"
        />
      </motion.div>
    </div>
  )
}

export default function HeroSection({ animationsReady }: { animationsReady: boolean }) {
  return (
    <section className="relative px-4 pb-16 pt-32 sm:px-6 sm:pb-20 sm:pt-36 lg:px-8 lg:pb-24 lg:pt-40" style={{ zIndex: 2 }}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        {/* LEFT — 카피 · CTA */}
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 24 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center lg:text-left"
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-black"
            style={{
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '2px solid #BAE6FD',
              color: '#0369A1',
              boxShadow: '0 2px 8px rgba(14,165,233,0.12)',
            }}
          >
            <Sparkles className="h-4 w-4" />
            AI 문제 생성 · 학생 회원가입, 설치 필요 없음
          </span>

          <h1 className="mt-6 text-4xl leading-tight sm:text-5xl lg:text-6xl">
            <PixelHeading>
              수업을 <PixelAccent>게임</PixelAccent>처럼
            </PixelHeading>
          </h1>

          <p
            className="mx-auto mt-3 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0"
            style={{ color: '#334155' }}
          >
            자료만 올리면 AI가 문제를 만들어요.
            <br className="hidden sm:block" />
            아이들은 코드 한 번으로 들어와 {visibleGameModeCount}가지 게임으로 복습합니다.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/teacher" className="w-full sm:w-auto">
              <motion.span
                whileHover={{ y: -3 }}
                whileTap={{ y: 0 }}
                className="flex w-full items-center justify-center gap-2 rounded-full px-9 py-4 text-lg font-black text-white sm:w-auto sm:px-11"
                style={{
                  background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
                  boxShadow: '0 6px 0 #0b8fc4, 0 12px 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
                  textShadow: '0 1px 0 rgba(0,0,0,0.18)',
                }}
              >
                무료로 시작하기
                <ArrowRight className="h-5 w-5" />
              </motion.span>
            </Link>
            <a href="#games" className="w-full sm:w-auto">
              <motion.span
                whileHover={{ y: -3 }}
                whileTap={{ y: 0 }}
                className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-black sm:w-auto"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #BAE6FD',
                  color: '#0369A1',
                  boxShadow: '0 5px 0 rgba(186,230,253,0.9), 0 10px 20px rgba(14,165,233,0.14)',
                }}
              >
                게임 둘러보기
              </motion.span>
            </a>
          </div>
        </motion.div>

        {/* RIGHT — 실제 플레이 화면 */}
        <motion.div
          initial={animationsReady ? { opacity: 0, scale: 0.96 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.12 }}
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  )
}
