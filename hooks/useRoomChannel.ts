'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  emitRoomRuntimeEvent,
  getRoomClientId,
  notifyOutgoingRoomEvent,
  type RoomChannelEvent,
  type RoomEventType,
  type RoomPresenceMeta,
  type RoomPresenceRole,
  type RoomResyncReason,
} from '@/lib/realtime/roomChannel'
import { roomTransport, type RoomChannelStatus, type SendEventResult } from '@/lib/realtime/transport'
import type { RoomConnection } from '@/lib/realtime/transport/types'

type UseRoomChannelOptions = {
  roomCode: string
  playerId?: string | null
  role?: RoomPresenceRole
  enabled?: boolean
  onEvent?: (event: RoomChannelEvent) => void
  onResyncNeeded?: (reason: RoomResyncReason) => void | Promise<void>
}

/** 구독이 안 된 채널을 이 간격으로 살펴 소켓 재연결·채널 재생성을 한다 */
const WATCHDOG_INTERVAL_MS = 3000

export function useRoomChannel({
  roomCode,
  playerId = null,
  role = 'student',
  enabled = true,
  onEvent,
  onResyncNeeded,
}: UseRoomChannelOptions) {
  const [status, setStatus] = useState<RoomChannelStatus>('idle')
  const [presence, setPresence] = useState<RoomPresenceMeta[]>([])
  const [clientId, setClientId] = useState('')
  // 버려진 채널(teardown)을 새로 만들어야 할 때 올려서 구독 효과를 다시 돌린다
  const [generation, setGeneration] = useState(0)

  const channelRef = useRef<RoomConnection | null>(null)
  const statusRef = useRef<RoomChannelStatus>('idle')
  const seqRef = useRef(0)
  const wasSubscribedRef = useRef(false)
  const mountedRef = useRef(false)
  const onlineAtRef = useRef('')
  const onEventRef = useRef(onEvent)
  const onResyncNeededRef = useRef(onResyncNeeded)
  const playerIdRef = useRef(playerId)
  const clientIdRef = useRef('')

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onResyncNeededRef.current = onResyncNeeded
  }, [onResyncNeeded])

  useEffect(() => {
    playerIdRef.current = playerId
  }, [playerId])

  const setChannelStatus = useCallback((nextStatus: RoomChannelStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const sendEvent = useCallback(async <TPayload,>(
    type: RoomEventType,
    payload?: TPayload,
    /**
     * 보낸 사람 playerId를 직접 정한다. 입장 직후처럼 playerId 상태가 아직 반영되기 전에 보낼 때 쓴다.
     * 중계 서버는 이 playerId가 그 방 학생인지 확인한 뒤에만 이벤트를 중계한다.
     */
    options?: { playerId?: string | null },
  ): Promise<SendEventResult> => {
    const channel = channelRef.current
    if (!channel) {
      return { ok: false, reason: 'no_channel' }
    }

    seqRef.current += 1
    const eventClientId = clientIdRef.current || clientId || getRoomClientId(roomCode)
    const event: RoomChannelEvent<TPayload> = {
      type,
      roomCode,
      clientId: eventClientId,
      playerId: options?.playerId !== undefined ? options.playerId : playerIdRef.current,
      sentAt: new Date().toISOString(),
      seq: seqRef.current,
      payload,
    }
    // self:false 라 이 탭으로는 안 돌아오는 이벤트를, 같은 탭에서 들어야 하는 쪽(/dev 봇)에 알린다
    notifyOutgoingRoomEvent(event as RoomChannelEvent)

    // 구독돼 있으면 소켓(ack 대기)으로, 아니면 바로 예비 경로(HTTP)로 보낸다. 자세한 건 각 전송 구현 참고.
    return channel.send(event as RoomChannelEvent, statusRef.current === 'subscribed')
  }, [clientId, roomCode])

  const requestResync = useCallback((reason: RoomResyncReason = 'manual') => {
    void onResyncNeededRef.current?.(reason)
    void sendEvent('room:resync-request', { reason })
  }, [sendEvent])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!roomCode || !enabled) {
      setClientId('')
      setPresence([])
      setChannelStatus('idle')
      return
    }

    if (!roomTransport.isConfigured()) {
      setChannelStatus('channel_error')
      return
    }

    const nextClientId = getRoomClientId(roomCode)
    clientIdRef.current = nextClientId
    onlineAtRef.current = onlineAtRef.current || new Date().toISOString()
    setClientId(nextClientId)
    setChannelStatus('subscribing')

    const channel = roomTransport.connect({ roomCode, clientId: nextClientId }, {
      onPresence: (nextPresence) => {
        if (mountedRef.current) {
          setPresence(nextPresence)
        }
      },
      onEvent: (event) => {
        if (!event || event.roomCode !== roomCode || event.clientId === nextClientId) return

        emitRoomRuntimeEvent(event)
        onEventRef.current?.(event)

        if (event.type === 'game:finished') {
          void onResyncNeededRef.current?.('broadcast_hint')
        }
      },
      onStatus: (nextStatus) => {
        if (nextStatus !== 'subscribed') {
          setChannelStatus(nextStatus)
          return
        }

        setChannelStatus('subscribed')
        channel.track({
          clientId: nextClientId,
          role,
          playerId: playerIdRef.current,
          onlineAt: onlineAtRef.current,
          lastSeenAt: new Date().toISOString(),
        } satisfies RoomPresenceMeta)

        const reason: RoomResyncReason = wasSubscribedRef.current ? 'reconnected' : 'subscribed'
        wasSubscribedRef.current = true
        void onResyncNeededRef.current?.(reason)
      },
    })

    channelRef.current = channel

    // 안전망: 구독이 안 된 채로 멈춰 있으면 소켓을 다시 연결하고, 채널이 통째로 버려졌으면
    // (Supabase: 소켓 teardown → state 'closed') 새로 만든다. realtime-js는 소켓이 닫힌 채 남으면 스스로
    // connect()를 다시 부르지 않아 join이 영원히 묻힌다(로비 → 게임 전환에서 실제로 일어났던 일).
    const watchdog = window.setInterval(() => {
      if (channelRef.current !== channel || statusRef.current === 'subscribed') return
      if (channel.isAbandoned()) {
        setGeneration((value) => value + 1)
        return
      }
      channel.ensureConnected()
    }, WATCHDOG_INTERVAL_MS)

    return () => {
      window.clearInterval(watchdog)
      channelRef.current = null
      clientIdRef.current = ''
      setPresence([])
      channel.close()
    }
  }, [enabled, generation, role, roomCode, setChannelStatus])

  useEffect(() => {
    const channel = channelRef.current
    if (!channel || status !== 'subscribed') return

    channel.track({
      clientId,
      role,
      playerId,
      onlineAt: onlineAtRef.current || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    } satisfies RoomPresenceMeta)
  }, [clientId, playerId, role, status])

  useEffect(() => {
    const channel = channelRef.current
    if (!channel || status !== 'subscribed' || !clientId) return

    const heartbeat = window.setInterval(() => {
      channel.track({
        clientId,
        role,
        playerId: playerIdRef.current,
        onlineAt: onlineAtRef.current || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      } satisfies RoomPresenceMeta)
    }, 45000)

    return () => {
      window.clearInterval(heartbeat)
    }
  }, [clientId, role, status])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && statusRef.current === 'subscribed') {
        requestResync('tab_visible')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [requestResync])

  // 네트워크가 끊겼다 돌아오면(교실 와이파이 흔들림 등) 소켓 라이브러리의
  // 재연결 감지를 기다리지 않고 즉시 REST 스냅샷을 다시 받아 누락된 변경을 복구한다.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      requestResync('network_online')
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [requestResync])

  const onlineCount = presence.length

  return useMemo(() => ({
    status,
    isSubscribed: status === 'subscribed',
    clientId,
    presence,
    onlineCount,
    sendEvent,
    requestResync,
  }), [
    clientId,
    onlineCount,
    presence,
    requestResync,
    sendEvent,
    status,
  ])
}
