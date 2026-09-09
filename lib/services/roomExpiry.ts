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
 * 어떻게 판정하나:
 *   1) 마지막 활동 시각(started_at / updated_at / created_at 중 가장 최근)이
 *      상태별 유휴 한도를 넘겼거나,
 *   2) 만들어진 지 하루가 지났으면 자동 종료 대상으로 본다.
 *   단, 참여자(players) 행이 최근에 갱신된 방은 실제로 진행 중일 수 있으므로 건드리지 않는다.
 *   → 살아있는 수업을 강제로 끊는 사고가 나지 않는다.
 *
 * DB 스키마 변경이 필요 없다. 기존 컬럼만 읽고 status 만 바꾼다.
 */

const HOUR = 60 * 60 * 1000

/** 상태별 유휴 한도 — 이 시간 동안 아무 변화가 없으면 종료 처리 */
export const ROOM_IDLE_LIMIT_MS: Record<string, number> = {
  waiting: 3 * HOUR,  // 대기방만 열어두고 안 쓴 경우
  playing: 6 * HOUR,  // 수업 한 타임(길어야 2시간)보다 넉넉하게
  paused: 6 * HOUR,
}

/** 유휴 여부와 상관없이 이 시간이 지나면 무조건 종료 */
export const ROOM_MAX_AGE_MS = 24 * HOUR

/** 이 시간 안에 참여자 데이터가 갱신됐으면 '살아있는 방'으로 보고 건너뛴다 */
export const PLAYER_ACTIVITY_GRACE_MS = 1 * HOUR

/** 한 번에 처리할 최대 방 수 — 스윕이 요청을 오래 붙잡지 않도록 */
const SWEEP_LIMIT = 500

const ACTIVE_STATUSES = Object.keys(ROOM_IDLE_LIMIT_MS)
const MAX_IDLE_LIMIT_MS = Math.max(...Object.values(ROOM_IDLE_LIMIT_MS))

type RoomCandidate = {
  room_code: string
  status: string
  created_at: string
  updated_at: string | null
  started_at: string | null
}

export interface ExpireStaleRoomsResult {
  /** 검사 대상이 된 방 수 */
  scanned: number
  /** 실제로 종료 처리한 방 코드 */
  expired: string[]
  /** 오래됐지만 참여자가 아직 활동 중이라 건너뛴 방 코드 */
  skippedLive: string[]
}

function toTime(value: string | null | undefined): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

/** 방의 마지막 활동 시각 — updated_at 트리거가 없는 환경도 대비해 셋 중 최댓값을 쓴다 */
function lastActivityAt(room: RoomCandidate): number {
  return Math.max(toTime(room.updated_at), toTime(room.started_at), toTime(room.created_at))
}

export function isRoomStale(room: RoomCandidate, now: number): boolean {
  // 이미 끝난 방(finished/ended)은 손대지 않는다.
  const idleLimit = ROOM_IDLE_LIMIT_MS[room.status]
  if (idleLimit == null) return false

  const age = now - toTime(room.created_at)
  if (age >= ROOM_MAX_AGE_MS) return true

  return now - lastActivityAt(room) >= idleLimit
}

/**
 * 방치된 방을 찾아 finished 로 바꾼다.
 *
 * @param supabase 서버(service role) 또는 클라이언트 Supabase 인스턴스
 * @param now 테스트용 기준 시각
 */
export async function expireStaleRooms(
  supabase: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<ExpireStaleRoomsResult> {
  const nowMs = now.getTime()
  const empty: ExpireStaleRoomsResult = { scanned: 0, expired: [], skippedLive: [] }

  // 어떤 방도 자기 나이보다 오래 유휴일 수 없으므로,
  // '가장 관대한 유휴 한도'보다 어린 방은 아예 후보에서 뺀다. (하루 규칙도 이 안에 포함된다)
  const candidateCutoff = new Date(nowMs - MAX_IDLE_LIMIT_MS).toISOString()

  const { data, error } = await supabase
    .from('rooms')
    .select('room_code, status, created_at, updated_at, started_at')
    .in('status', ACTIVE_STATUSES)
    .lt('created_at', candidateCutoff)
    .order('created_at', { ascending: true })
    .limit(SWEEP_LIMIT)

  if (error) throw error

  const candidates = ((data ?? []) as RoomCandidate[]).filter((room) => isRoomStale(room, nowMs))
  if (candidates.length === 0) return empty

  // 참여자가 최근까지 움직인 방은 진짜 진행 중일 수 있으니 제외한다.
  const candidateCodes = candidates.map((room) => room.room_code)
  const liveCodes = new Set<string>()
  const { data: livePlayers, error: playersError } = await supabase
    .from('players')
    .select('room_code')
    .in('room_code', candidateCodes)
    .gt('updated_at', new Date(nowMs - PLAYER_ACTIVITY_GRACE_MS).toISOString())

  if (playersError) throw playersError
  for (const player of (livePlayers ?? []) as Array<{ room_code: string }>) {
    liveCodes.add(player.room_code)
  }

  const expiredCodes = candidateCodes.filter((code) => !liveCodes.has(code))
  if (expiredCodes.length === 0) {
    return { scanned: candidates.length, expired: [], skippedLive: [...liveCodes] }
  }

  const { error: updateError } = await (supabase.from('rooms') as any)
    .update({ status: 'finished' })
    .in('room_code', expiredCodes)
    .in('status', ACTIVE_STATUSES) // 조회 이후 선생님이 직접 끝냈다면 덮어쓰지 않는다

  if (updateError) throw updateError

  return { scanned: candidates.length, expired: expiredCodes, skippedLive: [...liveCodes] }
}

/**
 * 목록/통계 조회 앞에 끼워 넣는 정리용 래퍼.
 * 스윕이 실패해도 원래 응답은 그대로 나가야 하므로 오류를 삼킨다.
 */
export async function sweepStaleRoomsQuietly(supabase: SupabaseClient<Database>): Promise<void> {
  try {
    const result = await expireStaleRooms(supabase)
    if (result.expired.length > 0) {
      console.info(`[roomExpiry] 방치된 게임 룸 ${result.expired.length}개를 자동 종료했습니다.`)
    }
  } catch (error) {
    console.error('[roomExpiry] 자동 종료 스윕 실패:', error)
  }
}
