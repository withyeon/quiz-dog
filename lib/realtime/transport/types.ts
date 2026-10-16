import type { RoomChannelEvent, RoomPresenceMeta } from '@/lib/realtime/roomChannel'

export type RoomChannelStatus =
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'closed'
  | 'timed_out'
  | 'channel_error'

export type SendEventResult = {
  ok: boolean
  reason?: string
}

export type RoomTransportHandlers = {
  /** 방에 들어갔으면 'subscribed', 끊기거나 실패하면 그 상태를 알린다 */
  onStatus: (status: Exclude<RoomChannelStatus, 'idle' | 'subscribing'>) => void
  /** 방 접속 목록 전체(바뀔 때마다) */
  onPresence: (presence: RoomPresenceMeta[]) => void
  /** 다른 클라이언트가 보낸 room_event. 방 코드·보낸 사람 거르기는 훅이 한다 */
  onEvent: (event: RoomChannelEvent) => void
}

export type RoomTransportOptions = {
  roomCode: string
  /** presence 키이자 "내가 보낸 이벤트" 판별용 ID (getRoomClientId) */
  clientId: string
}

/**
 * 방 하나에 대한 실시간 연결. useRoomChannel이 상태·presence·재동기화·감시 타이머를 맡고,
 * 실제 전송(어느 서버로, 어떻게 다시 붙는지)만 이 뒤로 숨긴다.
 */
export interface RoomConnection {
  /** 이벤트를 방의 다른 클라이언트에게 보낸다. canUseSocket=false면 소켓을 건너뛰고 예비 경로(HTTP)로 보낸다 */
  send(event: RoomChannelEvent, canUseSocket: boolean): Promise<SendEventResult>
  /** 내 presence 정보를 올린다(입장 직후, 역할·playerId 변경, 45초 하트비트) */
  track(meta: RoomPresenceMeta): void
  /** 감시 타이머용: 연결이 통째로 버려져 새로 만들어야 하면 true */
  isAbandoned(): boolean
  /** 감시 타이머용: 구독이 안 된 채 멈춰 있으면 다시 연결을 시도한다 */
  ensureConnected(): void
  /** 방을 떠난다 */
  close(): void
}

export interface RoomTransport {
  /** 설정(환경 변수)이 갖춰졌는지. 아니면 훅이 channel_error로 둔다 */
  isConfigured(): boolean
  connect(options: RoomTransportOptions, handlers: RoomTransportHandlers): RoomConnection
}
