'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import type { FeatureIntroItem } from '@/components/landing/featureIntroData'

const CARD_BG = '#FFF9ED'
const CARD_BORDER = 'rgba(232, 190, 140, 0.65)'
const CARD_SHADOW = '0 5px 0 rgba(200, 155, 100, 0.35), 0 10px 28px rgba(91, 58, 26, 0.08)'
const CARD_SHADOW_HOVER = '0 8px 0 rgba(200, 155, 100, 0.45), 0 16px 36px rgba(91, 58, 26, 0.12)'

const BTN_BG = '#4FC3F7'
const BTN_BORDER = '#38a8dc'
const BTN_SHADOW = '0 4px 0 #2b8fc4'

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
        className="flex h-full flex-col rounded-[22px] border-[3px] p-6 sm:p-7 transition-shadow duration-200"
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
            style={{ color: '#3B1F0A', fontFamily: "'DNFBitBitv2', sans-serif" }}
          >
            {item.title}
          </h3>
          <p
            className="mt-2 text-base leading-relaxed"
            style={{ color: '#7B5A3A', fontFamily: "'DNFBitBitv2', sans-serif" }}
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
              style={{ color: '#4A3020', fontFamily: "'DNFBitBitv2', sans-serif" }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.5} />
              {feature}
            </li>
          ))}
        </ul>

        {/* 게임 스타일 버튼 */}
        <motion.button
          type="button"
          whileHover={{ y: -2, filter: 'brightness(1.06)' }}
          whileTap={{ y: 2, filter: 'brightness(0.95)' }}
          className="w-full rounded-2xl py-3.5 text-base font-black text-white transition-shadow duration-200 sm:py-4 sm:text-lg"
          style={{
            backgroundColor: BTN_BG,
            border: `2px solid ${BTN_BORDER}`,
            boxShadow: BTN_SHADOW,
            fontFamily: "'DNFBitBitv2', sans-serif",
          }}
        >
          {item.buttonLabel}
        </motion.button>
      </motion.div>
    </motion.article>
  )
}
