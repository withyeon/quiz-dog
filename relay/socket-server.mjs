// 퀴즈독 방 실시간 중계 서버 (Socket.IO).
// Supabase Realtime의 runtime:<방> 채널(broadcast + presence)을 대신한다. DB는 읽기만 한다(접속 인증).
// 예전 ws 서버(server.mjs)와 같은 일을 하되, WebSocket이 막힌 망에서는 Socket.IO가 HTTP long-polling으로 대신 붙는다.
// 클라이언트는 lib/realtime/transport/relayTransport.ts, 운영 메모는 relay/README.md.
//
//   PORT=8788 ALLOWED_ORIGINS=https://quizdog.kr SUPABASE_URL=… SUPABASE_ANON_KEY=… node relay/socket-server.mjs
//
// 인증: 방에 들어와 받기만 하는 건 누구나(Origin 검사만) 된다(로비 대기, 프로젝터 화면).
// 이벤트를 보내려면 둘 중 하나여야 한다(sql/20261016_relay_auth.sql 적용 기준).
//   - 교사: 접속 때 보낸 Supabase 세션 토큰의 사용자가 rooms.owner_id 와 같다. owner_id가 없는 예전 방은 로그인 사용자면 된다.
//   - 학생: 이벤트에 붙은 학생 비밀 토큰의 SHA-256이 그 playerId의 players.secret_hash 와 같고, 강퇴되지 않았다.
//     secret_hash가 없는 예전 학생은 RELAY_LEGACY_PLAYERS_UNTIL까지 playerId만으로 통과시킨다(호환 모드).
//     한 연결은 처음 확인된 playerId로 묶이고, 다른 playerId를 단 이벤트는 거절한다.
// SQL 적용 전(컬럼 없음)이면 교사는 로그인 사용자, 학생은 그 방 playerId로 확인한다(이전 규칙).
// Supabase가 응답하지 않으면(네트워크·5xx) 수업을 멈추지 않도록 통과시키고, "아님"이 확실할 때만 거절한다.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import { Server } from 'socket.io'

const PORT = Number(process.env.PORT || 8788)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const AUTH_ENABLED = process.env.RELAY_AUTH !== 'off' && Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
const LOG_METRICS = process.env.RELAY_LOG_METRICS === '1'
/**
 * /v2/status(관리자 화면의 서버 상태)는 Supabase is_admin() 이 true 인 계정만 본다(관리자 목록은 admin_users 표).
 * 아래 이메일 목록은 is_admin() 이 아직 없을 때(sql/20261029_admin_users.sql 적용 전)만 쓴다.
 */
const STATUS_ADMIN_EMAILS = new Set(
  ['withyeonedu@gmail.com', ...(process.env.RELAY_ADMIN_EMAILS || '').split(',')]
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)
const STARTED_AT = new Date().toISOString()

/** 점프점프 좌표를 모아 보내는 주기 */
const POS_FLUSH_MS = 200
/** 바뀌지 않은 좌표도 이 간격마다 한 번씩 다시 넣는다 (받는 쪽은 3초 동안 안 오면 근사 위치로 바꾼다) */
const POS_KEYFRAME_MS = 1000
/** 이보다 오래 소식 없는 좌표는 묶음에서 뺀다 */
const POS_FORGET_MS = 10_000
/** 연결 하나가 초당 보낼 수 있는 메시지 (평소 학생 한 명은 초당 1~4개) */
const RATE_PER_SEC = 30
const RATE_BURST = 60
const MAX_PAYLOAD_BYTES = 64 * 1024
/** 인증 결과 캐시 */
const PLAYER_OK_TTL_MS = 10 * 60_000
const PLAYER_DENY_TTL_MS = 15_000
const TOKEN_TTL_MS = 5 * 60_000
const OWNER_TTL_MS = 60_000
const AUTH_TIMEOUT_MS = 4000
/** secret_hash 없는 예전 학생(이 변경 전에 입장한 탭)을 playerId만으로 받아 주는 마지막 시각 */
const LEGACY_PLAYERS_UNTIL_MS = Date.parse(process.env.RELAY_LEGACY_PLAYERS_UNTIL || '2026-11-16T00:00:00+09:00')

