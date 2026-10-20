import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 수업 점검(하루치 돌아보기).
 *  GET ?date=YYYY-MM-DD   한국 시간 그 날 0시~24시에 만든 방·AI 생성·화면 오류를 모아 준다.
 *
 * 초피티의 '매일 밤 수업 점검'과 같은 용도: 어떤 선생님이 어떤 게임을 몇 명과 했는지,
 * 기록이 제대로 남았는지, 화면 오류가 있었는지를 한 화면에서 본다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const STARTED_STATUSES = new Set(['playing', 'paused', 'finished', 'ended'])
/** 점수가 정답 수와 무관한 모드(좀비=감염 수, 배틀=체력). '0점 많음' 신호에서 뺀다. */
const SCORE_NOT_ANSWER_MODES = new Set(['zombie', 'battle_royale'])

type RoomRow = {
  room_code: string
  status: string
  game_mode: string | null
  set_id: string | null
  owner_id: string | null
  is_homework: boolean | null
  created_at: string
  started_at: string | null
}
type PlayerRow = {
  id: string
  room_code: string
  nickname: string
  score: number | null
  answer_history: unknown
  created_at: string
}
type ErrorRow = {
  id: string
  created_at: string
  kind: string
  message: string
  stack: string | null
  path: string | null
  room_code: string | null
  nickname: string | null
  user_id: string | null
  user_agent: string | null
  extra: Record<string, unknown> | null
}

export interface DailyCheckRoom {
  roomCode: string
  createdAt: string
  startedAt: string | null
  status: string
  gameMode: string | null
  setTitle: string | null
  ownerId: string | null
  ownerName: string | null
  isHomework: boolean
  playerCount: number
  answeredCount: number
  zeroScoreCount: number
  reportSaved: boolean
  flags: string[]
}

