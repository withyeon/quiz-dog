'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import { ensureRealtimeSocketConnected, releaseRealtimeChannel } from '@/lib/supabase/realtimeLifecycle'
import {
  emitRoomRuntimeEvent,
  flattenPresenceState,
  getRoomClientId,
  type RoomChannelEvent,
  type RoomEventType,
  type RoomPresenceMeta,
  type RoomPresenceRole,
  type RoomResyncReason,
} from '@/lib/realtime/roomChannel'

type RoomChannelStatus =
  | 'idle'
  | 'subscribing'
  | 'subscribed'
  | 'closed'
  | 'timed_out'
  | 'channel_error'

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

type SendEventResult = {
  ok: boolean
  reason?: string
}

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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
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
      playerId: playerIdRef.current,
      sentAt: new Date().toISOString(),
      seq: seqRef.current,
      payload,
    }

    // 1) 채널이 살아 있으면 웹소켓으로 보낸다(ack 대기).
    //    예전에는 채널이 '구독됨'이 아니면 여기서 조용히 포기했다. 교실 와이파이가 흔들려
    //    소켓이 재연결 중(1~10초)일 때 뽑은 공격 아이템이 그대로 증발하던 원인.
    let wsResult: string | null = null
    if (statusRef.current === 'subscribed') {
      try {
        wsResult = await channel.send({ type: 'broadcast', event: 'room_event', payload: event })
      } catch (error) {
        wsResult = String(error)
      }
      if (wsResult === 'ok') return { ok: true }
    }

    // 2) 소켓이 끊겼거나 push가 실패/타임아웃이면 REST 브로드캐스트로 한 번 더 보낸다.
    //    서버가 같은 채널 구독자에게 뿌려 주므로 내 소켓 상태와 무관하게 전달된다.
    try {
      await channel.httpSend('room_event', event as unknown as Record<string, unknown>)
      return { ok: true, reason: wsResult ? `rest_after_${wsResult}` : 'rest_fallback' }
    } catch (error) {
      return { ok: false, reason: wsResult ?? (error instanceof Error ? error.message : String(error)) }
    }
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

    const configCheck = checkSupabaseConfig()
    if (!configCheck.isValid) {
      setChannelStatus('channel_error')
      return
    }

    const nextClientId = getRoomClientId(roomCode)
    clientIdRef.current = nextClientId
    onlineAtRef.current = onlineAtRef.current || new Date().toISOString()
    setClientId(nextClientId)
    setChannelStatus('subscribing')

    const channel = supabase
      .channel(`runtime:${roomCode}`, {
        config: {
          broadcast: {
            ack: true,
            self: false,
          },
          presence: {
            key: nextClientId,
          },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>
        if (mountedRef.current) {
          setPresence(flattenPresenceState(state))
        }
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        const event = payload as RoomChannelEvent
        if (!event || event.roomCode !== roomCode || event.clientId === nextClientId) return

        emitRoomRuntimeEvent(event)
        onEventRef.current?.(event)

        if (event.type === 'game:finished') {
          void onResyncNeededRef.current?.('broadcast_hint')
        }
      })
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') {
          setChannelStatus('subscribed')
          void channel.track({
            clientId: nextClientId,
            role,
            playerId: playerIdRef.current,
            onlineAt: onlineAtRef.current,
            lastSeenAt: new Date().toISOString(),
          } satisfies RoomPresenceMeta)

          const reason: RoomResyncReason = wasSubscribedRef.current ? 'reconnected' : 'subscribed'
          wasSubscribedRef.current = true
          void onResyncNeededRef.current?.(reason)
          return
        }

        if (nextStatus === 'CHANNEL_ERROR') {
          setChannelStatus('channel_error')
        } else if (nextStatus === 'TIMED_OUT') {
          setChannelStatus('timed_out')
        } else if (nextStatus === 'CLOSED') {
          setChannelStatus('closed')
        }
      })

    channelRef.current = channel

    // 안전망: 구독이 안 된 채로 멈춰 있으면 소켓을 다시 연결하고, 채널이 통째로 버려졌으면
    // (소켓 teardown → state 'closed') 새로 만든다. realtime-js는 소켓이 닫힌 채 남으면 스스로
    // connect()를 다시 부르지 않아 join이 영원히 묻힌다(로비 → 게임 전환에서 실제로 일어났던 일).
    const watchdog = window.setInterval(() => {
      if (channelRef.current !== channel || statusRef.current === 'subscribed') return
      if (channel.state === 'closed') {
        setGeneration((value) => value + 1)
        return
      }
      ensureRealtimeSocketConnected()
    }, WATCHDOG_INTERVAL_MS)

    return () => {
      window.clearInterval(watchdog)
      channelRef.current = null
      clientIdRef.current = ''
      setPresence([])
      // removeChannel이 아니라 unsubscribe: 마지막 채널이라고 소켓까지 끊지 않는다(이유는 helper 주석).
      releaseRealtimeChannel(channel)
    }
  }, [enabled, generation, role, roomCode, setChannelStatus])

  useEffect(() => {
    const channel = channelRef.current
    if (!channel || status !== 'subscribed') return

    void channel.track({
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
      void channel.track({
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
