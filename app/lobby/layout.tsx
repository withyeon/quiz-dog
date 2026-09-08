import type { Metadata } from 'next'

// page.tsx가 'use client'라 메타데이터를 직접 못 넣는다. 이 레이아웃이 대신 담당한다.
export const metadata: Metadata = {
  title: '코드로 입장하기',
  description:
    '선생님이 알려준 6자리 코드를 입력하면 퀴즈독 게임에 바로 들어갈 수 있어요. 가입도 설치도 필요 없습니다.',
  alternates: { canonical: '/lobby' },
  openGraph: {
    title: '코드로 입장하기 | 퀴즈독',
    description: '6자리 코드만 입력하면 바로 참여. 가입도 설치도 없이.',
  },
}

export default function LobbyLayout({ children }: { children: React.ReactNode }) {
  return children
}
