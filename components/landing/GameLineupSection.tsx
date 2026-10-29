'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import GameModeCard from '@/components/landing/GameModeCard'
import HeadingIcon from '@/components/landing/HeadingIcon'
import { PixelHeading, PixelAccent } from '@/components/landing/PixelHeading'
import { visibleGameModes } from '@/components/landing/gameModesData'
import GameRecommendationPicker from '@/components/landing/GameRecommendationPicker'
import { matchesRecommendation, type RecommendationTag } from '@/lib/game/modeGuide'
import { useGameTutorialPreview } from '@/components/landing/useGameTutorialPreview'

export default function GameLineupSection({ animationsReady }: { animationsReady: boolean }) {
  const [pick, setPick] = useState<RecommendationTag | null>(null)
  const { openTutorial, tutorialModal } = useGameTutorialPreview()
  const shown = visibleGameModes.filter((game) => matchesRecommendation(game.modeId, pick))

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
            <PixelHeading>
              초등교사 출신 개발자가 만든
              <br />
              <PixelAccent>초등학생 눈높이 게임</PixelAccent>!
              <HeadingIcon src="/assets/icons/joystick-128.png" />
            </PixelHeading>
          </h2>
          <p className="-mt-1 text-base sm:text-lg" style={{ color: '#475569' }}>
            카드에 마우스를 올려보세요
          </p>
        </motion.div>

        <GameRecommendationPicker value={pick} onChange={setPick} />

        <motion.div layout className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
          <AnimatePresence mode="popLayout">
            {shown.map((game, index) => (
              <motion.div
                key={game.name}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
              >
                <GameModeCard
                  game={game}
                  index={index}
                  animationsReady={animationsReady}
                  onTutorial={() => openTutorial(game.modeId)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

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
      {tutorialModal}
    </section>
  )
}
