'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { deriveDefaultDisplayName, ensureMyDisplayName, PROFILE_UPDATED_EVENT } from '@/lib/services/profiles'

/**
 * 로그인한 선생님의 표시 이름.
 * DB 조회 전에는 가입 메타데이터/이메일로 만든 기본값을 먼저 보여주고,
 * 프로필에 이름이 없으면 그 기본값을 조용히 저장해 둔다 (묻는 팝업 없음).
 */
export function useMyDisplayName(): string {
  const { user } = useAuth()
  const [name, setName] = useState<string>(() => deriveDefaultDisplayName(user))

  useEffect(() => {
    setName(deriveDefaultDisplayName(user))
    if (!user) return

    let cancelled = false
    void ensureMyDisplayName().then((n) => {
      if (!cancelled && n) setName(n)
    })

    const onUpdated = (e: Event) => {
      const next = (e as CustomEvent<{ displayName?: string }>).detail?.displayName
      if (next) setName(next)
    }
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdated)
    return () => {
      cancelled = true
      window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdated)
    }
  }, [user])

  return name
}
