import { relayRoomTransport } from '@/lib/realtime/transport/relayTransport'
import { supabaseRoomTransport } from '@/lib/realtime/transport/supabaseTransport'
import type { RoomTransport } from '@/lib/realtime/transport/types'

export type { RoomChannelStatus, SendEventResult } from '@/lib/realtime/transport/types'

/**
 * 방 실시간 전송 선택. 기본은 Supabase Realtime이고,
 * NEXT_PUBLIC_ROOM_TRANSPORT=relay 와 NEXT_PUBLIC_ROOM_RELAY_URL=wss://… 를 주면 자체 중계 서버를 쓴다.
 * (DB 변경 구독 — players INSERT/DELETE, rooms UPDATE — 은 이 설정과 무관하게 Supabase에 남는다)
 */
export const roomTransport: RoomTransport = process.env.NEXT_PUBLIC_ROOM_TRANSPORT === 'relay'
  ? relayRoomTransport
  : supabaseRoomTransport
