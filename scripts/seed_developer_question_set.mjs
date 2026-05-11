import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SET_ID = 'set-integrated-dev-dummy-20260505'

const questionSet = {
  id: SET_ID,
  title: '교사 상식 퀴즈',
  description:
    'QuizDog 기능 점검용 쉬운 교사 상식 문제집입니다. 객관식, OX, 주관식, 빈칸 문제를 함께 저장합니다.',
  subject: '기타',
  grade: '기타',
  tags: ['교사', '상식', '테스트', '쉬움', '혼합유형'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text: '수업 시작 전에 가장 먼저 확인하면 좋은 것은?',
    options: ['출석과 수업 준비', '급식 메뉴', '운동장 모래', '학교 종'],
    answer: '출석과 수업 준비',
  },
  {
    type: 'CHOICE',
    question_text: '학생이 다쳤을 때 가장 먼저 해야 할 일은?',
    options: ['안전 상태 확인', '숙제 검사', '자리 바꾸기', '칠판 지우기'],
    answer: '안전 상태 확인',
  },
  {
    type: 'CHOICE',
    question_text: '학생 이름과 출결을 기록하는 데 주로 쓰는 것은?',
    options: ['출석부', '운동화', '우산', '물통'],
    answer: '출석부',
  },
  {
    type: 'CHOICE',
    question_text: '학부모에게 학교 안내 내용을 전달할 때 많이 사용하는 것은?',
    options: ['가정통신문', '체육복', '분필 상자', '교실 시계'],
    answer: '가정통신문',
  },
  {
    type: 'OX',
    question_text: '교사는 학생의 질문을 끝까지 듣고 답해 주는 것이 좋다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text: '복도에서 뛰는 학생을 보면 안전을 위해 천천히 걷도록 안내하는 것이 좋다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text: '시험지를 나눠 줄 때 정답지도 함께 나눠 주는 것이 좋다.',
    options: ['O', 'X'],
    answer: 'X',
  },
  {
    type: 'SHORT',
    question_text: '학생이 아프다고 할 때 도움을 받을 수 있는 학교 장소는?',
    options: [],
    answer: '보건실',
  },
  {
    type: 'SHORT',
    question_text: '수업 시간에 선생님이 설명을 적는 큰 판은?',
    options: [],
    answer: '칠판',
  },
  {
    type: 'BLANK',
    question_text: '수업을 시작할 때 학생이 왔는지 확인하는 일을 {{blank}} 확인이라고 합니다.',
    options: [],
    answer: '출석',
  },
  {
    type: 'BLANK',
    question_text: '학생이 잘한 일을 발견하면 {{blank}}해 주면 좋습니다.',
    options: [],
    answer: '칭찬',
  },
  {
    type: 'CHOICE',
    question_text: '교실에서 불이 났을 때 가장 알맞은 행동은?',
    options: ['선생님 안내에 따라 대피하기', '혼자 숨어 있기', '창문만 닫기', '책상 정리하기'],
    answer: '선생님 안내에 따라 대피하기',
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
  console.log(`Seeding teacher question set: ${SET_ID}`)

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
