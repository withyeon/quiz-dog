import { NextRequest, NextResponse } from 'next/server'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { expireStaleRooms } from '@/lib/services/roomExpiry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 선생님이 '게임 시작' 화면을 열 때 한 번 호출하는 보조 정리.
 *
 * 주 정리는 GitHub Actions 크론(15분)이 맡는다. 이 경로는 크론이 멈췄거나 아직 안 돌았을 때
 * 선생님이 들어오는 순간만이라도 2시간 지난 방이 닫히고 결과가 기록에 남게 하는 안전망이다.
 * 로그인한 선생님이면 누구나 호출할 수 있지만, 하는 일은 크론과 똑같은 전역 스윕뿐이라 권한 문제가 없다.
 */

/** 같은 서버 인스턴스 안에서 이 간격 안에 또 오면 건너뛴다 (선생님 여럿이 동시에 열어도 DB 를 한 번만 훑도록) */
const MIN_INTERVAL_MS = 60 * 1000
let lastSweepAt = 0

export async function POST(request: NextRequest) {
  const userId = await resolveTeacherUserId(request)
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const now = Date.now()
  if (now - lastSweepAt < MIN_INTERVAL_MS) {
    return NextResponse.json({ success: true, skipped: true })
  }
  lastSweepAt = now

  try {
    const result = await expireStaleRooms(getAdminSupabase())
    return NextResponse.json({
      success: true,
      expiredCount: result.expired.length,
      reportedCount: result.reported.length,
    })
  } catch (error) {
    console.error('[sweep-rooms] 선생님 화면 보조 정리 실패:', error)
    return NextResponse.json({ error: '정리에 실패했습니다.' }, { status: 500 })
  }
}
