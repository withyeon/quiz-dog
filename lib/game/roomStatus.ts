import type { Database } from '@/types/database.types'

export type RoomStatus = Database['public']['Tables']['rooms']['Row']['status']

type RoomLike = {
  status: RoomStatus | null | undefined
  is_homework?: boolean | null
  due_at?: string | null
}

export function isTerminalRoomStatus(status: RoomStatus | null | undefined): boolean {
  return status === 'finished' || status === 'ended'
}

/** 과제 방 (호스트 없이 학생이 혼자 푸는 방) */
export function isHomeworkRoom(room: RoomLike | null | undefined): boolean {
  return Boolean(room?.is_homework)
}

/** 과제 마감이 지났는지 */
export function isHomeworkPastDue(room: RoomLike | null | undefined, now: number = Date.now()): boolean {
  if (!isHomeworkRoom(room) || !room?.due_at) return false
  const due = new Date(room.due_at).getTime()
  return Number.isFinite(due) && now >= due
}

/**
 * 학생이 이 방에 들어갈 수 없는 이유. 들어갈 수 있으면 null.
 * 로비의 코드 확인·입장 세 군데가 같은 문구를 쓰도록 한곳에 둔다.
 */
export function getRoomJoinBlockReason(room: RoomLike | null | undefined): string | null {
  if (!room) return '이 코드의 게임방이 없어요. 코드를 다시 확인해주세요.'
  if (isHomeworkRoom(room)) {
    if (isTerminalRoomStatus(room.status)) return '마감된 과제예요. 선생님께 확인해주세요.'
    if (isHomeworkPastDue(room)) return '과제 제출 기간이 끝났어요. 선생님께 확인해주세요.'
    return null
  }
  if (isTerminalRoomStatus(room.status)) return '이미 끝난 게임이에요. 선생님께 새 게임을 열어달라고 해주세요.'
  return null
}
