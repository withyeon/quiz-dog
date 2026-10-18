import { io, type Socket } from 'socket.io-client'
import { supabase } from '@/lib/supabase/client'
import { loadPlayerSecret } from '@/lib/realtime/playerSecret'
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
 * 자체 중계 서버(relay/socket-server.mjs, Socket.IO) 전송. NEXT_PUBLIC_ROOM_TRANSPORT=relay 일 때만 쓴다.
 *
 * 접속(handshake auth): { room, clientId, meta, token? } — token은 로그인한 교사의 Supabase 세션 토큰.
 *   ← 'joined' { c, presence }        방 입장 완료. c는 이 연결 번호
 *   → 'ev' event, { playerToken } (ack)  ← ack { ok } | { err: 'rate_limited' | 'bad_event' | 'unauthorized' }
 *   ← 'ev' event                      다른 클라이언트가 보낸 room_event (보낸 연결은 제외)
 *   → 'track' meta                    ← 'p' { k, m } presence 키 하나의 최신 목록(빈 배열이면 나감)
 *   ← 'pos' { at, items }             점프점프 좌표 묶음(200ms마다)
 * 이벤트는 교사 토큰의 사용자가 방 주인이거나, playerToken(이 탭에만 있는 학생 비밀 토큰)이 그 playerId의 것일 때만
 * 중계된다(서버가 Supabase로 확인, lib/realtime/playerSecret.ts).
 * WebSocket이 막힌 망에서는 Socket.IO가 HTTP long-polling으로 붙는다.
 * 소켓이 안 붙어 있으면 POST <주소>/v2/rooms/<방>/events 로 보낸다.
 */

const RELAY_URL = process.env.NEXT_PUBLIC_ROOM_RELAY_URL ?? ''

/** 입장 응답을 이만큼 못 받으면 timed_out 으로 보고 다시 붙는다 (realtime-js 기본 10초와 같게) */
const JOIN_TIMEOUT_MS = 10_000
/** ack를 이만큼 못 받으면 실패로 보고 HTTP 예비 경로로 보낸다 */
const ACK_TIMEOUT_MS = 10_000
/**
 * 서버가 어느 보내기 형식에 답하는지 아직 모를 때(연결 뒤 첫 이벤트) 쓰는 짧은 ack 대기.
 * 2026-10-16 이전 중계 서버는 ('ev', event, ack) 형식만 알아서, 새 형식 ('ev', event, { playerToken }, ack) 을 받으면
 * ack 를 영원히 주지 않았다. 그러면 모든 이벤트가 10초씩 기다렸다 예비 경로로 갔고, 학생 예비 경로는 옛 서버의
 * CORS 허용 목록에 X-Player-Token 이 없어 전부 막혔다(2026-10-18 25명 검수에서 발견). 서버·앱 배포 순서가 어긋나도
 * 수업이 멈추지 않도록, 새 형식에 답이 없으면 옛 형식으로 한 번 더 보내 보고 그 연결에서는 그 형식을 계속 쓴다.
 */
const PROBE_ACK_TIMEOUT_MS = 4_000

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

type AckReply = { ok?: boolean; err?: string }

/** 설정은 wss://… 로 받지만 Socket.IO와 HTTP 예비 경로는 https://… 기준이다 */
function toHttpBase(url: string): string {
  return url.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '')
}

/** 로그인한 교사면 Supabase 세션 토큰. 학생(비로그인)은 null */
async function getSessionToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

class RelayConnection implements RoomConnection {
  private readonly socket: Socket
  private closedByUser = false
  private joined = false
  private selfConn = -1
  private lastMeta: RoomPresenceMeta | null = null
  private presence = new Map<string, RoomPresenceMeta[]>()
  private joinTimer: number | null = null

