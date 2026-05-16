'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import GameShowcase from '@/components/GameShowcase'
import Footer from '@/components/Footer'
import AnimatedNumber from '@/components/AnimatedNumber'
import { DogGroup, ShibaDog, BeretDog } from '@/components/PixelDogs'
import {
  Sparkles,
  Brain,
  Gamepad2,
  BarChart3,
  Zap,
  Users,
  CheckCircle2,
  ArrowRight,
  Star,
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
  color?: 'blue' | 'green' | 'orange' | 'purple'
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
        fontFamily: "'BMJUA', sans-serif",
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
            fontFamily: "'BMJUA', sans-serif",
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
   교실 배경 SVG
───────────────────────────────────────────────────────────── */
function ClassroomBg() {
  return (
    <svg
      viewBox="0 0 1200 500"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'crisp-edges' }}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* 벽 */}
      <rect width="1200" height="500" fill="#F2E4C8" />
      {/* 벽 패널 선 */}
      {[100, 200, 300, 400].map((y) => (
        <line key={y} x1="0" y1={y} x2="1200" y2={y} stroke="#DDD0B0" strokeWidth="2" />
      ))}
      {/* 바닥 */}
      <rect y="400" width="1200" height="100" fill="#C4923A" />
      {[0, 150, 300, 450, 600, 750, 900, 1050, 1200].map((x) => (
        <line key={x} x1={x} y1="400" x2={x} y2="500" stroke="#A87020" strokeWidth="2" />
      ))}
      {/* 칠판 */}
      <rect x="200" y="30" width="800" height="300" rx="4" fill="#3A2010" />
      <rect x="212" y="42" width="776" height="276" rx="2" fill="#2A6040" />
      {/* 칠판 반사 */}
      <rect x="212" y="42" width="776" height="10" fill="rgba(255,255,255,0.07)" />
      {/* 칠판 분필 낙서 */}
      <text x="260" y="120" fill="rgba(255,255,255,0.2)" fontSize="22" fontFamily="monospace">x² + y² = r²</text>
      <text x="550" y="180" fill="rgba(255,255,255,0.15)" fontSize="18" fontFamily="monospace">🐶 + 퀴즈 = 😁</text>
      <text x="280" y="250" fill="rgba(255,255,255,0.18)" fontSize="16" fontFamily="monospace">정답률 ████████░ 80%</text>
      {/* 분필 트레이 */}
      <rect x="200" y="328" width="800" height="16" rx="3" fill="#2A1408" />
      {[220, 255, 290, 325].map((x, i) => (
        <rect key={i} x={x} y={330} width={25} height={10} rx="2"
          fill={['#FDFBF5', '#FFB0B0', '#B0D4FF', '#FFFAB0'][i]} />
      ))}
      {/* 창문 왼쪽 */}
      <rect x="20" y="60" width="140" height="200" rx="4" fill="#8BD0F0" opacity="0.8" />
      <rect x="20" y="60" width="140" height="200" rx="4" fill="none" stroke="#6A501A" strokeWidth="5" />
      <line x1="90" y1="60" x2="90" y2="260" stroke="#6A501A" strokeWidth="4" />
      <line x1="20" y1="160" x2="160" y2="160" stroke="#6A501A" strokeWidth="4" />
      {/* 창 빛 */}
      <rect x="25" y="65" width="60" height="90" fill="rgba(255,255,255,0.25)" rx="2" />
      {/* 창문 오른쪽 */}
      <rect x="1040" y="60" width="140" height="200" rx="4" fill="#8BD0F0" opacity="0.8" />
      <rect x="1040" y="60" width="140" height="200" rx="4" fill="none" stroke="#6A501A" strokeWidth="5" />
      <line x1="1110" y1="60" x2="1110" y2="260" stroke="#6A501A" strokeWidth="4" />
      <line x1="1040" y1="160" x2="1180" y2="160" stroke="#6A501A" strokeWidth="4" />
      <rect x="1045" y="65" width="60" height="90" fill="rgba(255,255,255,0.25)" rx="2" />
      {/* 책상들 */}
      {[100, 380, 660, 940].map((x) => (
        <g key={x}>
          <rect x={x} y="380" width="160" height="24" rx="4" fill="#C4813A" />
          <rect x={x + 20} y="404" width="12" height="36" rx="2" fill="#8B5A1A" />
          <rect x={x + 128} y="404" width="12" height="36" rx="2" fill="#8B5A1A" />
        </g>
      ))}
      {/* 선생님 책상 */}
      <rect x="470" y="350" width="260" height="28" rx="4" fill="#8B4513" />
      <rect x="490" y="378" width="16" height="42" rx="3" fill="#6B3010" />
      <rect x="714" y="378" width="16" height="42" rx="3" fill="#6B3010" />
      {/* 시계 */}
      <circle cx="600" cy="28" r="22" fill="#FFF8F0" stroke="#8B4513" strokeWidth="3" />
      <line x1="600" y1="28" x2="600" y2="16" stroke="#3B1F0A" strokeWidth="2" />
      <line x1="600" y1="28" x2="609" y2="34" stroke="#3B1F0A" strokeWidth="2" />
    </svg>
  )
}