const ROOM_CODE_RE = /^[0-9A-Za-z_-]{4,32}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const POS_EVENT = 'dontlookdown:pos'

/**
 * @typedef {{
 *   code: string,
 *   presence: Map<string, Map<number, object>>,
 *   pos: Map<string, { item: unknown[], updatedAt: number, dirty: boolean }>,
 *   lastKeyframe: number,
 *   size: number,
 *   createdAt: number,
 *   peak: number,
 * }} Room
 * @typedef {{
 *   id: number, room: Room, clientId: string, tokens: number, tokensAt: number,
 *   teacher: Promise<boolean> | null, playerId: string | null,
 * }} Conn
 */

/** @type {Map<string, Room>} */
const rooms = new Map()
let nextConnId = 1
const stats = { msgsIn: 0, msgsOut: 0, rateLimited: 0, unauthorized: 0, httpEvents: 0, authChecks: 0, authFailures: 0, connects: 0, disconnects: 0 }

// ─── 인증 ─────────────────────────────────────────────────────────────────────

/** Supabase가 응답하지 않아 모름 */
const UNKNOWN = Symbol('unknown')
/** @type {Map<string, { row: { kicked: boolean, hash: string | null } | null, until: number }>} 방|playerId → 행(없으면 null) */
const playerCache = new Map()
/** @type {Map<string, { userId: string | null, until: number }>} 세션 토큰 → 사용자 id(무효면 null) */
const tokenCache = new Map()
/** @type {Map<string, { owner: string | null, until: number }>} 방 → owner_id */
const ownerCache = new Map()
/** SQL 적용 전이라 컬럼이 없으면 true가 되고, 그 뒤로는 그 컬럼 없이 읽는다 */
const missingColumn = { secret_hash: false, owner_id: false }

async function supabaseGet(path, headers = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  try {
    stats.authChecks += 1
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, ...headers },
      signal: controller.signal,
    })
    if (res.status >= 500) stats.authFailures += 1
    return res
  } catch (error) {
    // 시간 초과·네트워크 오류: 서버 상태 화면에 'Supabase 응답 실패'로 남긴다
    stats.authFailures += 1
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/** 컬럼이 없어서 난 400인가. 맞으면 표시해 두고 true */
async function markIfMissingColumn(res, column) {
  if (res.status !== 400 || missingColumn[column]) return false
  const text = await res.text().catch(() => '')
  if (!text.includes(column)) return false
  missingColumn[column] = true
  console.warn(`[relay] ${column} 컬럼이 없다: sql/20261016_relay_auth.sql 적용 전 규칙으로 확인한다`)
  return true
}

/** 그 방의 학생 행. 없으면 null, Supabase가 응답하지 않으면 UNKNOWN */
async function getRoomPlayer(roomCode, playerId) {
  const key = `${roomCode}|${playerId}`
  const cached = playerCache.get(key)
  if (cached && cached.until > Date.now()) return cached.row
  try {
    const columns = missingColumn.secret_hash ? 'id,is_kicked' : 'id,is_kicked,secret_hash'
    const res = await supabaseGet(
      `/rest/v1/players?select=${columns}&id=eq.${playerId}&room_code=eq.${encodeURIComponent(roomCode)}`,
    )
    if (await markIfMissingColumn(res, 'secret_hash')) return getRoomPlayer(roomCode, playerId)
    if (!res.ok) return UNKNOWN
    const rows = await res.json()
    const found = Array.isArray(rows) && rows.length === 1 ? rows[0] : null
    const row = found ? { kicked: found.is_kicked === true, hash: typeof found.secret_hash === 'string' ? found.secret_hash : null } : null
    playerCache.set(key, { row, until: Date.now() + (row && !row.kicked ? PLAYER_OK_TTL_MS : PLAYER_DENY_TTL_MS) })
    return row
  } catch {
    return UNKNOWN
  }
}

/** 세션 토큰의 사용자 id. 무효면 null, Supabase가 응답하지 않으면 UNKNOWN */
async function getTokenUser(token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null
  const cached = tokenCache.get(token)
  if (cached && cached.until > Date.now()) return cached.userId
  try {
    const res = await supabaseGet('/auth/v1/user', { Authorization: `Bearer ${token}` })
    if (res.status >= 500) return UNKNOWN
    const userId = res.ok ? ((await res.json())?.id ?? null) : null
    tokenCache.set(token, { userId, until: Date.now() + (userId ? TOKEN_TTL_MS : PLAYER_DENY_TTL_MS) })
    return userId
  } catch {
    return UNKNOWN
  }
}

/** 방 주인(owner_id). 주인 없는 예전 방·컬럼 없음이면 null, Supabase가 응답하지 않으면 UNKNOWN */
async function getRoomOwner(roomCode) {
  if (missingColumn.owner_id) return null
  const cached = ownerCache.get(roomCode)
  if (cached && cached.until > Date.now()) return cached.owner
  try {
    const res = await supabaseGet(`/rest/v1/rooms?select=owner_id&room_code=eq.${encodeURIComponent(roomCode)}`)
    if (await markIfMissingColumn(res, 'owner_id')) return null
    if (!res.ok) return UNKNOWN
    const rows = await res.json()
    const owner = Array.isArray(rows) && rows[0] && typeof rows[0].owner_id === 'string' ? rows[0].owner_id : null
    ownerCache.set(roomCode, { owner, until: Date.now() + OWNER_TTL_MS })
    return owner
  } catch {
    return UNKNOWN
  }
}

setInterval(() => {
  const now = Date.now()
  for (const cache of [playerCache, tokenCache, ownerCache]) {
    for (const [key, value] of cache) if (value.until <= now) cache.delete(key)
  }
}, 60_000).unref()

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex')
}

