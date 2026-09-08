'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import type { FeatureIntroItem } from '@/components/landing/featureIntroData'

const CARD_SHADOW = '0 4px 20px rgba(15,23,42,0.06)'

export default function FeatureMenuCard({
  item,
  index,
  animationsReady,
}: {
  item: FeatureIntroItem
  index: number
  animationsReady: boolean
}) {
  const Icon = item.icon

  return (
    <motion.article
      initial={animationsReady ? { opacity: 0, y: 24 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      className="group h-full"
    >
      {/* 카드 전체가 /features의 해당 섹션으로 가는 링크 */}
      <Link href={item.href} className="block h-full">
        <motion.div
          className="flex h-full flex-col rounded-[22px] p-6 transition-colors duration-200 sm:p-7"
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid rgba(226,232,240,0.9)',
            boxShadow: CARD_SHADOW,
          }}
          whileHover={{
            borderColor: item.accent,
            boxShadow: `0 14px 34px ${item.accent}22, 0 4px 12px rgba(15,23,42,0.08)`,
          }}
        >
          <span
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${item.accent}1A` }}
          >
            <Icon className="h-7 w-7" style={{ color: item.accent }} strokeWidth={2.4} />
          </span>

          <h3 className="text-xl font-black sm:text-[22px]" style={{ color: '#0F172A' }}>
            {item.title}
          </h3>
          <p className="mt-1.5 text-[15px] leading-relaxed" style={{ color: '#64748B' }}>
            {item.description}
          </p>

          <ul className="mb-5 mt-5 flex-1 space-y-2.5">
            {item.features.map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-sm font-bold leading-snug"
                style={{ color: '#334155' }}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: item.accent }} strokeWidth={3} />
                {feature}
              </li>
            ))}
          </ul>

          <span
            className="mt-auto inline-flex items-center gap-1.5 text-sm font-black"
            style={{ color: item.accent }}
          >
            자세히 보기
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </motion.div>
      </Link>
    </motion.article>
  )
}
