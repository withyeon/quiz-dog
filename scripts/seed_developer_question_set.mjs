import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SET_ID = 'set-integrated-dev-dummy-20260505'

const questionSet = {
  id: SET_ID,
  title: '개발자 상식 더미 문제집',
  description:
    'QuizDog 기능 점검용 개발자 테마 더미 데이터입니다. 객관식, OX, 주관식, 빈칸 문제를 함께 저장합니다.',
  subject: '기타',
  grade: '기타',
  tags: ['개발자', '테스트', '더미데이터', '혼합유형'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text: 'HTTP 상태 코드 404가 의미하는 것은?',
    options: ['Bad Request', 'Unauthorized', 'Not Found', 'Internal Server Error'],
    answer: 'Not Found',
  },
  {
    type: 'CHOICE',
    question_text: 'Git에서 원격 저장소의 최신 변경을 가져오고 현재 브랜치에 병합하는 명령은?',
    options: ['git push', 'git pull', 'git reset', 'git stash'],
    answer: 'git pull',
  },
  {
    type: 'CHOICE',
    question_text: 'SQL에서 여러 행을 조건으로 걸러낼 때 주로 사용하는 절은?',
    options: ['ORDER BY', 'GROUP BY', 'WHERE', 'LIMIT'],
    answer: 'WHERE',
  },
  {
    type: 'CHOICE',
    question_text: 'React에서 리스트 렌더링 시 각 항목에 안정적으로 넣어야 하는 prop은?',
    options: ['ref', 'name', 'key', 'value'],
    answer: 'key',
  },
  {
    type: 'OX',
    question_text: 'TypeScript는 JavaScript의 상위 호환 언어다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text: 'const로 선언한 객체는 내부 속성도 절대 수정할 수 없다.',
    options: ['O', 'X'],
    answer: 'X',
  },
  {
    type: 'SHORT',
    question_text: '분산 버전 관리 시스템으로 가장 널리 쓰이는 도구 이름은?',
    options: [],
    answer: 'Git',
  },
  {
    type: 'SHORT',
    question_text: '웹 브라우저가 HTML, CSS, JavaScript를 해석해 화면을 그리는 과정을 보통 무엇이라고 부르나요?',
    options: [],
    answer: '렌더링',
  },
  {
    type: 'BLANK',
    question_text: 'REST API에서 서버 내부 오류를 뜻하는 대표 상태 코드는 {{blank}}입니다.',
    options: [],
    answer: '500',
  },
  {
    type: 'BLANK',
    question_text: 'SQL에서 모든 컬럼을 조회할 때는 SELECT {{blank}} FROM 테이블; 형태를 사용합니다.',
    options: [],
    answer: '*',
  },
  {
    type: 'CHOICE',
    question_text: 'JSON에서 배열을 나타내는 기호는?',
    options: ['{ }', '( )', '[ ]', '< >'],
    answer: '[ ]',
  },
  {
    type: 'BLANK',
    question_text: 'Unix 계열 터미널에서 현재 작업 디렉터리를 출력하는 명령은 {{blank}} 입니다.',
    options: [],
    answer: 'pwd',
  },
]

const rooms = [
  {
    room_code: 'DEV001',
    status: 'waiting',
    current_q_index: 0,
    game_mode: 'gold_quest',
    set_id: SET_ID,
  },
  {
    room_code: 'DEVDOWN',
    status: 'waiting',
    current_q_index: 0,
    game_mode: 'dontlookdown',
    set_id: SET_ID,
  },
]

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
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log(`Seeding developer question set: ${SET_ID}`)

  const { error: setError } = await supabase
    .from('question_sets')
    .upsert(questionSet, { onConflict: 'id' })

  if (setError) throw setError

  const { error: deleteError } = await supabase
    .from('questions')
    .delete()
    .eq('set_id', SET_ID)

  if (deleteError) throw deleteError

  const { error: questionError } = await supabase.from('questions').insert(
    questions.map((question) => ({
      set_id: SET_ID,
      ...question,
    }))
  )

  if (questionError) throw questionError

  const { error: roomError } = await supabase
    .from('rooms')
    .upsert(rooms, { onConflict: 'room_code' })

  if (roomError) throw roomError

  const { count, error: countError } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('set_id', SET_ID)

  if (countError) throw countError

  const { data: savedSet, error: savedSetError } = await supabase
    .from('question_sets')
    .select('id, title, subject, grade')
    .eq('id', SET_ID)
    .single()

  if (savedSetError) throw savedSetError

  console.log('Seed complete.')
  console.log(savedSet)
  console.log(`Inserted questions: ${count ?? 0}`)
  console.log(`Rooms ready: ${rooms.map((room) => room.room_code).join(', ')}`)
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