  constructor(
    private readonly options: RoomTransportOptions,
    private readonly handlers: RoomTransportHandlers,
  ) {
    this.socket = io(toHttpBase(RELAY_URL), {
      path: '/socket.io',
      // WebSocket을 먼저 쓰고, 안 되면(학교 프록시·방화벽) 폴링으로 다시 시도한다
      transports: ['websocket', 'polling'],
      tryAllTransports: true,
      // 끊긴 뒤 1초부터 최대 10초까지, ±50% 흔들기: 서버 재시작 때 전원이 같은 순간 몰리지 않게
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 10_000,
      randomizationFactor: 0.5,
      timeout: JOIN_TIMEOUT_MS,
      // 다시 붙을 때마다 불린다: 마지막 presence와 최신 토큰으로 다시 입장한다
      auth: (callback) => {
        void getSessionToken().then((token) => callback({
          room: this.options.roomCode,
          clientId: this.options.clientId,
          meta: this.lastMeta,
          ...(token ? { token } : {}),
        }))
      },
    })

    this.socket.on('connect', () => this.startJoinTimer())
    this.socket.on('joined', (message: { c: number; presence: Record<string, RoomPresenceMeta[]> }) => {
      this.clearJoinTimer()
      this.joined = true
      this.selfConn = message.c
      this.presence = new Map(Object.entries(message.presence ?? {}))
      this.emitPresence()
      this.handlers.onStatus('subscribed')
    })
    this.socket.on('ev', (event: RoomChannelEvent) => this.handlers.onEvent(event))
    this.socket.on('p', (message: { k: string; m: RoomPresenceMeta[] }) => {
      if (message.m.length > 0) this.presence.set(message.k, message.m)
      else this.presence.delete(message.k)
      this.emitPresence()
    })
    this.socket.on('pos', (message: { at: number; items: PositionItem[] }) => this.handlePositions(message))
    this.socket.on('fatal', () => {
      // 방 코드가 잘못된 접속: 다시 붙어도 같으므로 멈춘다
      this.closedByUser = true
      this.handlers.onStatus('channel_error')
    })
    this.socket.on('connect_error', () => {
      if (!this.joined) this.handlers.onStatus('channel_error')
    })
    this.socket.on('disconnect', (reason) => {
      this.handleDisconnect()
      // 서버가 끊은 경우 Socket.IO는 스스로 다시 붙지 않는다
      if (reason === 'io server disconnect' && !this.closedByUser) {
        window.setTimeout(() => {
          if (!this.closedByUser && !this.socket.connected) this.socket.connect()
        }, 1_000 + Math.random() * 1_000)
      }
    })
  }

  private handlePositions(message: { at: number; items: PositionItem[] }) {
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
  }

  private startJoinTimer() {
    this.clearJoinTimer()
    this.joinTimer = window.setTimeout(() => {
      this.joinTimer = null
      if (this.joined || this.closedByUser) return
      this.handlers.onStatus('timed_out')
      this.socket.disconnect()
      this.socket.connect()
    }, JOIN_TIMEOUT_MS)
  }

  private clearJoinTimer() {
    if (this.joinTimer !== null) {
      window.clearTimeout(this.joinTimer)
      this.joinTimer = null
    }
  }

  private handleDisconnect() {
    const wasJoined = this.joined
    this.joined = false
    this.clearJoinTimer()
    if (this.presence.size > 0) {
      this.presence.clear()
      this.emitPresence()
    }
    if (this.closedByUser) return
    if (wasJoined) this.handlers.onStatus('closed')
  }

  private emitPresence() {
    this.handlers.onPresence(flattenPresenceState(Object.fromEntries(this.presence)))
  }

  /**
   * 서버가 답하는 보내기 형식. null 이면 아직 모른다(연결마다 첫 이벤트로 알아낸다).
   * 'auth' = ('ev', event, { playerToken }, ack) — 2026-10-16 이후 서버. 'legacy' = ('ev', event, ack) — 그 전 서버.
   */
  private ackForm: 'auth' | 'legacy' | null = null

  private emitWithAck(event: RoomChannelEvent, form: 'auth' | 'legacy', timeoutMs: number): Promise<string> {
    return new Promise((resolve) => {
      const done = (error: Error | null, reply?: AckReply) => {
        if (error) resolve('timed out')
        else resolve(reply?.err ?? 'ok')
      }
      if (form === 'auth') {
        this.socket.timeout(timeoutMs).emit('ev', event, { playerToken: loadPlayerSecret(event.playerId) }, done)
      } else {
        this.socket.timeout(timeoutMs).emit('ev', event, done)
      }
    })
  }

