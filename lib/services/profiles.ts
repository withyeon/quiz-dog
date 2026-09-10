import { supabase } from '@/lib/supabase/client'

/** 로그인한 선생님의 표시 이름. 없으면 null. */
export async function getMyDisplayName(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) return null

  const { data, error } = await (supabase.from('profiles') as any)
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  const name = (data as { display_name: string | null } | null)?.display_name?.trim()
  return name ? name : null
}

/**
 * 표시 이름 저장.
 *
 * 마이그레이션이 기존 가입자 몫의 profiles 행을 미리 만들어 두지만,
 * 그 사이에 가입한 계정은 행이 없을 수 있어 upsert 로 넣는다.
 */
export async function saveMyDisplayName(displayName: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth?.user?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = displayName.trim()
  if (!trimmed) throw new Error('표시 이름을 입력해 주세요.')

  const { error } = await (supabase.from('profiles') as any)
    .upsert(
      { id: userId, display_name: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )

  if (error) throw error
}
