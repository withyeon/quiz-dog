// 중계 서버 부하 측정기. 방마다 학생 N명 + 교사 화면 1개를 실제 WebSocket 클라이언트로 띄우고,
// 앱과 같은 규칙으로 메시지를 보낸다. (/dev 봇은 자기 탭 안에서만 이벤트를 흘려서 네트워크 부하를 만들지 못한다)
//
//   node relay/loadtest.mjs --rooms 10 --mode quiz --seconds 60
//   node relay/loadtest.mjs --rooms 5 --mode dld --seconds 60 --procs 4
//
// 규칙
//   quiz: 학생마다 평균 6초(최소 1.5초)에 한 문제 → player:patch 1개. 45초마다 presence 하트비트, 25초마다 앱 핑.
//   dld : 60%는 움직이는 중(평균 6초 유지), 나머지는 멈춤(평균 4초). 움직이면 300ms, 멈추면 1.5초마다 좌표,
//         움직이는 동안 2초마다 player:patch(점수·에너지).
// 결과: 서버 /metrics(CPU·메모리·초당 메시지)를 5초마다 모은 평균과, 교사 화면이 받은 이벤트의 지연(p50/p95/p99).

import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { monitorEventLoopDelay } from 'node:perf_hooks'

const require = createRequire(import.meta.url)
const WebSocket = require('ws')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]
  }
  return {
    url: out.url || 'ws://127.0.0.1:8787',
    rooms: Number(out.rooms || 5),
    students: Number(out.students || 25),
    mode: out.mode || 'quiz',
    seconds: Number(out.seconds || 60),
    warmup: Number(out.warmup || 10),
    procs: Number(out.procs || 4),
    meanGap: Number(out['mean-gap'] || 6),
    moving: Number(out.moving || 0.6),
  }
}

const expo = (mean) => -Math.log(1 - Math.random()) * mean

// ─── worker: 맡은 방들의 클라이언트를 돌린다 ────────────────────────────────────

function runWorker(cfg, roomCodes) {
  const latencies = []
  const posLatencies = []
  let received = 0
  let sent = 0
  let connected = 0
  const sockets = []
  const timers = []
  const loop = monitorEventLoopDelay({ resolution: 10 })
  loop.enable()
  let measuring = false
  setTimeout(() => {
    measuring = true
    loop.reset()
  }, cfg.warmup * 1000)

  const at = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timers.push(id)
  }

  function makeClient(room, index, role) {
    const clientId = `${room}-${role}-${index}-${Math.random().toString(36).slice(2, 8)}`
    const playerId = role === 'student' ? `p-${room}-${index}` : null
    const ws = new WebSocket(cfg.url)
    sockets.push(ws)
    let seq = 0
    let score = 0
    const meta = () => ({ clientId, role, playerId, onlineAt: 'load', lastSeenAt: new Date().toISOString() })
    const send = (type, payload) => {
      if (ws.readyState !== 1) return
      seq += 1
      sent += 1
      ws.send(JSON.stringify({
        t: 'ev',
        r: seq,
        e: { type, roomCode: room, clientId, playerId, sentAt: new Date().toISOString(), seq, payload },
      }))
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'join', room, clientId, meta: meta() }))
    })
    ws.on('message', (data) => {
      received += 1
      if (role !== 'teacher' || !measuring) return
      const msg = JSON.parse(data.toString())
      const now = Date.now()
      if (msg.t === 'ev' && msg.e.payload && typeof msg.e.payload._t === 'number') latencies.push(now - msg.e.payload._t)
      else if (msg.t === 'pos') posLatencies.push(now - msg.at)
    })
    ws.on('error', () => {})

    const onJoined = () => {
      connected += 1
      // 45초 presence 하트비트, 25초 앱 핑
      const hb = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ t: 'track', meta: meta() })), 45_000)
      const ping = setInterval(() => ws.readyState === 1 && ws.send('{"t":"ping"}'), 25_000)
      timers.push(hb, ping)
      if (role !== 'student') return

      if (cfg.mode === 'quiz') {
        const answer = () => {
          score += 100
          send('player:patch', {
            playerId,
            patch: { score, gold: score * 2, combo_count: seq % 5, current_question_index: seq },
            reason: 'quiz_answer',
            _t: Date.now(),
          })
          at(answer, Math.max(1.5, expo(cfg.meanGap)) * 1000)
        }
        at(answer, expo(cfg.meanGap) * 1000)
      } else {
        let moving = Math.random() < cfg.moving
        let switchAt = Date.now() + expo(moving ? 6 : 4) * 1000
        let lastPatch = 0
        let x = 200
        let y = 500
        const tick = () => {
          const now = Date.now()
          if (now > switchAt) {
            moving = Math.random() < cfg.moving
            switchAt = now + expo(moving ? 6 : 4) * 1000
          }
          if (moving) {
            x += Math.round((Math.random() - 0.5) * 40)
            y -= Math.round(Math.random() * 20)
          }
          send('dontlookdown:pos', {
            x, y, vx: moving ? 120 : 0, vy: moving ? -300 : 0,
            facingRight: true, isOnGround: !moving, height: Math.max(0, 500 - y), energy: 50,
          })
          if (moving && now - lastPatch >= 2000) {
            lastPatch = now
            send('player:patch', { playerId, patch: { score: Math.max(0, 500 - y), gold: 50 }, reason: 'dontlookdown_score_sync', _t: now })
          }
          at(tick, moving ? 300 : 1500)
        }
        at(tick, Math.random() * 300)
      }
    }
    ws.once('message', (data) => {
      if (JSON.parse(data.toString()).t === 'joined') onJoined()
    })
  }

  // 접속 폭주로 측정이 흔들리지 않게 초당 400개씩 붙인다
  let delay = 0
  for (const room of roomCodes) {
    for (let i = 0; i < cfg.students; i += 1) {
      at(() => makeClient(room, i, 'student'), delay)
      delay += 2.5
    }
    at(() => makeClient(room, 0, 'teacher'), delay)
    delay += 2.5
  }

  setTimeout(() => {
    timers.forEach((id) => {
      clearTimeout(id)
      clearInterval(id)
    })
    sockets.forEach((ws) => ws.terminate())
    process.send({
      latencies,
      posLatencies,
      received,
      sent,
      connected,
      loopP99Ms: loop.percentile(99) / 1e6,
    })
    setTimeout(() => process.exit(0), 100)
  }, (cfg.warmup + cfg.seconds) * 1000)
}

