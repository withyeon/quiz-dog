'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/Navbar'
import GameShowcase from '@/components/GameShowcase'
import Footer from '@/components/Footer'
import AnimatedNumber from '@/components/AnimatedNumber'
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

const gameModesData = [
  { name: '해적왕의 보물찾기', emoji: '🏴‍☠️', color: 'from-yellow-300/60 to-orange-400/60', description: '황금을 모으며 보물을 찾아가는 모험' },
  { name: '등교 임파서블', emoji: '🏃', color: 'from-blue-300/60 to-cyan-400/60', description: '학교까지 장애물을 피하며 달리기' },
  { name: '눈싸움 대작전', emoji: '❄️', color: 'from-sky-200/60 to-blue-300/60', description: '눈덩이로 상대를 맞추는 배틀로얄' },
  { name: '인형뽑기', emoji: '🕹️', color: 'from-pink-300/60 to-rose-400/60', description: '운을 시험하는 짜릿한 뽑기 게임' },
  { name: '전설의 편의점', emoji: '🏪', color: 'from-green-300/60 to-emerald-400/60', description: '편의점을 경영하며 부자 되기' },
  { name: '달콤 바삭 카페', emoji: '☕', color: 'from-amber-300/60 to-orange-300/60', description: '카페를 운영하며 손님 맞이하기' },
  { name: '쉿! 마피아', emoji: '🕴️', color: 'from-slate-300/60 to-gray-400/60', description: '배신과 추리가 가득한 심리전' },
  { name: '타워 디펜스', emoji: '🏰', color: 'from-indigo-300/60 to-blue-400/60', description: '타워를 설치해 적을 막아내기' },
  { name: "Don't Look Down", emoji: '⛰️', color: 'from-teal-300/60 to-cyan-400/60', description: '정상을 향해 떨어지지 않고 등반' },
]

const testimonialsData = [
  { name: '김선생님', school: '서울 ○○초등학교', rating: 5, text: '학생들이 너무 좋아해요! 수업 참여도가 2배 이상 올랐습니다.', avatar: '👩‍🏫' },
  { name: '이선생님', school: '부산 ○○중학교', rating: 5, text: 'AI 문제 생성 기능이 정말 편리합니다. 시간이 많이 절약돼요!', avatar: '👨‍🏫' },
  { name: '박선생님', school: '대전 ○○고등학교', rating: 5, text: '다양한 게임 모드 덕분에 학생들이 지루해하지 않아요.', avatar: '👩‍🏫' },
]

