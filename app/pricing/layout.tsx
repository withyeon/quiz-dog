import type { Metadata } from 'next'

// page.tsx가 'use client'라 메타데이터를 직접 못 넣는다. 이 레이아웃이 대신 담당한다.
export const metadata: Metadata = {
  title: '요금제',
  description:
    '퀴즈독 요금제 안내. 학생은 언제나 무료이고, 선생님은 무료 플랜으로 바로 시작하고, Pro 기능은 가입 후 2주 동안 무료로 체험할 수 있습니다.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: '요금제 | 퀴즈독',
    description: '학생은 언제나 무료. 선생님도 무료 플랜으로 바로 시작하세요.',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
