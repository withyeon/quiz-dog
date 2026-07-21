import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { listAllAuthUsers } from '@/lib/admin/users'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const users = await listAllAuthUsers()

    // owner_id 별 문제세트 수 집계
    const { data: sets } = await supabase.from('question_sets').select('owner_id')
    const setCountByOwner = new Map<string, number>()
    for (const s of (sets ?? []) as Array<{ owner_id: string | null }>) {
      if (!s.owner_id) continue
      setCountByOwner.set(s.owner_id, (setCountByOwner.get(s.owner_id) ?? 0) + 1)
    }

    const result = users
      .map((u) => ({
        id: u.id,
        email: u.email ?? '(이메일 없음)',
        provider: (u.app_metadata?.provider as string) ?? 'email',
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        setCount: setCountByOwner.get(u.id) ?? 0,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('교사 목록 조회 오류:', error)
    return NextResponse.json({ error: '교사 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
