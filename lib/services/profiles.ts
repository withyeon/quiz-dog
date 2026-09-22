import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/** 표시 이름이 바뀌면 브라우저 안에서 알린다 (사이드바 등 즉시 갱신용) */
export const PROFILE_UPDATED_EVENT = 'quizdog:profile-updated'
export const DISPLAY_NAME_MAX = 20

/** 저장된 세션의 사용자 (서버 왕복 없이). 로그인 안 했으면 null. */
async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user ?? null
}

function readMeta(user: User | null | undefined, key: string): string {
  const v = user?.user_metadata?.[key]
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 회원가입 때 입력한 이름 → 소셜 로그인 프로필 이름 → 이메일 앞부분 순으로 기본 표시 이름을 정한다.
 * (DB 트리거 handle_new_user 와 같은 규칙. sql/20260922_profile_display_name_defaults.sql)
 */
export function deriveDefaultDisplayName(user: User | null | undefined): string {
  const fromMeta =
    readMeta(user, 'display_name') ||
    readMeta(user, 'name') ||
    readMeta(user, 'full_name') ||
    readMeta(user, 'nickname') ||
    readMeta(user, 'preferred_username') ||
    readMeta(user, 'user_name')
  const fromEmail = user?.email ? user.email.split('@')[0].trim() : ''
  return (fromMeta || fromEmail || '선생님').slice(0, DISPLAY_NAME_MAX)
}

/** 로그인한 선생님의 표시 이름. 없으면 null. */
export async function getMyDisplayName(): Promise<string | null> {
  const userId = (await getSessionUser())?.id
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
 * 표시 이름이 비어 있으면(트리거 도입 전 가입자, 소셜 가입자 등) 묻지 않고 기본값으로 채운다.
 * 채워진(또는 이미 있던) 이름을 돌려준다.
 */
export async function ensureMyDisplayName(): Promise<string | null> {
  // 사이드바·설정 페이지 등 여러 곳에서 동시에 불러도 조회/저장은 한 번만 한다
  if (!ensureInFlight) {
    ensureInFlight = ensureMyDisplayNameOnce().finally(() => { ensureInFlight = null })
  }
  return ensureInFlight
}

let ensureInFlight: Promise<string | null> | null = null

async function ensureMyDisplayNameOnce(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user) return null

  const existing = await getMyDisplayName()
  if (existing) return existing

  const fallback = deriveDefaultDisplayName(user)
  try {
    await saveMyDisplayName(fallback)
    return fallback
  } catch (error) {
    console.error('기본 표시 이름 저장 실패:', error)
    return fallback
  }
}

/**
 * 표시 이름 저장.
 *
 * 마이그레이션이 기존 가입자 몫의 profiles 행을 미리 만들어 두지만,
 * 그 사이에 가입한 계정은 행이 없을 수 있어 upsert 로 넣는다.
 */
export async function saveMyDisplayName(displayName: string): Promise<void> {
  const userId = (await getSessionUser())?.id
  if (!userId) throw new Error('로그인이 필요합니다.')

  const trimmed = displayName.trim().slice(0, DISPLAY_NAME_MAX)
  if (!trimmed) throw new Error('표시 이름을 입력해 주세요.')

  const { error } = await (supabase.from('profiles') as any)
    .upsert(
      { id: userId, display_name: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )

  if (error) throw error

  // auth 메타데이터에도 같이 두면 다음 로그인 직후 DB 조회 전에도 이름을 보여줄 수 있다 (실패해도 무시)
  void supabase.auth.updateUser({ data: { display_name: trimmed } }).catch(() => {})

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { displayName: trimmed } }))
  }
}
