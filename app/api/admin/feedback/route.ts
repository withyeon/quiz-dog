import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUSES = ['open', 'in_progress', 'resolved', 'archived']

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  const url = new URL(request.url)
  const status = url.searchParams.get('status')

  const supabase = getAdminSupabase()
  let query = supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(500)
  if (status && STATUSES.includes(status)) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('피드백 조회 오류:', error)
    return NextResponse.json({ error: '신고 내역을 불러오지 못했습니다.' }, { status: 500 })
  }
  return NextResponse.json({ feedback: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const id = String(body?.id ?? '')
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (STATUSES.includes(body.status)) patch.status = body.status
    if (typeof body.admin_note === 'string') patch.admin_note = body.admin_note

    const supabase = getAdminSupabase()
    const { data, error } = await (supabase.from('feedback') as any).update(patch).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ feedback: data })
  } catch (error) {
    console.error('피드백 수정 오류:', error)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    const supabase = getAdminSupabase()
    const { error } = await supabase.from('feedback').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('피드백 삭제 오류:', error)
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 })
  }
}