function kstDayRange(date: string | null): { label: string; start: Date; end: Date } {
  const todayKst = new Date(Date.now() + KST_OFFSET_MS)
  let label = todayKst.toISOString().slice(0, 10)
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) label = date
  const start = new Date(new Date(`${label}T00:00:00.000Z`).getTime() - KST_OFFSET_MS)
  return { label, start, end: new Date(start.getTime() + DAY_MS) }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function isMissingTable(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  return /does not exist|relation|schema cache|42P01/i.test(message)
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  try {
    const supabase = getAdminSupabase()
    const url = new URL(request.url)
    const { label, start, end } = kstDayRange(url.searchParams.get('date'))
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    // ── 방 ──
    const { data: roomsData, error: roomsError } = await (supabase.from('rooms') as any)
      .select('room_code, status, game_mode, set_id, owner_id, is_homework, created_at, started_at')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (roomsError) throw roomsError
    const rooms = (roomsData ?? []) as RoomRow[]
    const roomCodes = rooms.map((r) => r.room_code)

    // ── 학생·기록 ──
    const playersByRoom = new Map<string, PlayerRow[]>()
    const reportedRooms = new Set<string>()
    for (const codes of chunk(roomCodes, 100)) {
      const [{ data: players, error: playersError }, { data: reports, error: reportsError }] = await Promise.all([
        (supabase.from('players') as any).select('id, room_code, nickname, score, answer_history, created_at').in('room_code', codes).limit(5000),
        (supabase.from('game_reports') as any).select('room_code').in('room_code', codes),
      ])
      if (playersError) throw playersError
      if (reportsError) throw reportsError
      for (const p of (players ?? []) as PlayerRow[]) {
        const list = playersByRoom.get(p.room_code) ?? []
        list.push(p)
        playersByRoom.set(p.room_code, list)
      }
      for (const r of (reports ?? []) as Array<{ room_code: string }>) reportedRooms.add(r.room_code)
    }

    // ── 문제집 제목 ──
    const setIds = [...new Set(rooms.map((r) => r.set_id).filter(Boolean) as string[])]
    const setTitleById = new Map<string, string>()
    for (const ids of chunk(setIds, 100)) {
      const { data: sets } = await supabase.from('question_sets').select('id, title').in('id', ids)
      for (const s of (sets ?? []) as Array<{ id: string; title: string }>) setTitleById.set(s.id, s.title)
    }

    // ── AI 생성 ──
    let aiRows: Array<{ user_id: string; source_type: string; question_count: number; created_at: string }> = []
    let aiAvailable = true
    {
      const { data, error } = await (supabase.from('ai_generation_logs') as any)
        .select('user_id, source_type, question_count, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: true })
        .limit(1000)
      if (error) {
        if (!isMissingTable(error)) throw error
        aiAvailable = false
      } else aiRows = data ?? []
    }

    // ── 화면 오류 ──
    let errorRows: ErrorRow[] = []
    let errorsAvailable = true
    {
      const { data, error } = await (supabase.from('client_error_logs') as any)
        .select('id, created_at, kind, message, stack, path, room_code, nickname, user_id, user_agent, extra')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) {
        if (!isMissingTable(error)) throw error
        errorsAvailable = false
      } else {
        errorRows = data ?? []
        // 30일 지난 오류 정리(실패해도 무시)
        void (supabase as any).rpc('prune_client_error_logs').then(() => undefined, () => undefined)
      }
    }

    // ── 사람 이름 (profiles → auth 이메일) ──
    const userIds = new Set<string>()
    for (const r of rooms) if (r.owner_id) userIds.add(r.owner_id)
    for (const a of aiRows) userIds.add(a.user_id)
    for (const e of errorRows) if (e.user_id) userIds.add(e.user_id)
    const nameById = new Map<string, string>()
    for (const ids of chunk([...userIds], 100)) {
      const { data: profiles } = await (supabase.from('profiles') as any).select('id, display_name').in('id', ids)
      for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null }>) {
        const name = p.display_name?.trim()
        if (name) nameById.set(p.id, name)
      }
    }
    await Promise.all(
      [...userIds].filter((id) => !nameById.has(id)).slice(0, 50).map(async (id) => {
        try {
          const { data } = await supabase.auth.admin.getUserById(id)
          if (data.user?.email) nameById.set(id, data.user.email)
        } catch {
          // 이름을 못 찾으면 id 앞부분으로 보여 준다
        }
      }),
    )
    const nameOf = (id: string | null | undefined) => (id ? nameById.get(id) ?? id.slice(0, 8) : null)

    // ── 오류에 적힌 playerId → 닉네임 ──
    const errorPlayerIds = [...new Set(errorRows.map((e) => (e.extra as { playerId?: unknown } | null)?.playerId).filter((v): v is string => typeof v === 'string' && v.length > 0))]
    const nicknameByPlayerId = new Map<string, string>()
    for (const ids of chunk(errorPlayerIds, 100)) {
      const { data } = await (supabase.from('players') as any).select('id, nickname').in('id', ids)
      for (const p of (data ?? []) as Array<{ id: string; nickname: string }>) nicknameByPlayerId.set(p.id, p.nickname)
    }

    // ── 방별 정리 + 의심 신호 ──
    const roomItems: DailyCheckRoom[] = rooms.map((r) => {
      const players = playersByRoom.get(r.room_code) ?? []
      const started = Boolean(r.started_at) || STARTED_STATUSES.has(r.status)
      const answeredCount = players.filter((p) => Array.isArray(p.answer_history) && (p.answer_history as unknown[]).length > 0).length
      const zeroScoreCount = players.filter((p) => (p.score ?? 0) === 0).length
      const reportSaved = reportedRooms.has(r.room_code)
      const flags: string[] = []
      const mode = r.game_mode ?? ''
      if (!started && players.length >= 3) flags.push('학생이 들어왔는데 시작 안 함')
      if (started && !r.is_homework && players.length >= 2 && mode !== 'study') {
        if (answeredCount === 0) flags.push('풀이 기록이 하나도 없음')
        else if (!SCORE_NOT_ANSWER_MODES.has(mode) && zeroScoreCount / players.length >= 0.5) flags.push('절반 이상이 0점')
      }
      if (r.started_at && (r.status === 'finished' || r.status === 'ended') && players.length > 0 && !reportSaved && !r.is_homework) flags.push('종료됐는데 게임 기록이 없음')
      if ((r.status === 'playing' || r.status === 'paused') && Date.now() - new Date(r.created_at).getTime() > 3 * 60 * 60 * 1000) flags.push('3시간 넘게 진행 중')
      return {
        roomCode: r.room_code,
        createdAt: r.created_at,
        startedAt: r.started_at,
        status: r.status,
        gameMode: r.game_mode,
        setTitle: r.set_id ? setTitleById.get(r.set_id) ?? null : null,
        ownerId: r.owner_id,
        ownerName: nameOf(r.owner_id),
        isHomework: Boolean(r.is_homework),
        playerCount: players.length,
        answeredCount,
        zeroScoreCount,
        reportSaved,
        flags,
      }
    })

    // ── 오류를 같은 문구·경로끼리 묶기 ──
    const errorGroups = new Map<string, {
      key: string
      kind: string
      message: string
      path: string | null
      stack: string | null
      count: number
      firstAt: string
      lastAt: string
      roomCodes: Set<string>
      who: Set<string>
      userAgents: Set<string>
    }>()
    for (const e of errorRows) {
      const key = `${e.kind}|${e.path ?? ''}|${e.message.slice(0, 200)}`
      const group = errorGroups.get(key) ?? {
        key, kind: e.kind, message: e.message, path: e.path, stack: e.stack, count: 0,
        firstAt: e.created_at, lastAt: e.created_at, roomCodes: new Set<string>(), who: new Set<string>(), userAgents: new Set<string>(),
      }
      group.count += 1
      if (e.created_at < group.firstAt) group.firstAt = e.created_at
      if (e.created_at > group.lastAt) group.lastAt = e.created_at
      if (e.room_code) group.roomCodes.add(e.room_code)
      const playerId = (e.extra as { playerId?: unknown } | null)?.playerId
      const who = e.user_id ? nameOf(e.user_id) : typeof playerId === 'string' ? nicknameByPlayerId.get(playerId) ?? e.nickname : e.nickname
      if (who) group.who.add(who)
      if (e.user_agent) group.userAgents.add(e.user_agent.slice(0, 120))
      errorGroups.set(key, group)
    }
    const errors = [...errorGroups.values()]
      .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
      .map((g) => ({
        key: g.key, kind: g.kind, message: g.message, path: g.path, stack: g.stack, count: g.count,
        firstAt: g.firstAt, lastAt: g.lastAt,
        roomCodes: [...g.roomCodes].slice(0, 10), who: [...g.who].slice(0, 10), userAgents: [...g.userAgents].slice(0, 3),
      }))

    // ── 요약 ──
    const byModeMap = new Map<string, { mode: string; rooms: number; started: number; students: number }>()
    for (const r of roomItems) {
      const mode = r.gameMode ?? '(없음)'
      const m = byModeMap.get(mode) ?? { mode, rooms: 0, started: 0, students: 0 }
      m.rooms += 1
      if (r.startedAt) m.started += 1
      m.students += r.playerCount
      byModeMap.set(mode, m)
    }
    const teachers = new Set(roomItems.map((r) => r.ownerId).filter(Boolean) as string[])

    return NextResponse.json({
      date: label,
      rangeStart: startIso,
      rangeEnd: endIso,
      summary: {
        rooms: roomItems.length,
        startedRooms: roomItems.filter((r) => Boolean(r.startedAt)).length,
        students: roomItems.reduce((sum, r) => sum + r.playerCount, 0),
        teachers: teachers.size,
        anonymousRooms: roomItems.filter((r) => !r.ownerId).length,
        flaggedRooms: roomItems.filter((r) => r.flags.length > 0).length,
        aiGenerations: aiRows.length,
        aiQuestions: aiRows.reduce((sum, a) => sum + (a.question_count ?? 0), 0),
        errorEvents: errorRows.length,
        errorGroups: errors.length,
      },
      byMode: [...byModeMap.values()].sort((a, b) => b.rooms - a.rooms),
      rooms: roomItems,
      ai: aiRows.map((a) => ({ createdAt: a.created_at, sourceType: a.source_type, questionCount: a.question_count, userName: nameOf(a.user_id) })),
      aiAvailable,
      errors,
      errorsAvailable,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('수업 점검 조회 오류:', error)
    return NextResponse.json({ error: '수업 점검 자료를 불러오지 못했습니다.' }, { status: 500 })
  }
}