/** 이 세션 토큰으로 이 방에 교사로서 보낼 수 있는가(방 주인, 또는 주인 없는 예전 방의 로그인 사용자) */
async function isRoomTeacher(roomCode, sessionToken) {
  if (!sessionToken) return false
  const userId = await getTokenUser(sessionToken)
  if (userId === UNKNOWN) return true
  if (!userId) return false
  const owner = await getRoomOwner(roomCode)
  if (owner === UNKNOWN || owner === null) return true
  return owner === userId
}

/** 이 playerId로 보낼 수 있는가(그 방 학생, 강퇴 아님, 비밀 토큰 일치 또는 예전 학생 호환) */
async function isPlayerSender(roomCode, playerId, playerToken) {
  if (!UUID_RE.test(playerId)) return false
  const row = await getRoomPlayer(roomCode, playerId)
  if (row === UNKNOWN) return true
  if (!row || row.kicked) return false
  if (row.hash) {
    return typeof playerToken === 'string' && playerToken.length > 0 && playerToken.length <= 256
      && sha256Hex(playerToken) === row.hash
  }
  // 해시 없는 학생: SQL 적용 전이면 이전 규칙 그대로, 적용 후엔 예전 탭 호환 기한까지만
  return missingColumn.secret_hash || Date.now() < LEGACY_PLAYERS_UNTIL_MS
}

/**
 * 이 이벤트를 보낼 자격이 있는가.
 * @param {{ teacher: Promise<boolean> | null, playerId: string | null } | null} conn HTTP 예비 경로는 null
 * @param {{ sessionToken?: string | null, playerToken?: unknown }} auth HTTP 예비 경로의 세션 토큰, 이벤트에 붙은 학생 토큰
 */
async function canSend(roomCode, event, conn, auth) {
  if (!AUTH_ENABLED) return true
  const teacher = conn ? conn.teacher : (auth.sessionToken ? isRoomTeacher(roomCode, auth.sessionToken) : null)
  if (teacher && await teacher) return true
  const playerId = typeof event.playerId === 'string' ? event.playerId : ''
  if (!playerId) return false
  // 이 연결은 이미 그 학생으로 확인됐다(토큰은 처음 한 번만 본다)
  if (conn?.playerId) return conn.playerId === playerId
  if (!await isPlayerSender(roomCode, playerId, auth.playerToken)) return false
  if (conn) conn.playerId = playerId
  return true
}

