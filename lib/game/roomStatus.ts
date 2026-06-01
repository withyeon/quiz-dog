import type { Database } from '@/types/database.types'

export type RoomStatus = Database['public']['Tables']['rooms']['Row']['status']

export function isTerminalRoomStatus(status: RoomStatus | null | undefined): boolean {
  return status === 'finished' || status === 'ended'
}
