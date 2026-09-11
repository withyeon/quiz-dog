import { supabase } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils/gameCode'
import type { GameModeId } from '@/lib/game/modes'
import { getRoomByCode, finishRoom } from '@/lib/services/rooms'
import { listPlayersInRoom } from '@/lib/services/players'
import { saveGameReportSnapshot } from '@/lib/services/reports'
import type { Database, Json } from '@/types/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']

export type CreateHomeworkRoomInput = {
  setId: string
  gameMode: GameModeId
  /** 학생 한 명이 플레이하는 시간(초). 공부 모드는 제한 없음(null) */
  durationSeconds: number | null
  /** 제출 마감 (ISO) */
  dueAt: string
  /** 방 옵션(rooms.settings). 공부 모드 옵션 등. 없으면 보내지 않는다 */
  settings?: Json
}

export type HomeworkRoomSummary = RoomRow & {
  playerCount: number
}

/** 과제 기능이 켜지지 않은 DB(마이그레이션 전)에서 나는 오류인지 */
export function isHomeworkSchemaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  return /is_homework|due_at|started_at/.test(message)
}

/** 공부 모드(방 옵션·시도 기록·해설·game_mode 'study')가 아직 DB에 없을 때 나는 오류인지 */
export function isStudySchemaError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? ''
  return /settings|attempts|explanation|rooms_game_mode_check/.test(message)
}

export function describeHomeworkError(error: unknown): string {
  if (isHomeworkSchemaError(error)) {
    return '과제 기능을 쓰려면 DB 마이그레이션(sql/20260910_homework_mode.sql)을 먼저 적용해야 해요.'
  }
  if (isStudySchemaError(error)) {
    return '공부 모드를 쓰려면 DB 마이그레이션(sql/20260911_study_mode.sql)을 먼저 적용해야 해요.'
  }
  return (error as { message?: string } | null)?.message ?? String(error)
}

/**
 * 과제 방을 만든다. 만드는 순간부터 playing이라 학생이 바로 들어와 풀 수 있고,
 * 선생님 화면은 열려 있지 않아도 된다.
 */
export async function createHomeworkRoom(input: CreateHomeworkRoomInput): Promise<RoomRow> {
  const payload = {
    room_code: generateRoomCode(),
    status: 'playing',
    current_q_index: 0,
    game_mode: input.gameMode,
    set_id: input.setId,
    started_at: new Date().toISOString(),
    duration_seconds: input.durationSeconds,
    is_homework: true,
    due_at: input.dueAt,
    // 키가 있을 때만 보낸다. 게임 과제는 settings 컬럼이 없는 DB(마이그레이션 전)에서도 만들어져야 한다.
    ...(input.settings ? { settings: input.settings } : {}),
  }

  const { data, error } = await (supabase.from('rooms') as any)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as RoomRow
}

/**
 * 내 문제집으로 낸, 아직 열려 있는 과제 목록 (참여 인원 포함).
 * rooms에는 소유자 컬럼이 없어서 문제집 소유로 "내 과제"를 가른다 (게임 기록과 같은 방식).
 */
export async function listOpenHomeworkRooms(setIds: string[]): Promise<HomeworkRoomSummary[]> {
  if (setIds.length === 0) return []

  const { data, error } = await (supabase.from('rooms') as any)
    .select('*')
    .eq('is_homework', true)
    .in('status', ['playing', 'paused'])
    .in('set_id', setIds)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  const rooms = (data ?? []) as RoomRow[]
  if (rooms.length === 0) return []

  const codes = rooms.map((room) => room.room_code)
  const { data: players, error: playersError } = await (supabase.from('players') as any)
    .select('room_code')
    .in('room_code', codes)

  if (playersError) throw playersError
  const counts = new Map<string, number>()
  for (const player of (players ?? []) as Array<{ room_code: string }>) {
    counts.set(player.room_code, (counts.get(player.room_code) ?? 0) + 1)
  }

  return rooms.map((room) => ({ ...room, playerCount: counts.get(room.room_code) ?? 0 }))
}

/**
 * 과제를 마감한다: 방을 finished로 바꾸고, 그 시점의 성적을 게임 기록(game_reports)에 남긴다.
 * 실시간 수업의 "게임 종료"와 같은 결과라 리포트·기록 화면이 그대로 쓰인다.
 */
export async function closeHomeworkRoom(roomCode: string, ownerId: string | null): Promise<void> {
  const [room, players] = await Promise.all([getRoomByCode(roomCode), listPlayersInRoom(roomCode)])
  await finishRoom(roomCode)
  if (room) {
    try {
      await saveGameReportSnapshot({ ...room, status: 'finished' }, players, ownerId)
    } catch (error) {
      console.error('과제 마감 기록 저장 실패:', error)
    }
  }
}

/** 과제 마감 기본값: 내일 밤 11시 59분 (로컬) */
export function defaultHomeworkDueAt(): Date {
  const due = new Date()
  due.setDate(due.getDate() + 1)
  due.setHours(23, 59, 0, 0)
  return due
}

/** <input type="datetime-local"> 값 ↔ Date */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDueAt(iso: string | null | undefined): string {
  if (!iso) return '마감 없음'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '마감 없음'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
