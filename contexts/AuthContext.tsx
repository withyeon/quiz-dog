'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

// 저장된 세션은 있는데 토큰 갱신 요청이 일시적으로 실패(네트워크 끊김 등)한 경우,
// 곧바로 '로그아웃 상태'로 판정해 /login 으로 보내지 않고 잠깐 뒤 다시 시도한다.
const RECOVER_RETRY_DELAYS_MS = [1500, 3000]

async function loadSessionWithRetry(): Promise<Session | null> {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await supabase.auth.getSession()
    if (data.session || !error) return data.session
    const delay = RECOVER_RETRY_DELAYS_MS[attempt]
    if (delay === undefined) return null
    await new Promise((resolve) => setTimeout(resolve, delay))
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void loadSessionWithRetry().then((session) => {
      if (cancelled) return
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    // 기본값(global)은 이 계정의 모든 기기·브라우저 세션을 한꺼번에 끊는다.
    // 학교 컴퓨터에서 로그아웃하면 집 브라우저까지 풀려 버리므로, 지금 이 브라우저만 로그아웃한다.
    await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
