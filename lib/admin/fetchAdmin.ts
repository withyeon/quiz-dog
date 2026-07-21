import { supabase } from '@/lib/supabase/client'

/**
 * 관리자 API 호출용 fetch 래퍼 (클라이언트 전용).
 * Supabase 세션의 access_token 을 Authorization 헤더로 자동 첨부한다.
 */
export async function fetchAdmin(input: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = new Headers(init.headers)
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(input, { ...init, headers, cache: 'no-store' })
}

/** fetchAdmin 후 JSON 파싱까지. 실패 시 throw. */
export async function fetchAdminJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchAdmin(input, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data as { error?: string })?.error || `요청 실패 (${res.status})`
    throw new Error(message)
  }
  return data as T
}
