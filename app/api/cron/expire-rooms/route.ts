import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { expireStaleRooms } from '@/lib/services/roomExpiry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 방치된 게임 룸 자동 종료 (스케줄러 + 관리자 수동 실행용).
 *
 * 호출 주체:
 *   - Vercel Cron — vercel.json 의 crons 설정. `Authorization: Bearer $CRON_SECRET` 를 붙여 보낸다.
 *   - 관리자 — '게임 / 세션' 페이지의 '방치된 방 정리' 버튼 (관리자 3단계 인증 통과 필요)
 *
 * CRON_SECRET 환경변수가 없으면 크론 경로는 막히고 관리자만 호출할 수 있다.
 */

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token.trim()
}

/**
 * 관리자 로그인 토큰(Supabase JWT)은 점 두 개로 나뉜 3조각이다.
 * 그렇지 않은 값은 크론 암호를 넣은 것으로 보고, 세션 오류 대신 크론 오류로 안내한다.
 * (같은 401 이라도 "로그인 문제"와 "암호 불일치"는 고칠 방법이 완전히 다르다.)
 */
function looksLikeSessionToken(token: string): boolean {
  return token.split('.').length === 3
}

async function handle(request: NextRequest) {
  const token = bearerToken(request)
  const cronSecret = process.env.CRON_SECRET

  const isCronCall = Boolean(cronSecret) && token === cronSecret

  if (!isCronCall) {
    if (token && !looksLikeSessionToken(token)) {
      return NextResponse.json(
        {
          error: cronSecret
            ? '크론 암호가 일치하지 않습니다. Vercel 환경변수 CRON_SECRET 값과 다릅니다.'
            : '이 배포에는 CRON_SECRET 환경변수가 없습니다. Vercel에 등록한 뒤 다시 배포해주세요.',
          cronSecretConfigured: Boolean(cronSecret),
        },
        { status: 401 },
      )
    }

    const auth = await requireAdmin(request)
    if (!auth.ok) return auth.response!
  }

  try {
    const result = await expireStaleRooms(getAdminSupabase())
    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      expiredCount: result.expired.length,
      expired: result.expired,
      skippedLive: result.skippedLive,
    })
  } catch (error) {
    console.error('방치 룸 자동 종료 오류:', error)
    return NextResponse.json({ error: '자동 종료 처리에 실패했습니다.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
