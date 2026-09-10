import type { NextRequest } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

/**
 * 요청의 `Authorization: Bearer <access_token>`에서 로그인한 선생님의 user id를 알아낸다.
 * 토큰이 없거나 만료됐으면 null. (서버 전용)
 */
export async function resolveTeacherUserId(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  try {
    const { data, error } = await getAdminSupabase().auth.getUser(token)
    if (error || !data.user) return null
    return data.user.id
  } catch {
    return null
  }
}
