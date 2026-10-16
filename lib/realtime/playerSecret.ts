import { supabase } from '@/lib/supabase/client'

/**
 * 학생별 비밀 토큰. 입장할 때 만들고 원문은 그 탭의 sessionStorage에만 둔다.
 * DB(players.secret_hash)에는 SHA-256만 두므로, 다른 학생이 목록을 읽어도 토큰은 알 수 없다.
 * 중계 서버는 이벤트에 붙은 토큰의 해시가 그 playerId의 secret_hash와 같을 때만 그 학생 이름으로 중계한다.
 * (sql/20261016_relay_auth.sql 적용 전에는 컬럼이 없어 해시를 못 넣고, 서버는 예전 규칙으로 확인한다)
 */

const KEY_PREFIX = 'quizdog_player_secret'

function storageKey(playerId: string): string {
  return `${KEY_PREFIX}:${playerId}`
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashPlayerSecret(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
}

/** 새 토큰과 그 해시. 토큰은 256비트 난수 */
export async function createPlayerSecret(): Promise<{ token: string; hash: string }> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = toBase64Url(bytes)
  return { token, hash: await hashPlayerSecret(token) }
}

export function savePlayerSecret(playerId: string, token: string): void {
  if (typeof window === 'undefined' || !playerId) return
  try {
    window.sessionStorage.setItem(storageKey(playerId), token)
  } catch {
    // 저장소를 못 쓰면(사생활 보호 모드 등) 이 탭은 토큰 없이 보낸다 → 서버의 예전 학생 규칙을 따른다
  }
}

export function loadPlayerSecret(playerId: string | null | undefined): string | null {
  if (typeof window === 'undefined' || !playerId) return null
  try {
    return window.sessionStorage.getItem(storageKey(playerId))
  } catch {
    return null
  }
}

/** secret_hash 컬럼이 없는 DB(SQL 적용 전)에서 난 오류인가 */
export function isMissingSecretColumnError(error: unknown): boolean {
  const text = error && typeof error === 'object'
    ? `${(error as { code?: unknown }).code ?? ''} ${(error as { message?: unknown }).message ?? ''}`
    : String(error)
  return /secret_hash/.test(text) && /(PGRST204|42703|column|schema cache)/i.test(text)
}

/**
 * 과제 방 '이어하기'처럼 다른 기기에서 기존 학생으로 이어갈 때 토큰을 새로 정한다.
 * DB 트리거가 과제 방에서만 허용하고, 실시간 수업 방에서는 무시한다(그러면 이 탭은 그 학생 이름으로 못 보낸다).
 * 컬럼이 없거나 실패해도 이어하기 자체는 막지 않는다.
 */
export async function rekeyPlayerSecret(playerId: string): Promise<void> {
  const { token, hash } = await createPlayerSecret()
  const { error } = await (supabase.from('players') as any)
    .update({ secret_hash: hash })
    .eq('id', playerId)
  if (error) {
    if (!isMissingSecretColumnError(error)) console.warn('학생 토큰 갱신 실패:', error.message ?? error)
    return
  }
  savePlayerSecret(playerId, token)
}
