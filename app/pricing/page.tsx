'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Check, Crown } from 'lucide-react'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/* ─── 버튼 ─── */
function PlanButton({
  children,
  href,
  color = 'blue',
  className = '',
}: {
  children: React.ReactNode
  href: string
  color?: 'blue' | 'purple'
  className?: string
}) {
  const c = {
    blue:   { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', shadow: 'rgba(59,130,246,0.35)' },
    purple: { bg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', shadow: 'rgba(124,58,237,0.35)' },
  }[color]
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ scale: 1.02, opacity: 0.92 }}
        whileTap={{ scale: 0.98 }}
        className={`cursor-pointer text-center font-black text-white rounded-xl px-6 py-3.5 text-base ${className}`}
        style={{
          background: c.bg,
          boxShadow: `0 4px 20px ${c.shadow}`,
          fontFamily: "'DNFBitBitv2', sans-serif",
        }}
      >
        {children}
      </motion.div>
    </Link>
  )
}

/* ─── 요금제 데이터 ─── */
const PLANS = [
  {
    name: 'Free',
    emoji: '🐾',
    originalPrice: null,
    price: '₩0',
    period: '월',
    description: '체험용 · 소규모 수업',
    features: [
      '월 AI 문제 생성 400회',
      '기본 게임 모드',
      '실시간 순위표',
      '기본 리포트',
    ],
    cta: '무료로 시작',
    href: '/teacher',
    popular: false,
    badgeLabel: null,
    topGradient: 'linear-gradient(90deg, #94A3B8, #CBD5E1)',
    cardBg: '#FFFFFF',
    glowRgb: '148,163,184',
    accentColor: '#64748B',
    buttonColor: 'blue' as const,
  },
  {
    name: 'Pro',
    emoji: '⚡',
    originalPrice: '₩4,900',
    price: '₩0',
    period: '월',
    description: '고학년 · AI 심화 수업',
    features: [
      'AI 문제 생성 무제한',
      '학생 최대 100명 동시 접속',
      '엑셀 리포트 다운로드',
      '고급 통계 분석',
      '우선 고객 지원',
      '커스텀 브랜딩',
    ],
    cta: '지금 무료로 사용',
    href: '/teacher',
    popular: false,
    badgeLabel: null,
    topGradient: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
    cardBg: '#FFFFFF',
    glowRgb: '59,130,246',
    accentColor: '#2563EB',
    buttonColor: 'blue' as const,
  },
  {
    name: 'Pro 연간',
    emoji: '👑',
    originalPrice: '₩49,000',
    price: '₩0',
    period: '1년',
    description: '최고 가성비 · 연간 플랜',
    features: [
      'AI 문제 생성 무제한',
      '학생 최대 100명 동시 접속',
      '엑셀 리포트 다운로드',
      '고급 통계 분석',
      '우선 고객 지원',
      '커스텀 브랜딩',
    ],
    cta: '지금 무료로 사용 🎉',
    href: '/teacher',
    popular: true,
    badgeLabel: '인기',
    topGradient: 'linear-gradient(90deg, #7C3AED, #A855F7, #EC4899)',
    cardBg: 'linear-gradient(160deg, #FAF5FF 0%, #F5F3FF 100%)',
    glowRgb: '124,58,237',
    accentColor: '#7C3AED',
    buttonColor: 'purple' as const,
  },
]

const FAQS = [
  {
    q: '베타 테스트 기간에는 정말 무료인가요?',
    a: '네! 베타 테스트 기간 동안에는 Pro 플랜 포함 모든 기능을 완전 무료로 이용하실 수 있습니다. 추후 유료 전환 시 사전에 안내드립니다.',
  },
  {
    q: '무료 플랜으로도 수업에 쓸 수 있나요?',
    a: '물론입니다. 기본 게임 모드와 AI 문제 생성(월 400회)을 무료로 이용할 수 있어요. 더 많은 기능이 필요하면 Pro를 선택하세요.',
  },
  {
    q: '학생들도 별도로 결제해야 하나요?',
    a: '아니요! 학생은 항상 무료입니다. 선생님만 플랜을 선택하시면 돼요.',
  },
  {
    q: '연간 플랜은 어떤 점이 좋은가요?',
    a: '월간 대비 2개월치를 절약할 수 있어요. 한 번 결제하면 1년 내내 Pro 기능을 사용할 수 있습니다.',
  },
]

