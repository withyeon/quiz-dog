'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import GameStartTutorialModal from '@/components/GameStartTutorialModal'
import { isGameModeId, type GameModeId } from '@/lib/game/modes'

function TutorialPreview() {
  const params = useSearchParams()
  const raw = params.get('game')
  const gameMode: GameModeId = isGameModeId(raw) ? raw : 'gold_quest'
  // ?step=N 으로 특정 규칙 화면을 바로 열 수 있다 (스크린샷 확인용)
  const initialStep = Number.parseInt(params.get('step') ?? '', 10)
  const [stepIndex, setStepIndex] = useState(Number.isFinite(initialStep) && initialStep > 0 ? initialStep : 0)
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

export default function TutorialPreviewPage() {
  return (
    <Suspense fallback={null}>
      <TutorialPreview />
    </Suspense>
  )
}
