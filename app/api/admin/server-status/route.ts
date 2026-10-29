import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 관리자 화면 '서버 상태'.
 * - 중계 서버(rt.quizdog.kr): /v2/healthz 응답 시간 + /v2/status 상세 지표·과부하 로그(관리자 토큰으로 읽음)
 * - Supabase: DB·인증 응답 시간, 방·학생 수로 본 지금 부하, 시간대별 활동
 * - 화면 오류(client_error_logs): 최근 24시간 건수, 자주 난 오류, 최근 오류
 * - 이 API를 돌린 Vercel 함수 정보
 */

const FUNCTION_STARTED_AT = new Date().toISOString()
const ACTIVE_STATUSES = ['waiting', 'playing', 'paused']
const RELAY_TIMEOUT_MS = 5000

function relayHttpBase(): string {
  const raw = process.env.NEXT_PUBLIC_ROOM_RELAY_URL || 'wss://rt.quizdog.kr'
  return raw.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '')
}

async function timed<T>(task: () => Promise<T>): Promise<{ ms: number; value?: T; error?: string }> {
  const started = performance.now()
  try {
    const value = await task()
    return { ms: Math.round(performance.now() - started), value }
  } catch (error) {
    return { ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : String(error) }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timer)
  }
}

async function loadRelay(token: string | null, minutes: number) {
  const base = relayHttpBase()
  const health = await timed(async () => {
    const res = await fetchWithTimeout(`${base}/v2/healthz`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return true
  })
  const status = await timed(async () => {
    const res = await fetchWithTimeout(`${base}/v2/status?minutes=${minutes}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    // 상태 API가 없는 예전 중계 서버는 404를 준다
    if (res.status === 404) return { kind: 'not_deployed' as const }
    if (res.status === 403) return { kind: 'forbidden' as const }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { kind: 'ok' as const, data: await res.json() }
  })
  return {
    url: base,
    reachable: !health.error,
    healthMs: health.ms,
    healthError: health.error ?? null,
    statusMs: status.ms,
    statusState: status.error ? 'error' : status.value!.kind,
    statusError: status.error ?? null,
    status: status.value?.kind === 'ok' ? status.value.data : null,
  }
}

function isMissingTable(error: { code?: string; message?: string } | null) {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message ?? '')))
}

/** 최근 24시간을 한 시간 칸으로 나눠 센다 (KST 시각 라벨) */
function hourlyBuckets(timestamps: string[], now: number) {
  const buckets: { hour: string; count: number }[] = []
  const hourMs = 3_600_000
  const end = Math.floor(now / hourMs) * hourMs + hourMs
  for (let i = 23; i >= 0; i--) {
    const start = end - (i + 1) * hourMs
    const kstHour = new Date(start + 9 * hourMs).getUTCHours()
    buckets.push({ hour: `${String(kstHour).padStart(2, '0')}시`, count: 0 })
  }
  const first = end - 24 * hourMs
  for (const ts of timestamps) {
    const t = Date.parse(ts)
    if (!Number.isFinite(t) || t < first || t >= end) continue
    buckets[Math.floor((t - first) / hourMs)].count += 1
  }
  return buckets
}

async function loadDatabase() {
  const supabase = getAdminSupabase()
  const now = Date.now()
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()
  const count = (query: PromiseLike<{ count: number | null; error: unknown }>) =>
    Promise.resolve(query).then((r) => (r.error ? null : r.count ?? 0), () => null)

  const pingRest = () =>
    timed(async () => {
      const { error } = await supabase.from('rooms').select('room_code', { head: true, count: 'planned' }).limit(1)
      if (error) throw new Error(error.message)
    })
  // 첫 요청은 TLS 연결을 맺는 시간까지 들어가 늘 느리게 나온다. 연결을 맺은 뒤 한 번 더 잰 값을 쓴다.
  const coldPing = await pingRest()
  const restPing = coldPing.error ? coldPing : await pingRest()
  const authPing = await timed(async () => {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw new Error(error.message)
  })

  const [waiting, playing, paused, roomsLastHour, roomsToday, playersLast5m, playersLastHour, playersToday, reportsToday] = await Promise.all([
    count((supabase.from('rooms') as any).select('*', { count: 'exact', head: true }).eq('status', 'waiting')),
    count((supabase.from('rooms') as any).select('*', { count: 'exact', head: true }).eq('status', 'playing')),
    count((supabase.from('rooms') as any).select('*', { count: 'exact', head: true }).eq('status', 'paused')),
    count((supabase.from('rooms') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(3_600_000))),
    count((supabase.from('rooms') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(86_400_000))),
    count((supabase.from('players') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(300_000))),
    count((supabase.from('players') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(3_600_000))),
    count((supabase.from('players') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(86_400_000))),
    count((supabase.from('game_reports') as any).select('*', { count: 'exact', head: true }).gte('created_at', iso(86_400_000))),
  ])

  // 지금 열린 방과 그 방의 학생 수 (가장 붐비는 방 순)
  const { data: activeRooms } = await (supabase.from('rooms') as any)
    .select('room_code, status, game_mode, created_at, started_at')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(300)
  const codes = ((activeRooms ?? []) as Array<{ room_code: string }>).map((r) => r.room_code)
  const playerCounts = new Map<string, number>()
  for (let i = 0; i < codes.length; i += 100) {
    const { data } = await (supabase.from('players') as any).select('room_code').in('room_code', codes.slice(i, i + 100)).limit(10000)
    for (const row of (data ?? []) as Array<{ room_code: string }>) playerCounts.set(row.room_code, (playerCounts.get(row.room_code) ?? 0) + 1)
  }
  const busiestRooms = ((activeRooms ?? []) as Array<{ room_code: string; status: string; game_mode: string | null; created_at: string; started_at: string | null }>)
    .map((r) => ({ ...r, players: playerCounts.get(r.room_code) ?? 0 }))
    .sort((a, b) => b.players - a.players)
    .slice(0, 15)
  const playersInActiveRooms = [...playerCounts.values()].reduce((a, b) => a + b, 0)

  // 시간대별 활동 (최근 24시간)
  const [{ data: recentPlayers }, { data: recentRooms }] = await Promise.all([
    (supabase.from('players') as any).select('created_at').gte('created_at', iso(86_400_000)).order('created_at', { ascending: false }).limit(20000),
    (supabase.from('rooms') as any).select('created_at').gte('created_at', iso(86_400_000)).order('created_at', { ascending: false }).limit(5000),
  ])
  const playerHours = hourlyBuckets(((recentPlayers ?? []) as Array<{ created_at: string }>).map((r) => r.created_at), now)
  const roomHours = hourlyBuckets(((recentRooms ?? []) as Array<{ created_at: string }>).map((r) => r.created_at), now)

  // 화면 오류
  let errors: {
    available: boolean
    lastHour: number
    last24h: number
    hourly: { hour: string; count: number }[]
    top: { message: string; count: number; lastAt: string; paths: string[] }[]
    recent: Array<{ id: string; created_at: string; kind: string; message: string; path: string | null; room_code: string | null; nickname: string | null }>
  } = { available: true, lastHour: 0, last24h: 0, hourly: [], top: [], recent: [] }
  {
    const { data, error } = await (supabase.from('client_error_logs') as any)
      .select('id, created_at, kind, message, path, room_code, nickname')
      .gte('created_at', iso(86_400_000))
      .order('created_at', { ascending: false })
      .limit(3000)
    if (error) {
      if (!isMissingTable(error)) throw error
      errors = { ...errors, available: false }
    } else {
      const rows = (data ?? []) as typeof errors.recent
      const grouped = new Map<string, { message: string; count: number; lastAt: string; paths: Set<string> }>()
      for (const row of rows) {
        const key = row.message.slice(0, 200)
        const entry = grouped.get(key) ?? { message: key, count: 0, lastAt: row.created_at, paths: new Set<string>() }
        entry.count += 1
        if (row.path && entry.paths.size < 5) entry.paths.add(row.path)
        grouped.set(key, entry)
      }
      errors = {
        available: true,
        lastHour: rows.filter((r) => Date.parse(r.created_at) >= now - 3_600_000).length,
        last24h: rows.length,
        hourly: hourlyBuckets(rows.map((r) => r.created_at), now),
        top: [...grouped.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map((g) => ({ message: g.message, count: g.count, lastAt: g.lastAt, paths: [...g.paths] })),
        recent: rows.slice(0, 40),
      }
    }
  }

  return {
    restMs: restPing.ms,
    restColdMs: coldPing.ms,
    restError: restPing.error ?? null,
    authMs: authPing.ms,
    authError: authPing.error ?? null,
    rooms: { waiting, playing, paused, lastHour: roomsLastHour, last24h: roomsToday },
    players: { inActiveRooms: playersInActiveRooms, last5m: playersLast5m, lastHour: playersLastHour, last24h: playersToday },
    reportsLast24h: reportsToday,
    busiestRooms,
    hourly: playerHours.map((p, i) => ({ hour: p.hour, players: p.count, rooms: roomHours[i].count })),
    errors,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response!

  const url = new URL(request.url)
  const minutes = Math.min(360, Math.max(5, Number(url.searchParams.get('minutes')) || 60))
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null

  try {
    const [relay, database] = await Promise.all([
      loadRelay(token, minutes),
      loadDatabase(),
    ])
    const mem = process.memoryUsage()
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      relay,
      database,
      web: {
        region: process.env.VERCEL_REGION ?? 'local',
        env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        node: process.version,
        functionStartedAt: FUNCTION_STARTED_AT,
        rssMB: Math.round(mem.rss / 1e5) / 10,
        heapMB: Math.round(mem.heapUsed / 1e5) / 10,
      },
    })
  } catch (error) {
    console.error('[admin/server-status]', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : '서버 상태를 불러오지 못했습니다.' }, { status: 500 })
  }
}
