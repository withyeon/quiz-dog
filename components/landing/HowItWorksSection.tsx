'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { FileUp, Gamepad2, KeyRound, ArrowRight } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import HeadingIcon from '@/components/landing/HeadingIcon'
/**
 * screenshot: 실제 교사 화면 캡처(16:10, public/main/steps). 기능 카드와 같은 방식으로 찍었다
 * (헤드리스 Chrome 1280×800@2x, /dev/shot 임시 페이지, 사이드바 잘라냄). 화면이 바뀌면 같은 구도로 교체.
 *   upload → 문제 만들기에서 '수업 자료 넣기' 선택   pick → 게임 시작의 게임 모드 선택   code → 참가코드·QR 대기실
 */
const STEPS = [
  {
    icon: FileUp,
    step: '01',
    title: '자료 올리기',
    description: '수업 자료를 올리면 AI가 문제를 생성해요.',
    screenshot: '/main/steps/upload.webp',
  },
  {
    icon: Gamepad2,
    step: '02',
    title: '게임 고르기',
    description: '초등학생 눈높이에 맞는 즐거운 게임',
    screenshot: '/main/steps/pick.webp',
  },
  {
    icon: KeyRound,
    step: '03',
    title: '코드 공유하기',
    description: 'QR 스캔 또는 6자리 코드 입력하기',
    screenshot: '/main/steps/code.webp',
  },
]

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
              수업 준비, <PixelAccent>3단계</PixelAccent>면 끝
              <HeadingIcon src="/icons/time.webp" />
            </PixelHeading>
          </h2>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((item, index) => {
            const Icon = item.icon
            return (
              <motion.div
                key={item.step}
                initial={animationsReady ? { opacity: 0, y: 24 } : false}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.12 }}
                whileHover={{ y: -4 }}
                className="relative"
              >
                <div
                  className="flex h-full flex-col overflow-hidden rounded-[22px]"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(226,232,240,0.9)',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  {/* 단계별 실제 화면. 번호 배지를 사진 위에 얹으면 화면 제목을 가려서 글 영역에 둔다 */}
                  <div
                    className="relative aspect-[16/10] w-full overflow-hidden"
                    style={{ backgroundColor: '#F0F9FF', borderBottom: '1px solid rgba(226,232,240,0.9)' }}
                  >
                    <Image
                      src={item.screenshot}
                      alt={`${item.title} 화면`}
                      fill
                      sizes="(min-width: 1280px) 400px, (min-width: 768px) 33vw, 100vw"
                      className="object-cover object-top"
                    />
                  </div>

                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
                        style={{
                          background: 'linear-gradient(180deg, #38BDF8, #0284C7)',
                          boxShadow: '0 2px 0 #0369A1',
                        }}
                      >
                        {item.step}
                      </span>
                      <Icon className="h-5 w-5 shrink-0" style={{ color: '#0284C7' }} strokeWidth={2.4} />
                      <h3 className="text-lg font-black sm:text-xl" style={{ color: '#0F172A' }}>
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed sm:text-[15px]" style={{ color: '#64748B' }}>
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* 카드 사이 화살표 (데스크톱) */}
                {index < STEPS.length - 1 && (
                  <div className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 md:block" aria-hidden>
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: '#FFFFFF', border: '2px solid #BAE6FD' }}
                    >
                      <ArrowRight className="h-4 w-4" style={{ color: '#0284C7' }} strokeWidth={3} />
                    </span>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>

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
