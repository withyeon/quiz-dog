import {
  flattenPresenceState,
  type RoomChannelEvent,
  type RoomPresenceMeta,
} from '@/lib/realtime/roomChannel'
import type {
  RoomConnection,
  RoomTransport,
  RoomTransportHandlers,
  RoomTransportOptions,
  SendEventResult,
} from '@/lib/realtime/transport/types'

/**
 * 자체 중계 서버(relay/server.mjs) 전송. NEXT_PUBLIC_ROOM_TRANSPORT=relay 일 때만 쓴다.
 *
 * 프로토콜(JSON 텍스트 프레임, 자세한 건 relay/README.md):
 *   → {t:'join', room, clientId, meta}      ← {t:'joined', c, presence}
 *   → {t:'ev', r, e}                        ← {t:'ack', r, err?}  (다른 클라이언트에겐 {t:'ev', e})
 *   → {t:'track', meta}                     ← {t:'p', k, m}       (presence 키 하나의 최신 목록, 빈 배열이면 나감)
 *   → {t:'ping'}                            ← {t:'pos', at, items} (점프점프 좌표 묶음, 200ms마다)
 * 소켓이 안 붙어 있으면 POST <http 주소>/rooms/<방>/events 로 보낸다(Supabase REST 브로드캐스트 예비 경로와 같은 역할).
 */

const RELAY_URL = process.env.NEXT_PUBLIC_ROOM_RELAY_URL ?? ''

/** 입장 응답을 이만큼 못 받으면 timed_out 으로 보고 다시 붙는다 (realtime-js 기본 10초와 같게) */
const JOIN_TIMEOUT_MS = 10_000
/** ack를 이만큼 못 받으면 실패로 보고 HTTP 예비 경로로 보낸다 */
const ACK_TIMEOUT_MS = 10_000
/** 프록시·공유기가 조용한 연결을 끊지 않게 보내는 앱 수준 핑 */
const APP_PING_MS = 25_000
/** 끊긴 뒤 다시 붙는 간격 (realtime-js 기본 재연결 간격과 비슷하게) */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000]

type PositionItem = [
  conn: number,
  playerId: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  facingRight: 0 | 1,
  isOnGround: 0 | 1,
  height: number | null,
  energy: number | null,
]

type ServerMessage =
  | { t: 'joined'; c: number; presence: Record<string, RoomPresenceMeta[]> }
  | { t: 'ev'; e: RoomChannelEvent }
  | { t: 'ack'; r: number; err?: string }
  | { t: 'p'; k: string; m: RoomPresenceMeta[] }
  | { t: 'pos'; at: number; items: PositionItem[] }
  | { t: 'error'; message: string }

function toHttpBase(wsUrl: string): string {
  return wsUrl.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '')
}

class RelayConnection implements RoomConnection {
  private ws: WebSocket | null = null
  private closedByUser = false
  private joined = false
  private attempt = 0
  private selfConn = -1
  private nextRef = 1
  private lastMeta: RoomPresenceMeta | null = null
  private presence = new Map<string, RoomPresenceMeta[]>()
  private pending = new Map<number, { resolve: (result: string) => void; timer: number }>()
  private reconnectTimer: number | null = null
  private joinTimer: number | null = null
  private pingTimer: number | null = null

  constructor(
    private readonly options: RoomTransportOptions,
    private readonly handlers: RoomTransportHandlers,
  ) {
    this.open()
  }

  private open() {
    if (this.closedByUser) return
    this.clearTimer('reconnect')

    let ws: WebSocket
    try {
      ws = new WebSocket(RELAY_URL)
    } catch {
      this.handlers.onStatus('channel_error')
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      if (this.ws !== ws) return
      ws.send(JSON.stringify({
        t: 'join',
        room: this.options.roomCode,
        clientId: this.options.clientId,
        meta: this.lastMeta,
      }))
    }
    ws.onmessage = (message) => {
      if (this.ws !== ws || typeof message.data !== 'string') return
      let parsed: ServerMessage
      try {
        parsed = JSON.parse(message.data) as ServerMessage
      } catch {
        return
      }
      this.handleMessage(parsed)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.handleDisconnect()
    }

    this.joinTimer = window.setTimeout(() => {
      this.joinTimer = null
      if (this.ws !== ws || this.joined) return
      this.handlers.onStatus('timed_out')
      this.ws = null
      ws.close()
      this.handleDisconnect()
    }, JOIN_TIMEOUT_MS)
  }

