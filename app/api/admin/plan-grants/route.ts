import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { listAllAuthUsers } from '@/lib/admin/users'
import { extendPro, extractEmails, normalizeEmail, parseInterval, toInterval } from '@/lib/admin/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 요금제 미리 적용(pending_plan_grants).
 * 아직 가입하지 않은 이메일에 프로 기간을 걸어 두면, 가입 트리거(apply_pending_plan_grant)가 가입일부터 적용한다.
 *  GET    목록 + 상태(waiting: 가입 대기, claimed: 적용됨, unapplied: 가입은 했는데 미적용)
 *  POST   { emailsText, months, bonusDays, applyExisting, note } — 여러 이메일 한꺼번에
 *  PATCH  { email, action: 'apply' } — 가입은 했는데 미적용인 계정에 지금 적용
 *  DELETE ?email= — 적용 전 예약 취소
 */

interface GrantRow {
  email: string
  pro_interval: string
  note: string | null
  created_at: string
  applied_at: string | null
  applied_user_id: string | null
}

async function usersByEmail() {
  const users = await listAllAuthUsers()
  const map = new Map<string, { id: string; email: string }>()
  for (const u of users) if (u.email) map.set(u.email.toLowerCase(), { id: u.id, email: u.email })
  return map
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const [{ data, error }, users] = await Promise.all([
      (supabase.from('pending_plan_grants') as any).select('*').order('created_at', { ascending: false }),
      usersByEmail(),
    ])
    if (error) throw error

    const grants = ((data ?? []) as GrantRow[]).map((g) => {
      const { months, days } = parseInterval(g.pro_interval)
      const status = g.applied_at ? 'claimed' : users.has(g.email) ? 'unapplied' : 'waiting'
      return {
        email: g.email,
        months,
        bonusDays: days,
        note: g.note,
        createdAt: g.created_at,
        appliedAt: g.applied_at,
        appliedUserId: g.applied_user_id,
        status,
      }
    })
    return NextResponse.json({ grants, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('요금제 예약 조회 오류:', error)
    return NextResponse.json({ error: '예약 목록을 불러오지 못했습니다. (pending_plan_grants 표가 있는지 확인합니다)' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const { emails, duplicates } = extractEmails(String(body?.emailsText ?? ''))
    if (emails.length === 0) return NextResponse.json({ error: '등록할 이메일이 없습니다.' }, { status: 400 })
    if (emails.length > 200) return NextResponse.json({ error: '한 번에 200개까지 등록할 수 있습니다.' }, { status: 400 })

    const months = Math.max(0, Math.min(60, Math.floor(Number(body?.months ?? 12))))
    const bonusDays = Math.max(0, Math.min(366, Math.floor(Number(body?.bonusDays ?? 0))))
    if (months === 0 && bonusDays === 0) return NextResponse.json({ error: '기간을 정해야 합니다.' }, { status: 400 })
    const applyExisting = body?.applyExisting !== false
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) || null : null

    const supabase = getAdminSupabase()
    const users = await usersByEmail()
    const outcomes: Array<{ email: string; result: 'waiting' | 'applied' | 'skipped'; message?: string }> = []

    for (const email of emails) {
      const existing = users.get(email)
      if (existing) {
        if (!applyExisting) {
          outcomes.push({ email, result: 'skipped', message: '이미 가입한 계정입니다.' })
          continue
        }
        await extendPro(supabase, existing.id, months, bonusDays)
        // 기록으로 남긴다(적용됨 상태). 이미 행이 있으면 적용 표시만 갱신.
        await (supabase.from('pending_plan_grants') as any).upsert({
          email,
          pro_interval: toInterval(months, bonusDays),
          note,
          applied_at: new Date().toISOString(),
          applied_user_id: existing.id,
        })
        outcomes.push({ email, result: 'applied' })
        continue
      }

      const { data: prev } = await (supabase.from('pending_plan_grants') as any).select('applied_at').eq('email', email).maybeSingle()
      if (prev?.applied_at) {
        outcomes.push({ email, result: 'skipped', message: '이미 적용된 예약이 있습니다. 가입한 계정이 지워졌다면 먼저 예약을 취소합니다.' })
        continue
      }
      const { error } = await (supabase.from('pending_plan_grants') as any).upsert({
        email,
        pro_interval: toInterval(months, bonusDays),
        note,
        created_at: new Date().toISOString(),
        applied_at: null,
        applied_user_id: null,
      })
      if (error) {
        outcomes.push({ email, result: 'skipped', message: error.message })
        continue
      }
      outcomes.push({ email, result: 'waiting' })
    }

    return NextResponse.json({ outcomes, duplicates })
  } catch (error) {
    console.error('요금제 예약 등록 오류:', error)
    return NextResponse.json({ error: '예약을 등록하지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email ?? ''))
    if (!email || body?.action !== 'apply') return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

    const supabase = getAdminSupabase()
    const { data: grant } = await (supabase.from('pending_plan_grants') as any).select('*').eq('email', email).maybeSingle()
    if (!grant) return NextResponse.json({ error: '예약을 찾지 못했습니다.' }, { status: 404 })
    if (grant.applied_at) return NextResponse.json({ error: '이미 적용된 예약입니다.' }, { status: 409 })

    const user = (await usersByEmail()).get(email)
    if (!user) return NextResponse.json({ error: '아직 가입하지 않은 이메일입니다. 가입하면 자동으로 적용됩니다.' }, { status: 409 })

    const { months, days } = parseInterval(grant.pro_interval)
    const proUntil = await extendPro(supabase, user.id, months, days)
    await (supabase.from('pending_plan_grants') as any)
      .update({ applied_at: new Date().toISOString(), applied_user_id: user.id })
      .eq('email', email)
    return NextResponse.json({ email, proUntil })
  } catch (error) {
    console.error('요금제 예약 적용 오류:', error)
    return NextResponse.json({ error: '적용하지 못했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const email = normalizeEmail(new URL(request.url).searchParams.get('email') ?? '')
    if (!email) return NextResponse.json({ error: 'email이 필요합니다.' }, { status: 400 })
    const supabase = getAdminSupabase()
    const { error } = await (supabase.from('pending_plan_grants') as any).delete().eq('email', email)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('요금제 예약 취소 오류:', error)
    return NextResponse.json({ error: '예약을 취소하지 못했습니다.' }, { status: 500 })
  }
}