// ─── 방 상태 ─────────────────────────────────────────────────────────────────

function getRoom(code) {
  let room = rooms.get(code)
  if (!room) {
    room = { code, presence: new Map(), pos: new Map(), lastKeyframe: 0, size: 0, createdAt: Date.now(), peak: 0 }
    rooms.set(code, room)
  }
  return room
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

function samePresenceExceptSeen(a, b) {
  return a.role === b.role && a.playerId === b.playerId && a.onlineAt === b.onlineAt
}

function setPresence(io, conn, meta) {
  if (!meta || typeof meta !== 'object') return
  const room = conn.room
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
  io.to(room.code).emit('p', { k: conn.clientId, m: presenceList(room, conn.clientId) })
  stats.msgsOut += room.size
}

function leaveRoom(io, conn) {
  const room = conn.room
  room.size -= 1
  stats.disconnects += 1
  const metas = room.presence.get(conn.clientId)
  if (metas?.delete(conn.id)) {
    if (metas.size === 0) room.presence.delete(conn.clientId)
    io.to(room.code).emit('p', { k: conn.clientId, m: presenceList(room, conn.clientId) })
    stats.msgsOut += room.size
  }
  for (const [playerId, entry] of room.pos) {
    if (entry.item[0] === conn.id) room.pos.delete(playerId)
  }
  if (room.size <= 0) rooms.delete(room.code)
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

function isValidEvent(event, roomCode) {
  return event && typeof event === 'object' && typeof event.type === 'string' && event.roomCode === roomCode
}

/** 방 이벤트 하나 중계. socket이 있으면 보낸 연결은 빼고(Supabase self:false와 같음), 없으면(HTTP) 방 전체 */
function relayEvent(io, room, event, socket, connId) {
  if (event.type === POS_EVENT) {
    storePosition(room, connId ?? -1, event)
    return
  }
  if (socket) socket.to(room.code).emit('ev', event)
  else io.to(room.code).emit('ev', event)
  stats.msgsOut += Math.max(0, room.size - (socket ? 1 : 0))
}

function flushPositions(io) {
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
    if (items.length > 0) {
      io.to(room.code).emit('pos', { at: now, items })
      stats.msgsOut += room.size
    }
  }
}

function originAllowed(origin) {
  return ALLOWED_ORIGINS.length === 0 || (origin && ALLOWED_ORIGINS.includes(origin))
}

// ─── HTTP: 예비 전송 경로, 상태 확인 ─────────────────────────────────────────
// Socket.IO가 /socket.io/ 를 가져가고, 나머지는 /v2/ 아래에 둔다(예전 ws 서버와 같은 도메인에서 함께 돌리기 위해).

const LOOP_RESOLUTION_MS = 100
/** 히스토그램 값에는 측정 간격(100ms)이 들어 있다. 그만큼 빼야 실제로 늦어진 시간이다. */
const loopLagMs = (ns) => Math.max(0, Math.round((ns / 1e6 - LOOP_RESOLUTION_MS) * 100) / 100)

/** 측정 기준점. /v2/metrics(부하 측정 스크립트)와 상태 기록이 서로의 기준점을 건드리지 않게 따로 둔다. */
function makeSampler() {
  // 10ms 해상도는 연결 0개에서도 vCPU 1개의 0.6~0.7%를 계속 썼다(2026-10-18 Lightsail 실측 = 기준 성능의 3.5%). 100ms면 충분하다.
  const loopDelay = monitorEventLoopDelay({ resolution: LOOP_RESOLUTION_MS })
  loopDelay.enable()
  return { cpu: process.cpuUsage(), cpuAt: process.hrtime.bigint(), stats: { ...stats }, statsAt: Date.now(), loopDelay }
}

function countTransports() {
  let websocket = 0
  let polling = 0
  for (const socket of io.of('/').sockets.values()) {
    if (socket.conn.transport.name === 'websocket') websocket += 1
    else polling += 1
  }
  return { websocket, polling }
}

function sampleMetrics(sampler) {
  const nowNs = process.hrtime.bigint()
  const cpu = process.cpuUsage(sampler.cpu)
  const elapsedUs = Math.max(1, Number(nowNs - sampler.cpuAt) / 1000)
  const now = Date.now()
  const secs = Math.max(0.001, (now - sampler.statsAt) / 1000)
  const rate = (key) => Math.round(((stats[key] - sampler.stats[key]) / secs) * 10) / 10
  let conns = 0
  for (const room of rooms.values()) conns += room.size
  const mem = process.memoryUsage()
  const out = {
    rooms: rooms.size,
    conns,
    inPerSec: rate('msgsIn'),
    outPerSec: rate('msgsOut'),
    rateLimitedPerSec: rate('rateLimited'),
    unauthorizedPerSec: rate('unauthorized'),
    authChecksPerSec: rate('authChecks'),
    authFailuresPerSec: rate('authFailures'),
    connectsPerSec: rate('connects'),
    disconnectsPerSec: rate('disconnects'),
    cpuPct: Math.round(((cpu.user + cpu.system) / elapsedUs) * 1000) / 10,
    rssMB: Math.round(mem.rss / 1e5) / 10,
    heapMB: Math.round(mem.heapUsed / 1e5) / 10,
    loopDelayP99Ms: loopLagMs(sampler.loopDelay.percentile(99)),
    loopDelayMaxMs: loopLagMs(sampler.loopDelay.max),
  }
  sampler.cpu = process.cpuUsage()
  sampler.cpuAt = nowNs
  sampler.stats = { ...stats }
  sampler.statsAt = now
  sampler.loopDelay.reset()
  return out
}

const metricsSampler = makeSampler()

// ─── 상태 기록: 10초마다 지표를 남기고, 기준을 넘으면 과부하 로그를 쓴다 ─────────────────────
const HISTORY_EVERY_MS = 10_000
const HISTORY_KEEP = 6 * 60 * 6 // 6시간
const EVENTS_KEEP = 300
/** 이 값을 넘으면 경고/위험으로 본다. 내려가면 '회복' 기록을 남긴다. */
const THRESHOLDS = [
  { kind: 'cpu', label: 'CPU 사용률', unit: '%', pick: (m) => m.cpuPct, warn: 70, critical: 90 },
  { kind: 'loop', label: '이벤트 루프 지연(p99)', unit: 'ms', pick: (m) => m.loopDelayP99Ms, warn: 100, critical: 500 },
  { kind: 'rss', label: '중계 프로세스 메모리', unit: 'MB', pick: (m) => m.rssMB, warn: 400, critical: 700 },
  { kind: 'sysmem', label: '서버 메모리 사용률', unit: '%', pick: (m) => m.sysMemPct, warn: 85, critical: 95 },
  { kind: 'load', label: '서버 부하(1분 평균/코어)', unit: '', pick: (m) => m.loadPerCpu, warn: 1.5, critical: 3 },
  { kind: 'ratelimit', label: '속도 제한에 걸린 메시지', unit: '/s', pick: (m) => m.rateLimitedPerSec, warn: 0.1, critical: 20 },
  { kind: 'unauthorized', label: '거절된 보내기(인증 실패)', unit: '/s', pick: (m) => m.unauthorizedPerSec, warn: 2, critical: 20 },
  { kind: 'supabase', label: 'Supabase 응답 실패', unit: '/s', pick: (m) => m.authFailuresPerSec, warn: 0.1, critical: 2 },
]
const statusSampler = makeSampler()
/** @type {Array<Record<string, number|string>>} */
const history = []
/** @type {Array<{ at: string, kind: string, level: 'warn'|'critical'|'recovered'|'info', message: string, value?: number, peak?: number, durationSec?: number }>} */
const overloadEvents = [{ at: STARTED_AT, kind: 'start', level: 'info', message: '중계 서버 시작' }]
/** @type {Map<string, { level: 'warn'|'critical', since: number, peak: number }>} */
const activeAlerts = new Map()
const peaks = { conns: { value: 0, at: STARTED_AT }, rooms: { value: 0, at: STARTED_AT }, cpuPct: { value: 0, at: STARTED_AT }, loopDelayP99Ms: { value: 0, at: STARTED_AT }, rssMB: { value: 0, at: STARTED_AT }, inPerSec: { value: 0, at: STARTED_AT }, outPerSec: { value: 0, at: STARTED_AT } }

function pushEvent(event) {
  overloadEvents.push(event)
  if (overloadEvents.length > EVENTS_KEEP) overloadEvents.splice(0, overloadEvents.length - EVENTS_KEEP)
  console.warn(`[relay:${event.level}] ${event.message}`)
}

/** 리눅스는 캐시를 뺀 실제 여유 메모리(MemAvailable)를 본다. os.freemem()은 캐시까지 사용 중으로 센다. */
function availableMemory() {
  try {
    const match = readFileSync('/proc/meminfo', 'utf8').match(/^MemAvailable:\s+(\d+)\s+kB/m)
    if (match) return Number(match[1]) * 1024
  } catch {
    // 리눅스가 아니면 아래로
  }
  return os.freemem()
}

function systemSnapshot() {
  const total = os.totalmem()
  const free = availableMemory()
  const cpus = os.cpus().length || 1
  const [load1, load5, load15] = os.loadavg()
  return {
    sysMemPct: Math.round(((total - free) / total) * 1000) / 10,
    sysMemUsedMB: Math.round((total - free) / 1e6),
    sysMemTotalMB: Math.round(total / 1e6),
    cpus,
    load1: Math.round(load1 * 100) / 100,
    load5: Math.round(load5 * 100) / 100,
    load15: Math.round(load15 * 100) / 100,
    loadPerCpu: Math.round((load1 / cpus) * 100) / 100,
  }
}

function recordStatus() {
  const at = new Date().toISOString()
  const system = systemSnapshot()
  const sample = { at, ...sampleMetrics(statusSampler), ...countTransports(), sysMemPct: system.sysMemPct, loadPerCpu: system.loadPerCpu }
  history.push(sample)
  if (history.length > HISTORY_KEEP) history.splice(0, history.length - HISTORY_KEEP)

  for (const key of Object.keys(peaks)) {
    if (sample[key] > peaks[key].value) peaks[key] = { value: sample[key], at }
  }

  for (const rule of THRESHOLDS) {
    const value = rule.pick(sample)
    const level = value >= rule.critical ? 'critical' : value >= rule.warn ? 'warn' : null
    const active = activeAlerts.get(rule.kind)
    if (level) {
      if (!active || (active.level === 'warn' && level === 'critical')) {
        pushEvent({ at, kind: rule.kind, level, message: `${rule.label} ${value}${rule.unit} (기준 ${level === 'critical' ? rule.critical : rule.warn}${rule.unit})`, value })
        activeAlerts.set(rule.kind, { level, since: active?.since ?? Date.now(), peak: Math.max(value, active?.peak ?? 0) })
      } else {
        active.peak = Math.max(active.peak, value)
      }
    } else if (active) {
      const durationSec = Math.round((Date.now() - active.since) / 1000)
      pushEvent({ at, kind: rule.kind, level: 'recovered', message: `${rule.label} 정상으로 돌아옴 (최고 ${active.peak}${rule.unit}, ${durationSec}초 지속)`, peak: active.peak, durationSec })
      activeAlerts.delete(rule.kind)
    }
  }
}

setInterval(recordStatus, HISTORY_EVERY_MS).unref()

/** 관리자 화면용 상세 상태 */
function statusPayload(minutes) {
  const since = Date.now() - minutes * 60_000
  const topRooms = [...rooms.values()]
    .sort((a, b) => b.size - a.size)
    .slice(0, 30)
    .map((room) => ({ code: room.code, conns: room.size, peak: room.peak, presence: room.presence.size, openedAt: new Date(room.createdAt).toISOString() }))
  return {
    now: new Date().toISOString(),
    startedAt: STARTED_AT,
    uptimeSec: Math.round(process.uptime()),
    node: process.version,
    host: { hostname: os.hostname(), platform: `${os.type()} ${os.release()}`, uptimeSec: Math.round(os.uptime()) },
    authEnabled: AUTH_ENABLED,
    limits: { ratePerSec: RATE_PER_SEC, burst: RATE_BURST, maxPayloadBytes: MAX_PAYLOAD_BYTES },
    totals: { ...stats },
    system: systemSnapshot(),
    current: history[history.length - 1] ?? null,
    history: history.filter((h) => Date.parse(String(h.at)) >= since),
    peaks,
    activeAlerts: [...activeAlerts.entries()].map(([kind, a]) => ({ kind, level: a.level, since: new Date(a.since).toISOString(), peak: a.peak })),
    events: [...overloadEvents].reverse(),
    thresholds: THRESHOLDS.map(({ kind, label, unit, warn, critical }) => ({ kind, label, unit, warn, critical })),
    topRooms,
  }
}

/** @type {Map<string, { ok: boolean, until: number }>} */
const statusTokenCache = new Map()

/** is_admin() 이 없을 때: 토큰의 이메일을 예전 목록과 비교한다 */
async function isLegacyStatusAdmin(token) {
  const res = await supabaseGet('/auth/v1/user', { Authorization: `Bearer ${token}` })
  const email = res.ok ? String((await res.json())?.email || '').toLowerCase() : ''
  return Boolean(email && STATUS_ADMIN_EMAILS.has(email))
}

/** 상태를 볼 수 있는 관리자 토큰인가 (Supabase is_admin() 으로 확인, 1분 캐시) */
async function isStatusAdmin(token) {
  if (!token || token.length < 20 || token.length > 4096 || !SUPABASE_URL) return false
  const cached = statusTokenCache.get(token)
  if (cached && cached.until > Date.now()) return cached.ok
  let ok = false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS)
  try {
    stats.authChecks += 1
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
    if (res.ok) ok = (await res.json()) === true
    // 함수가 아직 없으면(404) 예전 목록으로 본다. 토큰이 무효(401) 등이면 거절.
    else if (res.status === 404) ok = await isLegacyStatusAdmin(token)
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
  if (statusTokenCache.size > 100) statusTokenCache.clear()
  statusTokenCache.set(token, { ok, until: Date.now() + 60_000 })
  return ok
}

function corsHeaders(origin) {
  if (!originAllowed(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Player-Token',
    Vary: 'Origin',
  }
}

/** @param {Server} io */
function makeHttpHandler(getIo) {
  return (req, res) => {
    // /socket.io/ 요청은 Socket.IO가 같은 서버에서 따로 처리한다
    if ((req.url || '').startsWith('/socket.io/')) return
    const origin = req.headers.origin
    const url = new URL(req.url || '/', 'http://relay')

    if (req.method === 'GET' && url.pathname === '/v2/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok')
      return
    }
    // 측정용. 운영에서는 Caddy가 막는다.
    if (req.method === 'GET' && url.pathname === '/v2/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(sampleMetrics(metricsSampler)))
      return
    }
    // 관리자 화면(/admin/server)이 보는 상세 상태. 관리자 Supabase 세션 토큰이 있어야 한다.
    if (req.method === 'GET' && url.pathname === '/v2/status') {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
      void isStatusAdmin(token).then((ok) => {
        if (!ok) {
          res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"error":"forbidden"}')
          return
        }
        const minutes = Math.min(360, Math.max(5, Number(url.searchParams.get('minutes')) || 60))
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(statusPayload(minutes)))
      })
      return
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(origin)).end()
      return
    }

    const match = url.pathname.match(/^\/v2\/rooms\/([^/]+)\/events$/)
    if (req.method === 'POST' && match) {
      if (!originAllowed(origin)) {
        res.writeHead(403).end()
        return
      }
      const code = decodeURIComponent(match[1])
      const sessionToken = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || null
      const playerToken = req.headers['x-player-token'] || null
      let body = ''
      req.setEncoding('utf8')
      req.on('data', (chunk) => {
        body += chunk
        if (body.length > MAX_PAYLOAD_BYTES) req.destroy()
      })
      req.on('end', async () => {
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
        if (!await canSend(code, event, null, { sessionToken, playerToken })) {
          stats.unauthorized += 1
          res.writeHead(401, corsHeaders(origin)).end()
          return
        }
        stats.httpEvents += 1
        const room = rooms.get(code)
        if (room) relayEvent(getIo(), room, event, null, null)
        res.writeHead(202, corsHeaders(origin)).end()
      })
      return
    }

    res.writeHead(404).end()
  }
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────

