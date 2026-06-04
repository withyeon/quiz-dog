'use client'

import { useState } from 'react'
import QuizView from '@/components/QuizView'

const SAMPLE = {
  id: 'demo-1',
  type: 'CHOICE' as const,
  question_text: '대한민국의 수도는 어디일까요?',
  options: ['서울', '부산', '인천', '대구'],
  answer: '서울',
}

export default function GlassPreviewPage() {
  const [key, setKey] = useState(0)

  // 실제 게임 배경(gold-quest-ambient) 위에 글래스 퀴즈 패널만 얹은 미리보기
  return (
    <main className="gold-quest-ambient min-h-dvh flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-bitbit">
      <div className="relative z-10 w-full max-w-2xl">
        <QuizView
          key={key}
          variant="glass"
          question={SAMPLE}
          timeLimit={20}
          onAnswer={(a) => a === SAMPLE.answer}
          onCorrectClick={() => setKey((k) => k + 1)}
        />
      </div>
    </main>
  )
}
