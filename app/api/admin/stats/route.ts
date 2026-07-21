import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { listAllAuthUsers } from '@/lib/admin/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES = ['waiting', 'playing', 'paused']

function startOfTodayKST(): Date {
  // KST(UTC+9) 기준 오늘 0시를 UTC Date로 환산
  const now = new Date()
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000
  const kst = new Date(kstMs)
  kst.setUTCHours(0, 0, 0, 0)
  return new Date(kst.getTime() - 9 * 60 * 60 * 1000)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const users = await listAllAuthUsers()

    const todayStart = startOfTodayKST()
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000)

    const newTeachersToday = users.filter((u) => new Date(u.created_at) >= todayStart).length
    const newTeachersThisWeek = users.filter((u) => new Date(u.created_at) >= weekStart).length
    const newTeachersThisMonth = users.filter((u) => new Date(u.created_at) >= monthStart).length

    // 테이블 카운트 (RLS는 service role 이 우회)
    const [setsCount, gamesCount, roomsActive, openFeedback] = await Promise.all([
      supabase.from('question_sets').select('*', { count: 'exact', head: true }),
      supabase.from('game_reports').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES),
      supabase.from('feedback').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    ])

    // 최근 14일 신규 가입 추이
    const trend: { date: string; signups: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const count = users.filter((u) => {
        const c = new Date(u.created_at)
        return c >= dayStart && c < dayEnd
      }).length
      const kst = new Date(dayStart.getTime() + 9 * 60 * 60 * 1000)
      trend.push({
        date: `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}`,
        signups: count,
      })
    }

    return NextResponse.json({
      totalTeachers: users.length,
      newTeachersToday,
      newTeachersThisWeek,
      newTeachersThisMonth,
      totalQuestionSets: setsCount.count ?? 0,
      totalGames: gamesCount.count ?? 0,
      activeRooms: roomsActive.count ?? 0,
      openFeedback: openFeedback.count ?? 0,
      trend,
    })
  } catch (error) {
    console.error('관리자 통계 조회 오류:', error)
    return NextResponse.json({ error: '통계 데이터를 불러오지 못했습니다.' }, { status: 500 })
  }
}
