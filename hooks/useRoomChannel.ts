'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
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
    if (!channel || statusRef.current !== 'subscribed') {
      return { ok: false, reason: 'channel_not_subscribed' }
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

    const result = await channel.send({
      type: 'broadcast',
      event: 'room_event',
      payload: event,
    })

    return { ok: result === 'ok', reason: result === 'ok' ? undefined : String(result) }
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

        if (event.type === 'room:snapshot-hint' || event.type === 'game:finished') {
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

    return () => {
      channelRef.current = null
      clientIdRef.current = ''
      setPresence([])
      supabase.removeChannel(channel)
    }
  }, [enabled, role, roomCode, setChannelStatus])

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
    }, 15000)

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
