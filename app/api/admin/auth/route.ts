import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminUser,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
} from '@/lib/admin/auth'

export const runtime = 'nodejs'

/**
 * POST: 2차 비밀번호 검증 → admin-session 쿠키 발급
 * GET:  현재 관리자 인증 상태 확인 (로그인 + 관리자 + 2차 인증)
 */

export async function POST(request: NextRequest) {
  const user = await verifyAdminUser(request)
  if (!user.ok) return user.response

  let password = ''
  try {
    const body = await request.json()
    password = typeof body?.password === 'string' ? body.password : ''
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  if (!password) {
    return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_SECONDARY_PASSWORD
  if (!adminPassword) {
    console.error('ADMIN_SECONDARY_PASSWORD 환경변수가 설정되지 않았습니다.')
    return NextResponse.json({ error: '시스템 설정 오류입니다.' }, { status: 500 })
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  const response = NextResponse.json({
    authenticated: true,
    success: true,
    message: '관리자 인증이 완료되었습니다.',
  })

  response.cookies.set(ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24시간
  })

  return response
}

export async function GET(request: NextRequest) {
  const user = await verifyAdminUser(request)
  if (!user.ok) {
    // 로그인/권한 단계 실패는 authenticated=false 로 통일해 게이트에서 처리
    return NextResponse.json({ authenticated: false, reason: '권한 없음' })
  }

  const adminSession = request.cookies.get(ADMIN_SESSION_COOKIE)
  if (!adminSession || adminSession.value !== ADMIN_SESSION_VALUE) {
    return NextResponse.json({ authenticated: false, reason: '2차 인증 필요' })
  }

  return NextResponse.json({ authenticated: true, user: user.email })
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
  })
  return response
}
