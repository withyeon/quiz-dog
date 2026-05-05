import type { Database } from '@/types/database.types'

type PlayerRow = Database['public']['Tables']['players']['Row']
type RoomRow = Database['public']['Tables']['rooms']['Row']

export type RoomPresenceRole = 'student' | 'teacher' | 'spectator'

export type RoomPresenceMeta = {
  clientId: string
  role: RoomPresenceRole
  playerId?: string | null
  onlineAt: string
  lastSeenAt: string
}

export type RoomEventType =
  | 'room:resync-request'
  | 'room:snapshot-hint'
  | 'room:patch'
  | 'game:finished'
  | 'player:patch'
  | 'game:effect'

export type RoomChannelEvent<TPayload = unknown> = {
  type: RoomEventType
  roomCode: string
  clientId: string
  playerId?: string | null
  sentAt: string
  seq: number
  payload?: TPayload
}

export type RoomResyncReason =
  | 'subscribed'
  | 'reconnected'
  | 'tab_visible'
  | 'broadcast_hint'
  | 'manual'

export type PlayerPatchPayload = {
  playerId: string
  patch: Partial<PlayerRow> & Record<string, unknown>
  reason?: string
}

export type RoomPatchPayload = {
  patch: Partial<RoomRow> & Record<string, unknown>
  reason?: string
}

export type HostCandidate = Pick<PlayerRow, 'id'> & {
  created_at?: string | null
  is_online?: boolean | null
}

const CLIENT_ID_PREFIX = 'quizdog_client_id'
export const ROOM_RUNTIME_EVENT = 'quizdog:room-runtime-event'

export function emitRoomRuntimeEvent(event: RoomChannelEvent): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<RoomChannelEvent>(ROOM_RUNTIME_EVENT, { detail: event }))
}

export function subscribeRoomRuntimeEvent(
  listener: (event: RoomChannelEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleEvent = (event: Event) => {
    listener((event as CustomEvent<RoomChannelEvent>).detail)
  }

  window.addEventListener(ROOM_RUNTIME_EVENT, handleEvent)
  return () => {
    window.removeEventListener(ROOM_RUNTIME_EVENT, handleEvent)
  }
}

export function getRoomClientId(roomCode: string): string {
  if (typeof window === 'undefined') {
    return `server-${roomCode || 'unknown'}`
  }

  const storageKey = `${CLIENT_ID_PREFIX}:${roomCode || 'global'}`
  const existing = window.sessionStorage.getItem(storageKey)
  if (existing) return existing

  const randomId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  window.sessionStorage.setItem(storageKey, randomId)
  return randomId
}

export function flattenPresenceState(
  state: Record<string, unknown[]>,
): RoomPresenceMeta[] {
  return Object.values(state)
    .flat()
    .filter((meta): meta is RoomPresenceMeta => {
      if (!meta || typeof meta !== 'object') return false
      const candidate = meta as Partial<RoomPresenceMeta>
      return typeof candidate.clientId === 'string'
        && typeof candidate.role === 'string'
        && typeof candidate.onlineAt === 'string'
    })
}

export function selectRoomHostPlayerId(
  players: HostCandidate[],
  presence: RoomPresenceMeta[] = [],
): string | null {
  const connectedPlayerIds = new Set(
    presence
      .filter((meta) => meta.role === 'student' && meta.playerId)
      .map((meta) => String(meta.playerId)),
  )

  const connectedPlayers = players.filter((player) => connectedPlayerIds.has(player.id))
  const fallbackPlayers = players.filter((player) => player.is_online !== false)
  const candidates = connectedPlayers.length > 0 ? connectedPlayers : fallbackPlayers

  return [...candidates].sort((a, b) => {
    const createdCompare = String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''))
    return createdCompare || a.id.localeCompare(b.id)
  })[0]?.id ?? null
}

export function isRoomHostPlayer(
  playerId: string | null | undefined,
  players: HostCandidate[],
  presence: RoomPresenceMeta[] = [],
): boolean {
  if (!playerId) return false
  return selectRoomHostPlayerId(players, presence) === playerId
}
