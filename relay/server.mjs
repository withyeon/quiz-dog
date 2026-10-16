// 퀴즈독 방 실시간 중계 서버 (프로토타입).
// Supabase Realtime의 runtime:<방> 채널(broadcast + presence)을 대신한다. DB는 건드리지 않는다.
// 프로토콜과 운영 메모는 relay/README.md, 클라이언트는 lib/realtime/transport/relayTransport.ts.
//
//   node relay/server.mjs                         (기본 포트 8787)
//   PORT=8787 ALLOWED_ORIGINS=https://quizdog.kr RELAY_LOG_METRICS=1 node relay/server.mjs
//   TLS_CERT=fullchain.pem TLS_KEY=privkey.pem node relay/server.mjs   (프록시 없이 wss:// 로 직접 받을 때)

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT || 8787)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
const LOG_METRICS = process.env.RELAY_LOG_METRICS === '1'

/** 점프점프 좌표를 모아 보내는 주기 */
const POS_FLUSH_MS = 200
/** 바뀌지 않은 좌표도 이 간격마다 한 번씩 다시 넣는다 (받는 쪽은 3초 동안 안 오면 근사 위치로 바꾼다) */
const POS_KEYFRAME_MS = 1000
/** 이보다 오래 소식 없는 좌표는 묶음에서 뺀다 */
const POS_FORGET_MS = 10_000
/** 연결 하나가 초당 보낼 수 있는 메시지 (평소 학생 한 명은 초당 1~4개) */
const RATE_PER_SEC = 30
const RATE_BURST = 60
/** 이만큼 쌓인 느린 클라이언트에게는 이번 메시지를 건너뛴다 */
const MAX_BUFFERED_BYTES = 1_000_000
const MAX_PAYLOAD_BYTES = 64 * 1024
/** 브라우저가 자동으로 답하는 ws ping. 두 번 연속 답이 없으면 끊는다 */
const WS_PING_MS = 30_000

const ROOM_CODE_RE = /^[0-9A-Za-z_-]{4,32}$/
const POS_EVENT = 'dontlookdown:pos'

/** @type {Map<string, Room>} */
const rooms = new Map()
/** 살아 있는지 확인용으로 모든 연결을 들고 있는다 (방에 아직 안 들어간 연결 포함) */
const conns = new Set()
let nextConnId = 1

const stats = { msgsIn: 0, msgsOut: 0, bytesOut: 0, dropped: 0, rateLimited: 0, httpEvents: 0 }

/**
 * @typedef {{
 *   code: string,
 *   conns: Set<Conn>,
 *   presence: Map<string, Map<number, object>>,
 *   pos: Map<string, { item: unknown[], updatedAt: number, dirty: boolean }>,
 *   lastKeyframe: number,
 * }} Room
 * @typedef {{
 *   id: number, ws: import('ws').WebSocket, room: Room | null, clientId: string,
 *   tokens: number, tokensAt: number, alive: boolean,
 * }} Conn
 */

function getRoom(code) {
  let room = rooms.get(code)
  if (!room) {
    room = { code, conns: new Set(), presence: new Map(), pos: new Map(), lastKeyframe: 0 }
    rooms.set(code, room)
  }
  return room
}

function sendRaw(conn, data) {
  if (conn.ws.readyState !== 1) return
  if (conn.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    stats.dropped += 1
    return
  }
  conn.ws.send(data)
  stats.msgsOut += 1
  stats.bytesOut += data.length
}

function fanout(room, data, except) {
  for (const conn of room.conns) {
    if (conn !== except) sendRaw(conn, data)
  }
}

function presenceList(room, key) {
  const metas = room.presence.get(key)
  return metas ? [...metas.values()] : []
}

function presenceSnapshot(room) {
  const out = {}
  for (const key of room.presence.keys()) out[key] = presenceList(room, key)
  return out
}

function setPresence(room, conn, meta) {
  if (!meta || typeof meta !== 'object') return
  const clean = { ...meta, clientId: conn.clientId }
  let metas = room.presence.get(conn.clientId)
  const previous = metas?.get(conn.id)
  if (!metas) {
    metas = new Map()
    room.presence.set(conn.clientId, metas)
  }
  metas.set(conn.id, clean)
  // 45초 하트비트처럼 lastSeenAt만 바뀐 track은 저장만 하고 방에 다시 뿌리지 않는다 (쓰는 화면이 없다)
  if (previous && samePresenceExceptSeen(previous, clean)) return
  // 나 자신도 받는다: Supabase presence처럼 내 화면의 접속 목록에도 내가 들어 있어야 한다
  fanout(room, JSON.stringify({ t: 'p', k: conn.clientId, m: presenceList(room, conn.clientId) }))
}

