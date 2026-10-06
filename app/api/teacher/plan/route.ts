import { NextRequest, NextResponse } from 'next/server'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { getTeacherPlan } from '@/lib/server/teacherPlan'

/** 내 정보 화면의 '내 플랜'. 로그인한 선생님의 요금제와 프로 만료일. */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const userId = await resolveTeacherUserId(request)
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  return NextResponse.json(await getTeacherPlan(userId))
}
