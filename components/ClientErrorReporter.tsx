'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * 브라우저 오류를 /api/client-errors 로 보낸다. 루트 레이아웃에 한 번 마운트한다.
 *
 * 잡는 것: window 'error'(스크립트 오류·리소스 로드 실패 제외), 'unhandledrejection',
 * 그리고 app/error.tsx·global-error.tsx 가 부르는 reportClientError.
 * 방 코드·playerId 는 게임 화면 URL(?room=&playerId=)에서 읽어 함께 보낸다.
 *
 * 한 페이지에서 같은 문구는 한 번만, 전체는 10건까지만 보낸다. 개발 서버에서는 보내지 않는다
 * (주소에 ?errlog=1 을 붙이면 개발에서도 보낸다).
 */

const MAX_PER_PAGE = 10
const sent = new Set<string>()
let sentCount = 0

// 브라우저 확장·광고 차단기 등 앱 밖에서 나는 잡음은 거른다.
const IGNORE_PATTERNS = [
  /ResizeObserver loop/i,
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /Script error\.?$/i,
  /Loading chunk [\d]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /AbortError/i,
  /The user aborted a request/i,
  /Load failed$/i,
]

export type ClientErrorKind = 'error' | 'unhandledrejection' | 'page_error' | 'global_error' | 'console_error'

function shouldReport(): boolean {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV !== 'production') {
    try {
      return new URLSearchParams(window.location.search).get('errlog') === '1'
    } catch {
      return false
    }
  }
  return true
}

function describe(value: unknown): { message: string; stack: string | null } {
  if (value instanceof Error) return { message: value.message || value.name || 'Error', stack: value.stack ?? null }
  if (typeof value === 'string') return { message: value, stack: null }
  if (value && typeof value === 'object') {
    const record = value as { message?: unknown; reason?: unknown }
    if (typeof record.message === 'string') return { message: record.message, stack: null }
    if (typeof record.reason === 'string') return { message: record.reason, stack: null }
    try {
      return { message: JSON.stringify(value).slice(0, 500), stack: null }
    } catch {
      return { message: String(value), stack: null }
    }
  }
  return { message: String(value), stack: null }
}

export async function reportClientError(kind: ClientErrorKind, value: unknown, extra: Record<string, unknown> = {}): Promise<void> {
  if (!shouldReport()) return
  const { message, stack } = describe(value)
  if (!message || IGNORE_PATTERNS.some((pattern) => pattern.test(message) || (stack ? pattern.test(stack) : false))) return

  const key = `${kind}|${message}`
  if (sent.has(key) || sentCount >= MAX_PER_PAGE) return
  sent.add(key)
  sentCount += 1

  let roomCode: string | null = null
  let playerId: string | null = null
  try {
    const params = new URLSearchParams(window.location.search)
    roomCode = params.get('room')
    playerId = params.get('playerId')
    // /lobby/123456, /teacher/game/123456 처럼 경로에 방 코드가 들어가는 화면
    if (!roomCode) {
      const match = window.location.pathname.match(/\/(\d{6})(?:\/|$)/)
      if (match) roomCode = match[1]
    }
  } catch {
    // 주소를 못 읽어도 오류 자체는 보낸다
  }

  const body = {
    kind,
    message,
    stack,
    path: window.location.pathname,
    roomCode,
    extra: {
      ...extra,
      playerId,
      digest: (value as { digest?: string } | null)?.digest ?? undefined,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
    },
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`
  } catch {
    // 로그인 정보가 없으면 익명으로 보낸다
  }

  try {
    await fetch('/api/client-errors', { method: 'POST', headers, body: JSON.stringify(body), keepalive: true })
  } catch {
    // 보내기 실패는 조용히 넘긴다. 오류 보고가 또 오류를 만들면 안 된다.
  }
}

export default function ClientErrorReporter() {
  useEffect(() => {
    if (!shouldReport()) return

    const onError = (event: ErrorEvent) => {
      // 이미지·스크립트 로드 실패(ErrorEvent 가 아닌 Event)는 message 가 없다
      if (!event.message) return
      void reportClientError('error', event.error ?? event.message, {
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      void reportClientError('unhandledrejection', event.reason)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
