import type { LucideIcon } from 'lucide-react'
import { BarChart3, ClipboardCheck, Megaphone, MessageSquare, Radio, Server, ShieldCheck, Users } from 'lucide-react'

export interface AdminNavItem {
  label: string
  href: string
  icon: LucideIcon
  /** 페이지 상단과 대시보드 바로가기에 쓰는 한 줄 설명. */
  description: string
}

export interface AdminNavGroup {
  label: string
  items: AdminNavItem[]
}

/** 관리자 메뉴. 초피티 관리자와 같은 묶음(현황·사람·소통)으로 둔다. */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: '현황',
    items: [
      { label: '대시보드', href: '/admin/dashboard', icon: BarChart3, description: '가입·게임·요금제 현황을 한눈에 봅니다.' },
      { label: '게임 / 세션', href: '/admin/sessions', icon: Radio, description: '열린 게임 방을 찾아 종료하거나 정리합니다.' },
      { label: '수업 점검', href: '/admin/daily-check', icon: ClipboardCheck, description: '하루 동안의 수업, 기록 누락, 화면 오류를 돌아봅니다.' },
      { label: '서버 상태', href: '/admin/server', icon: Server, description: '중계 서버·Supabase 부하와 과부하 기록, 화면 오류를 실시간으로 봅니다.' },
    ],
  },
  {
    label: '사람',
    items: [
      { label: '교사 관리', href: '/admin/users', icon: Users, description: '교사 계정, 프로 기간, 가입 전 요금제 예약을 관리합니다.' },
      { label: '관리자 계정', href: '/admin/admins', icon: ShieldCheck, description: '관리자 목록(Supabase admin_users)을 추가·삭제합니다.' },
    ],
  },
  {
    label: '소통',
    items: [
      { label: '공지사항', href: '/admin/announcements', icon: Megaphone, description: '교사에게 보이는 공지를 작성하고 게시합니다.' },
      { label: '문제 신고', href: '/admin/feedback', icon: MessageSquare, description: '사용자가 보낸 문의와 오류 신고를 처리합니다.' },
    ],
  },
]

export function findAdminNavItem(pathname: string): AdminNavItem | null {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item
    }
  }
  return null
}
