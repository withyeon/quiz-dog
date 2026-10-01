'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import { visibleGameModeCount } from '@/components/landing/gameModesData'
import { gameAssets } from '@/assets/game-assets'

/**
 * 히어로 영상(약 22초, 1440×1080 4:3, 무음 반복) — "11가지 게임으로 신나게 복습!" 로고 그리드 → 게임 11개
 * 플레이 장면(각 1.5초, 한 줄 자막) → 로고 엔딩. 역할은 "얼마나 재미있나"이고, "어떻게 쓰나"(AI 문제 생성 →
 * 코드 입장 → 결과 리포트)는 아래 FeatureVideoTabs 가 맡아 두 영상이 겹치지 않는다.
 * 제목·자막이 영상 안에 있어서 카드 위에 따로 글자를 얹지 않는다. 게임 장면은 튜토리얼 데모(/dev/tutorial-preview)
 * 녹화. 포스터는 게임 로고 11개 장면.
 */
const HERO_PROMO = {
  webm: '/main/mp4/quizdog-promo.webm',
  mp4: '/main/mp4/quizdog-promo.mp4',
  poster: '/main/mp4/quizdog-promo-poster.webp',
}

/** 히어로 우측 — 퀴즈독 소개 영상 */
function HeroPreview() {
  return (
    <div className="relative -mx-2 sm:mx-0">
      {/* 뒤에 살짝 겹쳐 보이는 카드 — 여러 게임이 쌓여 있는 느낌 */}
      <div
        className="absolute inset-x-6 -bottom-3 top-6 rounded-[28px]"
        style={{ backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.9)' }}
        aria-hidden
      />

      {/* 영상이 4:3 이라 폰에서도 같은 비율로 둬야 양 끝 자막이 잘리지 않는다 */}
      <div
        className="toss-card texture-grain relative aspect-[4/3] overflow-hidden rounded-[28px]"
        style={{
          backgroundColor: 'rgba(255,255,255,0.55)',
          border: '1px solid rgba(255,255,255,0.9)',
          transform: 'translateZ(0)',
        }}
      >
        <video
          poster={HERO_PROMO.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="퀴즈독 게임 소개 영상: 타워 디펜스, 인형뽑기, 좀비, 카페, 마피아 등 11가지 게임으로 퀴즈를 복습하는 장면"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={HERO_PROMO.webm} type="video/webm" />
          <source src={HERO_PROMO.mp4} type="video/mp4" />
        </video>

        {/* 상단 광택 라인 */}
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
          aria-hidden
        />
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
    <section className="relative px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-40" style={{ zIndex: 2 }}>
      <div className="mx-auto grid max-w-7xl items-center gap-10 sm:gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        {/* LEFT — 카피 · CTA */}
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 24 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="order-2 text-center lg:order-1 lg:text-left"
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
              <PixelAccent>퀴즈독</PixelAccent>과 함께
              <br />
              즐거운 수업시간
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
                <Image
                  src="/assets/icons/joystick-64.png"
                  alt=""
                  aria-hidden
                  width={64}
                  height={64}
                  unoptimized
                  className="h-6 w-6 object-contain"
                />
                시작하기
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
          className="order-1 lg:order-2"
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
