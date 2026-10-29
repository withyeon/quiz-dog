'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { GameModeId } from '@/lib/game/modes'

// 게임 데모가 전부 들어 있어 무겁다 — 카드에서 '튜토리얼 보기'를 눌렀을 때만 받는다
const GameStartTutorialModal = dynamic(() => import('@/components/GameStartTutorialModal'), { ssr: false })

/**
 * 게임 카드의 '튜토리얼 보기' — 랜딩 게임 라인업과 기능 소개(/features) 게임 섹션이 함께 쓴다.
 * 게임 시작 전 튜토리얼을 둘러보기(preview)로 띄우고, '직접 해보기'는 그 게임으로 1분 체험(/try?game=)을 바로 연다.
 * 카드 섹션이 z-index 쌓임 맥락이라 그 안에 두면 상단 메뉴(z-50)가 위로 올라온다 → body 로 포털한다.
 */
export function useGameTutorialPreview() {
  const router = useRouter()
  const [mode, setMode] = useState<GameModeId | null>(null)
  const [step, setStep] = useState(0)

  // 전체 화면 튜토리얼이 떠 있는 동안 뒤 페이지가 스크롤되지 않게
  useEffect(() => {
    if (!mode) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mode])

  const openTutorial = (modeId: GameModeId) => {
    setStep(0)
    setMode(modeId)
  }

  // 포털하면 페이지의 font-bitbit 밖으로 나가므로 다시 씌운다
  const tutorialModal = mode ? createPortal(
    <div className="font-bitbit">
      <GameStartTutorialModal
        key={mode}
        gameMode={mode}
        isOpen
        stepIndex={step}
        role="preview"
        onStepChange={setStep}
        onStart={() => router.push(`/try?game=${mode}`)}
        onClose={() => setMode(null)}
      />
    </div>,
    document.body,
  ) : null

  return { openTutorial, tutorialModal }
}
