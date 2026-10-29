/**
 * 관리자(admin) 계정 판별 유틸.
 *
 * 관리자 이메일 목록은 환경변수로 관리한다.
 * - 클라이언트: NEXT_PUBLIC_ADMIN_EMAILS
 * - 서버: ADMIN_EMAILS (없으면 NEXT_PUBLIC_ADMIN_EMAILS 로 폴백)
 *
 * 두 값은 쉼표(,)로 구분된 이메일 목록이다. 여기에 코드에 박아 둔 기본 관리자(BUILT_IN_ADMIN_EMAILS)를 더한다.
 * 기본 관리자는 환경변수를 고치지 않아도 늘 관리자다. 관리자 화면은 2차 비밀번호도 따로 요구한다.
 */

/** 운영 환경변수와 상관없이 늘 관리자인 계정 */
export const BUILT_IN_ADMIN_EMAILS = ['withyeonedu@gmail.com']

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
  const fromEnv = fromPublic.length > 0 ? fromPublic : parseAdminEmails(process.env.ADMIN_EMAILS)
  return [...new Set([...fromEnv, ...BUILT_IN_ADMIN_EMAILS])]
}

/** 주어진 이메일이 관리자 계정인지 여부. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return getAdminEmails().includes(normalized)
}
