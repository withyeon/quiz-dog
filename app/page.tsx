'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import PawBackgroundDecor from '@/components/PawBackgroundDecor'
import HeroSection from '@/components/landing/HeroSection'
import HowItWorksSection from '@/components/landing/HowItWorksSection'
import GameLineupSection from '@/components/landing/GameLineupSection'
import FeatureIntroSection from '@/components/landing/FeatureIntroSection'
import { visibleGameModeCount } from '@/components/landing/gameModesData'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import Footer from '@/components/Footer'
import { gameAssets } from '@/assets/game-assets'
import { ArrowRight } from 'lucide-react'

export default function LandingPage() {
  const [chalkDust, setChalkDust] = useState<{ left: string; top: string; size: number; color: string }[]>([])
  const [animationsReady, setAnimationsReady] = useState(false)

  useEffect(() => {
    setAnimationsReady(true)
    setChalkDust(
      Array.from({ length: 24 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: i % 3 === 0 ? 4 : 2,
        color: ['rgba(255,255,255,0.6)', 'rgba(79,195,247,0.35)', 'rgba(30,58,138,0.18)'][i % 3],
      }))
    )
  }, [])

  return (
    <div className="min-h-dvh relative overflow-hidden font-bitbit bg-[#d9eef5]">
      <PawBackgroundDecor />

      {/* 분필 먼지 (Hero 섹션 안에서만 보임 — 아래 섹션에 영향 없게 absolute) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1, height: '100dvh' }}>
        {chalkDust.map((p, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{ left: p.left, top: p.top, width: p.size, height: p.size, backgroundColor: p.color }}
            animate={{ opacity: [0, 0.9, 0], y: [0, -50, -100], x: [0, (i % 2 ? 1 : -1) * 15] }}
            transition={{ duration: 6 + (i % 4), repeat: Infinity, delay: i * 0.35 }}
          />
        ))}
      </div>

      <div className="page-texture-overlay" aria-hidden />
      <Navbar />

      {/* ══ 1. Hero ═══════════════════════════════════════════ */}
      <HeroSection animationsReady={animationsReady} />

      {/* ══ 2. 3단계 사용법 ════════════════════════════════════ */}
      <HowItWorksSection animationsReady={animationsReady} />

      {/* ══ 3. 게임 라인업 ═════════════════════════════════════ */}
      <GameLineupSection animationsReady={animationsReady} />

      {/* ══ 4. 기능 소개 ═══════════════════════════════════════ */}
      <FeatureIntroSection gameModeCount={visibleGameModeCount} animationsReady={animationsReady} />

      {/* ══ 5. 마지막 CTA ══════════════════════════════════════ */}
      <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8" style={{ zIndex: 2 }}>
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={animationsReady ? { opacity: 0, scale: 0.96 } : false}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div
              className="overflow-hidden rounded-[28px]"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(226,232,240,0.9)',
                boxShadow: '0 8px 48px rgba(14,165,233,0.12), 0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="relative overflow-hidden px-6 py-12 sm:px-12 sm:py-14">
                <motion.div
                  className="mb-6 flex justify-center gap-4"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Image
                    src={gameAssets['mascot-pome'].tight}
                    alt="포메 마스코트"
                    width={90}
                    height={90}
                    unoptimized
                    className="pixelated h-[90px] w-[90px] object-contain"
                  />
                  <Image
                    src={gameAssets.mascot_sigol.tight}
                    alt="시골 마스코트"
                    width={90}
                    height={90}
                    unoptimized
                    className="pixelated h-[90px] w-[90px] object-contain"
                  />
                </motion.div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl">
                  <PixelHeading>
                    다음 수업은 <PixelAccent>게임</PixelAccent>으로
                  </PixelHeading>
                </h2>
                <p className="-mt-1 mb-8 text-base sm:text-lg" style={{ color: '#475569' }}>
                  가입도 결제도 없이, 지금 바로 문제 하나 만들어보세요
                </p>

                <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/teacher" className="w-full sm:w-auto">
                    <motion.span
                      whileHover={{ y: -3 }}
                      whileTap={{ y: 0 }}
                      className="flex w-full items-center justify-center gap-2 rounded-full px-9 py-4 text-lg font-black text-white sm:w-auto sm:px-12"
                      style={{
                        background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
                        boxShadow:
                          '0 6px 0 #0b8fc4, 0 12px 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
                        textShadow: '0 1px 0 rgba(0,0,0,0.18)',
                      }}
                    >
                      무료로 시작하기
                      <ArrowRight className="h-5 w-5" />
                    </motion.span>
                  </Link>
                  <Link href="/lobby" className="w-full sm:w-auto">
                    <motion.span
                      whileHover={{ y: -3 }}
                      whileTap={{ y: 0 }}
                      className="flex w-full items-center justify-center rounded-full px-8 py-4 text-lg font-black sm:w-auto"
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '2px solid #BAE6FD',
                        color: '#0369A1',
                        boxShadow: '0 5px 0 rgba(186,230,253,0.9), 0 10px 20px rgba(14,165,233,0.14)',
                      }}
                    >
                      학생 코드로 입장
                    </motion.span>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
