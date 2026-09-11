import { supabase } from '@/lib/supabase/client'
import { generateRoomCode } from '@/lib/utils/gameCode'
import { DEFAULT_GAME_MODE, getModeInitialPlayerState, isGameModeId, type GameModeId } from '@/lib/game/modes'
import { createRoleAssignmentPatches } from '@/lib/game/zombie'
import type { Database, Json } from '@/types/database.types'

type RoomRow = Database['public']['Tables']['rooms']['Row']
type RoomInsert = Database['public']['Tables']['rooms']['Insert']
type PlayerRow = Database['public']['Tables']['players']['Row']
type PlayerInsert = Database['public']['Tables']['players']['Insert']

export type CreateRoomInput = {
  setId: string | null
  gameMode: GameModeId
  /** 방 옵션(rooms.settings). 공부 모드 옵션 등. 없으면 보내지 않는다 */
  settings?: Json
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

export async function createRoom({ setId, gameMode, settings }: CreateRoomInput): Promise<RoomRow> {
  const roomCode = generateRoomCode()
  const payload: RoomInsert = {
    room_code: roomCode,
    status: 'waiting',
    current_q_index: 0,
    game_mode: gameMode,
    set_id: setId,
    // 키가 있을 때만 보낸다 (settings 컬럼이 없는 DB에서도 게임 방은 만들어져야 한다)
    ...(settings ? { settings } : {}),
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

  if (gameMode === 'zombie') {
    const { data: roomPlayers, error: listError } = await (supabase
      .from('players') as any)
      .select('id, nickname, is_kicked')
      .eq('room_code', roomCode)

    if (listError) throw listError

    const activePlayers = ((roomPlayers ?? []) as Array<{
      id: string
      nickname: string
      is_kicked: boolean | null
    }>).filter((player) => !player.is_kicked)

    const patches = createRoleAssignmentPatches(activePlayers)
    await Promise.all(
      patches.map(({ playerId, patch }) =>
        (supabase.from('players') as any).update(patch).eq('id', playerId),
      ),
    )
  }

  const updatePayload: Record<string, unknown> = {
    status: 'playing',
    started_at: new Date().toISOString(),
    duration_seconds: null,
  }
  if (durationSeconds) {
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

export async function pauseRoom(roomCode: string, durationSeconds?: number | null): Promise<void> {
  const patch: Record<string, unknown> = { status: 'paused' }
  if (durationSeconds != null) {
    patch.duration_seconds = durationSeconds
  }

  const { error } = await (supabase
    .from('rooms') as any)
    .update(patch)
    .eq('room_code', roomCode)

  if (error) throw error
}

export async function resumeRoom(roomCode: string, durationSeconds?: number | null): Promise<void> {
  const patch: Record<string, unknown> = {
    status: 'playing',
    started_at: new Date().toISOString(),
  }
  if (durationSeconds != null) {
    patch.duration_seconds = durationSeconds
  }

  const { error } = await (supabase
    .from('rooms') as any)
    .update(patch)
    .eq('room_code', roomCode)

  if (error) throw error
}

export async function endRoom(roomCode: string): Promise<void> {
  const { error } = await (supabase
    .from('rooms') as any)
    .update({ status: 'ended' })
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
      attack_power: null,
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
      current_question_index: 0,
      combo_count: 0,
      has_umbrella: false,
      pending_attacks: [],
      is_kicked: false,
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
  const normalizedNickname = input.nickname.trim()
  const payload: PlayerInsert = {
    room_code: input.roomCode,
    nickname: normalizedNickname,
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

export async function nicknameExists(
  roomCode: string,
  nickname: string,
  excludePlayerId?: string | null,
): Promise<boolean> {
  const normalizedNickname = nickname.trim().toLocaleLowerCase('ko-KR')
  const { data, error } = await (supabase
    .from('players')
    .select('id, nickname')
    .eq('room_code', roomCode) as any)

  if (error) throw error
  return ((data ?? []) as Array<{ id: string; nickname: string }>).some((player) => (
    player.id !== excludePlayerId
    && player.nickname.trim().toLocaleLowerCase('ko-KR') === normalizedNickname
  ))
}

/**
 * 방 안에서 같은 닉네임(대소문자·앞뒤 공백 무시)을 가진 참가자.
 * 과제 방의 "이어서 하기"에 쓴다: 다른 기기나 탭에서 온 학생을 같은 기록에 잇는다.
 */
export async function findPlayerByNickname(roomCode: string, nickname: string): Promise<PlayerRow | null> {
  const normalizedNickname = nickname.trim().toLocaleLowerCase('ko-KR')
  const { data, error } = await (supabase
    .from('players')
    .select('*')
    .eq('room_code', roomCode) as any)

  if (error) throw error
  return ((data ?? []) as PlayerRow[]).find((player) => (
    player.nickname.trim().toLocaleLowerCase('ko-KR') === normalizedNickname
  )) ?? null
}

export function isNicknameConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown }
  const text = `${String(candidate.message ?? '')} ${String(candidate.details ?? '')}`.toLowerCase()
  return candidate.code === '23505'
    || text.includes('players_room_nickname_unique')
    || text.includes('nickname already exists in room')
}
