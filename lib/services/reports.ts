import { supabase } from '@/lib/supabase/client'
import { getRoomByCode } from '@/lib/services/rooms'
import { listPlayersInRoom } from '@/lib/services/players'
import type { Database } from '@/types/database.types'
import type { Json } from '@/types/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']
type PlayerRow = Database['public']['Tables']['players']['Row']
export type GameReportRow = Database['public']['Tables']['game_reports']['Row']

export async function saveGameReportSnapshot(room: RoomRow, players: PlayerRow[]): Promise<void> {
  const { error } = await supabase.from('game_reports').insert({
    room_code: room.room_code,
    set_id: room.set_id,
    game_mode: room.game_mode,
    player_count: players.length,
    players_data: players,
  } as any)

  if (error) throw error
}

export async function listRecentGameReports(limit = 50): Promise<GameReportRow[]> {
  const { data, error } = await ((supabase
    .from('game_reports') as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit))

  if (error) throw error
  return (data ?? []) as GameReportRow[]
}

export async function getGameReportById(reportId: string): Promise<GameReportRow | null> {
  const { data, error } = await ((supabase
    .from('game_reports') as any)
    .select('*')
    .eq('id', reportId)
    .maybeSingle())

  if (error) throw error
  return data as GameReportRow | null
}

export function parseReportPlayers(playersData: Json): PlayerRow[] {
  return Array.isArray(playersData)
    ? (playersData as PlayerRow[])
    : []
}

export async function getFinishedRoomReport(roomCode: string): Promise<{
  room: RoomRow | null
  players: PlayerRow[]
}> {
  const [room, players] = await Promise.all([
    getRoomByCode(roomCode),
    listPlayersInRoom(roomCode),
  ])

  return { room, players }
}
