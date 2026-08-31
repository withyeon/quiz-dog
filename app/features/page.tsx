import type { Metadata } from 'next'
import FeaturesContent from '@/components/features/FeaturesContent'

export const metadata: Metadata = {
  title: '기능 소개 - 퀴즈독',
  description:
    'AI 문제 생성부터 11가지 게임 모드, 실시간 리포트까지. 자료만 올리면 수업이 게임이 되는 퀴즈독의 기능을 한눈에 확인하세요.',
  openGraph: {
    title: '기능 소개 - 퀴즈독',
    description:
      'AI 문제 생성부터 11가지 게임 모드, 실시간 리포트까지. 퀴즈독의 모든 기능을 한눈에.',
  },
}

export default function FeaturesPage() {
  return <FeaturesContent />
}
