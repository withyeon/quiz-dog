'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { FileUp, Gamepad2, KeyRound, ArrowRight } from 'lucide-react'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import PixelIcon from '@/components/ui/PixelIcon'

/**
 * screenshot: 실제 교사 화면 캡처(16:10, public/main/steps). 기능 카드와 같은 방식으로 찍었다
 * (헤드리스 Chrome 1280×800@2x, /dev/shot 임시 페이지, 사이드바 잘라냄). 화면이 바뀌면 같은 구도로 교체.
 *   upload → 문제 만들기에서 '수업 자료 넣기' 선택   pick → 게임 시작의 게임 모드 선택   code → 참가코드·QR 대기실
 */
const STEPS = [
  {
    icon: FileUp,
    step: '01',
    time: '약 1분',
    title: '자료 올리기',
    description: 'PDF·문서·유튜브 링크를 올리면 AI가 알아서 문제를 뽑아줘요.',
    screenshot: '/main/steps/upload.webp',
  },
  {
    icon: Gamepad2,
    step: '02',
    time: '30초',
    title: '게임 고르기',
    description: '오늘 수업 분위기에 맞는 게임을 고르면 그대로 퀴즈가 실립니다.',
    screenshot: '/main/steps/pick.webp',
  },
  {
    icon: KeyRound,
    step: '03',
    time: '바로',
    title: '코드 공유하기',
    description: '화면에 뜬 6자리 코드만 알려주면 아이들이 바로 들어와요.',
    screenshot: '/main/steps/code.webp',
  },
]

const PERKS = ['준비 3분', '🔓 학생 가입 없음', '💻 설치 없이 브라우저', '📊 결과 리포트 자동']

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
            </PixelHeading>
          </h2>
          <p className="-mt-1 text-base sm:text-lg" style={{ color: '#475569' }}>
            자료를 올린 순간부터 아이들이 게임에 들어오기까지
          </p>
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
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-black"
                        style={{ backgroundColor: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}
                      >
                        {item.time}
                      </span>
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
              key={perk}
              className="rounded-full px-4 py-2 text-sm font-black sm:text-base"
              style={{
                backgroundColor: 'rgba(255,255,255,0.85)',
                border: '2px solid rgba(186,230,253,0.9)',
                color: '#1E3A8A',
              }}
            >
              {perk === '준비 3분' && <PixelIcon name="time" size={18} alt="" className="mr-1 inline-block align-[-3px]" />}
              {perk}
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
