import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { normalizeAdminEmail } from '@/lib/admin/admins'
import { invalidateAdminCache, isMissingAdminTable, listAdminRows } from '@/lib/admin/adminList.server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 관리자 계정 목록(public.admin_users) 관리.
 * GET: 목록 · POST { email, note? }: 추가 · DELETE ?email=: 삭제
 * 자기 자신과 마지막 남은 관리자는 지울 수 없다.
 */

const NOT_READY = 'admin_users 표가 아직 없습니다. Supabase에서 sql/20261029_admin_users.sql 을 먼저 실행하세요.'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!
  try {
    const { available, rows } = await listAdminRows()
    return NextResponse.json({ available, admins: rows, me: normalizeAdminEmail(auth.email) })
  } catch (error) {
    console.error('[admin/admins] GET', error)
    return NextResponse.json({ error: '관리자 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  let email = ''
  let note: string | null = null
  try {
    const body = await request.json()
    email = normalizeAdminEmail(typeof body?.email === 'string' ? body.email : '')
    note = typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })
  }

  const { error } = await (getAdminSupabase().from('admin_users') as any).insert({
    email,
    note,
    added_by: normalizeAdminEmail(auth.email),
  })
  if (error) {
    if (isMissingAdminTable(error)) return NextResponse.json({ error: NOT_READY }, { status: 503 })
    if (error.code === '23505') return NextResponse.json({ error: '이미 관리자인 계정입니다.' }, { status: 409 })
    console.error('[admin/admins] POST', error)
    return NextResponse.json({ error: '관리자를 추가하지 못했습니다.' }, { status: 500 })
  }
  invalidateAdminCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  const email = normalizeAdminEmail(new URL(request.url).searchParams.get('email'))
  if (!email) return NextResponse.json({ error: '지울 이메일이 없습니다.' }, { status: 400 })
  if (email === normalizeAdminEmail(auth.email)) {
    return NextResponse.json({ error: '자기 자신은 관리자에서 뺄 수 없습니다. 다른 관리자에게 부탁하세요.' }, { status: 400 })
  }

  try {
    const { available, rows } = await listAdminRows()
    if (!available) return NextResponse.json({ error: NOT_READY }, { status: 503 })
    if (!rows.some((row) => normalizeAdminEmail(row.email) === email)) {
      return NextResponse.json({ error: '관리자 목록에 없는 계정입니다.' }, { status: 404 })
    }
    if (rows.length <= 1) {
      return NextResponse.json({ error: '마지막 관리자는 지울 수 없습니다.' }, { status: 400 })
    }
    const { error } = await (getAdminSupabase().from('admin_users') as any).delete().eq('email', email)
    if (error) throw error
    invalidateAdminCache()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[admin/admins] DELETE', error)
    return NextResponse.json({ error: '관리자를 지우지 못했습니다.' }, { status: 500 })
  }
}
