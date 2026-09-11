'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import GameModeCard from '@/components/landing/GameModeCard'
import { PixelHeading } from '@/components/landing/PixelHeading'
import { visibleGameModes } from '@/components/landing/gameModesData'

export default function GameLineupSection({ animationsReady }: { animationsReady: boolean }) {
  return (
    <section id="games" className="relative scroll-mt-28 px-4 py-20 sm:px-6 sm:py-24 lg:px-8" style={{ zIndex: 2 }}>
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={animationsReady ? { opacity: 0, y: 20 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center sm:mb-14"
        >
          <h2 className="text-4xl sm:text-5xl">
            <PixelHeading>게임 모드</PixelHeading>
          </h2>
          <p className="-mt-1 text-base sm:text-lg" style={{ color: '#475569' }}>
            카드에 마우스를 올려보세요
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          {visibleGameModes.map((game, index) => (
            <GameModeCard key={game.name} game={game} index={index} animationsReady={animationsReady} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/features#games"
            className="inline-flex items-center gap-2 text-base font-black transition-colors hover:opacity-80"
            style={{ color: '#0369A1' }}
          >
            게임별 자세한 규칙 보기 →
          </Link>
        </div>
      </div>
    </section>
  )
}