// ─── parent: 워커를 띄우고 서버 지표를 모은다 ──────────────────────────────────

function pct(sorted, p) {
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

async function runParent(cfg) {
  const httpBase = cfg.url.replace(/^ws/, 'http')
  const roomCodes = Array.from({ length: cfg.rooms }, (_, i) => `LT${String(i).padStart(4, '0')}`)
  const procs = Math.max(1, Math.min(cfg.procs, cfg.rooms))
  const slices = Array.from({ length: procs }, (_, p) => roomCodes.filter((_, i) => i % procs === p))

  const samples = []
  const metricsTimer = setInterval(async () => {
    try {
      samples.push({ at: Date.now(), ...(await (await fetch(`${httpBase}/metrics`)).json()) })
    } catch {
      // 서버가 잠깐 바쁘면 건너뛴다
    }
  }, 5000)
  await fetch(`${httpBase}/metrics`).catch(() => {}) // 기준점 리셋
  const startedAt = Date.now()

  const results = await Promise.all(slices.map((rooms) => new Promise((resolve) => {
    const child = fork(fileURLToPath(import.meta.url), ['--worker'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
    child.on('message', resolve)
    child.send({ cfg, rooms })
  })))
  clearInterval(metricsTimer)

  const measured = samples.filter((s) => s.at - startedAt > (cfg.warmup + 5) * 1000)
  const avg = (key) => measured.length ? Math.round(measured.reduce((a, s) => a + s[key], 0) / measured.length * 10) / 10 : null
  const max = (key) => measured.length ? Math.max(...measured.map((s) => s[key])) : null
  const lat = results.flatMap((r) => r.latencies).sort((a, b) => a - b)
  const posLat = results.flatMap((r) => r.posLatencies).sort((a, b) => a - b)

  const summary = {
    mode: cfg.mode,
    rooms: cfg.rooms,
    clients: cfg.rooms * (cfg.students + 1),
    connected: results.reduce((a, r) => a + r.connected, 0),
    server: {
      conns: max('conns'),
      inPerSec: avg('inPerSec'),
      outPerSec: avg('outPerSec'),
      outPerSecMax: max('outPerSec'),
      kbOutPerSec: avg('bytesOutPerSec') === null ? null : Math.round(avg('bytesOutPerSec') / 1024),
      cpuPctAvg: avg('cpuPct'),
      cpuPctMax: max('cpuPct'),
      rssMBMax: max('rssMB'),
      loopDelayP99MsMax: max('loopDelayP99Ms'),
      droppedPerSec: avg('droppedPerSec'),
      rateLimitedPerSec: avg('rateLimitedPerSec'),
    },
    latencyMs: { samples: lat.length, p50: pct(lat, 0.5), p95: pct(lat, 0.95), p99: pct(lat, 0.99), max: lat.at(-1) ?? null },
    posBatchLatencyMs: posLat.length ? { samples: posLat.length, p50: pct(posLat, 0.5), p95: pct(posLat, 0.95), p99: pct(posLat, 0.99) } : null,
    generatorLoopP99MsMax: Math.round(Math.max(...results.map((r) => r.loopP99Ms)) * 10) / 10,
  }
  console.log(JSON.stringify(summary))
}

if (process.argv.includes('--worker')) {
  process.once('message', ({ cfg, rooms }) => runWorker(cfg, rooms))
} else {
  runParent(parseArgs(process.argv.slice(2)))
}
