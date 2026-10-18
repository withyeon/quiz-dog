import { NextResponse, type NextRequest } from 'next/server'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { getAiUsage } from '@/lib/server/aiUsage'

export const dynamic = 'force-dynamic'

/** 로그인한 선생님의 이번 달 AI 문제 생성 사용량(문제 만들기 화면의 "이번 달 3/10회"). */
export async function GET(request: NextRequest) {
  const userId = await resolveTeacherUserId(request)
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  return NextResponse.json(await getAiUsage(userId))
}
