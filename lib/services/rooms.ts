import { supabase } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils/gameCode'
import { DEFAULT_GAME_MODE, getModeInitialPlayerState, isGameModeId, type GameModeId } from '@/lib/game/modes'
import type { Database } from '@/types/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']
type RoomInsert = Database['public']['Tables']['rooms']['Insert']
type PlayerInsert = Database['public']['Tables']['players']['Insert']

export type CreateRoomInput = {
  setId: string | null
  gameMode: GameModeId
}

export type StartRoomInput = {
  roomCode: string
  gameMode: GameModeId
  durationSeconds?: number | null
}

export async function getRoomByCode(roomCode: string): Promise<RoomRow | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_code', roomCode)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createRoom({ setId, gameMode }: CreateRoomInput): Promise<RoomRow> {
  const roomCode = generateRoomCode()
  const payload: RoomInsert = {
    room_code: roomCode,
    status: 'waiting',
    current_q_index: 0,
    game_mode: gameMode,
    set_id: setId,
  }

  const { data, error } = await (supabase
    .from('rooms') as any)
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data as RoomRow
}

export async function updateRoomGameMode(roomCode: string, gameMode: GameModeId): Promise<void> {
  const { error } = await (supabase
    .from('rooms') as any)
    .update({ game_mode: gameMode })
    .eq('room_code', roomCode)

  if (error) throw error
}

export async function assertQuestionSetHasQuestions(setId: string | null): Promise<void> {
  if (!setId) return

  const { data, error } = await supabase
    .from('questions')
    .select('id')
    .eq('set_id', setId)
    .limit(1)

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('이 문제집에 문제가 없습니다. 문제를 먼저 추가해주세요.')
  }
}

export async function startRoom({ roomCode, gameMode, durationSeconds }: StartRoomInput): Promise<void> {
  if (gameMode === 'battle_royale') {
    const { error: healthResetError } = await (supabase
      .from('players') as any)
      .update({ health: 100 })
      .eq('room_code', roomCode)

    if (healthResetError) throw healthResetError
  }

  const updatePayload: Record<string, unknown> = {
    status: 'playing',
    started_at: new Date().toISOString(),
    duration_seconds: null,
  }
  if (gameMode === 'factory' && durationSeconds) {
    updatePayload.duration_seconds = durationSeconds
  }

  const { error } = await (supabase
    .from('rooms') as any)
    .update(updatePayload)
    .eq('room_code', roomCode)

  if (error) throw error
}

export async function finishRoom(roomCode: string): Promise<void> {
  const { error } = await (supabase
    .from('rooms') as any)
    .update({ status: 'finished' })
    .eq('room_code', roomCode)

  if (error) throw error
}

export async function resetRoom(roomCode: string): Promise<void> {
  const { error } = await (supabase
    .from('rooms') as any)
    .update({
      status: 'waiting',
      current_q_index: 0,
      started_at: null,
      duration_seconds: null,
    })
    .eq('room_code', roomCode)

  if (error) throw error

  const { error: resetPlayersError } = await (supabase
    .from('players') as any)
    .update({
      score: 0,
      gold: 0,
      position: 0,
      health: null,
      active_item: null,
      item_effects: null,
      caught_dolls: null,
      claw_points: 0,
      caught_fishes: null,
      fishing_points: 0,
      factories: null,
      factory_money: 0,
      convenience_products: null,
      convenience_money: 0,
      cafe_cash: 0,
      cafe_customers_served: 0,
      mafia_cash: 0,
      mafia_diamonds: 0,
      answer_history: null,
    })
    .eq('room_code', roomCode)

  if (resetPlayersError) throw resetPlayersError
}

export async function createPlayerForRoom(input: {
  roomCode: string
  nickname: string
  avatar: string | null
  gameMode?: string | null
}): Promise<{ id: string }> {
  const mode = isGameModeId(input.gameMode) ? input.gameMode : DEFAULT_GAME_MODE
  const payload: PlayerInsert = {
    room_code: input.roomCode,
    nickname: input.nickname,
    score: 0,
    gold: 0,
    avatar: input.avatar,
    is_online: true,
    ...getModeInitialPlayerState(mode),
  }

  const { data, error } = await (supabase
    .from('players') as any)
    .insert(payload)
    .select('id')
    .single()

  if (error) throw error
  return data as { id: string }
}

export async function ensureRoomExists(roomCode: string): Promise<RoomRow> {
  const existingRoom = await getRoomByCode(roomCode)
  if (existingRoom) return existingRoom

  const { data, error } = await (supabase
    .from('rooms') as any)
    .insert({
      room_code: roomCode,
      status: 'waiting',
      current_q_index: 0,
      game_mode: DEFAULT_GAME_MODE,
    } satisfies RoomInsert)
    .select()
    .single()

  if (error) throw error
  return data as RoomRow
}

export async function nicknameExists(roomCode: string, nickname: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('players')
    .select('id')
    .eq('room_code', roomCode)
    .eq('nickname', nickname)
    .limit(1)

  if (error) throw error
  return (data ?? []).length > 0
}
