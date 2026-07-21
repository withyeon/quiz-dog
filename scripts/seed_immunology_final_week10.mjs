import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 10주차 <B림프구 활성화와 항체 생산> 핵심 20문제
const SET_ID = 'set-immunology-final-week10-2026'

const questionSet = {
  id: SET_ID,
  title: '면역학 기말 10주차 - B림프구 활성화와 항체 생산',
  description:
    '체액면역 반응의 단계와 유형(T의존/비의존, 1·2차 반응), BCR 신호전달, 보조 T림프구의 기능(연결인식·결합백신·CD40), 소포외/배중심 반응, 클래스전환(CSR)·친화력 성숙(SHM)·AID, 형질세포/기억B, 체액면역 조절을 다룬 객관식·OX·주관식 혼합 20문제. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['면역학', '기말', 'B림프구', '항체', '10주차'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      '클래스(동형)전환의 핵심 원리에 대한 설명으로 옳은 것은?',
    options: [
      '중사슬 불변(C) 영역이 변경되고 가변(V) 영역은 유지되어 항원 특이성은 그대로이고 작동기능만 바뀐다',
      '가변(V) 영역이 변경되어 항원 특이성이 새로 바뀐다',
      '클래스전환 후 이전 동형으로 자유롭게 되돌아갈 수 있다',
      'T비의존 반응에서 완전한 클래스전환이 일어난다',
    ],
    answer:
      '중사슬 불변(C) 영역이 변경되고 가변(V) 영역은 유지되어 항원 특이성은 그대로이고 작동기능만 바뀐다',
  },
  {
    type: 'CHOICE',
    question_text:
      '나이브(숫) B림프구가 발현하는 항원 수용체(BCR)에 대한 설명으로 옳은 것은?',
    options: [
      '세포막 IgM과 IgD를 발현하며 항원 인식 후 활성화되지만 항체는 분비하지 않는다',
      '세포막 IgG와 IgA를 발현하며 즉시 항체를 분비한다',
      '항원 수용체 없이 사이토카인 신호만으로 활성화된다',
      '클래스전환을 이미 완료한 IgE를 발현한다',
    ],
    answer:
      '세포막 IgM과 IgD를 발현하며 항원 인식 후 활성화되지만 항체는 분비하지 않는다',
  },
  {
    type: 'CHOICE',
    question_text:
      'T의존(TD) 항체 반응과 T비의존(TI) 항체 반응을 비교한 설명으로 옳지 않은 것은?',
    options: [
      'T비의존 반응은 단백질 항원에 대해 일어나며 강력한 친화력 성숙을 보인다',
      'T의존 반응은 IgG·IgA·IgE로의 클래스전환과 친화력 성숙이 일어난다',
      'T의존 반응은 소포 B세포가 주도하고 장수형질세포·기억B세포를 생성한다',
      'T비의존 반응은 주로 IgM을 생산하고 기억세포 생성이 미미하다',
    ],
    answer:
      'T비의존 반응은 단백질 항원에 대해 일어나며 강력한 친화력 성숙을 보인다',
  },
  {
    type: 'CHOICE',
    question_text:
      '2차 항체 반응이 1차 항체 반응과 다른 점으로 옳은 것은?',
    options: [
      '지체 기간이 짧고(1~3일) 주로 IgG가 증가하며 친화력이 더 높고 장수형질세포가 형성된다',
      '주요 항체 동형이 IgM이고 친화력이 더 낮다',
      '반응 최고점이 1차보다 작다',
      '기억세포가 거의 생성되지 않는다',
    ],
    answer:
      '지체 기간이 짧고(1~3일) 주로 IgG가 증가하며 친화력이 더 높고 장수형질세포가 형성된다',
  },
  {
    type: 'CHOICE',
    question_text:
      'BCR 복합체에서 세포질 영역에 ITAM을 보유하여 실제 신호전달을 담당하는 구성요소는?',
    options: [
      'Igα/Igβ 신호 아단위',
      '막 면역글로불린(mIg)의 항원 결합 부위',
      'CD21(CR2)',
      'FcγRIIB',
    ],
    answer: 'Igα/Igβ 신호 아단위',
  },
  {
    type: 'CHOICE',
    question_text:
      'BCR 신호전달에서 인산화된 ITAM에 모집되어 활성화되는, T세포의 ZAP-70에 해당하는 효소는?',
    options: ['SYK', 'AID', 'IMPDH', 'Calcineurin'],
    answer: 'SYK',
  },
  {
    type: 'CHOICE',
    question_text:
      'BCR 신호전달에 중요하며 유전자 돌연변이 시 X연관 무감마글로불린혈증(XLA)을 일으켜 B세포 발달이 차단되는 효소는?',
    options: ['BTK(Bruton 티로신 인산화효소)', 'AID', 'SHIP', 'MASP-2'],
    answer: 'BTK(Bruton 티로신 인산화효소)',
  },
  {
    type: 'CHOICE',
    question_text:
      'B세포 보조수용체 복합체(CD21/CD19/CD81)에서 미생물에 결합한 보체 분해산물 C3d와 결합하여 BCR 신호를 약 1000배까지 증폭시키는 역할을 하는 분자는?',
    options: [
      'CD21(보체 수용체 2, CR2)',
      'CD81',
      'Igα',
      'FcγRIIB',
    ],
    answer: 'CD21(보체 수용체 2, CR2)',
  },
  {
    type: 'CHOICE',
    question_text:
      '단백질 항원에 대한 항체 반응에서 B세포가 항원제시세포(APC)로 기능하는 과정 순서로 옳은 것은?',
    options: [
      'BCR로 항원 포획 → 내재화 → 엔도솜에서 펩티드로 처리 → MHC II에 제시',
      '항원을 비특이적 식작용으로 포획 → 세포질에서 처리 → MHC I에 제시',
      'BCR로 항원 포획 → 세포질 프로테아솜 처리 → MHC I에 제시',
      '사이토카인 신호만 받아 항원 처리 없이 T세포를 활성화',
    ],
    answer:
      'BCR로 항원 포획 → 내재화 → 엔도솜에서 펩티드로 처리 → MHC II에 제시',
  },
  {
    type: 'CHOICE',
    question_text:
      'B세포가 인식하는 에피토프와 T세포가 인식하는 에피토프가 같은 항원 분자 내에 있어야 한다는 원리로, 결합백신 설계의 기초가 되는 것은?',
    options: ['연결 인식(linked recognition)', '교차 제시', '항원 소변이', '가소성'],
    answer: '연결 인식(linked recognition)',
  },
  {
    type: 'CHOICE',
    question_text:
      '결합백신(conjugate vaccine)이 다당류 항원의 한계를 극복하는 핵심 원리는?',
    options: [
      '다당류 특이 B세포가 결합체의 단백질 부분을 처리·제시하여 T세포 도움을 얻어 T의존 반응으로 전환한다',
      '다당류 자체가 MHC에 결합하여 직접 T세포를 활성화한다',
      'T세포 도움 없이 IgM만 더 많이 생산하게 한다',
      '친화력 성숙을 억제하여 안정적인 항체를 만든다',
    ],
    answer:
      '다당류 특이 B세포가 결합체의 단백질 부분을 처리·제시하여 T세포 도움을 얻어 T의존 반응으로 전환한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '활성화된 보조 T세포에서 발현되어 B세포의 CD40에 결합함으로써 B세포 증식·클래스전환·생존 신호를 전달하는 분자는?',
    options: ['CD40L(CD154)', 'PD-L1', 'C3d', 'CXCL13'],
    answer: 'CD40L(CD154)',
  },
  {
    type: 'CHOICE',
    question_text:
      '사이토카인에 의한 클래스전환 방향 결정이 잘못 짝지어진 것은?',
    options: [
      'IFN-γ → IgE',
      'IL-4 → IgE',
      'TGF-β → IgA',
      'IFN-γ → IgG',
    ],
    answer: 'IFN-γ → IgE',
  },
  {
    type: 'CHOICE',
    question_text:
      '배중심(germinal center)의 암구역(dark zone)과 명구역(light zone)에 대한 설명으로 옳은 것은?',
    options: [
      '암구역에서 증식과 체세포 과돌연변이(SHM)로 다양한 친화력의 B세포가 생기고, 명구역에서 FDC 항원과 경쟁 결합·Tfh 생존신호로 고친화력 B세포가 선택된다',
      '명구역에서 SHM이 일어나고 암구역에서 항원 선택이 일어난다',
      '암구역에서는 클래스전환만, 명구역에서는 증식만 일어난다',
      '두 구역 모두 친화력 성숙과 무관하다',
    ],
    answer:
      '암구역에서 증식과 체세포 과돌연변이(SHM)로 다양한 친화력의 B세포가 생기고, 명구역에서 FDC 항원과 경쟁 결합·Tfh 생존신호로 고친화력 B세포가 선택된다',
  },
  {
    type: 'CHOICE',
    question_text:
      'AID(activation-induced cytidine deaminase) 효소에 대한 설명으로 옳지 않은 것은?',
    options: [
      'AID는 V 영역에만 작용하고 클래스전환(CSR)에는 관여하지 않는다',
      '시티딘을 우라실로 전환하는 cytidine deaminase이다',
      'CSR에서 S region의 C→U 전환으로 DNA 이중가닥 절단을 유도한다',
      'SHM에서 V 영역의 C→U 전환으로 점돌연변이를 유도한다',
    ],
    answer: 'AID는 V 영역에만 작용하고 클래스전환(CSR)에는 관여하지 않는다',
  },
  {
    type: 'CHOICE',
    question_text:
      '장수형질세포(long-lived plasma cell)의 특징으로 옳지 않은 것은?',
    options: [
      '세포 분열을 계속하며 배중심에 머물러 SHM을 반복한다',
      '골수 생존 적소(niche)에 정착하여 수개월~수년간 항체를 생산한다',
      'BCR 발현이 없고 항원 자극 없이도 생존한다',
      '골수 기질세포가 IL-6, APRIL 등 생존 인자를 공급한다',
    ],
    answer: '세포 분열을 계속하며 배중심에 머물러 SHM을 반복한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '항체 되먹임(antibody feedback)에서 IgG 면역복합체가 BCR과 동시에 교차결합하여 ITIM을 통해 B세포 활성화를 억제하는 억제성 Fc 수용체는?',
    options: ['FcγRIIB(CD32B)', 'FcγRI(CD64)', 'FcεRI', 'CD19'],
    answer: 'FcγRIIB(CD32B)',
  },
  {
    type: 'OX',
    question_text:
      '소포외(extrafollicular) 반응은 주로 IgM을 생산하며 친화력 성숙이 없고 단명형질세포를 만들어, 배중심 반응이 완성되기 전 초기 감염을 억제한다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      'X연관 고IgM증후군은 CD40L 유전자 돌연변이로 CD40 신호가 전달되지 못해 클래스전환이 불가능하여, 혈청에 IgM만 존재하고 IgG·IgA·IgE가 결핍된다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'SHORT',
    question_text:
      '배중심 명구역에서 B세포에 IL-21과 CD40L로 생존 신호를 제공하여 고친화력 B세포를 선택하는 데 핵심 역할을 하는 T세포의 이름(약어)을 쓰시오.',
    options: [],
    answer: 'Tfh',
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
