import { supabase, checkSupabaseConfig } from '@/lib/supabase/client'
import { ensureRealtimeSocketConnected, releaseRealtimeChannel } from '@/lib/supabase/realtimeLifecycle'
import { flattenPresenceState, type RoomChannelEvent } from '@/lib/realtime/roomChannel'
import type { RoomConnection, RoomTransport } from '@/lib/realtime/transport/types'

/** 기본 전송: Supabase Realtime 채널(runtime:<방 코드>)의 broadcast + presence */
export const supabaseRoomTransport: RoomTransport = {
  isConfigured: () => checkSupabaseConfig().isValid,

  connect({ roomCode, clientId }, handlers): RoomConnection {
    const channel = supabase
      .channel(`runtime:${roomCode}`, {
        config: {
          broadcast: {
            ack: true,
            self: false,
          },
          presence: {
            key: clientId,
          },
        },
      })
      .on('presence', { event: 'sync' }, () => {
        handlers.onPresence(flattenPresenceState(channel.presenceState() as Record<string, unknown[]>))
      })
      .on('broadcast', { event: 'room_event' }, ({ payload }) => {
        handlers.onEvent(payload as RoomChannelEvent)
      })
      .subscribe((nextStatus) => {
        if (nextStatus === 'SUBSCRIBED') handlers.onStatus('subscribed')
        else if (nextStatus === 'CHANNEL_ERROR') handlers.onStatus('channel_error')
        else if (nextStatus === 'TIMED_OUT') handlers.onStatus('timed_out')
        else if (nextStatus === 'CLOSED') handlers.onStatus('closed')
      })

    return {
      async send(event, canUseSocket) {
        // 1) 채널이 살아 있으면 웹소켓으로 보낸다(ack 대기).
        //    예전에는 채널이 '구독됨'이 아니면 여기서 조용히 포기했다. 교실 와이파이가 흔들려
        //    소켓이 재연결 중(1~10초)일 때 뽑은 공격 아이템이 그대로 증발하던 원인.
        let wsResult: string | null = null
        if (canUseSocket) {
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
      },
      track(meta) {
        void channel.track(meta)
      },
      // realtime-js는 소켓 teardown 때 채널을 'closed'로 버린다. 그러면 훅이 새로 만든다.
      isAbandoned: () => channel.state === 'closed',
      // realtime-js는 소켓이 닫힌 채 남으면 스스로 connect()를 다시 부르지 않아 join이 영원히 묻힌다
      // (로비 → 게임 전환에서 실제로 일어났던 일). 감시 타이머가 대신 깨운다.
      ensureConnected: () => {
        ensureRealtimeSocketConnected()
      },
      // removeChannel이 아니라 unsubscribe: 마지막 채널이라고 소켓까지 끊지 않는다(이유는 helper 주석).
      close: () => {
        releaseRealtimeChannel(channel)
      },
    }
  },
}
