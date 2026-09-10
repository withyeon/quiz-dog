import { supabase } from '@/lib/supabase/client'
import { getRoomByCode } from '@/lib/services/rooms'
import { listPlayersInRoom } from '@/lib/services/players'
import type { Database } from '@/types/database.types'
import type { Json } from '@/types/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']
type PlayerRow = Database['public']['Tables']['players']['Row']
export type GameReportRow = Database['public']['Tables']['game_reports']['Row']
export type GameReportWithQuestionSetTitle = GameReportRow & {
  question_set_title?: string | null
}

async function hydrateReportsWithQuestionSetTitles(
  reports: GameReportRow[],
): Promise<GameReportWithQuestionSetTitle[]> {
  const setIds = [...new Set(reports.map((report) => report.set_id).filter(Boolean) as string[])]
  if (setIds.length === 0) return reports

  const { data, error } = await (supabase
    .from('question_sets') as any)
    .select('id, title')
    .in('id', setIds)

  if (error) throw error

  const titleBySetId = new Map(
    ((data ?? []) as Array<{ id: string; title: string | null }>)
      .map((set) => [set.id, set.title]),
  )

  return reports.map((report) => ({
    ...report,
    question_set_title: report.set_id ? titleBySetId.get(report.set_id) ?? null : null,
  }))
}

/**
 * game_reports.owner_id 는 migrations/add_game_reports_owner.sql 을 실행한 뒤에만 존재한다.
 * 마이그레이션 전 환경에서도 저장·조회가 깨지지 않도록, 컬럼이 없다는 응답을 한 번 받으면
 * 이후에는 컬럼 없이 동작한다(같은 세션 안에서만 기억).
 */
let ownerColumnAvailable: boolean | null = null

function isMissingOwnerColumn(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  return message.includes('owner_id')
}

export async function saveGameReportSnapshot(
  room: RoomRow,
  players: PlayerRow[],
  ownerId?: string | null,
): Promise<void> {
  const snapshot = {
    room_code: room.room_code,
    set_id: room.set_id,
    game_mode: room.game_mode,
    player_count: players.length,
    players_data: players,
  }

  if (ownerId && ownerColumnAvailable !== false) {
    const { error } = await supabase
      .from('game_reports')
      .insert({ ...snapshot, owner_id: ownerId } as any)

    if (!error) {
      ownerColumnAvailable = true
      return
    }
    if (!isMissingOwnerColumn(error)) throw error
    ownerColumnAvailable = false
  }

  const { error } = await supabase.from('game_reports').insert(snapshot as any)
  if (error) throw error
}

/** 내 문제집 id 목록 — 소유자 컬럼이 없던 시절의 기록을 찾아내는 데 쓴다 */
async function listOwnedQuestionSetIds(ownerId: string): Promise<string[]> {
  const { data, error } = await (supabase
    .from('question_sets') as any)
    .select('id')
    .eq('owner_id', ownerId)

  if (error) throw error
  return ((data ?? []) as Array<{ id: string }>).map((set) => set.id)
}

/**
 * 내 게임 기록만 고르는 조건.
 * owner_id(진행한 사람) 우선, 그 컬럼이 없거나 값이 비어 있던 예전 기록은 내 문제집 기준으로 찾는다.
 */
async function selectOwnerReports<T>(
  ownerId: string,
  columns: string,
  apply: (query: any) => any,
): Promise<T[]> {
  const ownedSetIds = await listOwnedQuestionSetIds(ownerId)
  const quotedSetIds = ownedSetIds.map((id) => `"${id}"`).join(',')

  if (ownerColumnAvailable !== false) {
    const conditions = [`owner_id.eq.${ownerId}`]
    if (ownedSetIds.length > 0) conditions.push(`set_id.in.(${quotedSetIds})`)

    const { data, error } = await apply(
      (supabase.from('game_reports') as any).select(columns).or(conditions.join(',')),
    )

    if (!error) {
      ownerColumnAvailable = true
      return (data ?? []) as T[]
    }
    if (!isMissingOwnerColumn(error)) throw error
    ownerColumnAvailable = false
  }

  if (ownedSetIds.length === 0) return []

  const { data, error } = await apply(
    (supabase.from('game_reports') as any).select(columns).in('set_id', ownedSetIds),
  )
  if (error) throw error
  return (data ?? []) as T[]
}

