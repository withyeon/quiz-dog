'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import HeadingIcon from '@/components/landing/HeadingIcon'
import FeatureVideoTabs from '@/components/landing/FeatureVideoTabs'

const PERKS = [
  { icon: '/icons/time.webp', text: '준비 3분' },
  { icon: '/icons/people.webp', text: '학생 가입 없음' },
  { icon: '/icons/rocket.webp', text: '설치 없음' },
  { icon: '/trophy.webp', text: '결과 리포트 제공' },
]

export default function HowItWorksSection({ animationsReady }: { animationsReady: boolean }) {
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8" style={{ zIndex: 2 }}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center sm:mb-14"
        >
          <h2 className="text-4xl sm:text-5xl">
            <PixelHeading>
              수업 준비부터 결과까지, <PixelAccent>한 번에</PixelAccent>
              <HeadingIcon src="/icons/time.webp" />
            </PixelHeading>
          </h2>
        </motion.div>

        {/* 기능별 탭 영상 (ZEP 퀴즈 랜딩 방식): 큰 영상 + 기능 카드 4개 */}
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 24 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-6xl"
        >
          <FeatureVideoTabs />
        </motion.div>

        {/* 한 줄 요약 배지 */}
        <motion.div
          initial={animationsReady ? { opacity: 0 } : false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {PERKS.map((perk) => (
            <span
              key={perk.text}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black sm:text-base"
              style={{
                backgroundColor: 'rgba(255,255,255,0.85)',
                border: '2px solid rgba(186,230,253,0.9)',
                color: '#1E3A8A',
              }}
            >
              <Image src={perk.icon} alt="" width={20} height={20} unoptimized className="h-5 w-5 shrink-0 object-contain" />
              {perk.text}
            </span>
          ))}
        </motion.div>

        <div className="mt-10 text-center">
          <Link href="/teacher">
            <motion.span
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              className="inline-flex items-center gap-2 rounded-full px-9 py-4 text-lg font-black text-white"
              style={{
                background: 'linear-gradient(180deg, #7dd3fc 0%, #4FC3F7 45%, #0ea5e9 100%)',
                boxShadow: '0 6px 0 #0b8fc4, 0 12px 24px rgba(14,165,233,0.3), inset 0 1px 0 rgba(255,255,255,0.45)',
                textShadow: '0 1px 0 rgba(0,0,0,0.18)',
              }}
            >
              지금 문제 만들어보기
              <ArrowRight className="h-5 w-5" />
            </motion.span>
          </Link>
        </div>
      </div>
    </section>
  )
}
