import type { Metadata } from 'next'
import TrialExperience from '@/components/try/TrialExperience'

export const metadata: Metadata = {
  title: '가입 없이 1분 체험',
  alternates: { canonical: '/try' },
  description:
    '회원가입 없이 게임을 골라 바로 해보세요. 학생들이 보는 퀴즈독 게임 화면을 선생님 혼자서도 2분 만에 체험할 수 있어요.',
  openGraph: {
    title: '가입 없이 1분 체험 | 퀴즈독',
    description: '게임을 골라 바로 해보세요. 학생이 보는 화면 그대로, 가입 없이.',
  },
}

/** 가입 없이 1분 체험 — 랜딩 '시작하기' 옆 버튼과 자료실의 "이 문제집으로 1분 체험"(?set=)이 여기로 온다 */
export default function TryPage() {
  return <TrialExperience />
}
