'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import FeatureMenuCard from '@/components/landing/FeatureMenuCard'
import { FEATURE_INTRO_ITEMS } from '@/components/landing/featureIntroData'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'

export default function FeatureIntroSection({
  animationsReady,
}: {
  animationsReady: boolean
}) {
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
              <PixelAccent>퀴즈독</PixelAccent> 기능 한눈에
            </PixelHeading>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {FEATURE_INTRO_ITEMS.map((item, index) => (
            <FeatureMenuCard
              key={item.title}
              item={item}
              index={index}
              animationsReady={animationsReady}
            />
          ))}
        </div>

        {/* 섹션 하나에 CTA 하나 — 세부 내용은 기능 소개 페이지로 */}
        <motion.div
          initial={animationsReady ? { opacity: 0 } : false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <Link href="/features">
            <motion.span
              whileHover={{ y: -3 }}
              whileTap={{ y: 0 }}
              className="inline-flex items-center gap-2 rounded-full px-9 py-4 text-lg font-black"
              style={{
                backgroundColor: '#FFFFFF',
                border: '2px solid #BAE6FD',
                color: '#0369A1',
                boxShadow: '0 5px 0 rgba(186,230,253,0.9), 0 10px 20px rgba(14,165,233,0.14)',
              }}
            >
              기능 더 알아보기
              <ArrowRight className="h-5 w-5" />
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
