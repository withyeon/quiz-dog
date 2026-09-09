'use client'

import { motion } from 'framer-motion'
import { Sprout, HandHeart, Repeat } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'

/* ─────────────────────────────────────────────────────────────
   퀴즈독이 게임으로 수업하는 이유 — 만든 사람의 신념을 담는 자리.
   기능 나열 사이에 '왜'가 한 번 들어가야 나머지 섹션이 설득된다.
───────────────────────────────────────────────────────────── */

const BELIEFS = [
  {
    icon: Sprout,
    title: '가르치지 않아도 배웁니다',
    description: '외우라고 시키지 않아도 괜찮아요. 놀이에 빠져 있는 동안 배움은 자연스럽게 일어납니다.',
  },
  {
    icon: HandHeart,
    title: '흥미 없던 아이도 참여합니다',
    description: '손 들지 않던 아이가 게임 앞에서는 먼저 답을 외쳐요. 수업의 주인공이 한 명 더 늘어납니다.',
  },
  {
    icon: Repeat,
    title: '반복이 실력으로 남습니다',
    description: '재미있으니까 한 판 더. 그렇게 쌓인 반복이 결국 아이 몸에 배는 학습이 됩니다.',
  },
]

export default function MottoSection({ animationsReady }: { animationsReady: boolean }) {
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
              우리가 <PixelAccent>게임</PixelAccent>으로 하는 이유
            </PixelHeading>
          </h2>
          <p className="-mt-1 text-base sm:text-lg" style={{ color: '#475569' }}>
            퀴즈독이 만들어질 때부터 지키고 있는 세 가지 믿음
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {BELIEFS.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.title}
                initial={animationsReady ? { opacity: 0, y: 24 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -4 }}
                className="flex h-full flex-col rounded-[22px] p-6 sm:p-7"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(226,232,240,0.9)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <span
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)' }}
                >
                  <Icon className="h-7 w-7" style={{ color: '#0284C7' }} strokeWidth={2.4} />
                </span>
                <h3 className="mb-2 text-xl font-black sm:text-2xl" style={{ color: '#0F172A' }}>
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed" style={{ color: '#64748B' }}>
                  {item.description}
                </p>
              </motion.div>
            )
          })}
        </div>

        {/* 모토 한 줄 */}
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 flex justify-center"
        >
          <blockquote
            className="max-w-3xl rounded-[24px] px-7 py-8 text-center sm:px-12 sm:py-10"
            style={{
              background: 'linear-gradient(180deg, #1E3A8A 0%, #172A63 100%)',
              boxShadow: '0 10px 30px rgba(12,32,77,0.28), inset 0 1px 0 rgba(255,255,255,0.14)',
            }}
          >
            <p className="text-xl font-black leading-relaxed sm:text-2xl" style={{ color: '#FFFFFF' }}>
              억지로 외우게 하지 않습니다.
              <br className="hidden sm:block" />{' '}
              <span style={{ color: '#7dd3fc' }}>재미있어서 또 하다 보면,</span> 배움은 저절로 남으니까요.
            </p>
            <footer className="mt-4 text-sm font-black sm:text-base" style={{ color: '#BAE6FD' }}>
              — 퀴즈독을 만드는 마음
            </footer>
          </blockquote>
        </motion.div>
      </div>
    </section>
  )
}
