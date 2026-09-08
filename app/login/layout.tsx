import type { Metadata } from 'next'

// page.tsx가 'use client'라 메타데이터를 직접 못 넣는다. 이 레이아웃이 대신 담당한다.
export const metadata: Metadata = {
  title: '선생님 로그인',
  description: '퀴즈독 선생님 로그인. 이메일 또는 구글·카카오 계정으로 시작하세요.',
  alternates: { canonical: '/login' },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