export default function LandingPage() {
  const [particles, setParticles] = useState<Array<{ left: string; top: string }>>([])

  useEffect(() => {
    const newParticles = Array.from({ length: 35 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #dbeafe 0%, #bae6fd 25%, #e0f2fe 50%, #cffafe 75%, #eff6ff 100%)',
      }}
    >
      {/* Background ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-left big orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 600, height: 600,
            top: -180, left: -180,
            background: 'radial-gradient(circle, rgba(125,211,252,0.55) 0%, rgba(56,189,248,0.2) 50%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{ x: [0, 70, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Bottom-right orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 700, height: 700,
            bottom: -220, right: -220,
            background: 'radial-gradient(circle, rgba(147,197,253,0.5) 0%, rgba(186,230,253,0.2) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{ x: [0, -60, 0], y: [0, -50, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Center mid orb */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 450, height: 450,
            top: '38%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(186,230,253,0.6) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Top-right small accent */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 280, height: 280,
            top: '15%', right: '10%',
            background: 'radial-gradient(circle, rgba(103,232,249,0.4) 0%, transparent 70%)',
            filter: 'blur(35px)',
          }}
          animate={{ y: [0, -30, 0], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: particle.left,
              top: particle.top,
              width: i % 3 === 0 ? 4 : 2,
              height: i % 3 === 0 ? 4 : 2,
              background:
                i % 3 === 0
                  ? 'rgba(56,189,248,0.7)'
                  : i % 3 === 1
                    ? 'rgba(125,211,252,0.8)'
                    : 'rgba(255,255,255,0.9)',
            }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [0, -40, 0] }}
            transition={{
              duration: 4 + (i % 5),
              repeat: Infinity,
              delay: (i % 12) * 0.3,
            }}
          />
        ))}
      </div>

      <Navbar />

      {/* AI 기반 게이미피케이션 학습 플랫폼 배지 - 맨 위 (Navbar h-24 아래로 여백) */}
      <section className="relative pt-28 pb-2 px-4 flex justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 4px 24px rgba(56,189,248,0.2), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <Sparkles className="w-4 h-4 text-sky-500" />
          <span className="text-sm font-semibold text-sky-700 tracking-wide">AI 기반 게이미피케이션 학습 플랫폼</span>
        </motion.div>
      </section>

      <GameShowcase />

      {/* ─── Hero Section ─── */}
      <section className="relative pt-36 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Main Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-black mb-6 leading-tight"
              style={{
                background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 35%, #0ea5e9 70%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              수업을 게임으로<br />
              학습을 즐거움으로
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-sky-700/80 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              AI가 문제를 만들고, 학생들은 게임으로 배웁니다.<br />
              <span className="text-sky-500 font-semibold">퀴즈독</span>과 함께 교실을 재미의 공간으로 바꿔보세요.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-20"
            >
              <Link href="/teacher">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <button
                    className="inline-flex items-center gap-2 text-lg px-10 py-4 font-bold rounded-2xl text-white transition-all duration-300"
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 60%, #38bdf8 100%)',
                      boxShadow: '0 8px 32px rgba(14,165,233,0.45), 0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    <Zap className="h-5 w-5" />
                    무료로 시작하기
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </motion.div>
              </Link>
              <Link href="/pricing">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <button
                    className="inline-flex items-center gap-2 text-lg px-10 py-4 font-semibold rounded-2xl text-sky-700 transition-all duration-300"
                    style={{
                      background: 'rgba(255,255,255,0.5)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(255,255,255,0.85)',
                      boxShadow: '0 4px 24px rgba(56,189,248,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                  >
                    <Trophy className="h-5 w-5 text-amber-400" />
                    요금제 보기
                  </button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="relative inline-block"
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(ellipse, rgba(56,189,248,0.3) 0%, rgba(125,211,252,0.15) 50%, transparent 70%)',
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
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section className="py-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { value: 1250, label: '활성 선생님', icon: Users, accent: '#0ea5e9' },
              { value: 45000, label: '생성된 문제', icon: Brain, accent: '#06b6d4' },
              { value: 280000, label: '참여한 학생', icon: Sparkles, accent: '#f59e0b' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="relative"
              >
                <div
                  className="relative rounded-3xl p-8 text-center overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 8px 32px rgba(14,165,233,0.12), inset 0 1px 0 rgba(255,255,255,1)',
                  }}
                >
                  <div className="absolute inset-x-4 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }} />
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: `${stat.accent}18`,
                      border: `1px solid ${stat.accent}30`,
                      boxShadow: `0 4px 16px ${stat.accent}25`,
                    }}
                  >
                    <stat.icon className="w-7 h-7" style={{ color: stat.accent }} />
                  </div>
                  <div className="text-4xl font-black mb-2" style={{ color: '#0369a1' }}>
                    <AnimatedNumber value={stat.value} suffix="+" />
                  </div>
                  <div className="font-medium text-sky-600/70">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: '#0369a1' }}>강력한 기능</h2>
            <p className="text-lg text-sky-600/70">AI 기반 문제 생성부터 실시간 게임까지, 모든 것이 한 곳에</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI 문제 생성',
                description: '유튜브, PDF, 텍스트를 업로드하면 AI가 자동으로 퀴즈를 생성',
                features: ['유튜브 자막 추출', 'PDF 문서 분석', '다양한 문제 유형'],
                accent: '#0ea5e9',
              },
              {
                icon: Gamepad2,
                title: '9가지 게임 모드',
                description: '다양한 게임으로 학생들의 참여를 극대화',
                features: ['실시간 대결', '팀 플레이', '개인 미션'],
                accent: '#06b6d4',
              },
              {
                icon: BarChart3,
                title: '상세 리포트',
                description: '학생별 성취도와 문제별 정답률을 한눈에',
                features: ['실시간 통계', '엑셀 다운로드', '개인별 분석'],
                accent: '#10b981',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -8 }}
                className="group"
              >
                <div
                  className="h-full rounded-3xl p-8 relative overflow-hidden transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.45)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 8px 32px rgba(14,165,233,0.10), inset 0 1px 0 rgba(255,255,255,1)',
                  }}
                >
                  <div className="absolute inset-x-4 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)' }} />
                  <div
                    className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-30 group-hover:opacity-50 transition-opacity duration-300"
                    style={{ background: `radial-gradient(circle, ${feature.accent}60 0%, transparent 70%)`, filter: 'blur(20px)' }}
                  />
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 relative z-10"
                    style={{
                      background: `${feature.accent}18`,
                      border: `1px solid ${feature.accent}35`,
                      boxShadow: `0 4px 20px ${feature.accent}25`,
                    }}
                  >
                    <feature.icon className="w-7 h-7" style={{ color: feature.accent }} />
                  </div>
                  <h3 className="text-2xl font-bold mb-3 relative z-10" style={{ color: '#0369a1' }}>{feature.title}</h3>
                  <p className="text-sky-700/60 mb-6 relative z-10 leading-relaxed">{feature.description}</p>
                  <ul className="space-y-2.5 relative z-10">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-sky-700/60">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: feature.accent }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Game Modes Section ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: '#0369a1' }}>9가지 게임 모드</h2>
            <p className="text-lg text-sky-600/70">학생들이 즐기는 다양한 게임으로 학습 참여도 UP!</p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {gameModesData.map((game, index) => (
              <motion.div
                key={game.name}
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ scale: 1.04, y: -4 }}
                className="group cursor-pointer"
              >
                <div
                  className="relative overflow-hidden rounded-2xl p-6 transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.45)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 4px 20px rgba(14,165,233,0.08), inset 0 1px 0 rgba(255,255,255,1)',
                  }}
                >
                  <div className="absolute inset-x-3 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }} />
                  <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${game.color} rounded-full blur-2xl opacity-70 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className="text-4xl mb-3">{game.emoji}</div>
                    <h3 className="text-base font-bold mb-1.5 leading-snug" style={{ color: '#0369a1' }}>{game.name}</h3>
                    <p className="text-xs text-sky-600/60 leading-relaxed">{game.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials Section ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-4" style={{ color: '#0369a1' }}>선생님들의 후기</h2>
            <p className="text-lg text-sky-600/70">이미 많은 선생님들이 퀴즈독과 함께하고 있습니다</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonialsData.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -6 }}
              >
                <div
                  className="h-full rounded-3xl p-7 relative overflow-hidden transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 8px 32px rgba(14,165,233,0.10), inset 0 1px 0 rgba(255,255,255,1)',
                  }}
                >
                  <div className="absolute inset-x-4 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)' }} />
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sky-800/70 mb-6 italic leading-relaxed text-sm">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                      style={{
                        background: 'rgba(186,230,253,0.5)',
                        border: '1px solid rgba(125,211,252,0.5)',
                      }}
                    >
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-sky-800 text-sm">{testimonial.name}</div>
                      <div className="text-xs text-sky-600/60">{testimonial.school}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div
              className="rounded-3xl p-14 relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.5)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: '1px solid rgba(255,255,255,0.9)',
                boxShadow: '0 20px 60px rgba(14,165,233,0.2), inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              <div className="absolute inset-x-8 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,1), transparent)' }} />
              <div
                className="absolute inset-0 opacity-40"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(125,211,252,0.5) 0%, transparent 60%)' }}
              />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-black mb-6" style={{ color: '#0369a1' }}>지금 바로 시작하세요</h2>
                <p className="text-lg text-sky-700/60 mb-10">무료로 시작하고, 언제든 업그레이드하세요</p>
                <Link href="/teacher">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="inline-block">
                    <button
                      className="inline-flex items-center gap-2 text-lg px-12 py-4 font-bold rounded-2xl text-white transition-all duration-300"
                      style={{
                        background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 60%, #38bdf8 100%)',
                        boxShadow: '0 8px 32px rgba(14,165,233,0.5), 0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.35)',
                      }}
                    >
                      <Sparkles className="h-5 w-5" />
                      무료로 시작하기
                    </button>
                  </motion.div>
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
