import type { User } from '@supabase/supabase-js'
import { getAdminSupabase } from '@/lib/supabase/admin'

/** auth.users 전체를 페이지네이션으로 모두 가져온다. */
export async function listAllAuthUsers(): Promise<User[]> {
  const supabase = getAdminSupabase()
  const all: User[] = []
  const perPage = 1000
  let page = 1

  // 안전장치: 최대 50페이지(5만명)까지만
  while (page <= 50) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    all.push(...data.users)
    if (data.users.length < perPage) break
    page += 1
  }

  return all
}
