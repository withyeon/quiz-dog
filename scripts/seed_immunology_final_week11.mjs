import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 11주차 <체액면역의 작동기작> 핵심 20문제
const SET_ID = 'set-immunology-final-week11-2026'

const questionSet = {
  id: SET_ID,
  title: '면역학 기말 11주차 - 체액면역의 작동기작',
  description:
    '항체의 작동기능(중화·옵소닌화·보체)과 동형별 특성, FcRn, Fc수용체와 ADCC, 보체 3경로(고전·대체·렉틴)와 MAC·조절, 점막면역(IgA)·신생아 면역, 미생물의 체액면역 회피와 예방접종을 다룬 객관식·OX·주관식 혼합 20문제. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['면역학', '기말', '항체', '보체', '11주차'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      '항체가 Fab 부위와 Fc 부위로 수행하는 세 가지 주요 작동 기능에 해당하지 않는 것은?',
    options: ['체세포 과돌연변이', '중화(neutralization)', '옵소닌화(opsonization)', '보체 활성화'],
    answer: '체세포 과돌연변이',
  },
  {
    type: 'CHOICE',
    question_text:
      'FcRn(신생아 Fc수용체)의 두 가지 핵심 기능과 작동 원리로 옳은 것은?',
    options: [
      '산성 pH에서 IgG Fc에 결합하고 중성 pH에서 방출하여, IgG 혈청 반감기를 약 3주로 연장하고 모체 IgG를 태아에게 전달한다',
      '중성 pH에서 IgG에 결합하고 산성 pH에서 방출하여 IgA를 점막으로 운반한다',
      'IgM의 반감기를 연장하고 IgM을 태반으로 전달한다',
      'C3b에 결합하여 옵소닌화를 매개한다',
    ],
    answer:
      '산성 pH에서 IgG Fc에 결합하고 중성 pH에서 방출하여, IgG 혈청 반감기를 약 3주로 연장하고 모체 IgG를 태아에게 전달한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '항체에 의한 중화(neutralization)에 대한 설명으로 옳지 않은 것은?',
    options: [
      '항체가 포식세포의 Fc수용체에 결합하여 포식작용과 세포 내 사멸을 직접 강화하는 것을 의미한다',
      '항체가 바이러스 표면 단백질에 결합해 숙주세포 수용체 결합을 차단한다',
      '항-독소 항체가 독소의 세포 진입과 독성 작용을 막는다',
      '분비성 IgA가 점막에서 세균의 상피 부착을 차단한다',
    ],
    answer:
      '항체가 포식세포의 Fc수용체에 결합하여 포식작용과 세포 내 사멸을 직접 강화하는 것을 의미한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '옵소닌화에서 큰포식세포·호중구가 IgG의 Fc 부위에 결합하여 포식작용을 매개하는 고친화력 Fc수용체는?',
    options: ['FcγRI(CD64)', 'FcγRIIB(CD32)', 'FcγRIIIA(CD16)', 'FcεRI'],
    answer: 'FcγRI(CD64)',
  },
  {
    type: 'CHOICE',
    question_text:
      'NK세포가 IgG로 코팅된 표적세포를 인식하여 퍼포린/그랜자임으로 살해하는 ADCC에서 사용하는 Fc수용체는?',
    options: ['FcγRIIIA(CD16)', 'FcγRI(CD64)', 'FcεRI', 'FcγRIIB(CD32)'],
    answer: 'FcγRIIIA(CD16)',
  },
  {
    type: 'CHOICE',
    question_text:
      '유일한 억제성 Fc수용체로, B세포에서 BCR과 동시에 항원-항체 복합체에 결합하면 ITIM 신호로 B세포 활성화를 억제하는 것은?',
    options: ['FcγRIIB(CD32)', 'FcγRI(CD64)', 'FcγRIIIA(CD16)', 'FcεRI'],
    answer: 'FcγRIIB(CD32)',
  },
  {
    type: 'CHOICE',
    question_text:
      '보체 활성화 세 경로와 활성화 자극을 바르게 짝지은 것은?',
    options: [
      '고전경로 — 항원-항체 복합체(C1q) / 대체경로 — 미생물 표면(C3 자발적 가수분해) / 렉틴경로 — MBL+미생물 만노스',
      '고전경로 — 미생물 만노스 / 대체경로 — 항원-항체 복합체 / 렉틴경로 — C3 tick-over',
      '세 경로 모두 항원-항체 복합체에 의해서만 활성화된다',
      '고전경로만 선천면역에 속하고 대체·렉틴경로는 적응면역에 속한다',
    ],
    answer:
      '고전경로 — 항원-항체 복합체(C1q) / 대체경로 — 미생물 표면(C3 자발적 가수분해) / 렉틴경로 — MBL+미생물 만노스',
  },
  {
    type: 'CHOICE',
    question_text:
      '고전경로에서 C1q의 결합 특성에 대한 설명으로 옳은 것은?',
    options: [
      'IgG 또는 IgM이 항원에 결합한 후에만 Fc 부위에 결합하고 유리 항체에는 결합하지 않는다',
      '항원에 결합하지 않은 유리 항체에도 잘 결합한다',
      'IgA와 IgE의 Fc 부위에 우선적으로 결합한다',
      'C1q는 항체 없이 미생물 만노스에 직접 결합한다',
    ],
    answer:
      'IgG 또는 IgM이 항원에 결합한 후에만 Fc 부위에 결합하고 유리 항체에는 결합하지 않는다',
  },
  {
    type: 'CHOICE',
    question_text:
      '고전경로와 렉틴경로가 공통으로 형성하는 C3 전환효소와, 대체경로가 형성하는 C3 전환효소를 바르게 짝지은 것은?',
    options: [
      '고전·렉틴경로 — C4b2a / 대체경로 — C3bBb',
      '고전·렉틴경로 — C3bBb / 대체경로 — C4b2a',
      '세 경로 모두 C4b2a를 형성한다',
      '세 경로 모두 C3bBb를 형성한다',
    ],
    answer: '고전·렉틴경로 — C4b2a / 대체경로 — C3bBb',
  },
  {
    type: 'CHOICE',
    question_text:
      '대체경로에서 C3bBb 전환효소에 결합하여 이를 안정화시키는 단백질은?',
    options: ['Properdin(Factor P)', 'Factor H', 'DAF', 'C1 저해자'],
    answer: 'Properdin(Factor P)',
  },
  {
    type: 'CHOICE',
    question_text:
      '막공격복합체(MAC) 형성과 그 임상적 의의에 대한 설명으로 옳은 것은?',
    options: [
      'C5b6789(중합)이 세포막에 구멍을 내며, C5~C9 결핍 환자는 나이세리아(수막알균·임균) 감염에 취약하다',
      'C3b가 중합하여 MAC를 형성하며 모든 두꺼운 세포벽 세균에 효과적이다',
      'MAC는 옵소닌으로만 작용하고 직접적 세포 용해는 일으키지 않는다',
      'C1q가 MAC의 최종 구성 요소로 막에 삽입된다',
    ],
    answer:
      'C5b6789(중합)이 세포막에 구멍을 내며, C5~C9 결핍 환자는 나이세리아(수막알균·임균) 감염에 취약하다',
  },
  {
    type: 'CHOICE',
    question_text:
      '보체 분해산물 중 호중구 화학주성과 혈관 확장, 비만세포 탈과립을 유도하는 강력한 염증 매개자(아나필라톡신)는?',
    options: ['C3a와 C5a', 'C3b와 C4b', 'C9 중합체', 'Factor B'],
    answer: 'C3a와 C5a',
  },
  {
    type: 'CHOICE',
    question_text:
      '발작성 야간혈색소뇨(PNH)의 발생 기전으로 옳은 것은?',
    options: [
      'GPI 닻 단백질(DAF, CD59) 합성 효소가 후천적으로 결핍되어 적혈구 표면에서 보체 조절이 안 되어 용혈이 일어난다',
      'C3 결핍으로 보체 활성화 자체가 일어나지 않는다',
      'MBL 결핍으로 렉틴경로가 작동하지 않는다',
      'C1 저해자 결핍으로 고전경로가 과활성화된다',
    ],
    answer:
      'GPI 닻 단백질(DAF, CD59) 합성 효소가 후천적으로 결핍되어 적혈구 표면에서 보체 조절이 안 되어 용혈이 일어난다',
  },
  {
    type: 'CHOICE',
    question_text:
      'IgA의 상피 운반(poly-Ig 수용체) 기전과 분비성 성분(SC)의 역할로 옳은 것은?',
    options: [
      '이량체 IgA가 pIgR에 결합해 내강으로 운반되고, 절단된 분비성 성분(SC)이 단백질분해효소로부터 IgA를 보호한다',
      '단량체 IgA가 FcRn을 통해 점막으로 운반된다',
      '분비성 성분(SC)은 IgA를 분해하여 점막 면역을 종료시킨다',
      'IgM이 pIgR을 통해 점막으로 운반되어 sIgA를 형성한다',
    ],
    answer:
      '이량체 IgA가 pIgR에 결합해 내강으로 운반되고, 절단된 분비성 성분(SC)이 단백질분해효소로부터 IgA를 보호한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '신생아 면역과 항체 수준에 대한 설명으로 옳지 않은 것은?',
    options: [
      'IgM은 태반을 통과하므로 출생 시 신생아 IgM이 모체와 동일하게 높다',
      '모체 IgG는 태반 FcRn을 통해 임신 후기에 활발히 전달된다',
      '초유의 분비성 IgA가 신생아 장 점막면역을 제공한다',
      '생후 3~6개월은 모체 IgG가 소진되고 자체 생산이 부족한 최저 항체 수준 시기로 감염에 취약하다',
    ],
    answer:
      'IgM은 태반을 통과하므로 출생 시 신생아 IgM이 모체와 동일하게 높다',
  },
  {
    type: 'CHOICE',
    question_text:
      '미생물의 체액면역 회피 기전과 예가 잘못 짝지어진 것은?',
    options: [
      '사슬알균 — 항원 소변이/대변이로 매년 새로운 변이주 출현',
      '인플루엔자 — 항원 소변이(drift)·대변이(shift)',
      'HIV — gp120의 높은 돌연변이율로 다양한 변이주 생성',
      '사슬알균 — 히알루론산 협막으로 포식작용 차단',
    ],
    answer: '사슬알균 — 항원 소변이/대변이로 매년 새로운 변이주 출현',
  },
  {
    type: 'CHOICE',
    question_text:
      '협막을 가진 세균(폐렴알균·인플루엔자균·수막알균)에 대한 방어로, 결합백신이 유도하고자 하는 핵심 항체 작동기능은?',
    options: [
      '협막 다당류에 대한 IgG 생산을 통한 옵소닌화',
      'IgE를 통한 비만세포 탈과립',
      'IgM의 친화력 성숙',
      '분비성 IgA의 점막 격리',
    ],
    answer: '협막 다당류에 대한 IgG 생산을 통한 옵소닌화',
  },
  {
    type: 'OX',
    question_text:
      'IgM은 5량체 구조여서 항원 결합 부위가 이미 10개 존재하므로, 1개의 IgM만으로도 C1q가 결합하여 고전경로를 활성화할 수 있다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      '대체경로는 항체가 만들어지기 전 초기 감염 단계에서도 미생물 표면에서 즉각 활성화될 수 있는 선천면역 기작이다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'SHORT',
    question_text:
      '렉틴경로에서 미생물 표면의 만노스 잔기에 결합하여 경로를 개시하는, C1q와 구조적으로 유사한 콜렉틴의 이름(약어)을 쓰시오.',
    options: [],
    answer: 'MBL',
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
  console.log(`Seeding ${questionSet.title}: ${SET_ID} (${questions.length} questions)`)

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

  const { count, error: countError } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('set_id', SET_ID)

  if (countError) throw countError

  console.log(`  → inserted ${count ?? 0} questions`)
  console.log('Seed complete.')
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
