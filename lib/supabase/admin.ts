import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * 서버 전용 Supabase 클라이언트 (service role / secret key).
 *
 * RLS를 우회하므로 절대 클라이언트 번들에 포함되면 안 된다.
 * 반드시 서버(라우트 핸들러)에서만 import 할 것.
 */

let cached: SupabaseClient<Database> | null = null

export function getAdminSupabase(): SupabaseClient<Database> {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error(
      'Supabase service role 설정 누락: NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SECRET_KEY 환경변수를 확인하세요.'
    )
  }

  cached = createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cached
}