export default function PricingPage() {
  return (
    <div
      className="min-h-dvh font-bitbit"
      style={{ background: 'linear-gradient(180deg, #E0EEFF 0%, #F0F4FF 60%, #F8F9FF 100%)' }}
    >
      <Navbar />

      {/* ── 히어로 ── */}
      <section className="pt-32 pb-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p
              className="inline-block text-base font-black text-[#1A4F9C] mb-4 px-5 py-1.5 rounded-full"
              style={{
                background: '#DBEAFE',
                border: '2px solid #93C5FD',
                fontFamily: "'DNFBitBitv2', sans-serif",
              }}
            >
              퀴즈독 요금제
            </p>
            <h1
              className="text-5xl md:text-6xl font-black text-[#0F172A] leading-tight mb-4"
              style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
            >
              심플하고 투명한
              <br />
              <span style={{ color: '#2E7BD4' }}>요금제</span>
            </h1>
            <p
              className="text-lg text-slate-600 mb-8"
              style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
            >
              필요에 맞는 플랜을 선택하세요.
            </p>
          </motion.div>

          {/* ── 무료 이벤트 배너 ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mx-auto max-w-2xl rounded-3xl p-8"
            style={{
              background: 'linear-gradient(135deg, #EEF2FF 0%, #F5F3FF 50%, #FDF4FF 100%)',
              boxShadow: '0 8px 40px rgba(124,58,237,0.10), 0 2px 8px rgba(0,0,0,0.04)',
              fontFamily: "'DNFBitBitv2', sans-serif",
            }}
          >
            {/* 배지 */}
            <div className="flex justify-center mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black"
                style={{
                  background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
                  color: '#fff',
                  letterSpacing: '0.02em',
                }}
              >
                🎉 베타 테스트 이벤트
              </span>
            </div>

            {/* 메인 타이틀 */}
            <h2
              className="text-3xl md:text-4xl font-black text-slate-900 mb-2 text-center"
              style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
            >
              지금은{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #7C3AED, #2563EB)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                전 플랜 완전 무료
              </span>
            </h2>
            <p className="text-slate-500 text-sm text-center mb-7" style={{ fontFamily: 'inherit' }}>
              베타 테스트 기간 동안 Pro 기능을 포함한 모든 기능을 무료로 이용하세요
            </p>

            {/* 가격 비교 */}
            <div className="flex justify-center items-center gap-6 flex-wrap">
              {[
                { label: 'Pro 월간', original: '₩4,900/월' },
                { label: 'Pro 연간', original: '₩49,000/년' },
              ].map(({ label, original }) => (
                <div key={label} className="flex items-center gap-3 bg-white/70 rounded-2xl px-5 py-3" style={{ boxShadow: '0 2px 8px rgba(124,58,237,0.08)' }}>
                  <div>
                    <p className="text-xs text-slate-400 font-black">{label}</p>
                    <p className="text-sm text-slate-400 line-through font-black">{original}</p>
                  </div>
                  <span className="text-2xl font-black" style={{ color: '#16A34A', fontFamily: "'DNFBitBitv2', sans-serif" }}>무료</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 플랜 카드 ── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 180, damping: 20 }}
                className="relative flex flex-col"
              >
                {/* 인기 뱃지 */}
                {plan.badgeLabel && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-20">
                    <span
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-black text-white"
                      style={{
                        background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
                        boxShadow: '0 4px 16px rgba(124,58,237,0.45)',
                        fontFamily: "'DNFBitBitv2', sans-serif",
                      }}
                    >
                      <Crown className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                      {plan.badgeLabel}
                    </span>
                  </div>
                )}

                <div
                  className={`flex flex-col h-full rounded-2xl overflow-hidden ${plan.popular ? 'scale-[1.03]' : ''}`}
                  style={{
                    background: plan.cardBg,
                    boxShadow: `0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(${plan.glowRgb},0.14)`,
                    fontFamily: "'DNFBitBitv2', sans-serif",
                  }}
                >
                  {/* 상단 컬러 스트라이프 */}
                  <div style={{ height: '5px', background: plan.topGradient }} />

                  <div className="flex flex-col flex-1 p-6 pt-5">
                  {/* 플랜 이름 */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-3xl">{plan.emoji}</span>
                    <span
                      className="text-2xl font-black"
                      style={{ color: plan.accentColor }}
                    >
                      {plan.name}
                    </span>
                  </div>

                  {/* 가격 */}
                  <div className="mb-3">
                    {plan.originalPrice && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base text-slate-400 line-through font-black">
                          {plan.originalPrice}
                        </span>
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                          style={{ background: '#EF4444', border: '2px solid #B91C1C' }}
                        >
                          무료 이벤트
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-5xl font-black"
                        style={{
                          color: plan.originalPrice ? '#16A34A' : '#0F172A',
                          textShadow: plan.originalPrice ? '0 2px 0 #14532D40' : 'none',
                          fontFamily: "'DNFBitBitv2', sans-serif",
                        }}
                      >
                        {plan.price}
                      </span>
                      <span className="text-slate-500 font-black text-lg">/{plan.period}</span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 font-black mb-5">{plan.description}</p>

                  {/* 기능 목록 */}
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check
                          className="w-5 h-5 flex-shrink-0 mt-0.5"
                          style={{ color: plan.accentColor }}
                          strokeWidth={3}
                        />
                        <span className="text-sm text-slate-700 font-black">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA 버튼 */}
                  <PlanButton href={plan.href} color={plan.buttonColor} className="w-full text-base">
                    {plan.cta}
                  </PlanButton>
                </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-black text-[#0F172A] text-center mb-10"
            style={{ fontFamily: "'DNFBitBitv2', sans-serif" }}
          >
            자주 묻는 질문
          </motion.h2>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl p-5"
                style={{
                  background: '#FFFFFF',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.04), 0 12px 32px rgba(148,163,184,0.12)',
                  fontFamily: "'DNFBitBitv2', sans-serif",
                }}
              >
                <h3 className="font-black text-[#1E3A8A] mb-2 text-base leading-snug">
                  Q. {faq.q}
                </h3>
                <p className="text-sm text-slate-600 font-black leading-relaxed">
                  {faq.a}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
