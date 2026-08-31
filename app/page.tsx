'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import PawBackgroundDecor from '@/components/PawBackgroundDecor'
import FeatureIntroSection from '@/components/landing/FeatureIntroSection'
import { gameModesData, visibleGameModeCount } from '@/components/landing/gameModesData'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import GameShowcase from '@/components/GameShowcase'
import Footer from '@/components/Footer'
import AnimatedNumber from '@/components/AnimatedNumber'
import { gameAssets } from '@/assets/game-assets'
import {
  Sparkles,
  Brain,
  Gamepad2,
  BarChart3,
  Zap,
  Users,
  CheckCircle2,
  ArrowRight,
  Trophy,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
   픽셀 스타일 버튼
───────────────────────────────────────────────────────────── */
function PixelButton({
  children,
  color = 'blue',
  className = '',
  onClick,
}: {
  children: React.ReactNode
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'sky'
  className?: string
  onClick?: () => void
}) {
  const colorMap = {
    blue: {
      bg: '#2E7BD4',
      border: '#1A4F9C',
      shadow: '#0D2E6B',
      hover: '#3A8FE8',
      text: '#FFFFFF',
    },
    green: {
      bg: '#2D9E5E',
      border: '#1A6B3A',
      shadow: '#0D4022',
      hover: '#38B870',
      text: '#FFFFFF',
    },
    orange: {
      bg: '#E87A1A',
      border: '#A85210',
      shadow: '#6B3008',
      hover: '#F5921A',
      text: '#FFFFFF',
    },
    purple: {
      bg: '#7B4FCC',
      border: '#4F2F9A',
      shadow: '#2D1860',
      hover: '#9060E0',
      text: '#FFFFFF',
    },
    sky: {
      bg: '#0ea5e9',
      border: '#0284c7',
      shadow: '#0369a1',
      hover: '#38bdf8',
      text: '#FFFFFF',
    },
  }
  const c = colorMap[color]
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ y: 2, scale: 0.98 }}
      className={`relative font-black text-white rounded-lg px-6 py-3 transition-colors ${className}`}
      style={{
        backgroundColor: c.bg,
        border: `3px solid ${c.border}`,
        boxShadow: `0 5px 0 ${c.shadow}, 0 8px 20px rgba(0,0,0,0.25)`,
        fontFamily: "'DNFBitBitv2', sans-serif",
        color: c.text,
        textShadow: `0 2px 0 ${c.shadow}`,
      }}
    >
      {children}
    </motion.button>
  )
}

/* ─────────────────────────────────────────────────────────────
   픽셀 패널 (게임 UI 느낌 테두리)
───────────────────────────────────────────────────────────── */
function PixelPanel({
  children,
  label,
  labelColor = '#C17B3A',
  className = '',
}: {
  children: React.ReactNode
  label?: string
  labelColor?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <div
          className="absolute -top-4 left-4 px-4 py-1 rounded-lg font-black text-sm text-white z-10"
          style={{
            backgroundColor: labelColor,
            border: `3px solid rgba(0,0,0,0.2)`,
            fontFamily: "'DNFBitBitv2', sans-serif",
            boxShadow: '0 3px 0 rgba(0,0,0,0.2)',
          }}
        >
          {label}
        </div>
      )}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,248,235,0.92)',
          border: '3px solid rgba(193,123,58,0.35)',
          boxShadow:
            '0 6px 0 rgba(91,58,26,0.2), 0 12px 32px rgba(91,58,26,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [chalkDust, setChalkDust] = useState<{ left: string; top: string; size: number; color: string }[]>([])
  const [activeFeature, setActiveFeature] = useState(0)
  const [animationsReady, setAnimationsReady] = useState(false)

  useEffect(() => {
    setAnimationsReady(true)
    setChalkDust(
      Array.from({ length: 24 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: i % 3 === 0 ? 4 : 2,
        color: ['rgba(255,255,255,0.6)', 'rgba(193,123,58,0.35)', 'rgba(255,215,0,0.4)'][i % 3],
      }))
    )
  }, [])

  return (
    <div
      className="min-h-dvh relative overflow-hidden font-bitbit bg-[#d9eef5]"
    >
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

      <div className="relative z-10 h-12" aria-hidden />

      {/* ══ GameShowcase ══════════════════════════════════════ */}
      <div className="relative z-10">
        <GameShowcase />
      </div>

      <FeatureIntroSection gameModeCount={visibleGameModeCount} animationsReady={animationsReady} />

      {/* ══ Game Modes Grid ═══════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={animationsReady ? { opacity: 0, y: 20 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="mb-4 text-4xl sm:text-5xl">
              <PixelHeading>
                <PixelAccent>{visibleGameModeCount}가지</PixelAccent> 게임 모드
              </PixelHeading>
            </h2>
            <p className="text-lg mt-2" style={{ color: '#475569', fontFamily: "'DNFBitBitv2', sans-serif" }}>
              학생들이 즐기는 다양한 게임으로 학습 참여도 UP!
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gameModesData.map((game, index) => (
              <motion.div
                key={game.name}
                initial={animationsReady ? { opacity: 0, scale: 0.9 } : false}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ scale: 1.04, y: -4 }}
                className="cursor-pointer group"
              >
                <div
                  className="rounded-2xl p-5 transition-all duration-300"
                  style={{
                    backgroundColor: 'transparent',
                    borderTop: `3px solid ${game.color}`,
                  }}
                >
                  {game.titleImage && (
                    <Image
                      src={game.titleImage}
                      alt={game.name}
                      width={540}
                      height={180}
                      className="mb-4 h-40 w-full object-contain md:h-44"
                    />
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                    {game.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Final CTA ═════════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={animationsReady ? { opacity: 0, scale: 0.95 } : false}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: '#FFFFFF',
                boxShadow: '0 8px 48px rgba(14,165,233,0.12), 0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div className="p-14 relative overflow-hidden">
                {/* 강아지 CTA 장식 */}
                <motion.div
                  className="flex justify-center mb-6 gap-4"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Image
                    src={gameAssets['mascot-pome'].tight}
                    alt="포메 마스코트"
                    width={90}
                    height={90}
                    unoptimized
                    className="h-[90px] w-[90px] object-contain pixelated"
                  />
                  <Image
                    src={gameAssets.mascot_sigol.tight}
                    alt="시골 마스코트"
                    width={90}
                    height={90}
                    unoptimized
                    className="h-[90px] w-[90px] object-contain pixelated"
                  />
                </motion.div>

                <h2
                  className="text-4xl md:text-5xl font-black mb-10"
                  style={{ color: '#0F172A', fontFamily: "'DNFBitBitv2', sans-serif" }}
                >
                  지금 바로 시작하세요!
                </h2>
                <Link href="/teacher" className="inline-block">
                  <motion.span
                    whileHover={{ y: -3, scale: 1.02 }}
                    whileTap={{ y: 0, scale: 0.98 }}
                    className="inline-flex items-center gap-3 rounded-full px-10 py-4 text-lg font-bold text-white sm:px-14 sm:py-5 sm:text-xl"
                    style={{
                      background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 40%, #0ea5e9 100%)',
                      boxShadow:
                        '0 8px 24px rgba(14, 165, 233, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.45)',
                      fontFamily: "'DNFBitBitv2', sans-serif",
                    }}
                  >
                    <Sparkles className="h-6 w-6 shrink-0" />
                    무료로 시작하기
                  </motion.span>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