function samePresenceExceptSeen(a, b) {
  return a.role === b.role && a.playerId === b.playerId && a.onlineAt === b.onlineAt
}

function leaveRoom(conn) {
  const room = conn.room
  if (!room) return
  conn.room = null
  room.conns.delete(conn)
  const metas = room.presence.get(conn.clientId)
  if (metas?.delete(conn.id)) {
    if (metas.size === 0) room.presence.delete(conn.clientId)
    fanout(room, JSON.stringify({ t: 'p', k: conn.clientId, m: presenceList(room, conn.clientId) }))
  }
  for (const [playerId, entry] of room.pos) {
    if (entry.item[0] === conn.id) room.pos.delete(playerId)
  }
  if (room.conns.size === 0) rooms.delete(room.code)
}

function takeToken(conn) {
  const now = Date.now()
  conn.tokens = Math.min(RATE_BURST, conn.tokens + ((now - conn.tokensAt) / 1000) * RATE_PER_SEC)
  conn.tokensAt = now
  if (conn.tokens < 1) return false
  conn.tokens -= 1
  return true
}

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

/** 점프점프 좌표는 바로 뿌리지 않고 방별 묶음에 넣는다 (최신 값만 남긴다) */
function storePosition(room, connId, event) {
  const p = event.payload
  if (!event.playerId || !p || typeof p.x !== 'number' || typeof p.y !== 'number') return
  room.pos.set(String(event.playerId), {
    item: [
      connId, String(event.playerId),
      num(p.x), num(p.y), num(p.vx) ?? 0, num(p.vy) ?? 0,
      p.facingRight === false ? 0 : 1, p.isOnGround === true ? 1 : 0,
      num(p.height), num(p.energy),
    ],
    updatedAt: Date.now(),
    dirty: true,
  })
}

/** 방 이벤트 하나 처리. sender가 없으면(HTTP 예비 경로) 방 전체에 보낸다 */
function relayEvent(room, event, sender) {
  if (event.type === POS_EVENT) {
    storePosition(room, sender ? sender.id : -1, event)
    return
  }
  fanout(room, JSON.stringify({ t: 'ev', e: event }), sender)
}

function isValidEvent(event, roomCode) {
  return event && typeof event === 'object' && typeof event.type === 'string' && event.roomCode === roomCode
}

function flushPositions() {
  const now = Date.now()
  for (const room of rooms.values()) {
    if (room.pos.size === 0) continue
    const keyframe = now - room.lastKeyframe >= POS_KEYFRAME_MS
    if (keyframe) room.lastKeyframe = now
    const items = []
    for (const [playerId, entry] of room.pos) {
      if (now - entry.updatedAt > POS_FORGET_MS) {
        room.pos.delete(playerId)
        continue
      }
      if (entry.dirty || keyframe) {
        items.push(entry.item)
        entry.dirty = false
      }
    }
    if (items.length > 0) fanout(room, JSON.stringify({ t: 'pos', at: now, items }))
  }
}

function originAllowed(origin) {
  return ALLOWED_ORIGINS.length === 0 || (origin && ALLOWED_ORIGINS.includes(origin))
}

function handleSocketMessage(conn, raw) {
  stats.msgsIn += 1
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  if (!msg || typeof msg !== 'object') return

  if (msg.t === 'ping') return

  if (msg.t === 'join') {
    if (conn.room) return
    const code = String(msg.room || '')
    const clientId = String(msg.clientId || '').slice(0, 64)
    if (!ROOM_CODE_RE.test(code) || !clientId) {
      conn.ws.send(JSON.stringify({ t: 'error', message: 'bad_join' }))
      conn.ws.close(4000, 'bad_join')
      return
    }
    const room = getRoom(code)
    conn.room = room
    conn.clientId = clientId
    room.conns.add(conn)
    conn.ws.send(JSON.stringify({ t: 'joined', c: conn.id, presence: presenceSnapshot(room) }))
    if (msg.meta) setPresence(room, conn, msg.meta)
    return
  }

  const room = conn.room
  if (!room) return

  if (msg.t === 'track') {
    setPresence(room, conn, msg.meta)
    return
  }

  if (msg.t === 'ev') {
    const ref = Number(msg.r) || 0
    if (!takeToken(conn)) {
      stats.rateLimited += 1
      conn.ws.send(JSON.stringify({ t: 'ack', r: ref, err: 'rate_limited' }))
      return
    }
    if (!isValidEvent(msg.e, room.code)) {
      conn.ws.send(JSON.stringify({ t: 'ack', r: ref, err: 'bad_event' }))
      return
    }
    relayEvent(room, msg.e, conn)
    conn.ws.send(JSON.stringify({ t: 'ack', r: ref }))
  }
}

// ─── HTTP: 예비 전송 경로, 상태 확인 ─────────────────────────────────────────