/* ─────────────────────────────────────────────────────────────
   데이터
───────────────────────────────────────────────────────────── */
const gameModesData = [
  { name: '해적왕의 보물찾기', titleImage: '/title/gold-quest.svg', emoji: '🏴‍☠️', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', description: '황금을 모으며 보물을 찾는 모험' },
  { name: '눈싸움 대작전', titleImage: '/title/battle-royale.svg', emoji: '❄️', color: '#38BDF8', bg: 'rgba(56,189,248,0.15)', description: '눈덩이로 상대를 맞추는 배틀' },
  { name: '인형뽑기', emoji: '🕹️', color: '#EC4899', bg: 'rgba(236,72,153,0.15)', description: '희귀 아이템을 노려라!' },
  { name: '전설의 편의점', titleImage: '/title/factory.svg', emoji: '🏪', color: '#10B981', bg: 'rgba(16,185,129,0.15)', description: '편의점 경영 부자 되기' },
  { name: '달콤 바삭 카페', titleImage: '/title/cafe.svg', emoji: '☕', color: '#F97316', bg: 'rgba(249,115,22,0.15)', description: '카페 운영 최고 점수 달성' },
  { name: '쉿! 마피아', titleImage: '/title/mafia.svg', emoji: '🕴️', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', description: '배신과 추리의 심리전' },
  { name: '타워 디펜스', titleImage: '/title/tower-defense.svg', emoji: '🏰', color: '#6366F1', bg: 'rgba(99,102,241,0.15)', description: '타워로 적을 막아내기' },
  { name: "Don't Look Down", emoji: '⛰️', color: '#14B8A6', bg: 'rgba(20,184,166,0.15)', description: '떨어지지 않고 정상 등반' },
]
const visibleGameModeCount = gameModesData.length

const testimonialsData = [
  { name: '김선생님', school: '서울 ○○초등학교', rating: 5, text: '학생들이 너무 좋아해요! 수업 참여도가 2배 이상 올랐습니다.', avatar: '👩‍🏫' },
  { name: '이선생님', school: '부산 ○○중학교', rating: 5, text: 'AI 문제 생성 기능이 정말 편리합니다. 시간이 많이 절약돼요!', avatar: '👨‍🏫' },
  { name: '박선생님', school: '대전 ○○고등학교', rating: 5, text: '다양한 게임 모드 덕분에 학생들이 지루해하지 않아요.', avatar: '👩‍🏫' },
]

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
      className="min-h-screen relative overflow-hidden"
      style={{ backgroundImage: 'linear-gradient(160deg, #FFF3DC 0%, #FFE8C0 40%, #FFF0D0 70%, #FDEBC8 100%)' }}
    >
      {/* 분필 먼지 (Hero 섹션 안에서만 보임 — 아래 섹션에 영향 없게 absolute) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1, height: '100vh' }}>
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

      {/* ══ 배지 ══════════════════════════════════════════════ */}
      <section className="relative pt-28 pb-2 px-4 flex justify-center z-10">
        <motion.div
          initial={animationsReady ? { scale: 0.8, opacity: 0 } : false}
          animate={animationsReady ? { scale: 1, opacity: 1 } : undefined}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.88)',
            border: '3px solid rgba(193,123,58,0.3)',
            boxShadow: '0 4px 0 rgba(91,58,26,0.15), 0 8px 20px rgba(91,58,26,0.1)',
            fontFamily: "'BMJUA', sans-serif",
          }}
        >
          <span className="text-base">🐶</span>
          <span className="text-sm font-bold" style={{ color: '#7B4B1A' }}>
            AI 기반 게이미피케이션 학습 플랫폼
          </span>
          <span className="text-base">✨</span>
        </motion.div>
      </section>

      {/* ══ GameShowcase ══════════════════════════════════════ */}
      <div className="relative z-10">
        <GameShowcase />
      </div>

      {/* ══ Hero Section ══════════════════════════════════════ */}
      <section className="relative py-16 px-4 sm:px-6 lg:px-8 overflow-hidden min-h-[560px]" style={{ zIndex: 2 }}>
        {/* 교실 배경 - Hero 섹션 내부에만 */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <ClassroomBg />
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(255,248,230,0.5)' }} />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center min-h-[480px]">
            {/* 왼쪽: 텍스트 + 버튼 */}
            <motion.div
              initial={animationsReady ? { opacity: 0, x: -30 } : false}
              animate={animationsReady ? { opacity: 1, x: 0 } : undefined}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10"
            >
              {/* 골드 타이틀 박스 */}
              <motion.div
                initial={animationsReady ? { opacity: 0, y: 20 } : false}
                animate={animationsReady ? { opacity: 1, y: 0 } : undefined}
                transition={{ delay: 0.3 }}
                className="inline-block mb-6 px-6 py-4 rounded-2xl"
                style={{
                  backgroundImage: 'linear-gradient(135deg, #8B4513 0%, #C17B3A 40%, #8B4513 100%)',
                  border: '4px solid #5B2D0A',
                  boxShadow: '0 6px 0 #3B1A05, 0 12px 30px rgba(91,45,10,0.4), inset 0 1px 0 rgba(255,200,80,0.4)',
                }}
              >
                <h1
                  className="text-4xl md:text-5xl xl:text-6xl font-black text-white leading-tight"
                  style={{
                    fontFamily: "'BMJUA', sans-serif",
                    textShadow: '0 3px 0 #3B1A05, 0 0 20px rgba(255,200,80,0.5)',
                    WebkitTextStroke: '1px rgba(255,200,80,0.3)',
                  }}
                >
                  수업을 게임으로!
                </h1>
                <p
                  className="text-xl md:text-2xl font-black mt-1"
                  style={{
                    fontFamily: "'BMJUA', sans-serif",
                    color: '#FFD700',
                    textShadow: '0 2px 0 rgba(91,45,10,0.5)',
                  }}
                >
                  퀴즈독 🐶
                </p>
              </motion.div>

              <motion.p
                className="text-lg md:text-xl mb-8 leading-relaxed"
                style={{
                  color: '#3B1F0A',
                  fontFamily: "'BMJUA', sans-serif",
                  textShadow: '0 1px 0 rgba(255,255,255,0.6)',
                }}
                initial={animationsReady ? { opacity: 0, y: 20 } : false}
                animate={animationsReady ? { opacity: 1, y: 0 } : undefined}
                transition={{ delay: 0.4 }}
              >
                AI가 문제를 만들고,<br />
                학생들은 게임으로 배웁니다! 🎓
              </motion.p>

              <motion.div
                className="flex flex-col sm:flex-row gap-4"
                initial={animationsReady ? { opacity: 0, y: 20 } : false}
                animate={animationsReady ? { opacity: 1, y: 0 } : undefined}
                transition={{ delay: 0.5 }}
              >
                <Link href="/teacher">
                  <PixelButton color="green" className="text-lg px-8 py-4 flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    무료로 시작하기
                    <ArrowRight className="h-5 w-5" />
                  </PixelButton>
                </Link>
                <Link href="/pricing">
                  <PixelButton color="orange" className="text-lg px-8 py-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    요금제 보기
                  </PixelButton>
                </Link>
              </motion.div>
            </motion.div>

            {/* 오른쪽: 강아지 3마리 */}
            <motion.div
              className="flex flex-col items-center justify-end relative"
              initial={animationsReady ? { opacity: 0, scale: 0.8 } : false}
              animate={animationsReady ? { opacity: 1, scale: 1 } : undefined}
              transition={{ duration: 0.8, delay: 0.4, type: 'spring', bounce: 0.3 }}
            >
              {/* 말풍선 */}
              <motion.div
                className="mb-4 px-5 py-3 rounded-2xl rounded-bl-none relative"
                style={{
                  backgroundColor: '#FFFBF2',
                  border: '3px solid #C17B3A',
                  boxShadow: '0 4px 0 rgba(91,58,26,0.2), 0 8px 20px rgba(91,58,26,0.15)',
                  fontFamily: "'BMJUA', sans-serif",
                  color: '#3B1F0A',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                우리랑 같이 공부하자! 🎓✨
                <div
                  className="absolute"
                  style={{
                    bottom: -14,
                    left: 20,
                    width: 0,
                    height: 0,
                    borderRight: '14px solid transparent',
                    borderLeft: '0',
                    borderTop: '14px solid #C17B3A',
                  }}
                />
                <div
                  className="absolute"
                  style={{
                    bottom: -10,
                    left: 23,
                    width: 0,
                    height: 0,
                    borderRight: '11px solid transparent',
                    borderTop: '11px solid #FFFBF2',
                  }}
                />
              </motion.div>

              {/* 강아지 그룹 */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <DogGroup size={110} />
              </motion.div>

              {/* 그림자 */}
              <div
                style={{
                  width: 320,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(91,58,26,0.18)',
                  filter: 'blur(12px)',
                  marginTop: 4,
                }}
              />
            </motion.div>
          </div>

          {/* 로고 */}
          <motion.div
            className="mt-12 flex justify-center"
            initial={animationsReady ? { opacity: 0, y: 20 } : false}
            animate={animationsReady ? { opacity: 1, y: 0 } : undefined}
            transition={{ delay: 0.7 }}
          >
            <div className="relative inline-block">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage: 'radial-gradient(ellipse, rgba(193,123,58,0.3) 0%, transparent 70%)',
                  filter: 'blur(40px)',
                  transform: 'scale(1.5)',
                }}
              />
              <Image
                src="/quizdog-logo.svg"
                alt="퀴즈독 로고"
                width={500}
                height={150}
                className="w-full max-w-md mx-auto relative z-10"
                priority
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ Stats Section ══════════════════════════════════════ */}
      <section className="py-16 relative" style={{ zIndex: 2 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { value: 1250, label: '활성 선생님', emoji: '👩‍🏫', color: 'blue' as const },
              { value: 45000, label: '생성된 문제', emoji: '🧠', color: 'green' as const },
              { value: 280000, label: '참여한 학생', emoji: '🐶', color: 'orange' as const },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={animationsReady ? { opacity: 0, y: 24 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -6, scale: 1.02 }}
              >
                <PixelPanel className="pt-4">
                  <div className="p-8 text-center">
                    <div className="text-5xl mb-3">{stat.emoji}</div>
                    <div
                      className="text-4xl font-black mb-2"
                      style={{ fontFamily: "'BMJUA', sans-serif", color: '#3B1F0A' }}
                    >
                      <AnimatedNumber value={stat.value} suffix="+" />
                    </div>
                    <div className="font-bold" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
                      {stat.label}
                    </div>
                  </div>
                </PixelPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Features Section ══════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={animationsReady ? { opacity: 0, y: 20 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-block mb-4">
              <PixelButton color="blue" className="text-3xl px-10 py-4 pointer-events-none">
                ✏️ 강력한 기능
              </PixelButton>
            </div>
            <p className="text-lg mt-4" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
              AI 기반 문제 생성부터 실시간 게임까지, 모든 것이 한 곳에
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                emoji: '🤖',
                title: 'AI 문제 생성',
                description: '유튜브, PDF, 텍스트를 업로드하면 AI가 자동으로 퀴즈를 생성',
                features: ['유튜브 자막 추출', 'PDF 문서 분석', '다양한 문제 유형'],
                color: 'blue' as const,
              },
              {
                emoji: '🎮',
                title: `${visibleGameModeCount}가지 게임 모드`,
                description: '다양한 게임으로 학생들의 참여를 극대화',
                features: ['실시간 대결', '팀 플레이', '개인 미션'],
                color: 'green' as const,
              },
              {
                emoji: '📊',
                title: '상세 리포트',
                description: '학생별 성취도와 문제별 정답률을 한눈에',
                features: ['실시간 통계', '엑셀 다운로드', '개인별 분석'],
                color: 'orange' as const,
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={animationsReady ? { opacity: 0, y: 30 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -8 }}
              >
                <PixelPanel label={feature.emoji + ' ' + feature.title} className="pt-8">
                  <div className="p-8 pt-6">
                    <p className="mb-6 leading-relaxed" style={{ color: '#5B3A1A', opacity: 0.85 }}>
                      {feature.description}
                    </p>
                    <ul className="space-y-3">
                      {feature.features.map((item) => (
                        <li key={item} className="flex items-center gap-3 font-bold" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
                          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      <PixelButton color={feature.color} className="w-full text-base py-3">
                        자세히 보기 →
                      </PixelButton>
                    </div>
                  </div>
                </PixelPanel>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Game Modes Grid ═══════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={animationsReady ? { opacity: 0, y: 20 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-block mb-4">
              <PixelButton color="purple" className="text-3xl px-10 py-4 pointer-events-none">
                {`🎮 ${visibleGameModeCount}가지 게임 모드`}
              </PixelButton>
            </div>
            <p className="text-lg mt-4" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
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
                    backgroundColor: game.bg,
                    border: `3px solid ${game.color}40`,
                    boxShadow: `0 5px 0 ${game.color}30, 0 8px 20px rgba(0,0,0,0.08)`,
                  }}
                >
                  {game.titleImage && (
                    <Image
                      src={game.titleImage}
                      alt={game.name}
                      width={540}
                      height={180}
                      className="mb-4 h-32 w-full object-contain md:h-36"
                    />
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: '#7B4B1A', opacity: 0.8 }}>
                    {game.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Testimonials ══════════════════════════════════════ */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={animationsReady ? { opacity: 0, y: 20 } : false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2
              className="text-4xl md:text-5xl font-black mb-4"
              style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}
            >
              ⭐ 선생님들의 후기
            </h2>
            <p className="text-lg" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
              이미 많은 선생님들이 퀴즈독과 함께하고 있습니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonialsData.map((t, index) => (
              <motion.div
                key={t.name}
                initial={animationsReady ? { opacity: 0, y: 20 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -6 }}
              >
                <PixelPanel>
                  <div className="p-7">
                    <div className="flex items-center gap-1 mb-4">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="mb-6 italic leading-relaxed text-sm" style={{ color: '#5B3A1A' }}>
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                        style={{
                          backgroundColor: 'rgba(193,123,58,0.15)',
                          border: '3px solid rgba(193,123,58,0.3)',
                        }}
                      >
                        {t.avatar}
                      </div>
                      <div>
                        <div className="font-black text-sm" style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}>
                          {t.name}
                        </div>
                        <div className="text-xs" style={{ color: '#7B4B1A', opacity: 0.7 }}>
                          {t.school}
                        </div>
                      </div>
                    </div>
                  </div>
                </PixelPanel>
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
            <PixelPanel>
              <div className="p-14 relative overflow-hidden">
                {/* 강아지 CTA 장식 */}
                <motion.div
                  className="flex justify-center mb-6 gap-4"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ShibaDog size={90} />
                  <BeretDog size={90} />
                </motion.div>

                <h2
                  className="text-4xl md:text-5xl font-black mb-4"
                  style={{ color: '#3B1F0A', fontFamily: "'BMJUA', sans-serif" }}
                >
                  지금 바로 시작하세요! 🎓
                </h2>
                <p className="text-lg mb-10" style={{ color: '#7B4B1A', fontFamily: "'BMJUA', sans-serif" }}>
                  무료로 시작하고, 언제든 업그레이드하세요
                </p>
                <Link href="/teacher">
                  <PixelButton color="green" className="text-xl px-14 py-5 inline-flex items-center gap-3">
                    <Sparkles className="h-6 w-6" />
                    무료로 시작하기
                  </PixelButton>
                </Link>
              </div>
            </PixelPanel>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