  private handleMessage(message: ServerMessage) {
    switch (message.t) {
      case 'joined': {
        this.clearTimer('join')
        this.joined = true
        this.attempt = 0
        this.selfConn = message.c
        this.presence = new Map(Object.entries(message.presence ?? {}))
        this.emitPresence()
        this.startPing()
        this.handlers.onStatus('subscribed')
        return
      }
      case 'ev':
        this.handlers.onEvent(message.e)
        return
      case 'ack': {
        const pending = this.pending.get(message.r)
        if (!pending) return
        this.pending.delete(message.r)
        window.clearTimeout(pending.timer)
        pending.resolve(message.err ?? 'ok')
        return
      }
      case 'p':
        if (message.m.length > 0) this.presence.set(message.k, message.m)
        else this.presence.delete(message.k)
        this.emitPresence()
        return
      case 'pos': {
        const sentAt = new Date(message.at).toISOString()
        for (const item of message.items) {
          if (item[0] === this.selfConn) continue
          this.handlers.onEvent({
            type: 'dontlookdown:pos',
            roomCode: this.options.roomCode,
            clientId: '',
            playerId: item[1],
            sentAt,
            seq: 0,
            payload: {
              x: item[2],
              y: item[3],
              vx: item[4],
              vy: item[5],
              facingRight: item[6] === 1,
              isOnGround: item[7] === 1,
              ...(item[8] !== null ? { height: item[8] } : {}),
              ...(item[9] !== null ? { energy: item[9] } : {}),
            },
          })
        }
        return
      }
      default:
        return
    }
  }

  private handleDisconnect() {
    const wasJoined = this.joined
    this.joined = false
    this.clearTimer('join')
    this.clearTimer('ping')
    this.pending.forEach(({ resolve, timer }) => {
      window.clearTimeout(timer)
      resolve('closed')
    })
    this.pending.clear()
    if (this.presence.size > 0) {
      this.presence.clear()
      this.emitPresence()
    }
    if (this.closedByUser) return
    if (wasJoined) this.handlers.onStatus('closed')
    this.scheduleReconnect()
  }

  private scheduleReconnect() {
    if (this.closedByUser || this.reconnectTimer !== null) return
    // ±50% 흔들기: 서버 재시작 때 전원이 같은 순간 다시 붙으면 TLS 핸드셰이크가 몰려 일부가 끊긴다
    // (M4에서 초당 1,600개 동시 접속 시 18%가 ECONNRESET, relay/MEASUREMENTS.md)
    const base = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)]
    const delay = Math.round(base * (0.5 + Math.random()))
    this.attempt += 1
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.open()
    }, delay)
  }

  private startPing() {
    this.clearTimer('ping')
    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('{"t":"ping"}')
    }, APP_PING_MS)
  }

  private clearTimer(kind: 'reconnect' | 'join' | 'ping') {
    if (kind === 'reconnect' && this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    } else if (kind === 'join' && this.joinTimer !== null) {
      window.clearTimeout(this.joinTimer)
      this.joinTimer = null
    } else if (kind === 'ping' && this.pingTimer !== null) {
      window.clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private emitPresence() {
    this.handlers.onPresence(flattenPresenceState(Object.fromEntries(this.presence)))
  }

  private sendOverSocket(event: RoomChannelEvent): Promise<string> {
    const ws = this.ws
    if (!ws || !this.joined || ws.readyState !== WebSocket.OPEN) return Promise.resolve('not_joined')
    const ref = this.nextRef++
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(ref)
        resolve('timed out')
      }, ACK_TIMEOUT_MS)
      this.pending.set(ref, { resolve, timer })
      ws.send(JSON.stringify({ t: 'ev', r: ref, e: event }))
    })
  }

  async send(event: RoomChannelEvent, canUseSocket: boolean): Promise<SendEventResult> {
    let wsResult: string | null = null
    if (canUseSocket) {
      wsResult = await this.sendOverSocket(event)
      if (wsResult === 'ok') return { ok: true }
      // 서버가 초당 한도를 넘었다고 거절한 건 예비 경로로 우회하지 않는다
      if (wsResult === 'rate_limited') return { ok: false, reason: wsResult }
    }

    try {
      const response = await fetch(
        `${toHttpBase(RELAY_URL)}/rooms/${encodeURIComponent(this.options.roomCode)}/events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        },
      )
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { ok: true, reason: wsResult ? `rest_after_${wsResult}` : 'rest_fallback' }
    } catch (error) {
      return { ok: false, reason: wsResult ?? (error instanceof Error ? error.message : String(error)) }
    }
  }

  track(meta: RoomPresenceMeta) {
    this.lastMeta = meta
    if (this.joined && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ t: 'track', meta }))
    }
  }

  // 이 연결은 스스로 다시 붙으므로 버려지는 일이 없다
  isAbandoned() {
    return false
  }

  // 재연결 대기 중이면 기다리지 않고 바로 다시 붙는다 (감시 타이머·네트워크 복구 때)
  ensureConnected() {
    if (this.closedByUser) return
    const state = this.ws?.readyState
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return
    this.open()
  }

  close() {
    this.closedByUser = true
    this.clearTimer('reconnect')
    const ws = this.ws
    this.ws = null
    this.handleDisconnect()
    ws?.close(1000)
  }
}

export const relayRoomTransport: RoomTransport = {
  isConfigured: () => /^wss?:\/\//.test(RELAY_URL),
  connect: (options, handlers) => new RelayConnection(options, handlers),
}
