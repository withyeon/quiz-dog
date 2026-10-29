'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Cpu, Database, Gauge, KeyRound, MemoryStick, Radio, ShieldAlert, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchAdminJson } from '@/lib/admin/fetchAdmin'
import {
  Banner,
  DataTable,
  EmptyState,
  FilterChips,
  KeyValue,
  PageHeader,
  Panel,
  Pill,
  RefreshButton,
  StatCard,
  StatGrid,
  formatDateTime,
  formatNumber,
  timeAgo,
  type PillTone,
  type StatTone,
} from '@/components/admin/ui'

// ── 응답 모양 (app/api/admin/server-status, relay/socket-server.mjs /v2/status) ──

interface RelaySample {
  at: string
  rooms: number
  conns: number
  inPerSec: number
  outPerSec: number
  rateLimitedPerSec: number
  unauthorizedPerSec: number
  authChecksPerSec: number
  authFailuresPerSec: number
  connectsPerSec: number
  disconnectsPerSec: number
  cpuPct: number
  rssMB: number
  heapMB: number
  loopDelayP99Ms: number
  loopDelayMaxMs: number
  websocket: number
  polling: number
  sysMemPct: number
  loadPerCpu: number
}

interface RelayEvent {
  at: string
  kind: string
  level: 'warn' | 'critical' | 'recovered' | 'info'
  message: string
}

interface RelayStatus {
  now: string
  startedAt: string
  uptimeSec: number
  node: string
  host: { hostname: string; platform: string; uptimeSec: number }
  authEnabled: boolean
  limits: { ratePerSec: number; burst: number; maxPayloadBytes: number }
  totals: Record<string, number>
  system: { sysMemPct: number; sysMemUsedMB: number; sysMemTotalMB: number; cpus: number; load1: number; load5: number; load15: number; loadPerCpu: number }
  current: RelaySample | null
  history: RelaySample[]
  peaks: Record<string, { value: number; at: string }>
  activeAlerts: { kind: string; level: 'warn' | 'critical'; since: string; peak: number }[]
  events: RelayEvent[]
  thresholds: { kind: string; label: string; unit: string; warn: number; critical: number }[]
  topRooms: { code: string; conns: number; peak: number; presence: number; openedAt: string }[]
}

interface ServerStatus {
  timestamp: string
  relay: {
    url: string
    reachable: boolean
    healthMs: number
    healthError: string | null
    statusMs: number
    statusState: 'ok' | 'not_deployed' | 'forbidden' | 'error'
    statusError: string | null
    status: RelayStatus | null
  }
  database: {
    restMs: number
    restColdMs: number
    restError: string | null
    authMs: number
    authError: string | null
    rooms: { waiting: number | null; playing: number | null; paused: number | null; lastHour: number | null; last24h: number | null }
    players: { inActiveRooms: number; last5m: number | null; lastHour: number | null; last24h: number | null }
    reportsLast24h: number | null
    busiestRooms: { room_code: string; status: string; game_mode: string | null; created_at: string; started_at: string | null; players: number }[]
    hourly: { hour: string; players: number; rooms: number }[]
    errors: {
      available: boolean
      lastHour: number
      last24h: number
      hourly: { hour: string; count: number }[]
      top: { message: string; count: number; lastAt: string; paths: string[] }[]
      recent: { id: string; created_at: string; kind: string; message: string; path: string | null; room_code: string | null; nickname: string | null }[]
    }
  }
  web: { region: string; env: string; commit: string | null; node: string; functionStartedAt: string; rssMB: number; heapMB: number }
}

type RangeKey = '15' | '60' | '360'
const RANGES: { value: RangeKey; label: string }[] = [
  { value: '15', label: '15분' },
  { value: '60', label: '1시간' },
  { value: '360', label: '6시간' },
]
const AUTO_REFRESH_MS = 10_000

// ── 표시 도우미 ──

