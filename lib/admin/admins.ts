/**
 * 관리자 판정의 "예전 목록" (sql/20261029_admin_users.sql 적용 전에만 쓰는 대비책).
 *
 * 관리자 목록의 기준은 Supabase public.admin_users 표다.
 * - 서버: lib/admin/adminList.server.ts (service role 로 표를 읽는다)
 * - 화면: lib/admin/useIsAdmin.ts (is_admin() RPC 로 "내가 관리자인가"만 묻는다)
 * 표나 함수가 아직 없을 때만 아래 환경변수·기본값으로 판단한다. SQL 적용 뒤에는 이 파일의 목록은 쓰이지 않는다.
 */

function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/** 표가 없을 때도 늘 관리자인 계정 */
const LEGACY_BUILT_IN_ADMIN_EMAILS = ['withyeonedu@gmail.com']

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/** 예전 목록: NEXT_PUBLIC_ADMIN_EMAILS (없으면 ADMIN_EMAILS) + 기본 관리자 */
export function getLegacyAdminEmails(): string[] {
  const fromPublic = parseAdminEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS)
  const fromEnv = fromPublic.length > 0 ? fromPublic : parseAdminEmails(process.env.ADMIN_EMAILS)
  return [...new Set([...fromEnv, ...LEGACY_BUILT_IN_ADMIN_EMAILS])]
}

export function isLegacyAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeAdminEmail(email)
  return Boolean(normalized) && getLegacyAdminEmails().includes(normalized)
}
