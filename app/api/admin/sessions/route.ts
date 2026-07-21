import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES = ['waiting', 'playing', 'paused']

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('active') === '1'

    let roomsQuery = supabase
      .from('rooms')
      .select('room_code, status, game_mode, set_id, created_at, started_at')
      .order('created_at', { ascending: false })
      .limit(300)
    if (activeOnly) roomsQuery = roomsQuery.in('status', ACTIVE_STATUSES)

    const { data, error } = await roomsQuery
    if (error) throw error

    const rooms = (data ?? []) as Array<{
      room_code: string
      status: string
      game_mode: string | null
      set_id: string | null
      created_at: string
      started_at: string | null
    }>

    const roomCodes = (rooms ?? []).map((r) => r.room_code)

    // 참여자 수 집계
    const playerCountByRoom = new Map<string, number>()
    if (roomCodes.length > 0) {
      const { data: players } = await supabase
        .from('players')
        .select('room_code')
        .in('room_code', roomCodes)
      for (const p of (players ?? []) as Array<{ room_code: string }>) {
        playerCountByRoom.set(p.room_code, (playerCountByRoom.get(p.room_code) ?? 0) + 1)
      }
    }

    // 문제 세트 제목
    const setIds = [...new Set((rooms ?? []).map((r) => r.set_id).filter(Boolean) as string[])]
    const setTitleById = new Map<string, string>()
    if (setIds.length > 0) {
      const { data: sets } = await supabase.from('question_sets').select('id, title').in('id', setIds)
      for (const s of (sets ?? []) as Array<{ id: string; title: string }>) setTitleById.set(s.id, s.title)
    }

    const result = (rooms ?? []).map((r) => ({
      roomCode: r.room_code,
      status: r.status,
      gameMode: r.game_mode ?? null,
      setTitle: r.set_id ? setTitleById.get(r.set_id) ?? null : null,
      playerCount: playerCountByRoom.get(r.room_code) ?? 0,
      createdAt: r.created_at,
      startedAt: r.started_at ?? null,
    }))

    return NextResponse.json({ sessions: result })
  } catch (error) {
    console.error('세션 목록 조회 오류:', error)
    return NextResponse.json({ error: '세션 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

// 룸 정리(삭제): 해당 룸과 참여자 데이터를 제거
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const { roomCode } = await request.json()
    if (!roomCode || typeof roomCode !== 'string') {
      return NextResponse.json({ error: 'roomCode가 필요합니다.' }, { status: 400 })
    }

    const supabase = getAdminSupabase()
    await supabase.from('players').delete().eq('room_code', roomCode)
    const { error } = await supabase.from('rooms').delete().eq('room_code', roomCode)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('세션 삭제 오류:', error)
    return NextResponse.json({ error: '세션을 삭제하지 못했습니다.' }, { status: 500 })
  }
}
