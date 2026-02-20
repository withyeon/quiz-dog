'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navbar from '@/components/Navbar'
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
  Target,
} from 'lucide-react'

const gameModesData = [
  { name: '해적왕의 보물찾기', emoji: '🏴‍☠️', color: 'from-yellow-400 to-orange-500', description: '황금을 모으며 보물을 찾아가는 모험' },
  { name: '등교 임파서블', emoji: '🏃', color: 'from-blue-400 to-cyan-500', description: '학교까지 장애물을 피하며 달리기' },
  { name: '눈싸움 대작전', emoji: '❄️', color: 'from-sky-300 to-blue-400', description: '눈덩이로 상대를 맞추는 배틀로얄' },
  { name: '인형뽑기', emoji: '🕹️', color: 'from-pink-400 to-rose-500', description: '운을 시험하는 짜릿한 뽑기 게임' },
  { name: '전설의 편의점', emoji: '🏪', color: 'from-green-400 to-emerald-500', description: '편의점을 경영하며 부자 되기' },
  { name: '달콤 바삭 카페', emoji: '☕', color: 'from-amber-400 to-orange-400', description: '카페를 운영하며 손님 맞이하기' },
  { name: '쉿! 마피아', emoji: '🕴️', color: 'from-gray-700 to-gray-900', description: '배신과 추리가 가득한 심리전' },
  { name: '타워 디펜스', emoji: '🏰', color: 'from-indigo-400 to-blue-500', description: '타워를 설치해 적을 막아내기' },
  { name: 'Don\'t Look Down', emoji: '⛰️', color: 'from-teal-400 to-cyan-600', description: '정상을 향해 떨어지지 않고 등반' },
]

const testimonialsData = [
  { name: '김선생님', school: '서울 ○○초등학교', rating: 5, text: '학생들이 너무 좋아해요! 수업 참여도가 2배 이상 올랐습니다.', avatar: '👩‍🏫' },
  { name: '이선생님', school: '부산 ○○중학교', rating: 5, text: 'AI 문제 생성 기능이 정말 편리합니다. 시간이 많이 절약돼요!', avatar: '👨‍🏫' },
  { name: '박선생님', school: '대전 ○○고등학교', rating: 5, text: '다양한 게임 모드 덕분에 학생들이 지루해하지 않아요.', avatar: '👩‍🏫' },
]

export default function LandingPage() {
  const [particles, setParticles] = useState<Array<{ left: string; top: string }>>([])

  // Initialize particles only on client-side to prevent hydration mismatch
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full h-full bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-blue-500/20 animate-gradient-shift" />
        <motion.div
          className="absolute top-0 left-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: particle.left,
              top: particle.top,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              y: [0, -30, 0],
            }}
            transition={{
              duration: 3 + (i % 5),
              repeat: Infinity,
              delay: (i % 10) * 0.2,
            }}
          />
        ))}
      </div>

      <Navbar />

      {/* Hero Section - Modern Design */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white mb-8"
            >
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-semibold">AI 기반 게이미피케이션 학습 플랫폼</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-white via-blue-200 to-cyan-200 bg-clip-text text-transparent leading-tight"
            >
              수업을 게임으로<br />
              학습을 즐거움으로
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              AI가 문제를 만들고, 학생들은 게임으로 배웁니다.<br />
              <span className="text-cyan-300 font-semibold">퀴즈독</span>과 함께 교실을 재미의 공간으로 바꿔보세요.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <Link href="/teacher">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" className="text-lg px-12 py-7 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-2xl shadow-blue-500/50">
                    <Zap className="mr-2 h-5 w-5" />
                    무료로 시작하기
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <Link href="/pricing">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="lg" variant="outline" className="text-lg px-12 py-7 border-2 border-white/30 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 font-semibold rounded-xl">
                    <Trophy className="mr-2 h-5 w-5" />
                    요금제 보기
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-3xl rounded-full" />
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

      {/* Stats Section */}
      <section className="py-16 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { value: 1250, label: '활성 선생님', icon: Users, color: 'from-blue-400 to-cyan-500' },
              { value: 45000, label: '생성된 문제', icon: Brain, color: 'from-blue-400 to-cyan-500' },
              { value: 280000, label: '참여한 학생', icon: Sparkles, color: 'from-yellow-400 to-orange-500' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl" />
                <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center hover:border-white/20 transition-all">
                  <div className={`w-16 h-16 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                    <stat.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-4xl font-black text-white mb-2">
                    <AnimatedNumber value={stat.value} suffix="+" />
                  </div>
                  <div className="text-gray-300 font-medium">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Glassmorphism */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              강력한 기능
            </h2>
            <p className="text-xl text-gray-300">
              AI 기반 문제 생성부터 실시간 게임까지, 모든 것이 한 곳에
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: 'AI 문제 생성',
                description: '유튜브, PDF, 텍스트를 업로드하면 AI가 자동으로 퀴즈를 생성',
                features: ['유튜브 자막 추출', 'PDF 문서 분석', '다양한 문제 유형'],
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Gamepad2,
                title: '9가지 게임 모드',
                description: '다양한 게임으로 학생들의 참여를 극대화',
                features: ['실시간 대결', '팀 플레이', '개인 미션'],
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: BarChart3,
                title: '상세 리포트',
                description: '학생별 성취도와 문제별 정답률을 한눈에',
                features: ['실시간 통계', '엑셀 다운로드', '개인별 분석'],
                color: 'from-green-500 to-emerald-500',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -10, rotateY: 5 }}
                className="group"
              >
                <div className="h-full bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-300 mb-6">{feature.description}</p>
                  <ul className="space-y-2">
                    {feature.features.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-gray-400">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
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

      {/* Game Modes Showcase */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              9가지 게임 모드
            </h2>
            <p className="text-xl text-gray-300">
              학생들이 즐기는 다양한 게임으로 학습 참여도 UP!
            </p>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {gameModesData.map((game, index) => (
              <motion.div
                key={game.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -5 }}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 hover:bg-white/10 hover:border-white/20 transition-all">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${game.color} opacity-20 blur-2xl group-hover:opacity-30 transition-opacity`} />
                  <div className="relative z-10">
                    <div className="text-5xl mb-3">{game.emoji}</div>
                    <h3 className="text-lg font-bold text-white mb-2">{game.name}</h3>
                    <p className="text-sm text-gray-400">{game.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              선생님들의 후기
            </h2>
            <p className="text-xl text-gray-300">
              이미 많은 선생님들이 퀴즈독과 함께하고 있습니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonialsData.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="h-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-6 italic">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{testimonial.avatar}</div>
                    <div>
                      <div className="font-bold text-white">{testimonial.name}</div>
                      <div className="text-sm text-gray-400">{testimonial.school}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-black/20" />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
                  지금 바로 시작하세요
                </h2>
                <p className="text-xl text-white/90 mb-8">
                  무료로 시작하고, 언제든 업그레이드하세요
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/teacher">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button size="lg" className="text-lg px-12 py-7 bg-white text-blue-600 hover:bg-gray-100 font-bold rounded-xl shadow-2xl">
                        <Sparkles className="mr-2 h-5 w-5" />
                        무료로 시작하기
                      </Button>
                    </motion.div>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />

      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-shift {
          background-size: 200% 200%;
          animation: gradient-shift 15s ease infinite;
        }
      `}</style>
    </div>
  )
}
