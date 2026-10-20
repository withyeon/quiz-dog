// 수업 점검 (터미널판). 관리자 '수업 점검' 페이지와 같은 자료를 터미널에서 본다.
//
//   node scripts/daily-check.mjs            어제 (한국 시간)
//   node scripts/daily-check.mjs today      오늘
//   node scripts/daily-check.mjs 2026-10-19 특정 날짜
//   node scripts/daily-check.mjs 7d         최근 7일을 하루씩
//
// .env.local 의 SUPABASE_SECRET_KEY 로 REST 를 직접 읽는다(읽기만 한다). 프로덕션 DB 이니 조심.
import fs from 'node:fs'
import path from 'node:path'

const envPath = path.join(process.cwd(), '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SECRET_KEY
if (!URL || !KEY) { console.error('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 가 필요합니다.'); process.exit(1) }

async function q(p) {
  const r = await fetch(`${URL}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!r.ok) throw new Error(`${p} → ${r.status} ${await r.text()}`)
  return r.json()
}
const KST = 9 * 36e5
const DAY = 864e5
const kst = (d) => new Date(new Date(d).getTime() + KST).toISOString()
const hhmm = (d) => kst(d).slice(11, 16)
const SCORE_NOT_ANSWER = new Set(['zombie', 'battle_royale'])

function parseArg(arg) {
  const today = kst(Date.now()).slice(0, 10)
  if (!arg) return [shift(today, -1)]
  if (arg === 'today') return [today]
  const m = arg.match(/^(\d+)d$/)
  if (m) return Array.from({ length: Number(m[1]) }, (_, i) => shift(today, -(Number(m[1]) - 1 - i)))
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return [arg]
  console.error('날짜 형식: today | YYYY-MM-DD | 7d'); process.exit(1)
}
function shift(date, days) { return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10) }

async function checkDay(date) {
  const start = new Date(new Date(`${date}T00:00:00Z`).getTime() - KST).toISOString()
  const end = new Date(new Date(start).getTime() + DAY).toISOString()
  const rooms = await q(`rooms?select=room_code,status,game_mode,set_id,owner_id,is_homework,created_at,started_at&created_at=gte.${start}&created_at=lt.${end}&order=created_at.asc`)
  const codes = rooms.map((r) => `"${r.room_code}"`).join(',')
  const [players, reports, ai, errors] = await Promise.all([
    rooms.length ? q(`players?select=room_code,nickname,score,answer_history&room_code=in.(${codes})&limit=5000`) : [],
    rooms.length ? q(`game_reports?select=room_code&room_code=in.(${codes})`) : [],
    q(`ai_generation_logs?select=user_id,source_type,question_count,created_at&created_at=gte.${start}&created_at=lt.${end}&order=created_at.asc`).catch(() => null),
    q(`client_error_logs?select=created_at,kind,message,path,room_code&created_at=gte.${start}&created_at=lt.${end}&order=created_at.desc&limit=500`).catch(() => null),
  ])
  const ids = [...new Set([...rooms.map((r) => r.owner_id), ...(ai ?? []).map((a) => a.user_id)].filter(Boolean))]
  const profiles = ids.length ? await q(`profiles?select=id,display_name&id=in.(${ids.join(',')})`).catch(() => []) : []
  const name = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]))
  const setIds = [...new Set(rooms.map((r) => r.set_id).filter(Boolean))]
  const sets = setIds.length ? await q(`question_sets?select=id,title&id=in.(${setIds.map((s) => `"${s}"`).join(',')})`).catch(() => []) : []
  const title = Object.fromEntries(sets.map((s) => [s.id, s.title]))
  const byRoom = {}
  for (const p of players) (byRoom[p.room_code] ??= []).push(p)
  const reported = new Set(reports.map((r) => r.room_code))

  const started = rooms.filter((r) => r.started_at)
  const students = players.length
  const teachers = new Set(rooms.map((r) => r.owner_id).filter(Boolean)).size
  console.log(`\n━━━ ${date} (${['일','월','화','수','목','금','토'][new Date(`${date}T00:00:00Z`).getUTCDay()]}) ━━━ 방 ${rooms.length} · 시작 ${started.length} · 학생 ${students} · 선생님 ${teachers}명 · AI ${ai ? ai.length + '회' : '표 없음'} · 오류 ${errors ? errors.length + '건' : '표 없음'}`)

  const flagged = []
  for (const r of rooms) {
    const ps = byRoom[r.room_code] ?? []
    const answered = ps.filter((p) => Array.isArray(p.answer_history) && p.answer_history.length > 0).length
    const zero = ps.filter((p) => (p.score ?? 0) === 0).length
    const flags = []
    if (!r.started_at && ps.length >= 3) flags.push('학생 있는데 시작 안 함')
    if (r.started_at && !r.is_homework && ps.length >= 2 && r.game_mode !== 'study') {
      if (answered === 0) flags.push('풀이 기록 없음')
      else if (!SCORE_NOT_ANSWER.has(r.game_mode) && zero / ps.length >= 0.5) flags.push(`0점 ${zero}/${ps.length}`)
    }
    if (r.started_at && ['finished', 'ended'].includes(r.status) && ps.length > 0 && !reported.has(r.room_code) && !r.is_homework) flags.push('게임 기록 없음')
    if (['playing', 'paused'].includes(r.status) && Date.now() - new Date(r.created_at).getTime() > 3 * 36e5) flags.push('3시간 넘게 진행 중')
    const line = `${hhmm(r.created_at)} ${r.room_code} ${(r.game_mode ?? '').padEnd(13)} 학생${String(ps.length).padStart(3)} 풀이${String(answered).padStart(3)} ${r.started_at ? '시작' : '    '} ${reported.has(r.room_code) ? '기록' : '    '} ${(name[r.owner_id] ?? (r.owner_id ? r.owner_id.slice(0, 8) : '비로그인')).padEnd(10)} ${(title[r.set_id] ?? '').slice(0, 28)}`
    if (ps.length >= 5 || flags.length) console.log(`  ${line}${flags.length ? '   ⚠ ' + flags.join(', ') : ''}`)
    if (flags.length) flagged.push(r.room_code)
  }
  if (rooms.length && !rooms.some((r) => (byRoom[r.room_code] ?? []).length >= 5) && !flagged.length) console.log('  (5명 이상 방 없음, 살펴볼 방 없음)')

  if (ai?.length) {
    console.log('  AI 생성:')
    for (const a of ai) console.log(`    ${hhmm(a.created_at)} ${a.source_type.padEnd(8)} ${String(a.question_count).padStart(2)}문제  ${name[a.user_id] ?? a.user_id.slice(0, 8)}`)
  }
  if (errors?.length) {
    const groups = new Map()
    for (const e of errors) { const k = `${e.kind}|${e.path ?? ''}|${e.message.slice(0, 120)}`; const g = groups.get(k) ?? { ...e, n: 0 }; g.n++; groups.set(k, g) }
    console.log('  화면 오류:')
    for (const g of [...groups.values()].sort((a, b) => b.n - a.n)) console.log(`    ×${String(g.n).padStart(3)} [${g.kind}] ${g.path ?? ''}  ${g.message.slice(0, 140).replace(/\s+/g, ' ')}`)
  }
}

for (const date of parseArg(process.argv[2])) await checkDay(date)
