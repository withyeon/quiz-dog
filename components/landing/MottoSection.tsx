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
    title: '재미있으면, 아이가 먼저 합니다',
    lines: [
      '시키지 않아도 게임은 시작합니다.',
      '문제를 풀고, 경쟁하고, 웃는 사이',
      '아이들은 자연스럽게 배웁니다.',
    ],
  },
  {
    icon: HandHeart,
    title: '게임에서는, 모두가 참여합니다',
    lines: [
      '손들기를 망설이던 아이도',
      '게임이 시작되면 답을 고릅니다.',
      '구경하던 아이까지 직접 참여합니다.',
    ],
  },
  {
    icon: Repeat,
    title: '한 판 더가, 실력이 됩니다',
    lines: [
      '“한 번만 더!”',
      '재미있으니까 반복하고,',
      '반복하니까 배운 것이 오래 남습니다.',
    ],
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
          <p className="-mt-1 text-base font-black leading-relaxed sm:text-lg" style={{ color: '#1E3A8A' }}>
            공부를 게임처럼.
            <br />
            배움을 놀이처럼.
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
                <h3 className="mb-3 text-xl font-black sm:text-2xl" style={{ color: '#0F172A' }}>
                  {item.title}
                </h3>
                <p className="text-[15px] leading-relaxed" style={{ color: '#64748B' }}>
                  {item.lines.map((line, lineIndex) => (
                    <span key={line}>
                      {lineIndex > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              </motion.div>
            )
          })}
        </div>

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
              퀴즈독은
              <br />
              아이들이 배우는 순간을
              <br />
              <span style={{ color: '#7dd3fc' }}>‘공부’가 아닌 ‘재미’</span>로 바꿉니다.
            </p>
          </blockquote>
        </motion.div>
      </div>
    </section>
  )
}