function duration(sec?: number | null) {
  if (sec == null) return '-'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}일 ${h}시간`
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분 ${sec % 60}초`
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function latencyTone(ms: number, error: string | null): StatTone {
  if (error) return 'danger'
  if (ms >= 1500) return 'danger'
  if (ms >= 500) return 'warning'
  return 'success'
}

function thresholdTone(value: number | undefined, rule?: { warn: number; critical: number }): StatTone {
  if (value == null || !rule) return 'default'
  if (value >= rule.critical) return 'danger'
  if (value >= rule.warn) return 'warning'
  return 'default'
}

const EVENT_TONE: Record<RelayEvent['level'], PillTone> = { critical: 'rose', warn: 'amber', recovered: 'emerald', info: 'slate' }
const EVENT_LABEL: Record<RelayEvent['level'], string> = { critical: '위험', warn: '경고', recovered: '회복', info: '알림' }

function ChartBox({ children, height = 220 }: { children: React.ReactElement; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

const AXIS = { fontSize: 11, fill: '#64748b' }

export default function AdminServerPage() {
  const [data, setData] = useState<ServerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<RangeKey>('60')
  const [auto, setAuto] = useState(true)
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      setData(await fetchAdminJson<ServerStatus>(`/api/admin/server-status?minutes=${range}`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '서버 상태를 불러오지 못했습니다.')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, AUTO_REFRESH_MS)
    return () => clearInterval(timer)
  }, [auto, load])

  const relay = data?.relay
  const rs = relay?.status ?? null
  const cur = rs?.current ?? null
  const db = data?.database
  const rule = useMemo(() => new Map((rs?.thresholds ?? []).map((t) => [t.kind, t])), [rs])
  const history = useMemo(() => (rs?.history ?? []).map((h) => ({ ...h, time: clock(h.at) })), [rs])
  const skeleton = loading && !data

  // 한 줄 요약: 중계 서버가 안 닿거나 위험 경보가 있으면 위험, 경고가 있으면 주의
  const overall = useMemo(() => {
    if (!data) return null
    const problems: string[] = []
    let level: 'ok' | 'warn' | 'critical' = 'ok'
    if (!data.relay.reachable) {
      level = 'critical'
      problems.push('중계 서버에 닿지 않음')
    }
    for (const a of rs?.activeAlerts ?? []) {
      if (a.level === 'critical') level = 'critical'
      else if (level === 'ok') level = 'warn'
      problems.push(`${rule.get(a.kind)?.label ?? a.kind} ${a.level === 'critical' ? '위험' : '경고'} (${timeAgo(a.since)}부터)`)
    }
    if (data.database.restError || data.database.authError) {
      level = 'critical'
      problems.push('Supabase 응답 오류')
    } else if (data.database.restMs >= 1500 || data.database.authMs >= 1500) {
      if (level === 'ok') level = 'warn'
      problems.push('Supabase 응답이 느림')
    }
    if (data.database.errors.lastHour >= 20) {
      if (level === 'ok') level = 'warn'
      problems.push(`최근 1시간 화면 오류 ${data.database.errors.lastHour}건`)
    }
    return { level, problems }
  }, [data, rs, rule])

  return (
    <>
      <PageHeader
        title="서버 상태"
        description="중계 서버·Supabase 부하와 과부하 기록, 화면 오류를 실시간으로 봅니다."
        updatedAt={data?.timestamp}
        actions={
          <>
            <FilterChips value={range} onChange={setRange} options={RANGES} />
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              10초마다 갱신
            </label>
            <RefreshButton onClick={() => void load()} loading={loading} />
          </>
        }
      />

      {error && <Banner tone="error" action={<RefreshButton onClick={() => void load()} loading={loading} label="다시 시도" />}>{error}</Banner>}

      {overall && (
        <Banner tone={overall.level === 'ok' ? 'success' : overall.level === 'warn' ? 'warning' : 'error'}>
          {overall.level === 'ok' ? '모든 서버가 정상입니다.' : overall.problems.join(' · ')}
        </Banner>
      )}

      {relay && relay.statusState !== 'ok' && (
        <Banner tone="info">
          {relay.statusState === 'not_deployed' && (
            <>중계 서버가 아직 상세 상태(/v2/status)가 없는 예전 버전입니다. 접속·CPU·과부하 로그를 보려면 Lightsail 브라우저 SSH에서 중계 서버를 새 커밋으로 다시 배포하세요(relay/deploy-lightsail.sh).</>
          )}
          {relay.statusState === 'forbidden' && <>중계 서버가 이 계정을 관리자로 모릅니다. 배포 때 넷째 인자(관리자 이메일)에 이 계정을 넣어 주세요.</>}
          {relay.statusState === 'error' && <>중계 서버 상세 상태를 읽지 못했습니다: {relay.statusError}</>}
        </Banner>
      )}

      <StatGrid columns={4}>
        <StatCard
          label="중계 서버"
          value={relay ? (relay.reachable ? `${relay.healthMs}ms` : '응답 없음') : '-'}
          hint={relay ? (relay.reachable ? `정상 · 켜진 지 ${duration(rs?.uptimeSec)}` : relay.healthError) : undefined}
          tone={relay ? (relay.reachable ? latencyTone(relay.healthMs, null) : 'danger') : 'default'}
          icon={<Radio className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="지금 접속"
          value={cur ? formatNumber(cur.conns) : '-'}
          hint={cur ? `방 ${cur.rooms}개 · WebSocket ${cur.websocket} / 폴링 ${cur.polling}` : '중계 서버 상세 상태 필요'}
          icon={<Users className="h-4 w-4" />}
          tone="info"
          loading={skeleton}
        />
        <StatCard
          label="중계 CPU"
          value={cur ? `${cur.cpuPct}%` : '-'}
          hint={rs ? `서버 부하 ${rs.system.load1} / 코어 ${rs.system.cpus}개` : undefined}
          tone={thresholdTone(cur?.cpuPct, rule.get('cpu'))}
          icon={<Cpu className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="이벤트 루프 지연"
          value={cur ? `${cur.loopDelayP99Ms}ms` : '-'}
          hint={cur ? `최대 ${cur.loopDelayMaxMs}ms (p99, 10초 구간)` : undefined}
          tone={thresholdTone(cur?.loopDelayP99Ms, rule.get('loop'))}
          icon={<Gauge className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="서버 메모리"
          value={rs ? `${rs.system.sysMemPct}%` : '-'}
          hint={rs ? `${rs.system.sysMemUsedMB} / ${rs.system.sysMemTotalMB}MB · 중계 프로세스 ${cur?.rssMB ?? '-'}MB` : undefined}
          tone={thresholdTone(rs?.system.sysMemPct, rule.get('sysmem'))}
          icon={<MemoryStick className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="Supabase DB 응답"
          value={db ? `${db.restMs}ms` : '-'}
          hint={db?.restError ?? `인증 ${db?.authMs ?? '-'}ms${db?.authError ? ` · ${db.authError}` : ''}`}
          tone={db ? latencyTone(Math.max(db.restMs, db.authMs), db.restError ?? db.authError) : 'default'}
          icon={<Database className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="열린 방 (DB)"
          value={db ? formatNumber((db.rooms.waiting ?? 0) + (db.rooms.playing ?? 0) + (db.rooms.paused ?? 0)) : '-'}
          hint={db ? `진행 ${db.rooms.playing ?? '-'} · 대기 ${db.rooms.waiting ?? '-'} · 멈춤 ${db.rooms.paused ?? '-'} · 학생 ${db.players.inActiveRooms}명` : undefined}
          tone="success"
          icon={<Activity className="h-4 w-4" />}
          loading={skeleton}
        />
        <StatCard
          label="화면 오류 (1시간)"
          value={db ? formatNumber(db.errors.lastHour) : '-'}
          hint={db ? `24시간 ${formatNumber(db.errors.last24h)}건` : undefined}
          tone={db && db.errors.lastHour >= 20 ? 'danger' : db && db.errors.lastHour > 0 ? 'warning' : 'default'}
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={skeleton}
        />
      </StatGrid>

      {rs && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="접속 수" description="중계 서버에 붙은 연결과 방 (10초 간격)">
              <ChartBox>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={AXIS} minTickGap={40} />
                  <YAxis tick={AXIS} allowDecimals={false} width={40} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="conns" name="연결" stroke="#0ea5e9" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="polling" name="폴링 연결" stroke="#f59e0b" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="rooms" name="방" stroke="#10b981" dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartBox>
            </Panel>
            <Panel title="CPU · 이벤트 루프 지연" description="점선은 경고 기준">
              <ChartBox>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={AXIS} minTickGap={40} />
                  <YAxis yAxisId="cpu" tick={AXIS} unit="%" width={44} />
                  <YAxis yAxisId="ms" orientation="right" tick={AXIS} unit="ms" width={52} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {rule.get('cpu') && <ReferenceLine yAxisId="cpu" y={rule.get('cpu')!.warn} stroke="#f59e0b" strokeDasharray="4 4" />}
                  <Line yAxisId="cpu" type="monotone" dataKey="cpuPct" name="CPU %" stroke="#6366f1" dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line yAxisId="ms" type="monotone" dataKey="loopDelayP99Ms" name="루프 지연 p99 (ms)" stroke="#f43f5e" dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartBox>
            </Panel>
            <Panel title="초당 메시지" description="받은 메시지 / 보낸 메시지 / 거절">
              <ChartBox>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={AXIS} minTickGap={40} />
                  <YAxis tick={AXIS} width={44} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="inPerSec" name="받음/s" stroke="#0ea5e9" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="outPerSec" name="보냄/s" stroke="#10b981" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="rateLimitedPerSec" name="속도 제한/s" stroke="#f59e0b" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="unauthorizedPerSec" name="인증 거절/s" stroke="#f43f5e" dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="authFailuresPerSec" name="Supabase 실패/s" stroke="#7c3aed" dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartBox>
            </Panel>
            <Panel title="메모리" description="중계 프로세스(MB)와 서버 전체 사용률(%)">
              <ChartBox>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={AXIS} minTickGap={40} />
                  <YAxis yAxisId="mb" tick={AXIS} unit="MB" width={56} />
                  <YAxis yAxisId="pct" orientation="right" tick={AXIS} unit="%" domain={[0, 100]} width={44} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="mb" type="monotone" dataKey="rssMB" name="프로세스 MB" stroke="#0ea5e9" dot={false} isAnimationActive={false} />
                  <Line yAxisId="mb" type="monotone" dataKey="heapMB" name="힙 MB" stroke="#94a3b8" dot={false} isAnimationActive={false} />
                  <Line yAxisId="pct" type="monotone" dataKey="sysMemPct" name="서버 메모리 %" stroke="#f43f5e" dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartBox>
            </Panel>
          </div>

          <Panel
            title="과부하 로그"
            description={`중계 서버가 기준을 넘거나 회복할 때 남긴 기록 (서버가 켜진 ${formatDateTime(rs.startedAt)} 이후, 최근 300건)`}
            actions={
              rs.activeAlerts.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {rs.activeAlerts.map((a) => (
                    <Pill key={a.kind} tone={a.level === 'critical' ? 'rose' : 'amber'} dot>
                      {rule.get(a.kind)?.label ?? a.kind} 진행 중
                    </Pill>
                  ))}
                </div>
              ) : (
                <Pill tone="emerald" dot>지금 경보 없음</Pill>
              )
            }
            padded={false}
          >
            <div className="max-h-96 overflow-auto">
              <DataTable
                compact
                rows={rs.events}
                rowKey={(e) => `${e.at}-${e.kind}-${e.level}`}
                empty={<EmptyState title="기록이 없습니다" />}
                columns={[
                  { key: 'at', header: '시각', width: '9rem', render: (e) => <span className="whitespace-nowrap tabular-nums text-slate-600">{new Date(e.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span> },
                  { key: 'level', header: '단계', width: '5rem', render: (e) => <Pill tone={EVENT_TONE[e.level]}>{EVENT_LABEL[e.level]}</Pill> },
                  { key: 'message', header: '내용', render: (e) => <span className="text-slate-800">{e.message}</span> },
                ]}
              />
            </div>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="최고치" description="중계 서버가 켜진 뒤 가장 높았던 값">
              <KeyValue
                items={[
                  { label: '동시 연결', value: `${formatNumber(rs.peaks.conns?.value)} (${formatDateTime(rs.peaks.conns?.at)})` },
                  { label: '동시 방', value: `${formatNumber(rs.peaks.rooms?.value)} (${formatDateTime(rs.peaks.rooms?.at)})` },
                  { label: 'CPU', value: `${rs.peaks.cpuPct?.value}% (${formatDateTime(rs.peaks.cpuPct?.at)})` },
                  { label: '루프 지연 p99', value: `${rs.peaks.loopDelayP99Ms?.value}ms (${formatDateTime(rs.peaks.loopDelayP99Ms?.at)})` },
                  { label: '프로세스 메모리', value: `${rs.peaks.rssMB?.value}MB (${formatDateTime(rs.peaks.rssMB?.at)})` },
                  { label: '받은 메시지/s', value: `${rs.peaks.inPerSec?.value} (${formatDateTime(rs.peaks.inPerSec?.at)})` },
                  { label: '보낸 메시지/s', value: `${rs.peaks.outPerSec?.value} (${formatDateTime(rs.peaks.outPerSec?.at)})` },
                ]}
              />
            </Panel>
            <Panel title="경보 기준" description="이 값을 넘으면 과부하 로그에 남습니다" padded={false}>
              <div className="overflow-x-auto">
              <DataTable
                compact
                rows={rs.thresholds}
                rowKey={(t) => t.kind}
                columns={[
                  { key: 'label', header: '항목', render: (t) => t.label },
                  { key: 'now', header: '지금', align: 'right', render: (t) => {
                    const v = cur ? (t.kind === 'cpu' ? cur.cpuPct : t.kind === 'loop' ? cur.loopDelayP99Ms : t.kind === 'rss' ? cur.rssMB : t.kind === 'sysmem' ? cur.sysMemPct : t.kind === 'load' ? cur.loadPerCpu : t.kind === 'ratelimit' ? cur.rateLimitedPerSec : t.kind === 'unauthorized' ? cur.unauthorizedPerSec : cur.authFailuresPerSec) : null
                    const tone = thresholdTone(v ?? undefined, t)
                    return <span className={tone === 'danger' ? 'font-semibold text-rose-600' : tone === 'warning' ? 'font-semibold text-amber-600' : 'text-slate-700'}>{v ?? '-'}{t.unit}</span>
                  } },
                  { key: 'limit', header: '경고 / 위험', align: 'right', render: (t) => <span className="whitespace-nowrap">{t.warn} / {t.critical}{t.unit}</span> },
                ]}
              />
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="중계 서버의 방" description="지금 연결이 많은 순 (최대 30개)" padded={false}>
              <div className="max-h-80 overflow-auto">
                <DataTable
                compact
                  rows={rs.topRooms}
                  rowKey={(r) => r.code}
                  empty={<EmptyState title="열린 방이 없습니다" />}
                  columns={[
                    { key: 'code', header: '방 코드', render: (r) => <span className="font-mono">{r.code}</span> },
                    { key: 'conns', header: '연결', align: 'right', render: (r) => formatNumber(r.conns) },
                    { key: 'peak', header: '최고', align: 'right', render: (r) => formatNumber(r.peak) },
                    { key: 'openedAt', header: '열린 지', align: 'right', render: (r) => timeAgo(r.openedAt) },
                  ]}
                />
              </div>
            </Panel>
            <Panel title="중계 서버 정보">
              <KeyValue
                items={[
                  { label: '주소', value: relay?.url },
                  { label: '켜진 시각', value: `${formatDateTime(rs.startedAt, 'long')} (${duration(rs.uptimeSec)})` },
                  { label: '서버', value: `${rs.host.hostname} · ${rs.host.platform} · 부팅 후 ${duration(rs.host.uptimeSec)}` },
                  { label: 'Node', value: rs.node },
                  { label: '부하 평균', value: `${rs.system.load1} / ${rs.system.load5} / ${rs.system.load15} (1·5·15분, 코어 ${rs.system.cpus}개)` },
                  { label: '보낸 사람 인증', value: rs.authEnabled ? '켜짐' : <span className="text-rose-600">꺼짐</span> },
                  { label: '연결당 속도 제한', value: `초당 ${rs.limits.ratePerSec}개 (순간 ${rs.limits.burst}개)` },
                  { label: '누적', value: `받음 ${formatNumber(rs.totals.msgsIn)} · 보냄 ${formatNumber(rs.totals.msgsOut)} · 속도 제한 ${formatNumber(rs.totals.rateLimited)} · 인증 거절 ${formatNumber(rs.totals.unauthorized)} · Supabase 실패 ${formatNumber(rs.totals.authFailures)}` },
                  { label: '상태 응답', value: `${relay?.statusMs}ms` },
                ]}
              />
            </Panel>
          </div>
        </>
      )}

      {db && (
        <>
          <Panel title="최근 24시간 활동" description="한 시간마다 들어온 학생, 열린 방, 화면 오류 (KST)">
            <ChartBox height={240}>
              <BarChart data={db.hourly.map((h, i) => ({ ...h, errors: db.errors.hourly[i]?.count ?? 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="hour" tick={AXIS} interval={1} />
                <YAxis tick={AXIS} allowDecimals={false} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="players" name="입장한 학생" fill="#0ea5e9" isAnimationActive={false} />
                <Bar dataKey="rooms" name="열린 방" fill="#10b981" isAnimationActive={false} />
                <Bar dataKey="errors" name="화면 오류" fill="#f43f5e" isAnimationActive={false} />
              </BarChart>
            </ChartBox>
          </Panel>

          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="DB로 본 부하" description="Supabase 기준 숫자">
              <KeyValue
                items={[
                  { label: 'DB 응답', value: db.restError ? <span className="text-rose-600">{db.restError}</span> : `${db.restMs}ms (첫 연결 포함 ${db.restColdMs}ms)` },
                  { label: '인증 응답', value: db.authError ? <span className="text-rose-600">{db.authError}</span> : `${db.authMs}ms` },
                  { label: '입장한 학생', value: `5분 ${formatNumber(db.players.last5m)} · 1시간 ${formatNumber(db.players.lastHour)} · 24시간 ${formatNumber(db.players.last24h)}` },
                  { label: '열린 방', value: `1시간 ${formatNumber(db.rooms.lastHour)} · 24시간 ${formatNumber(db.rooms.last24h)}` },
                  { label: '저장된 게임 기록', value: `24시간 ${formatNumber(db.reportsLast24h)}` },
                  { label: '열려 있는 방의 학생', value: `${formatNumber(db.players.inActiveRooms)}명` },
                ]}
              />
            </Panel>
            <Panel title="학생이 많은 방 (DB)" description="열려 있는 방 중 학생이 많은 순" padded={false}>
              <div className="max-h-80 overflow-auto">
                <DataTable
                compact
                  rows={db.busiestRooms}
                  rowKey={(r) => r.room_code}
                  empty={<EmptyState title="열린 방이 없습니다" />}
                  columns={[
                    { key: 'code', header: '방 코드', render: (r) => <span className="font-mono">{r.room_code}</span> },
                    { key: 'mode', header: '게임', render: (r) => <span className="block max-w-[8rem] truncate">{r.game_mode ?? '-'}</span> },
                    { key: 'status', header: '상태', render: (r) => <Pill tone={r.status === 'playing' ? 'emerald' : r.status === 'paused' ? 'amber' : 'slate'}>{r.status === 'playing' ? '진행' : r.status === 'paused' ? '멈춤' : '대기'}</Pill> },
                    { key: 'players', header: '학생', align: 'right', render: (r) => formatNumber(r.players) },
                    { key: 'created', header: '열린 지', align: 'right', render: (r) => timeAgo(r.created_at) },
                  ]}
                />
              </div>
            </Panel>
          </div>

          {db.errors.available ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="자주 난 화면 오류" description="최근 24시간, 같은 문구끼리 묶음" padded={false}>
                <div className="max-h-96 overflow-auto">
                  <DataTable
                compact
                    rows={db.errors.top}
                    rowKey={(e) => e.message}
                    empty={<EmptyState title="최근 24시간 오류가 없습니다" icon={<ShieldAlert className="h-5 w-5" />} />}
                    columns={[
                      { key: 'count', header: '건수', width: '4rem', align: 'right', render: (e) => <span className="font-semibold tabular-nums">{e.count}</span> },
                      { key: 'message', header: '오류', render: (e) => (
                        <div className="min-w-0">
                          <div className="break-words text-slate-800">{e.message}</div>
                          {e.paths.length > 0 && <div className="mt-0.5 truncate text-xs text-slate-400">{e.paths.join(', ')}</div>}
                        </div>
                      ) },
                      { key: 'last', header: '마지막', width: '6rem', align: 'right', render: (e) => timeAgo(e.lastAt) },
                    ]}
                  />
                </div>
              </Panel>
              <Panel title="최근 화면 오류" description="최근 40건" padded={false}>
                <div className="max-h-96 overflow-auto">
                  <DataTable
                compact
                    rows={db.errors.recent}
                    rowKey={(e) => e.id}
                    empty={<EmptyState title="최근 24시간 오류가 없습니다" />}
                    columns={[
                      { key: 'at', header: '시각', width: '6rem', render: (e) => <span className="tabular-nums text-slate-600">{clock(e.created_at)}</span> },
                      { key: 'message', header: '오류', render: (e) => (
                        <div className="min-w-0">
                          <div className="break-words text-slate-800">{e.message}</div>
                          <div className="mt-0.5 truncate text-xs text-slate-400">
                            {[e.kind, e.path, e.room_code && `방 ${e.room_code}`, e.nickname].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      ) },
                    ]}
                  />
                </div>
              </Panel>
            </div>
          ) : (
            <Banner tone="info">화면 오류 기록 표가 없습니다. sql/20261020_client_error_logs.sql 을 적용하면 여기에 보입니다.</Banner>
          )}
        </>
      )}

      {data && (
        <Panel title="웹 서버 (Vercel)" description="이 화면의 API를 처리한 함수">
          <KeyValue
            columns={2}
            items={[
              { label: '지역', value: data.web.region },
              { label: '환경', value: data.web.env },
              { label: '배포 커밋', value: data.web.commit ?? '-' },
              { label: 'Node', value: data.web.node },
              { label: '함수 시작', value: `${formatDateTime(data.web.functionStartedAt, 'long')} (${timeAgo(data.web.functionStartedAt)})` },
              { label: '함수 메모리', value: `${data.web.rssMB}MB (힙 ${data.web.heapMB}MB)` },
            ]}
          />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <KeyRound className="h-3.5 w-3.5" />
            Vercel 함수 로그·Supabase 대시보드 로그는 각 서비스 콘솔에서 봅니다. 이 화면은 중계 서버 기록과 DB 숫자로 부하를 보여 줍니다.
          </p>
        </Panel>
      )}
    </>
  )
}
