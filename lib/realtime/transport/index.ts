import { relayRoomTransport } from '@/lib/realtime/transport/relayTransport'
import { supabaseRoomTransport } from '@/lib/realtime/transport/supabaseTransport'
import type { RoomTransport } from '@/lib/realtime/transport/types'

export type { RoomChannelStatus, SendEventResult } from '@/lib/realtime/transport/types'

/**
 * 방 실시간 전송 선택. 기본은 Supabase Realtime이고,
 * NEXT_PUBLIC_ROOM_TRANSPORT=relay 와 NEXT_PUBLIC_ROOM_RELAY_URL=wss://… 를 주면 자체 중계 서버를 쓴다.
 *
 * 중계 서버를 쓰면 DB 변경 구독(players INSERT/DELETE, rooms UPDATE)도 열지 않는다.
 * 학생 탭이 Supabase Realtime 소켓을 아예 열지 않게 해서 Free 플랜의 동시 접속 200개 한도를 피한다.
 * 그 대신 입장은 player:joined, 방 상태는 room:patch 이벤트로 받고, 주기 재동기화가 안전망이다.
 */
export const isRelayRoomTransport = process.env.NEXT_PUBLIC_ROOM_TRANSPORT === 'relay'

export const roomTransport: RoomTransport = isRelayRoomTransport
  ? relayRoomTransport
  : supabaseRoomTransport
