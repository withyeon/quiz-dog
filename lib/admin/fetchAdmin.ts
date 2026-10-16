import { supabase } from '@/lib/supabase/client'

/**
 * 관리자 API 호출용 fetch 래퍼 (클라이언트 전용).
 * Supabase 세션의 access_token 을 Authorization 헤더로 자동 첨부한다.
 * 2차 인증이 풀린 401이 오면 화면 전체에 알려(ADMIN_RELOCK_EVENT) 비밀번호 입력으로 되돌린다.
 */
export const ADMIN_RELOCK_EVENT = 'admin:relock'

export class AdminApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

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

  return fetch(input, { ...init, headers, cache: 'no-store', credentials: 'same-origin' })
}

/** fetchAdmin 후 JSON 파싱까지. 실패 시 서버가 준 문구로 throw. */
export async function fetchAdminJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await fetchAdmin(input, init)
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!res.ok) {
    const record = (data ?? {}) as { error?: string; message?: string; reason?: string }
    const message = record.error || record.message || `요청에 실패했습니다. (${res.status})`
    // 2차 인증 만료·폐기(관리자 API 는 reason 을 같이 준다)면 비밀번호 입력으로 되돌린다
    if (res.status === 401 && record.reason === '2차 인증 필요' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_RELOCK_EVENT, { detail: { message } }))
    }
    throw new AdminApiError(message, res.status)
  }
  return data as T
}

/** JSON 본문을 보내는 요청 옵션. */
export function adminJson(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', payload?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }
}