let ioRef = null
const server = http.createServer(makeHttpHandler(() => ioRef))
const io = new Server(server, {
  path: '/socket.io',
  // 폴링(HTTP)으로 붙을 때의 CORS. WebSocket 업그레이드는 allowRequest에서 Origin을 본다
  cors: { origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true },
  allowRequest: (req, callback) => callback(null, Boolean(originAllowed(req.headers.origin))),
  maxHttpBufferSize: MAX_PAYLOAD_BYTES,
  perMessageDeflate: false,
  pingInterval: 25_000,
  pingTimeout: 20_000,
  serveClient: false,
})
ioRef = io

io.on('connection', (socket) => {
  const auth = socket.handshake.auth || {}
  const code = String(auth.room || '')
  const clientId = String(auth.clientId || '').slice(0, 64)
  if (!ROOM_CODE_RE.test(code) || !clientId) {
    socket.emit('fatal', { message: 'bad_join' })
    socket.disconnect(true)
    return
  }

  const room = getRoom(code)
  /** @type {Conn} */
  const conn = {
    id: nextConnId++,
    room,
    clientId,
    tokens: RATE_BURST,
    tokensAt: Date.now(),
    // 교사 토큰은 접속할 때 한 번 확인을 시작해 두고, 처음 보내는 이벤트에서 결과를 기다린다
    teacher: auth.token ? isRoomTeacher(code, auth.token) : null,
    playerId: null,
  }
  socket.join(code)
  room.size += 1
  room.peak = Math.max(room.peak, room.size)
  stats.connects += 1
  socket.emit('joined', { c: conn.id, presence: presenceSnapshot(room) })
  if (auth.meta) setPresence(io, conn, auth.meta)

  socket.on('track', (meta) => {
    stats.msgsIn += 1
    if (!takeToken(conn)) {
      stats.rateLimited += 1
      return
    }
    setPresence(io, conn, meta)
  })

  // 새 클라이언트는 ('ev', event, { playerToken }, ack), 이 변경 전 클라이언트는 ('ev', event, ack)로 보낸다
  socket.on('ev', async (event, metaOrAck, maybeAck) => {
    stats.msgsIn += 1
    const ack = typeof metaOrAck === 'function' ? metaOrAck : maybeAck
    const meta = metaOrAck && typeof metaOrAck === 'object' ? metaOrAck : {}
    const reply = typeof ack === 'function' ? ack : () => {}
    if (!takeToken(conn)) {
      stats.rateLimited += 1
      reply({ err: 'rate_limited' })
      return
    }
    if (!isValidEvent(event, code)) {
      reply({ err: 'bad_event' })
      return
    }
    if (!await canSend(code, event, conn, { playerToken: meta.playerToken })) {
      stats.unauthorized += 1
      reply({ err: 'unauthorized' })
      return
    }
    relayEvent(io, room, event, socket, conn.id)
    reply({ ok: true })
  })

  socket.on('disconnect', () => leaveRoom(io, conn))
})

setInterval(() => flushPositions(io), POS_FLUSH_MS)

if (LOG_METRICS) {
  setInterval(() => console.log(JSON.stringify(history[history.length - 1] ?? {})), 10_000)
}

server.listen(PORT, () => {
  console.log(`quizdog socket.io relay on :${PORT} auth=${AUTH_ENABLED ? 'on' : 'off'}${ALLOWED_ORIGINS.length ? ` origins=${ALLOWED_ORIGINS.join(',')}` : ''}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    io.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
