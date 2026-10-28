import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * 방치된 게임 룸 자동 종료.
 *
 * 왜 필요한가:
 *   방 상태는 선생님이 '게임 종료'를 누르거나 제한시간이 끝날 때만 finished 로 바뀐다.
 *   선생님이 그냥 탭을 닫거나 네트워크가 끊기면 waiting/playing 그대로 남아서,
 *   관리자 '게임 / 세션' 목록과 '진행 중 게임' 통계에 며칠 전 게임이 계속 떠 있었다.
 *
 * 어떻게 판정하나 (2026-10-18 결정):
 *   1) 만든 지 2시간이 지난 방은 종료한다. 수업 한 타임은 길어야 50분이라 2시간이면 충분하다.
 *      게임을 시작(started_at)한 방은 시작 시각부터 2시간을 다시 센다 — 종료 화면의 '다시 시작'은
 *      같은 방을 재사용하고, 미리 만들어 둔 방도 시작하면 새 판이기 때문이다.
 *   2) 단, 최근 5분 안에 학생 행(players)이 갱신된 방은 실제로 진행 중일 수 있으므로
 *      이번 스윕에서는 건너뛰고 다음 스윕(15분 뒤)에 다시 본다. 살아있는 수업을 끊지 않기 위한 유예다.
 *   3) 과제 방은 며칠 열려 있는 게 정상이므로 마감 시각(due_at)이 지났을 때만 종료한다.
 *
 * 종료하면서 무엇을 남기나:
 *   게임이 시작됐던 방(playing/paused)에 학생이 있었다면 그 시점의 학생 행을 게임 기록
 *   (game_reports)으로 저장한다. 선생님이 '게임 종료'를 눌렀을 때와 같은 스냅샷이라
 *   기록 목록·학생 분석·엑셀 내보내기가 그대로 된다. 시작도 안 한 대기방과 1분 체험 방(settings.trial)은
 *   기록 없이 닫는다 — 체험을 하다 탭을 닫은 선생님 기록에 봇 판이 끼던 것(2026-10-28 점검)을 막는다.
 *
 * DB 스키마 변경이 필요 없다. 기존 컬럼만 읽고 status 를 바꾸고 game_reports 에 넣는다.
 */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** 이 시간이 지나면 종료 대상 (만든 시각 기준) */
export const ROOM_MAX_AGE_MS = 2 * HOUR

/** 이 시간 안에 학생 행이 갱신됐으면 아직 수업 중으로 보고 이번 스윕은 건너뛴다 */
export const PLAYER_ACTIVITY_GRACE_MS = 5 * MINUTE

/** 종료 대상이 되는 상태 */
const ACTIVE_STATUSES = ['waiting', 'playing', 'paused']

/** 이 상태였던 방은 학생이 있었다면 기록을 남긴다 (대기방은 점수가 없어 남기지 않는다) */
const STARTED_STATUSES = new Set(['playing', 'paused'])

/** 한 번에 처리할 최대 방 수 — 스윕이 요청을 오래 붙잡지 않도록 */
const SWEEP_LIMIT = 500

/** in(...) 한 번에 담을 방 코드 수 (URL 길이 제한 회피) */
const CHUNK_SIZE = 100

type RoomCandidate = {
  room_code: string
  status: string
  created_at: string
  updated_at: string | null
  started_at: string | null
  game_mode?: string | null
  set_id?: string | null
  owner_id?: string | null
  /** 과제 방 — 마감 시각까지는 유휴여도 살려 둔다 (컬럼이 없는 DB면 undefined) */
  is_homework?: boolean | null
  due_at?: string | null
  settings?: unknown
}

type PlayerRow = Database['public']['Tables']['players']['Row']

