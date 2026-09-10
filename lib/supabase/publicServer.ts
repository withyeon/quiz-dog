import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * 서버에서 "공개 데이터만" 읽을 때 쓰는 클라이언트.
 *
 * lib/supabase/client.ts 의 싱글턴은 persistSession: true 라서 브라우저용이다.
 * 서버 컴포넌트에서 그걸 쓰면 요청마다 다른 사용자의 세션이 한 모듈에 섞일 수 있다.
 * 여기서는 로그인 개념 자체가 없는(비로그인 방문자가 보는) 페이지만 다루므로
 * 세션을 아예 들고 있지 않는 별도 클라이언트를 만든다.
 *
 * 공개 키(anon)를 쓰기 때문에 RLS 를 켠 뒤에도 읽기 정책이 허용하는 것만 보인다.
 */
export function createPublicServerClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase 환경 변수가 없습니다 (URL / PUBLISHABLE_KEY).')
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
