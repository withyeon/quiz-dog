import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 객관식(CHOICE) 보기 순서를 섞는다. answer 문자열은 그대로 유지.
// OX/SHORT는 건드리지 않는다.
const SET_IDS = [
  'set-microbiology-final-2026',
  'set-micro-ch12',
  'set-micro-ch15',
  'set-micro-ch16',
  'set-micro-ch17',
  'set-micro-ch18',
  'set-micro-ch19',
  'set-micro-ch20',
  'set-micro-ch21',
  'set-immuno-w9',
  'set-immuno-w10',
  'set-immuno-w11',
  'set-immuno-w12',
  'set-immuno-w13',
]

// id 문자열을 시드로 한 결정론적 PRNG (mulberry32)
function seededRng(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function loadEnv() {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
    const envFile = fs.readFileSync(envPath, 'utf8')
    for (const line of envFile.split('\n')) {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    console.warn('Warning: Could not load .env.local manually.')
  }
}

loadEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or service key.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('questions')
    .select('id, type, options, answer, set_id')
    .in('set_id', SET_IDS)

  if (error) throw error

  let updated = 0
  const posCount = {}

  for (const q of data) {
    if (q.type !== 'CHOICE' || !Array.isArray(q.options) || q.options.length < 2) continue

    const rng = seededRng(String(q.id))
    const others = shuffle(
      q.options.filter((o) => o !== q.answer),
      rng
    )
    // 정답을 시드로 정한 위치에 삽입 → 0번 포함 고르게 분포
    const target = Math.floor(rng() * q.options.length)
    const shuffled = [...others]
    shuffled.splice(target, 0, q.answer)

    const idx = shuffled.indexOf(q.answer)
    posCount[idx] = (posCount[idx] || 0) + 1

    const { error: upErr } = await supabase
      .from('questions')
      .update({ options: shuffled })
      .eq('id', q.id)

    if (upErr) throw upErr
    updated++
  }

  console.log(`Updated ${updated} CHOICE questions.`)
  console.log('정답 위치 분포(0-indexed):', posCount)
}

run().catch((e) => {
  console.error('Failed:', e)
  process.exit(1)
})
