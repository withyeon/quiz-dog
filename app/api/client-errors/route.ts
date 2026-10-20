import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 브라우저 오류 수집.
 *
 * components/ClientErrorReporter.tsx 가 window 오류·unhandledrejection·error.tsx 를 잡아
 * 여기로 보낸다. 로그인 없이 누구나(학생 화면 포함) 보낼 수 있으므로
 *  - 본문 크기·글자 수를 자르고
 *  - 같은 IP 는 분당 몇 건만 받고
 *  - 테이블은 service role 로만 쓴다(sql/20261020_client_error_logs.sql).
 * 테이블이 아직 없어도 200 으로 답해 화면 쪽이 재시도하지 않게 한다.
 */

const MAX_MESSAGE = 1000
const MAX_STACK = 4000
const MAX_PATH = 300
const MAX_SHORT = 80
const MAX_EXTRA_BYTES = 2000
const PER_MINUTE_PER_IP = 20

const KINDS = new Set(['error', 'unhandledrejection', 'page_error', 'global_error', 'console_error'])

// 인스턴스마다 따로 세지만, 폭주를 막는 용도로는 충분하다.
const hits = new Map<string, { count: number; resetAt: number }>()
function allow(ip: string): boolean {
  const now = Date.now()
  const slot = hits.get(ip)
  if (!slot || slot.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + 60_000 })
    if (hits.size > 5000) hits.clear()
    return true
  }
  slot.count += 1
  return slot.count <= PER_MINUTE_PER_IP
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

async function userIdFromAuth(request: NextRequest): Promise<string | null> {
  const header = request.headers.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  try {
    const { data } = await getAdminSupabase().auth.getUser(token)
    return data.user?.id ?? null
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  if (!allow(ip)) return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 })

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > 20_000) return NextResponse.json({ ok: false }, { status: 413 })
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const message = clip(body.message, MAX_MESSAGE)
  if (!message) return NextResponse.json({ ok: false }, { status: 400 })

  const kindRaw = typeof body.kind === 'string' ? body.kind : 'error'
  const kind = KINDS.has(kindRaw) ? kindRaw : 'error'

  let extra: Record<string, unknown> = {}
  if (body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra)) {
    const serialized = JSON.stringify(body.extra)
    extra = serialized.length <= MAX_EXTRA_BYTES ? (body.extra as Record<string, unknown>) : { truncated: serialized.slice(0, MAX_EXTRA_BYTES) }
  }

  const row = {
    kind,
    message,
    stack: clip(body.stack, MAX_STACK),
    path: clip(body.path, MAX_PATH),
    room_code: clip(body.roomCode, MAX_SHORT),
    nickname: clip(body.nickname, MAX_SHORT),
    user_id: await userIdFromAuth(request),
    user_agent: clip(request.headers.get('user-agent'), 300),
    extra,
  }

  try {
    const { error } = await (getAdminSupabase().from('client_error_logs') as any).insert(row)
    if (error) {
      // 마이그레이션 전(테이블 없음)이면 조용히 넘긴다. 서버 로그에는 남겨 둔다.
      console.error('화면 오류 저장 실패:', error.message, '|', kind, message)
    }
  } catch (error) {
    console.error('화면 오류 저장 실패:', error)
  }
  return NextResponse.json({ ok: true })
}
