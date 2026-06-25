import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { isAdminEmail } from '@/lib/admin/admins'

/**
 * 관리자 API 보호용 서버 헬퍼.
 *
 * 인증 3단계:
 *  1) Supabase 로그인 세션(Authorization: Bearer <access_token>) 검증
 *  2) 로그인 이메일이 관리자 허용목록(ADMIN_EMAILS)에 있는지 확인
 *  3) 2차 비밀번호 통과 후 발급된 admin-session 쿠키 확인
 */

export const ADMIN_SESSION_COOKIE = 'admin-session'
export const ADMIN_SESSION_VALUE = 'authenticated'

export interface AdminAuthResult {
  ok: boolean
  email?: string
  /** 인증 실패 시 그대로 반환할 응답 */
  response?: NextResponse
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

  if (!isAdminEmail(data.user.email)) {
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

  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)
  if (!adminSession || adminSession.value !== ADMIN_SESSION_VALUE) {
    return {
      ok: false,
      response: NextResponse.json({ error: '2차 인증이 필요합니다.', reason: '2차 인증 필요' }, { status: 401 }),
    }
  }

  return { ok: true, email: user.email }
}
