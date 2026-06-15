'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { isAdminEmail } from '@/lib/admin/admins'

export type AdminState = {
  /** 현재 로그인된 사용자 이메일(없으면 null). */
  email: string | null
  /** 현재 로그인 사용자가 관리자 계정인지 여부. */
  isAdmin: boolean
  /** 세션 확인이 끝났는지 여부. */
  loading: boolean
}

/**
 * 현재 Supabase 로그인 사용자가 관리자 계정인지 판별하는 훅.
 *
 * 해당 이메일(NEXT_PUBLIC_ADMIN_EMAILS)로 로그인하면 isAdmin === true.
 * 로그인 기능이 붙으면 이 훅으로 관리자 기능 노출 여부를 제어할 수 있다.
 */
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>({
    email: null,
    isAdmin: false,
    loading: true,
  })

  useEffect(() => {
    let active = true

    const apply = (email: string | null | undefined) => {
      if (!active) return
      const normalized = email ?? null
      setState({
        email: normalized,
        isAdmin: isAdminEmail(normalized),
        loading: false,
      })
    }

    supabase.auth
      .getUser()
      .then(({ data }) => apply(data.user?.email))
      .catch(() => apply(null))

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.user?.email)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return state
}
