'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import type { FeatureIntroItem } from '@/components/landing/featureIntroData'

const CARD_BG = '#FFFFFF'
const CARD_BORDER = 'rgba(226,232,240,0.8)'
const CARD_SHADOW = '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)'
const CARD_SHADOW_HOVER = '0 12px 40px rgba(14,165,233,0.12), 0 4px 12px rgba(0,0,0,0.06)'

function FeatureIcon({ src, alt, fallbackEmoji }: { src: string; alt: string; fallbackEmoji: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span className="flex h-16 w-16 items-center justify-center text-5xl" aria-hidden>
        {fallbackEmoji}
      </span>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={72}
      height={72}
      className="h-14 w-14 object-contain sm:h-16 sm:w-16"
      onError={() => setFailed(true)}
    />
  )
}

export default function FeatureMenuCard({
  item,
  index,
  animationsReady,
}: {
  item: FeatureIntroItem
  index: number
  animationsReady: boolean
}) {
  return (
    <motion.article
      initial={animationsReady ? { opacity: 0, y: 28 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.12 }}
      whileHover={{ y: -4 }}
      className="group h-full"
    >
      <motion.div
        className="flex h-full flex-col rounded-[22px] border p-6 sm:p-7 transition-shadow duration-200"
        style={{
          backgroundColor: CARD_BG,
          borderColor: CARD_BORDER,
          boxShadow: CARD_SHADOW,
        }}
        whileHover={{ boxShadow: CARD_SHADOW_HOVER }}
      >
        {/* 상단: 아이콘 · 제목 · 설명 — 중앙 정렬 */}
        <motion.div className="mb-6 flex flex-col items-center text-center">
          <FeatureIcon src={item.iconSrc} alt={item.title} fallbackEmoji={item.fallbackEmoji} />
          <h3
            className="mt-4 text-xl font-black sm:text-2xl"
            style={{ color: '#0F172A', fontFamily: "'DNFBitBitv2', sans-serif" }}
          >
            {item.title}
          </h3>
          <p
            className="mt-2 text-base leading-relaxed"
            style={{ color: '#64748B', fontFamily: "'DNFBitBitv2', sans-serif" }}
          >
            {item.description}
          </p>
        </motion.div>

        {/* 체크리스트 — 왼쪽 정렬 */}
        <ul className="mb-6 flex-1 space-y-3.5 px-1">
          {item.features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-3 text-left text-[15px] font-bold sm:text-base"
              style={{ color: '#334155', fontFamily: "'DNFBitBitv2', sans-serif" }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.5} />
              {feature}
            </li>
          ))}
        </ul>

        {/* 버튼 */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.02, opacity: 0.92 }}
          whileTap={{ scale: 0.98 }}
          className="w-full rounded-xl py-3.5 text-base font-black text-white sm:py-4 sm:text-lg"
          style={{
            background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
            boxShadow: '0 4px 16px rgba(14,165,233,0.30)',
            fontFamily: "'DNFBitBitv2', sans-serif",
          }}
        >
          {item.buttonLabel}
        </motion.button>
      </motion.div>
    </motion.article>
  )
}
