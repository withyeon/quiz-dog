'use client'

import { motion, AnimatePresence } from 'framer-motion'
import QuizView from '@/components/QuizView'
import ItemChoiceModal from '@/components/cafe/ItemChoiceModal'
import PixelIcon from '@/components/ui/PixelIcon'
import type { ComponentProps } from 'react'
import type { CafeItem } from '@/lib/game/cafeItems'
import type { CafePlayer, CafeQuestion } from '@/hooks/useCafeView'

type Props = {
  open: boolean
  question: CafeQuestion | null
  consecutiveCorrect: number
  showItemModal: boolean
  itemChoices: CafeItem[]
  restockedMenuName: string
  players: CafePlayer[]
  currentPlayerId: string | null
  paused: boolean
  onAnswer: (answer: string) => Promise<boolean>
  onItemSelect: ComponentProps<typeof ItemChoiceModal>['onSelect']
  onSkip: () => void
}

/** 음식 채우기 퀴즈 오버레이. 정답이면 같은 자리에서 아이템 고르기로 바뀐다. */
export default function CafeQuizOverlay({
  open,
  question,
  consecutiveCorrect,
  showItemModal,
  itemChoices,
  restockedMenuName,
  players,
  currentPlayerId,
  paused,
  onAnswer,
  onItemSelect,
  onSkip,
}: Props) {
  return (
    <AnimatePresence>
      {open && question && (
        <motion.div
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          {consecutiveCorrect >= 2 && (
            <motion.div
              key={consecutiveCorrect}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg"
            >
              <PixelIcon name="streak" size={18} alt="" />
              {consecutiveCorrect}연속 정답! 희귀 아이템이 더 잘 나와요
            </motion.div>
          )}

          <div className="w-full max-w-3xl my-auto">
            {showItemModal ? (
              <ItemChoiceModal
                items={itemChoices}
                restockedMenuName={restockedMenuName}
                consecutiveCorrect={consecutiveCorrect + 1}
                players={players}
                currentPlayerId={currentPlayerId}
                onSelect={onItemSelect}
                onSkip={onSkip}
              />
            ) : (
              <QuizView
                question={question}
                onAnswer={onAnswer}
                onCorrectClick={() => undefined}
                timeLimit={30}
                paused={paused}
                variant="glass"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
