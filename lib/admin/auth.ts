import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { isAdminEmailOnServer } from '@/lib/admin/adminList.server'

/**
 * 관리자 API 보호용 서버 헬퍼.
 *
 * 인증 3단계:
 *  1) Supabase 로그인 세션(Authorization: Bearer <access_token>) 검증
 *  2) 로그인 이메일이 관리자 목록(Supabase admin_users 표)에 있는지 확인
 *  3) 2차 비밀번호 통과 후 발급된 admin-session 쿠키 확인
 *
 * 쿠키 값은 `authenticated:<만료 epoch ms>` 다. 만료 시각을 값에 같이 담아 두어
 * 화면이 "인증 N시간 남음"을 보여 주고, 지나면 서버에서도 거부한다.
 */

export const ADMIN_SESSION_COOKIE = 'admin-session'
export const ADMIN_SESSION_PREFIX = 'authenticated'
/** 2차 인증 유효 시간 */
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export interface AdminAuthResult {
  ok: boolean
  email?: string
  /** 인증 실패 시 그대로 반환할 응답 */
  response?: NextResponse
}

/** 새 2차 인증 쿠키 값과 만료 시각(ISO)을 만든다. */
export function issueAdminSession(): { value: string; expiresAt: string } {
  const exp = Date.now() + ADMIN_SESSION_TTL_MS
  return { value: `${ADMIN_SESSION_PREFIX}:${exp}`, expiresAt: new Date(exp).toISOString() }
}

/** 쿠키 값이 유효하면 만료 시각(ISO)을, 아니면 null 을 돌려준다. */
export function parseAdminSession(value: string | undefined | null): string | null {
  if (!value) return null
  const [prefix, expRaw] = value.split(':')
  if (prefix !== ADMIN_SESSION_PREFIX) return null
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp <= Date.now()) return null
  return new Date(exp).toISOString()
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

/** 1) 로그인 + 2) 관리자 이메일까지만 확인 (2차 비밀번호 검증 전 단계에서 사용) */
export async function verifyAdminUser(request: NextRequest): Promise<
  { ok: true; email: string } | { ok: false; response: NextResponse }
> {
  const token = bearerToken(request)
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }),
    }
  }

  const supabase = getAdminSupabase()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: '유효하지 않은 세션입니다.' }, { status: 401 }),
    }
  }

  if (!(await isAdminEmailOnServer(data.user.email))) {
    return {
      ok: false,
      response: NextResponse.json({ error: '관리자 권한이 없습니다.' }, { status: 403 }),
    }
  }

  return { ok: true, email: data.user.email }
}

/** 1) + 2) + 3) 전체 게이트. 보호된 모든 관리자 API의 첫 줄에서 호출. */
export async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const user = await verifyAdminUser(request)
  if (!user.ok) return { ok: false, response: user.response }

  const expiresAt = parseAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
  if (!expiresAt) {
    return {
      ok: false,
      response: NextResponse.json({ error: '2차 인증이 필요합니다.', reason: '2차 인증 필요' }, { status: 401 }),
    }
  }

  return { ok: true, email: user.email }
}
