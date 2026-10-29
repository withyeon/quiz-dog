import { getAdminSupabase } from '@/lib/supabase/admin'
import { getLegacyAdminEmails, isLegacyAdminEmail, normalizeAdminEmail } from '@/lib/admin/admins'

/**
 * 서버 전용: 관리자 목록(public.admin_users)을 읽는다. service role 을 쓰므로 화면 코드에서 import 하면 안 된다.
 * 관리자 API 마다 표를 읽지 않도록 30초 캐시한다. 관리자를 추가·삭제하면 invalidateAdminCache()로 비운다.
 * 표가 아직 없으면(sql/20261029_admin_users.sql 적용 전) 예전 목록으로 판단한다.
 */

export interface AdminRow {
  email: string
  note: string | null
  added_by: string | null
  created_at: string
}

const CACHE_MS = 30_000
let cache: { at: number; available: boolean; emails: Set<string> } | null = null

export function isMissingAdminTable(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(
    error &&
      (error.code === '42P01' || error.code === 'PGRST205' || /admin_users.*(does not exist|schema cache)|relation .*admin_users/i.test(error.message ?? '')),
  )
}

export function invalidateAdminCache() {
  cache = null
}

/** 관리자 표 전체. 표가 없으면 available=false */
export async function listAdminRows(): Promise<{ available: boolean; rows: AdminRow[] }> {
  const { data, error } = await (getAdminSupabase().from('admin_users') as any)
    .select('email, note, added_by, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingAdminTable(error)) {
      return {
        available: false,
        rows: getLegacyAdminEmails().map((email) => ({ email, note: '예전 목록(환경변수)', added_by: null, created_at: '' })),
      }
    }
    throw error
  }
  return { available: true, rows: (data ?? []) as AdminRow[] }
}

async function loadAdminEmails() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache
  const { available, rows } = await listAdminRows()
  cache = { at: Date.now(), available, emails: new Set(rows.map((row) => normalizeAdminEmail(row.email))) }
  return cache
}

/** 이 이메일이 관리자인가 (서버 판정) */
export async function isAdminEmailOnServer(email: string | null | undefined): Promise<boolean> {
  const normalized = normalizeAdminEmail(email)
  if (!normalized) return false
  try {
    const { emails } = await loadAdminEmails()
    return emails.has(normalized)
  } catch (error) {
    // 표를 읽다 다른 오류가 나면 예전 목록으로만 판단한다(관리자가 모두 잠기지 않게).
    console.error('[admin] admin_users 를 읽지 못해 예전 목록으로 판단합니다:', error)
    return isLegacyAdminEmail(normalized)
  }
}
