'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { isLegacyAdminEmail } from '@/lib/admin/admins'

/**
 * 화면용: 지금 로그인한 사람이 관리자인지 is_admin() RPC 로 묻는다.
 * 관리자 이메일 목록은 화면에 내려오지 않는다. 화면 판정은 메뉴를 보일지 정할 뿐이고, 실제 권한은 서버 API가 다시 확인한다.
 * RPC가 아직 없으면(sql/20261029_admin_users.sql 적용 전) 예전 목록으로 판단한다.
 */

const resultByUser = new Map<string, Promise<boolean>>()

export function checkIsAdmin(user: { id: string; email?: string | null }): Promise<boolean> {
  const cached = resultByUser.get(user.id)
  if (cached) return cached
  const pending = (async () => {
    const { data, error } = await (supabase as any).rpc('is_admin')
    if (error) {
      resultByUser.delete(user.id)
      return isLegacyAdminEmail(user.email)
    }
    return data === true
  })()
  resultByUser.set(user.id, pending)
  return pending
}

export function useIsAdmin(): { isAdmin: boolean; checking: boolean } {
  const { user, loading } = useAuth()
  const [state, setState] = useState<{ userId: string | null; isAdmin: boolean }>({ userId: null, isAdmin: false })

  useEffect(() => {
    if (!user) return
    let alive = true
    checkIsAdmin(user).then((isAdmin) => {
      if (alive) setState({ userId: user.id, isAdmin })
    })
    return () => {
      alive = false
    }
  }, [user])

  if (loading) return { isAdmin: false, checking: true }
  if (!user) return { isAdmin: false, checking: false }
  if (state.userId !== user.id) return { isAdmin: false, checking: true }
  return { isAdmin: state.isAdmin, checking: false }
}
