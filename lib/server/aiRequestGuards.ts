import type { NextRequest } from 'next/server'

// AI 생성 API(문제·단어장) 공통 문지기. 비용이 드는 호출이라 외부 사이트와 연타를 먼저 막는다.

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

/**
 * 간단한 IP 레이트리밋 (인스턴스 메모리 기준 — 서버리스에서는 인스턴스마다 별도이나
 * 단순 연타/스크립트 남용을 막는 비용 0짜리 속도 제한). API 마다 하나씩 만든다.
 */
export function createRateLimiter(windowMs: number, max: number): (ip: string) => boolean {
  const bucket = new Map<string, number[]>()
  return (ip: string) => {
    const now = Date.now()
    const recent = (bucket.get(ip) ?? []).filter((t) => now - t < windowMs)
    recent.push(now)
    bucket.set(ip, recent)
    return recent.length > max
  }
}

// 같은 사이트(브라우저)에서 온 요청만 허용 — 외부 사이트/스크립트의 무단 호출 차단
export function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? ''
  const source = request.headers.get('origin') ?? request.headers.get('referer') ?? ''
  if (!host || !source) return false
  try {
    return new URL(source).host === host
  } catch {
    return false
  }
}
