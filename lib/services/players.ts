import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']
type PlayerUpdate = Database['public']['Tables']['players']['Update']

export async function getPlayerById(playerId: string): Promise<PlayerRow | null> {
  const { data, error } = await (supabase
    .from('players') as any)
    .select('*')
    .eq('id', playerId)
    .maybeSingle()

  if (error) throw error
  return data as PlayerRow | null
}

export async function listPlayersInRoom(roomCode: string): Promise<PlayerRow[]> {
  const { data, error } = await (supabase
    .from('players') as any)
    .select('*')
    .eq('room_code', roomCode)

  if (error) throw error
  return (data ?? []) as PlayerRow[]
}

export async function updatePlayer(
  playerId: string,
  payload: PlayerUpdate | Record<string, unknown>,
): Promise<void> {
  const { error } = await (supabase
    .from('players') as any)
    .update(payload)
    .eq('id', playerId)

  if (error) throw error
}

export async function updatePlayersInRoom(
  roomCode: string,
  payload: PlayerUpdate | Record<string, unknown>,
): Promise<void> {
  const { error } = await (supabase
    .from('players') as any)
    .update(payload)
    .eq('room_code', roomCode)

  if (error) throw error
}
