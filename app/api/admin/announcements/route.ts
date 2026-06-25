import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LEVELS = ['info', 'warning', 'critical']

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  const supabase = getAdminSupabase()
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('공지 조회 오류:', error)
    return NextResponse.json({ error: '공지사항을 불러오지 못했습니다.' }, { status: 500 })
  }
  return NextResponse.json({ announcements: data })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const title = String(body?.title ?? '').trim()
    const content = String(body?.body ?? '').trim()
    const level = LEVELS.includes(body?.level) ? body.level : 'info'
    const isPublished = body?.is_published !== false

    if (!title) return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 })

    const supabase = getAdminSupabase()
    const { data, error } = await (supabase.from('announcements') as any)
      .insert({ title, body: content, level, is_published: isPublished, created_by: auth.email })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ announcement: data })
  } catch (error) {
    console.error('공지 생성 오류:', error)
    return NextResponse.json({ error: '공지를 생성하지 못했습니다.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const id = String(body?.id ?? '')
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (typeof body.title === 'string') patch.title = body.title.trim()
    if (typeof body.body === 'string') patch.body = body.body.trim()
    if (LEVELS.includes(body.level)) patch.level = body.level
    if (typeof body.is_published === 'boolean') patch.is_published = body.is_published

    const supabase = getAdminSupabase()
    const { data, error } = await (supabase.from('announcements') as any)
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ announcement: data })
  } catch (error) {
    console.error('공지 수정 오류:', error)
    return NextResponse.json({ error: '공지를 수정하지 못했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    const supabase = getAdminSupabase()
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('공지 삭제 오류:', error)
    return NextResponse.json({ error: '공지를 삭제하지 못했습니다.' }, { status: 500 })
  }
}
