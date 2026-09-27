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
  | 'tutorial:show'
  | 'tutorial:slide'
  | 'tutorial:hide'
  | 'gold_quest:attack_request'
  | 'gold_quest:attack_response'
  | 'gold_quest:attack_notice'
  | 'battle:attacked'
  | 'battle:blizzard'
  | 'cafe:item_attack'
  | 'dontlookdown:pos'

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
  | 'network_online'
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

const roomClientIds = new Map<string, string>()

/**
 * 이 탭(페이지 로드)의 채널 클라이언트 ID. 메모리에만 두고 sessionStorage에는 저장하지 않는다.
 * sessionStorage에 두면 "탭 복제"·"닫은 탭 다시 열기"로 생긴 탭이 같은 ID를 물려받아,
 * 두 탭이 서로의 브로드캐스트를 '내가 보낸 것'으로 오인해 버렸다(공격 아이템이 안 먹히는 것처럼 보임).
 */
export function getRoomClientId(roomCode: string): string {
  if (typeof window === 'undefined') {
    return `server-${roomCode || 'unknown'}`
  }

  const key = roomCode || 'global'
  const existing = roomClientIds.get(key)
  if (existing) return existing

  const randomId = typeof window.crypto?.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  roomClientIds.set(key, randomId)
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
