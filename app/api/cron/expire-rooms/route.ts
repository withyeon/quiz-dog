import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { expireStaleRooms } from '@/lib/services/roomExpiry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 방치된 게임 룸 자동 종료 (스케줄러용).
 *
 * 호출 주체:
 *   - Vercel Cron — vercel.json 의 crons 설정. `Authorization: Bearer $CRON_SECRET` 를 붙여 보낸다.
 *   - 관리자 — 수동으로 즉시 정리하고 싶을 때 (관리자 3단계 인증 통과 필요)
 *
 * CRON_SECRET 환경변수가 없으면 크론 경로는 막히고 관리자만 호출할 수 있다.
 */

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  return header === `Bearer ${secret}`
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
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