let cpuPrev = process.cpuUsage()
let cpuPrevAt = process.hrtime.bigint()
let statsPrev = { ...stats }
let statsPrevAt = Date.now()
const loopDelay = monitorEventLoopDelay({ resolution: 10 })
loopDelay.enable()

function sampleMetrics() {
  const nowNs = process.hrtime.bigint()
  const cpu = process.cpuUsage(cpuPrev)
  const elapsedUs = Number(nowNs - cpuPrevAt) / 1000
  cpuPrev = process.cpuUsage()
  cpuPrevAt = nowNs
  const now = Date.now()
  const secs = Math.max(0.001, (now - statsPrevAt) / 1000)
  const rate = (key) => Math.round((stats[key] - statsPrev[key]) / secs)
  let conns = 0
  for (const room of rooms.values()) conns += room.conns.size
  const mem = process.memoryUsage()
  const out = {
    rooms: rooms.size,
    conns,
    inPerSec: rate('msgsIn'),
    outPerSec: rate('msgsOut'),
    bytesOutPerSec: rate('bytesOut'),
    droppedPerSec: rate('dropped'),
    rateLimitedPerSec: rate('rateLimited'),
    cpuPct: Math.round(((cpu.user + cpu.system) / elapsedUs) * 1000) / 10,
    rssMB: Math.round(mem.rss / 1e5) / 10,
    heapMB: Math.round(mem.heapUsed / 1e5) / 10,
    loopDelayP99Ms: Math.round(loopDelay.percentile(99) / 1e4) / 100,
  }
  statsPrev = { ...stats }
  statsPrevAt = now
  loopDelay.reset()
  return out
}

function corsHeaders(origin) {
  if (!originAllowed(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function handleHttp(req, res) {
  const origin = req.headers.origin
  const url = new URL(req.url || '/', 'http://relay')

  if (req.method === 'GET' && url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
    return
  }
  // 측정용. 운영에서는 프록시에서 막거나 토큰을 붙인다.
  if (req.method === 'GET' && url.pathname === '/metrics') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(sampleMetrics()))
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin)).end()
    return
  }

  const match = url.pathname.match(/^\/rooms\/([^/]+)\/events$/)
  if (req.method === 'POST' && match) {
    if (!originAllowed(origin)) {
      res.writeHead(403).end()
      return
    }
    const code = decodeURIComponent(match[1])
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > MAX_PAYLOAD_BYTES) req.destroy()
    })
    req.on('end', () => {
      let event
      try {
        event = JSON.parse(body)
      } catch {
        res.writeHead(400, corsHeaders(origin)).end()
        return
      }
      if (!ROOM_CODE_RE.test(code) || !isValidEvent(event, code)) {
        res.writeHead(400, corsHeaders(origin)).end()
        return
      }
      stats.httpEvents += 1
      const room = rooms.get(code)
      if (room) relayEvent(room, event, null)
      res.writeHead(202, corsHeaders(origin)).end()
    })
    return
  }

  res.writeHead(404).end()
}

const server = process.env.TLS_CERT && process.env.TLS_KEY
  ? https.createServer({ cert: fs.readFileSync(process.env.TLS_CERT), key: fs.readFileSync(process.env.TLS_KEY) }, handleHttp)
  : http.createServer(handleHttp)

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES, perMessageDeflate: false })

server.on('upgrade', (req, socket, head) => {
  if (!originAllowed(req.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

wss.on('connection', (ws) => {
  /** @type {Conn} */
  const conn = { id: nextConnId++, ws, room: null, clientId: '', tokens: RATE_BURST, tokensAt: Date.now(), alive: true }
  ws.on('message', (data, isBinary) => {
    conn.alive = true
    if (!isBinary) handleSocketMessage(conn, data.toString())
  })
  ws.on('pong', () => {
    conn.alive = true
  })
  ws.on('close', () => leaveRoom(conn))
  ws.on('error', () => leaveRoom(conn))
  conns.add(conn)
  ws.once('close', () => conns.delete(conn))
})

setInterval(() => {
  for (const conn of conns) {
    if (!conn.alive) {
      conn.ws.terminate()
      continue
    }
    conn.alive = false
    conn.ws.ping()
  }
}, WS_PING_MS)

setInterval(flushPositions, POS_FLUSH_MS)

if (LOG_METRICS) {
  setInterval(() => console.log(JSON.stringify({ at: new Date().toISOString(), ...sampleMetrics() })), 10_000)
}

server.listen(PORT, () => {
  console.log(`quizdog relay listening on ${server instanceof https.Server ? 'wss' : 'ws'}://:${PORT}${ALLOWED_ORIGINS.length ? ` (origins: ${ALLOWED_ORIGINS.join(', ')})` : ''}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const conn of conns) conn.ws.close(1012, 'restart')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
