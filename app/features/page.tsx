import type { Metadata } from 'next'
import FeaturesContent from '@/components/features/FeaturesContent'
import { visibleGameModeCount } from '@/components/landing/gameModesData'

export const metadata: Metadata = {
  title: '기능 소개',
  alternates: { canonical: '/features' },
  description:
    `AI 문제 생성부터 ${visibleGameModeCount}가지 게임 모드, 실시간 리포트까지. 수업을 게임처럼 만드는 퀴즈독의 기능을 한눈에 확인하세요.`,
  openGraph: {
    title: '기능 소개 | 퀴즈독',
    description:
      `AI 문제 생성부터 ${visibleGameModeCount}가지 게임 모드, 실시간 리포트까지. 퀴즈독의 모든 기능을 한눈에.`,
  },
}

export default function FeaturesPage() {
  return <FeaturesContent />
}
