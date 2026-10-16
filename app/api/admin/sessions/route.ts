import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { sweepStaleRoomsQuietly } from '@/lib/services/roomExpiry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 게임 방(세션) 관리.
 *  GET    ?status=open|waiting|playing|paused|ended|all&q=  목록 + 상태별 개수
 *  PATCH  { roomCode, action: 'end' }  진행 중인 방을 종료(finished)
 *  DELETE { roomCode }  방과 참여자 기록 삭제
 */

const OPEN_STATUSES = ['waiting', 'playing', 'paused']
const ENDED_STATUSES = ['finished', 'ended']

type RoomRow = {
  room_code: string
  status: string
  game_mode: string | null
  set_id: string | null
  created_at: string
  updated_at: string | null
  started_at: string | null
  is_homework?: boolean | null
  due_at?: string | null
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()

    // 방치된 방을 먼저 정리해야 목록의 '진행 중 / 대기 중'이 실제 상태와 맞는다.
    await sweepStaleRoomsQuietly(supabase)

    const url = new URL(request.url)
    const status = url.searchParams.get('status') ?? 'open'
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()

    let roomsQuery = supabase
      .from('rooms')
      .select('room_code, status, game_mode, set_id, created_at, updated_at, started_at, is_homework, due_at')
      .order('created_at', { ascending: false })
      .limit(300)
    if (status === 'open') roomsQuery = roomsQuery.in('status', OPEN_STATUSES)
    else if (status === 'ended') roomsQuery = roomsQuery.in('status', ENDED_STATUSES)
    else if (status !== 'all') roomsQuery = roomsQuery.eq('status', status)

    const [{ data, error }, ...countResults] = await Promise.all([
      roomsQuery,
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'playing'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'paused'),
      supabase.from('rooms').select('*', { count: 'exact', head: true }).in('status', ENDED_STATUSES),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
    ])
    if (error) throw error
    const [waiting, playing, paused, ended, total] = countResults.map((r) => r.count ?? 0)

    let rooms = (data ?? []) as RoomRow[]

    // 문제 세트 제목
    const setIds = [...new Set(rooms.map((r) => r.set_id).filter(Boolean) as string[])]
    const setTitleById = new Map<string, string>()
    if (setIds.length > 0) {
      const { data: sets } = await supabase.from('question_sets').select('id, title').in('id', setIds)
      for (const s of (sets ?? []) as Array<{ id: string; title: string }>) setTitleById.set(s.id, s.title)
    }

    if (q) {
      rooms = rooms.filter((r) => {
        const title = r.set_id ? setTitleById.get(r.set_id) ?? '' : ''
        return r.room_code.toLowerCase().includes(q) || title.toLowerCase().includes(q) || (r.game_mode ?? '').toLowerCase().includes(q)
      })
    }

    // 참여자 수·마지막 활동
    const roomCodes = rooms.map((r) => r.room_code)
    const playerCountByRoom = new Map<string, number>()
    const lastPlayerActivityByRoom = new Map<string, string>()
    if (roomCodes.length > 0) {
      const { data: players } = await supabase.from('players').select('room_code, updated_at').in('room_code', roomCodes)
      for (const p of (players ?? []) as Array<{ room_code: string; updated_at: string | null }>) {
        playerCountByRoom.set(p.room_code, (playerCountByRoom.get(p.room_code) ?? 0) + 1)
        if (p.updated_at) {
          const prev = lastPlayerActivityByRoom.get(p.room_code)
          if (!prev || prev < p.updated_at) lastPlayerActivityByRoom.set(p.room_code, p.updated_at)
        }
      }
    }

    const sessions = rooms.map((r) => {
      const candidates = [r.updated_at, r.started_at, r.created_at, lastPlayerActivityByRoom.get(r.room_code)].filter(Boolean) as string[]
      const lastActivity = candidates.sort().at(-1) ?? r.created_at
      return {
        roomCode: r.room_code,
        status: r.status,
        gameMode: r.game_mode ?? null,
        setTitle: r.set_id ? setTitleById.get(r.set_id) ?? null : null,
        playerCount: playerCountByRoom.get(r.room_code) ?? 0,
        isHomework: Boolean(r.is_homework),
        dueAt: r.due_at ?? null,
        createdAt: r.created_at,
        startedAt: r.started_at ?? null,
        lastActivity,
      }
    })

    return NextResponse.json({
      sessions,
      counts: { waiting, playing, paused, open: waiting + playing + paused, ended, total },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('세션 목록 조회 오류:', error)
    return NextResponse.json({ error: '세션 목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

// 진행 중인 방 종료: 학생 화면은 finished 상태를 보고 결과 화면으로 넘어간다.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const body = await request.json()
    const roomCode = String(body?.roomCode ?? '')
    if (!roomCode || body?.action !== 'end') return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })

    const supabase = getAdminSupabase()
    const { error } = await (supabase.from('rooms') as any)
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('room_code', roomCode)
      .in('status', OPEN_STATUSES)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('세션 종료 오류:', error)
    return NextResponse.json({ error: '세션을 종료하지 못했습니다.' }, { status: 500 })
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
