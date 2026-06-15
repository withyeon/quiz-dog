/**
 * 관리자(admin) 계정 판별 유틸.
 *
 * 관리자 이메일 목록은 환경변수로 관리한다.
 * - 클라이언트: NEXT_PUBLIC_ADMIN_EMAILS
 * - 서버: ADMIN_EMAILS (없으면 NEXT_PUBLIC_ADMIN_EMAILS 로 폴백)
 *
 * 두 값은 쉼표(,)로 구분된 이메일 목록이다.
 *
 * NOTE: 실제 관리자 기능(UI/권한 동작)은 아직 미구현 상태이며,
 * 여기서는 "해당 이메일로 로그인했는지"를 판별하는 토대만 제공한다.
 */

function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

/** 환경변수에서 관리자 이메일 목록을 가져온다(클라이언트/서버 모두 동작). */
export function getAdminEmails(): string[] {
  const fromPublic = parseAdminEmails(process.env.NEXT_PUBLIC_ADMIN_EMAILS)
  if (fromPublic.length > 0) return fromPublic
  return parseAdminEmails(process.env.ADMIN_EMAILS)
}

/** 주어진 이메일이 관리자 계정인지 여부. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return getAdminEmails().includes(normalized)
}
