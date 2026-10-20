import type { Metadata } from 'next'
import PublicLibraryContent from '@/components/library/PublicLibraryContent'

export const metadata: Metadata = {
  title: '자료실',
  alternates: { canonical: '/explore' },
  description:
    '학년·과목·단원별 퀴즈 문제집을 로그인 없이 둘러보고 문제를 미리 볼 수 있어요. 마음에 들면 내 문제집에 담아 바로 게임 수업을 시작하세요.',
  openGraph: {
    title: '자료실 | 퀴즈독',
    description: '학년·과목별 퀴즈 문제집을 로그인 없이 미리 보고, 바로 수업에 쓰세요.',
  },
}

/** 공개 자료실 — 로그인 없이 목록·문제 미리보기까지 열려 있고, 담기·게임 시작에서만 로그인한다. */
export default function PublicLibraryPage() {
  return <PublicLibraryContent />
}