  private async sendOverSocket(event: RoomChannelEvent): Promise<string> {
    if (!this.joined || !this.socket.connected) return 'not_joined'
    if (this.ackForm) return this.emitWithAck(event, this.ackForm, ACK_TIMEOUT_MS)

    // 아직 모른다: 새 형식을 짧게 기다려 보고, 답이 없으면 옛 형식으로 한 번 더
    const viaAuth = await this.emitWithAck(event, 'auth', PROBE_ACK_TIMEOUT_MS)
    if (viaAuth !== 'timed out') {
      this.ackForm = 'auth'
      return viaAuth
    }
    if (!this.joined || !this.socket.connected) return 'not_joined'
    const viaLegacy = await this.emitWithAck(event, 'legacy', PROBE_ACK_TIMEOUT_MS)
    if (viaLegacy === 'ok') {
      this.ackForm = 'legacy'
      console.warn('[relay] 중계 서버가 옛 버전이라 옛 보내기 형식으로 보냅니다. relay/deploy-lightsail.sh 로 서버를 갱신하세요.')
      return viaLegacy
    }
    if (viaLegacy !== 'timed out') {
      // 옛 형식에 거절(unauthorized 등)로 답했다 = 새 서버다. 첫 전송이 그저 느렸던 것이니 새 형식을 계속 쓴다.
      this.ackForm = 'auth'
    }
    return 'timed out'
  }

  async send(event: RoomChannelEvent, canUseSocket: boolean): Promise<SendEventResult> {
    let socketResult: string | null = null
    if (canUseSocket) {
      socketResult = await this.sendOverSocket(event)
      if (socketResult === 'ok') return { ok: true }
      // 서버가 거절한 건(초당 한도·권한 없음) 예비 경로로 우회해도 같으므로 그대로 실패로 돌려준다
      if (socketResult === 'rate_limited' || socketResult === 'unauthorized' || socketResult === 'bad_event') {
        return { ok: false, reason: socketResult }
      }
    }

    try {
      const token = await getSessionToken()
      const playerToken = loadPlayerSecret(event.playerId)
      const post = (withPlayerToken: boolean) => fetch(
        `${toHttpBase(RELAY_URL)}/v2/rooms/${encodeURIComponent(this.options.roomCode)}/events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(withPlayerToken && playerToken ? { 'X-Player-Token': playerToken } : {}),
          },
          body: JSON.stringify(event),
        },
      )
      let response: Response
      try {
        response = await post(true)
      } catch (error) {
        // 네트워크 오류 또는 CORS 거절(fetch 는 둘을 구분하지 않고 TypeError 를 던진다).
        // 2026-10-16 이전 중계 서버는 X-Player-Token 헤더를 CORS 허용 목록에 넣지 않아 학생 예비 전송이 전부 막혔다.
        // 그 헤더를 빼고 한 번 더 보낸다(옛 서버는 playerId 만으로 확인한다). 진짜 네트워크 오류면 이것도 실패해 그대로 돌려준다.
        if (!playerToken) throw error
        response = await post(false)
      }
      if (!response.ok) throw new Error(response.status === 401 ? 'unauthorized' : `HTTP ${response.status}`)
      return { ok: true, reason: socketResult ? `rest_after_${socketResult}` : 'rest_fallback' }
    } catch (error) {
      return { ok: false, reason: socketResult ?? (error instanceof Error ? error.message : String(error)) }
    }
  }

  track(meta: RoomPresenceMeta) {
    this.lastMeta = meta
    if (this.joined && this.socket.connected) this.socket.emit('track', meta)
  }

  // 이 연결은 스스로 다시 붙으므로 버려지는 일이 없다
  isAbandoned() {
    return false
  }

  // 재연결을 포기했거나 멈춰 있으면 바로 다시 붙는다 (감시 타이머·네트워크 복구 때)
  ensureConnected() {
    if (this.closedByUser || this.socket.connected || this.socket.active) return
    this.socket.connect()
  }

  close() {
    this.closedByUser = true
    this.clearJoinTimer()
    this.handleDisconnect()
    this.socket.removeAllListeners()
    this.socket.disconnect()
  }
}

export const relayRoomTransport: RoomTransport = {
  isConfigured: () => /^(wss?|https?):\/\//.test(RELAY_URL),
  connect: (options, handlers) => new RelayConnection(options, handlers),
}