export interface ExpireStaleRoomsResult {
  /** 검사 대상이 된 방 수 */
  scanned: number
  /** 실제로 종료 처리한 방 코드 */
  expired: string[]
  /** 2시간이 지났지만 학생이 방금까지 활동 중이라 이번에는 건너뛴 방 코드 */
  skippedLive: string[]
  /** 종료하면서 게임 기록(game_reports)을 남긴 방 코드 */
  reported: string[]
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

export function isRoomStale(room: RoomCandidate, now: number): boolean {
  // 이미 끝난 방(finished/ended)은 손대지 않는다.
  if (!ACTIVE_STATUSES.includes(room.status)) return false

  // 과제 방은 며칠 조용해도 정상이다. 마감이 지났을 때만 정리한다.
  if (room.is_homework) {
    const due = toTime(room.due_at)
    return due > 0 && now >= due
  }

  // 시작한 방은 시작 시각 기준(다시 시작·재개가 started_at 을 새로 찍는다). 둘 중 늦은 쪽에서 2시간.
  const anchor = Math.max(toTime(room.created_at), toTime(room.started_at))
  return now - anchor >= ROOM_MAX_AGE_MS
}

/** 1분 체험(/try) 방 — 봇과 '체험 선생님'뿐이라 선생님 게임 기록에 남기지 않는다 */
function isTrialRoom(room: RoomCandidate): boolean {
  const settings = room.settings
  return typeof settings === 'object' && settings !== null && (settings as { trial?: unknown }).trial === true
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** game_reports 에 owner_id 컬럼이 없는 옛 DB도 죽지 않게, 한 번 실패하면 이후엔 빼고 넣는다 */
let ownerColumnAvailable: boolean | null = null

function isMissingOwnerColumn(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  return message.includes('owner_id')
}

/**
 * 자동 종료 시점의 학생 행을 게임 기록으로 남긴다.
 * 이미 기록이 있는 방(선생님이 직접 끝냈는데 상태 저장만 실패한 경우 등)은 건너뛴다.
 */
async function saveReportsForExpiredRooms(
  supabase: SupabaseClient<Database>,
  rooms: RoomCandidate[],
): Promise<string[]> {
  // 체험 방은 끝까지 하면 봇 실행기가 기록 없이 닫는다. 중간에 탭을 닫아 여기로 온 체험 방도 똑같이 기록 없이 닫는다.
  const targets = rooms.filter((room) => STARTED_STATUSES.has(room.status) && !isTrialRoom(room))
  if (targets.length === 0) return []
  const codes = targets.map((room) => room.room_code)

  const alreadyReported = new Set<string>()
  const playersByRoom = new Map<string, PlayerRow[]>()
  for (const codeChunk of chunk(codes, CHUNK_SIZE)) {
    const [{ data: reports, error: reportsError }, { data: players, error: playersError }] = await Promise.all([
      supabase.from('game_reports').select('room_code').in('room_code', codeChunk),
      supabase.from('players').select('*').in('room_code', codeChunk),
    ])
    if (reportsError) throw reportsError
    if (playersError) throw playersError
    for (const report of (reports ?? []) as Array<{ room_code: string }>) alreadyReported.add(report.room_code)
    for (const player of (players ?? []) as PlayerRow[]) {
      const list = playersByRoom.get(player.room_code) ?? []
      list.push(player)
      playersByRoom.set(player.room_code, list)
    }
  }

  const reported: string[] = []
  for (const room of targets) {
    if (alreadyReported.has(room.room_code)) continue
    const players = playersByRoom.get(room.room_code) ?? []
    if (players.length === 0) continue

    const snapshot = {
      room_code: room.room_code,
      set_id: room.set_id ?? null,
      game_mode: room.game_mode ?? null,
      player_count: players.length,
      players_data: players,
    }

    try {
      let error: unknown = null
      if (room.owner_id && ownerColumnAvailable !== false) {
        const result = await supabase.from('game_reports').insert({ ...snapshot, owner_id: room.owner_id } as any)
        error = result.error
        if (!error) ownerColumnAvailable = true
        else if (isMissingOwnerColumn(error)) {
          ownerColumnAvailable = false
          error = (await supabase.from('game_reports').insert(snapshot as any)).error
        }
      } else {
        error = (await supabase.from('game_reports').insert(snapshot as any)).error
      }
      if (error) throw error
      reported.push(room.room_code)
    } catch (error) {
      // 기록 저장이 실패해도 학생 행은 그대로 남아 있어 리포트 주소로는 볼 수 있다. 스윕 전체를 멈추지 않는다.
      console.error(`[roomExpiry] ${room.room_code} 자동 종료 기록 저장 실패:`, error)
    }
  }
  return reported
}

/**
 * 방치된 방을 찾아 finished 로 바꾸고, 시작됐던 방은 게임 기록을 남긴다.
 *
 * @param supabase 서버(service role) Supabase 인스턴스
 * @param now 테스트용 기준 시각
 */
export async function expireStaleRooms(
  supabase: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<ExpireStaleRoomsResult> {
  const nowMs = now.getTime()
  const empty: ExpireStaleRoomsResult = { scanned: 0, expired: [], skippedLive: [], reported: [] }

  const candidateCutoff = new Date(nowMs - ROOM_MAX_AGE_MS).toISOString()

  const { data, error } = await supabase
    .from('rooms')
    // is_homework/due_at/owner_id 컬럼이 아직 없는 DB에서도 스윕이 죽지 않게 * 로 읽는다
    .select('*')
    .in('status', ACTIVE_STATUSES)
    .lt('created_at', candidateCutoff)
    .order('created_at', { ascending: true })
    .limit(SWEEP_LIMIT)

  if (error) throw error

  const candidates = ((data ?? []) as RoomCandidate[]).filter((room) => isRoomStale(room, nowMs))
  if (candidates.length === 0) return empty

  // 학생이 방금까지 움직인 방은 진짜 수업 중일 수 있으니 다음 스윕으로 미룬다.
  const liveCodes = new Set<string>()
  const activitySince = new Date(nowMs - PLAYER_ACTIVITY_GRACE_MS).toISOString()
  for (const codeChunk of chunk(candidates.map((room) => room.room_code), CHUNK_SIZE)) {
    const { data: livePlayers, error: playersError } = await supabase
      .from('players')
      .select('room_code')
      .in('room_code', codeChunk)
      .gt('updated_at', activitySince)
    if (playersError) throw playersError
    for (const player of (livePlayers ?? []) as Array<{ room_code: string }>) liveCodes.add(player.room_code)
  }

  const expiredRooms = candidates.filter((room) => !liveCodes.has(room.room_code))
  if (expiredRooms.length === 0) {
    return { scanned: candidates.length, expired: [], skippedLive: [...liveCodes], reported: [] }
  }

  // PostgREST 는 in(...) 목록을 URL 쿼리에 싣는다. 수백 개가 한꺼번에 걸려도
  // URL 길이 제한에 부딪히지 않도록 나눠 보낸다.
  const expiredCodes = expiredRooms.map((room) => room.room_code)
  for (const codeChunk of chunk(expiredCodes, CHUNK_SIZE)) {
    const { error: updateError } = await (supabase.from('rooms') as any)
      .update({ status: 'finished' })
      .in('room_code', codeChunk)
      .in('status', ACTIVE_STATUSES) // 조회 이후 선생님이 직접 끝냈다면 덮어쓰지 않는다

    if (updateError) throw updateError
  }

  const reported = await saveReportsForExpiredRooms(supabase, expiredRooms)

  return { scanned: candidates.length, expired: expiredCodes, skippedLive: [...liveCodes], reported }
}

/**
 * 목록/통계 조회 앞에 끼워 넣는 정리용 래퍼.
 * 스윕이 실패해도 원래 응답은 그대로 나가야 하므로 오류를 삼킨다.
 */
export async function sweepStaleRoomsQuietly(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const result = await expireStaleRooms(supabase)
    if (result.expired.length > 0) {
      console.info(
        `[roomExpiry] 방치된 게임 룸 ${result.expired.length}개를 자동 종료했습니다. (기록 저장 ${result.reported.length}개)`,
      )
    }
  } catch (error) {
    console.error('[roomExpiry] 자동 종료 스윕 실패:', error)
  }
}
