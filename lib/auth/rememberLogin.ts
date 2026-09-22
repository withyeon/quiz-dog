// "자동 로그인" 설정 (브라우저별 저장)
//
// - 켜짐(기본): Supabase 세션을 localStorage 에 저장해 브라우저를 닫았다 열어도 로그인이 유지된다.
// - 꺼짐: sessionStorage 에 저장해 탭/브라우저를 닫으면 로그아웃된다 (학교 공용 컴퓨터용).
// 로그인 직전에 setRememberLogin() 을 호출해야 그 세션이 올바른 저장소에 들어간다.
// (lib/supabase/client.ts 의 storage 어댑터가 저장할 때마다 이 값을 읽는다.)

export const REMEMBER_LOGIN_KEY = 'quizdog.auth.remember'
export const REMEMBERED_EMAIL_KEY = 'quizdog.auth.email'

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

/** 자동 로그인 여부. 저장된 값이 없으면 켜짐(true). */
export function getRememberLogin(): boolean {
  const ls = safeLocalStorage()
  if (!ls) return true
  try {
    return ls.getItem(REMEMBER_LOGIN_KEY) !== '0'
  } catch {
    return true
  }
}

export function setRememberLogin(remember: boolean): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    ls.setItem(REMEMBER_LOGIN_KEY, remember ? '1' : '0')
  } catch {
    /* 비공개 모드 등에서 저장이 막혀도 로그인 자체는 진행한다 */
  }
}

/** 자동 로그인을 켜고 이메일로 로그인했을 때 기억해 둔 이메일 (없으면 빈 문자열) */
export function getRememberedEmail(): string {
  const ls = safeLocalStorage()
  if (!ls) return ''
  try {
    return ls.getItem(REMEMBERED_EMAIL_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setRememberedEmail(email: string | null): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    if (email) ls.setItem(REMEMBERED_EMAIL_KEY, email)
    else ls.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * 로그인 시도 직전에 호출: 자동 로그인 설정을 저장하고, 이메일 로그인이면 이메일도 기억한다.
 * (소셜 로그인은 email 을 넘기지 않는다)
 */
export function applyRememberLogin(remember: boolean, email?: string): void {
  setRememberLogin(remember)
  setRememberedEmail(remember && email ? email.trim() : null)
}
