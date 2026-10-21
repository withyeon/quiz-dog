import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// neutral-v1 형식 JSON(세트 → 문항: question/context/choices/answer_index/explanation/source)을 문제 세트로 넣는다.
// 문제 테이블에는 context·source 칸이 없어서 context 는 문제 뒤에 줄바꿈해 붙이고 source 는 맨 끝에 [출처]로 붙인다.
// 정답은 앱 형식대로 보기 글자 그대로 저장한다(answer_index 는 0부터).
// 사용: ENV_FILE=/path/to/.env.local node scripts/import_neutral_quiz.mjs <json> [owner-email]
const OWNER_EMAIL = (process.argv[3] || 'withyeonedu@gmail.com').toLowerCase()
const jsonPath = process.argv[2]
if (!jsonPath) {
  console.error('사용법: node scripts/import_neutral_quiz.mjs <json> [owner-email]')
  process.exit(1)
}

// JSON 세트 id → 앱 세트 id·제목·태그. gc1~gc4 는 이미 있는 기출퀴즈 세트를 교체한다.
const TARGETS = {
  bj8: { id: 'set-byeonjeung-quiz-8', title: '한방병리 변증퀴즈 8. 총론·팔강 표리', tag: '변증' },
  bj9: { id: 'set-byeonjeung-quiz-9', title: '한방병리 변증퀴즈 9. 기혈변증 나머지', tag: '변증' },
  bj10: { id: 'set-byeonjeung-quiz-10', title: '한방병리 변증퀴즈 10. 오장병기 빈틈', tag: '변증' },
  gc1: { id: 'set-gichul-quiz-1', title: '한방병리 기출퀴즈 1. 총론·팔강·기병', tag: '기출' },
  gc2: { id: 'set-gichul-quiz-2', title: '한방병리 기출퀴즈 2. 혈병·진액', tag: '기출' },
  gc3: { id: 'set-gichul-quiz-3', title: '한방병리 기출퀴즈 3. 간·심', tag: '기출' },
  gc4: { id: 'set-gichul-quiz-4', title: '한방병리 기출퀴즈 4. 비·폐·신', tag: '기출' },
}

function loadEnv() {
  const envPath = process.env.ENV_FILE || path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1].trim()] = value
  }
}

function toQuestion(q) {
  if (!Number.isInteger(q.answer_index) || q.answer_index < 0 || q.answer_index >= q.choices.length) {
    throw new Error(`정답 위치가 범위를 벗어났습니다: ${q.question}`)
  }
  if (new Set(q.choices).size !== q.choices.length) throw new Error(`보기가 겹칩니다: ${q.question}`)
  let text = q.question
  if (q.context) text += `\n${q.context}`
  if (q.source) text += ` [${q.source}]`
  const isOx = q.choices.length === 2 && q.choices[0] === 'O' && q.choices[1] === 'X'
  return {
    type: isOx ? 'OX' : 'CHOICE',
    question_text: text,
    options: q.choices,
    answer: q.choices[q.answer_index],
    explanation: q.explanation,
  }
}

loadEnv()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

async function findOwnerId() {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const user = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL)
    if (user) return user.id
    if (data.users.length < 200) break
  }
  throw new Error(`${OWNER_EMAIL} 계정을 찾지 못했습니다.`)
}

async function run() {
  const input = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  const ownerId = await findOwnerId()
  console.log(`owner: ${ownerId}`)

  for (const src of input.sets) {
    const target = TARGETS[src.id]
    if (!target) throw new Error(`알 수 없는 세트: ${src.id}`)
    const questions = src.questions.map(toQuestion)

    const { error: setError } = await supabase.from('question_sets').upsert(
      {
        id: target.id,
        title: target.title,
        description: src.subtitle ?? null,
        subject: '기타',
        grade: '기타',
        tags: ['한방병리', target.tag],
        owner_id: ownerId,
        is_public: false,
      },
      { onConflict: 'id' },
    )
    if (setError) throw setError

    const { error: deleteError } = await supabase.from('questions').delete().eq('set_id', target.id)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase
      .from('questions')
      .insert(questions.map((question) => ({ set_id: target.id, ...question })))
    if (insertError) throw insertError

    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', target.id)
    if (countError) throw countError
    console.log(`${src.id} → ${target.title}: ${count}/${questions.length}문항`)
  }
}

run().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