export async function listRecentGameReports(limit = 50): Promise<GameReportWithQuestionSetTitle[]> {
  const { data, error } = await ((supabase
    .from('game_reports') as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit))

  if (error) throw error
  return hydrateReportsWithQuestionSetTitles((data ?? []) as GameReportRow[])
}

/**
 * 로그인한 선생님의 게임 기록만 가져온다.
 *
 * game_reports 테이블에는 소유자 컬럼이 없어서, 내가 가진 문제집(question_sets.owner_id)의
 * set_id에 해당하는 기록만 골라낸다. 이 필터가 없으면 다른 선생님이 진행한 게임 기록
 * (학생 닉네임·답안 포함)까지 보이게 된다.
 */
export async function listGameReportsForOwner(
  ownerId: string,
  limit = 50,
): Promise<GameReportWithQuestionSetTitle[]> {
  const rows = await selectOwnerReports<GameReportRow>(ownerId, '*', (query) =>
    query.order('created_at', { ascending: false }).limit(limit),
  )
  return hydrateReportsWithQuestionSetTitles(rows)
}

/** 선생님 대시보드 상단 통계 — 내 문제집으로 진행한 게임 수와 누적 참여 학생 수 */
export async function getGameStatsForOwner(
  ownerId: string,
): Promise<{ gameCount: number; playerCount: number }> {
  const rows = await selectOwnerReports<{ player_count: number | null }>(
    ownerId,
    'player_count',
    (query) => query,
  )

  return {
    gameCount: rows.length,
    playerCount: rows.reduce((sum, row) => sum + (row.player_count ?? 0), 0),
  }
}

export async function getGameReportById(reportId: string): Promise<GameReportWithQuestionSetTitle | null> {
  const { data, error } = await ((supabase
    .from('game_reports') as any)
    .select('*')
    .eq('id', reportId)
    .maybeSingle())

  if (error) throw error
  if (!data) return null

  const [report] = await hydrateReportsWithQuestionSetTitles([data as GameReportRow])
  return report
}

export function parseReportPlayers(playersData: Json): PlayerRow[] {
  return Array.isArray(playersData)
    ? (playersData as PlayerRow[])
    : []
}

/** 방 코드로 종료 시 저장해 둔 스냅샷을 찾는다(같은 방이 여러 번이면 가장 최근 것). */
async function getLatestSnapshotByRoomCode(roomCode: string): Promise<GameReportRow | null> {
  const { data, error } = await ((supabase
    .from('game_reports') as any)
    .select('*')
    .eq('room_code', roomCode)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle())

  if (error) return null
  return (data as GameReportRow | null) ?? null
}

/**
 * 종료 직후 리포트가 읽는 데이터.
 *
 * 평소에는 실시간 rooms·players 를 그대로 쓴다. 다만 그 두 테이블은 운영 중
 * 정리될 수 있고(관리자 세션 삭제 등), 그러면 "게임 결과를 찾을 수 없습니다"만
 * 남는다. 게임이 끝날 때 game_reports 에 스냅샷을 남겨 두므로, 실시간 행이
 * 없으면 그쪽으로 대신 채운다. 게임 기록 화면과 같은 데이터를 보게 된다.
 */
export async function getFinishedRoomReport(roomCode: string): Promise<{
  room: RoomRow | null
  players: PlayerRow[]
}> {
  const [room, players] = await Promise.all([
    getRoomByCode(roomCode),
    listPlayersInRoom(roomCode),
  ])

  if (players.length > 0) return { room, players }

  const snapshot = await getLatestSnapshotByRoomCode(roomCode)
  if (!snapshot) return { room, players }

  const snapshotPlayers = parseReportPlayers(snapshot.players_data)
  if (snapshotPlayers.length === 0) return { room, players }

  return {
    // 방 행까지 사라졌다면 스냅샷에 담긴 값으로 최소한의 방 정보를 만들어 준다.
    room: room ?? ({
      room_code: snapshot.room_code,
      status: 'finished',
      current_q_index: 0,
      game_mode: snapshot.game_mode,
      set_id: snapshot.set_id,
      duration_seconds: null,
      started_at: null,
      created_at: snapshot.created_at,
      updated_at: snapshot.created_at,
    } as RoomRow),
    players: snapshotPlayers,
  }
}
