import { ReactNode } from 'react'
import { AdminGate } from '@/components/admin/shell/AdminGate'
import { AdminShell } from '@/components/admin/shell/AdminShell'

/**
 * 관리자 영역 레이아웃. 관문(AdminGate)이 로그인·관리자 이메일·2차 비밀번호를 확인한 뒤
 * 틀(AdminShell)이 사이드바와 헤더를 그린다.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <AdminShell>{children}</AdminShell>
    </AdminGate>
  )
}
