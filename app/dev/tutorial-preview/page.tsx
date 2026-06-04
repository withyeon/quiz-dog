'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import { isGameModeId, type GameModeId } from '@/lib/game/modes'

export default function TutorialPreviewPage() {
  const params = useSearchParams()
  const raw = params.get('game')
  const gameMode: GameModeId = isGameModeId(raw) ? raw : 'gold_quest'
  const [stepIndex, setStepIndex] = useState(0)
  return (
    <GameStartTutorialModal
      key={gameMode}
      gameMode={gameMode}
      isOpen
      stepIndex={stepIndex}
      role="teacher"
      onStepChange={setStepIndex}
      onStart={() => alert('게임 시작!')}
      onClose={() => alert('닫기')}
    />
  )
}
