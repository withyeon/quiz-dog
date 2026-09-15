import type { Metadata } from 'next'

// page.tsx가 'use client'라 메타데이터를 직접 못 넣는다. 이 레이아웃이 대신 담당한다.
export const metadata: Metadata = {
  title: '견적서 발행',
  description:
    '퀴즈독 견적서를 바로 발행하세요. 선생님 인원과 사용 기간을 고르면 부가세 포함 견적서를 인쇄·저장할 수 있습니다. 5명 이상이면 단체 할인이 자동 적용됩니다.',
  alternates: { canonical: '/pricing/quote' },
  openGraph: {
    title: '견적서 발행 | 퀴즈독',
    description: '인원과 기간만 고르면 견적서가 바로 나와요. 5명 이상은 단체 할인.',
  },
}

export default function PricingQuoteLayout({ children }: { children: React.ReactNode }) {
  return children
}
