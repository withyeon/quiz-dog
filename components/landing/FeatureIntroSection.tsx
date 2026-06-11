'use client'

import { motion } from 'framer-motion'
import FeatureMenuCard from '@/components/landing/FeatureMenuCard'
import { getFeatureIntroItems } from '@/components/landing/featureIntroData'

function SectionTitleButton({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block text-3xl font-black sm:text-4xl"
      style={{
        fontFamily: "'DNFBitBitv2', sans-serif",
        background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {children}
    </span>
  )
}

export default function FeatureIntroSection({
  gameModeCount,
  animationsReady,
}: {
  gameModeCount: number
  animationsReady: boolean
}) {
  const items = getFeatureIntroItems(gameModeCount)

  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-24 lg:px-8" style={{ zIndex: 2 }}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center sm:mb-14"
        >
          <div className="mb-4 inline-block">
            <SectionTitleButton>기능 소개</SectionTitleButton>
          </div>
          <p
            className="mt-4 text-base sm:text-lg"
            style={{ color: '#475569', fontFamily: "'DNFBitBitv2', sans-serif" }}
          >
            AI 기반 문제 생성부터 실시간 게임까지, 모든 것이 한 곳에
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3 lg:gap-8">
          {items.map((item, index) => (
            <FeatureMenuCard
              key={item.title}
              item={item}
              index={index}
              animationsReady={animationsReady}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
