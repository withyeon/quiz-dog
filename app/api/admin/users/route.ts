import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { listAllAuthUsers } from '@/lib/admin/users'
import { addPeriod, normalizeEmail, setProUntil } from '@/lib/admin/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 교사 관리 API.
 *  GET   목록(계정·가입 방법·프로필 이름·프로 만료·문제 세트 수)
 *  PATCH 프로 만료일 바꾸기 { id, proUntil: ISO | null }
 *  POST  계정 만들기 { email, password?, displayName?, plan: 'pro'|'free', months?, bonusDays?, proUntil? }
 *        — 납품 때 웹메일 계정을 미리 만들어 전달하는 용도. 비밀번호를 비우면 임의로 만들어 한 번만 돌려준다.
 */

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const users = await listAllAuthUsers()
    const ids = users.map((u) => u.id)

    const [{ data: sets }, { data: profiles }, { data: plans }] = await Promise.all([
      supabase.from('question_sets').select('owner_id'),
      ids.length ? supabase.from('profiles').select('id, display_name').in('id', ids) : Promise.resolve({ data: [] as unknown[] }),
      ids.length ? (supabase.from('teacher_plans') as any).select('user_id, pro_until').in('user_id', ids) : Promise.resolve({ data: [] as unknown[] }),
    ])

    const setCountByOwner = new Map<string, number>()
    for (const s of (sets ?? []) as Array<{ owner_id: string | null }>) {
      if (!s.owner_id) continue
      setCountByOwner.set(s.owner_id, (setCountByOwner.get(s.owner_id) ?? 0) + 1)
    }
    const nameById = new Map<string, string | null>()
    for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) nameById.set(p.id, p.display_name)
    const proUntilById = new Map<string, string | null>()
    for (const p of (plans ?? []) as Array<{ user_id: string; pro_until: string | null }>) proUntilById.set(p.user_id, p.pro_until)

    const now = Date.now()
    const result = users
      .map((u) => {
        const proUntil = proUntilById.get(u.id) ?? null
        const pro = Boolean(proUntil && new Date(proUntil).getTime() > now)
        return {
          id: u.id,
          email: u.email ?? '(이메일 없음)',
          name: nameById.get(u.id) ?? null,
          provider: (u.app_metadata?.provider as string) ?? 'email',
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at ?? null,
          setCount: setCountByOwner.get(u.id) ?? 0,
          plan: pro ? 'pro' : 'free',
          proUntil,
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ teachers: result, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('교사 목록 조회 오류:', error)
    return NextResponse.json({ error: '교사 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const id = String(body?.id ?? '')
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    let proUntil: string | null = null
    if (body.proUntil) {
      const d = new Date(String(body.proUntil))
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: '만료일 형식이 올바르지 않습니다.' }, { status: 400 })
      proUntil = d.toISOString()
    }

    const supabase = getAdminSupabase()
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(id)
    if (userError || !user?.user) return NextResponse.json({ error: '계정을 찾지 못했습니다.' }, { status: 404 })

    await setProUntil(supabase, id, proUntil)
    return NextResponse.json({ id, proUntil, plan: proUntil && new Date(proUntil).getTime() > Date.now() ? 'pro' : 'free' })
  } catch (error) {
    console.error('교사 요금제 수정 오류:', error)
    return NextResponse.json({ error: '요금제를 저장하지 못했습니다.' }, { status: 500 })
  }
}

function randomPassword(): string {
  // 헷갈리는 글자(0 O 1 l I)를 뺀 12자 + 기호 하나
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const core = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  return `${core.slice(0, 8)}@${core.slice(8)}`
}

/** 날짜만 받은 값(YYYY-MM-DD)은 KST 그날 자정으로 본다. 시각이 있으면 그대로. */
function parseDateInput(value: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00+09:00`)
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email ?? ''))
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: '이메일 형식이 올바르지 않습니다.' }, { status: 400 })

    const providedPassword = typeof body?.password === 'string' ? body.password.trim() : ''
    if (providedPassword && providedPassword.length < 8) return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다.' }, { status: 400 })
    const password = providedPassword || randomPassword()
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 20) : ''
    const plan = body?.plan === 'free' ? 'free' : 'pro'

    let proUntil: string | null = null
    if (plan === 'pro') {
      const start = body?.startAt ? parseDateInput(String(body.startAt)) : new Date()
      if (!start) return NextResponse.json({ error: '시작일 형식이 올바르지 않습니다.' }, { status: 400 })
      if (body?.proUntil) {
        const d = parseDateInput(String(body.proUntil))
        if (!d) return NextResponse.json({ error: '만료일 형식이 올바르지 않습니다.' }, { status: 400 })
        // 만료일은 그날이 끝날 때까지 쓰게 다음날 0시로
        d.setDate(d.getDate() + 1)
        proUntil = d.toISOString()
      } else {
        const months = Math.max(0, Math.min(60, Math.floor(Number(body?.months ?? 12))))
        const bonusDays = Math.max(0, Math.min(366, Math.floor(Number(body?.bonusDays ?? 0))))
        if (months === 0 && bonusDays === 0) return NextResponse.json({ error: '프로 기간을 정해야 합니다.' }, { status: 400 })
        proUntil = addPeriod(start, months, bonusDays).toISOString()
      }
    }

    const supabase = getAdminSupabase()
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    })
    if (error) {
      const taken = /already|registered|exists/i.test(error.message)
      return NextResponse.json({ error: taken ? '이미 가입된 이메일입니다.' : `계정을 만들지 못했습니다. (${error.message})` }, { status: taken ? 409 : 500 })
    }
    const userId = data.user.id

    if (proUntil) await setProUntil(supabase, userId, proUntil)

    // 같은 이메일에 걸어 둔 가입 전 예약이 있으면 트리거가 이미 적용했거나, 여기서 직접 만든 기간이 우선이다.
    // 둘 다 남지 않게 예약은 적용된 것으로 표시해 둔다.
    await (supabase.from('pending_plan_grants') as any)
      .update({ applied_at: new Date().toISOString(), applied_user_id: userId })
      .eq('email', email)
      .is('applied_at', null)

    return NextResponse.json({
      id: userId,
      email,
      displayName: displayName || null,
      plan,
      proUntil,
      password,
      generatedPassword: !providedPassword,
    })
  } catch (error) {
    console.error('교사 계정 생성 오류:', error)
    return NextResponse.json({ error: '계정을 만들지 못했습니다.' }, { status: 500 })
  }
}
