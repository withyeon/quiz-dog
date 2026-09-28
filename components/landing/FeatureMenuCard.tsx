'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
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
          className="flex h-full flex-col overflow-hidden rounded-[22px] transition-colors duration-200"
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
          {/* 사진이 주인공: 카드 폭 전체를 쓰는 큰 캡처. 글은 아래에 짧게만 */}
          <div
            className="relative aspect-[16/10] w-full overflow-hidden"
            style={{ backgroundColor: `${item.accent}14`, borderBottom: '2px solid rgba(226,232,240,0.9)' }}
          >
            <Image
              src={item.screenshot}
              alt={`${item.title} 화면`}
              fill
              sizes="(min-width: 1280px) 600px, (min-width: 640px) 50vw, 100vw"
              className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>

          <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                style={{ backgroundColor: `${item.accent}1A` }}
              >
                <Image src={item.icon} alt="" width={30} height={30} unoptimized className="h-[30px] w-[30px] object-contain" />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight sm:text-xl" style={{ color: '#0F172A' }}>
                  {item.title}
                </h3>
                <p className="mt-0.5 text-sm" style={{ color: '#64748B' }}>
                  {item.description}
                </p>
              </div>
              <span
                className="ml-auto hidden shrink-0 items-center gap-1 text-sm font-black sm:inline-flex"
                style={{ color: item.accent }}
              >
                자세히
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </div>

            {/* 세부 항목은 한 줄 칩으로 — 사진 아래 글이 길어지면 사진이 다시 조연이 된다 */}
            <ul className="flex flex-wrap gap-1.5">
              {item.features.map((feature) => (
                <li
                  key={feature.text}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}
                >
                  <Image src={feature.icon} alt="" width={16} height={16} unoptimized className="h-4 w-4 shrink-0 object-contain" />
                  {feature.text}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </Link>
    </motion.article>
  )
}
