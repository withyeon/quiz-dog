import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 9주차 <T세포 매개 면역의 작동 기작> 핵심 20문제
const SET_ID = 'set-immunology-final-week9-2026'

const questionSet = {
  id: SET_ID,
  title: '면역학 기말 9주차 - T세포 매개 면역',
  description:
    'T세포 매개 면역 반응의 종류, CD4⁺ 작동 T림프구(Th1/Th2/Th17/Tfh)의 발달과 기능, CD8⁺ CTL의 분화와 살상 기전, 병원성 미생물의 면역 저항, T세포 협동·고갈을 다룬 객관식·OX·주관식 혼합 20문제. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['면역학', '기말', 'T세포', '세포매개면역', '9주차'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      'CD8⁺ 세포독성 T림프구(CTL)가 주로 제거하는 표적은?',
    options: [
      '감염 세포의 세포질에 존재하는 미생물',
      '대식세포 소낭(포식소체) 내부의 미생물',
      '혈중을 떠도는 세균 독소',
      '점막 표면에 부착한 연충(기생충)',
    ],
    answer: '감염 세포의 세포질에 존재하는 미생물',
  },
  {
    type: 'CHOICE',
    question_text:
      '세포 내 세균에 대한 방어 실험 결과로 옳지 않은 것은?',
    options: [
      '항체가 세포 내 세균 방어에 가장 효과적이다',
      '세포매개면역은 T림프구에 의해 전달된다',
      '세균의 실제 사멸은 활성화된 대식세포가 담당한다',
      '세포 내 세균 방어는 B림프구가 아닌 T림프구가 매개한다',
    ],
    answer: '항체가 세포 내 세균 방어에 가장 효과적이다',
  },
  {
    type: 'CHOICE',
    question_text:
      'Th1 세포의 특징적 사이토카인, 주된 표적세포, 숙주 방어 대상을 바르게 짝지은 것은?',
    options: [
      'IFN-γ — 큰포식세포 — 세포 내 병원체',
      'IL-4·IL-5 — 호산구 — 연충(기생충)',
      'IL-17 — 호중구 — 세포 외 세균·곰팡이',
      'IL-21 — B세포 — 세포 외 병원체(항체생산)',
    ],
    answer: 'IFN-γ — 큰포식세포 — 세포 내 병원체',
  },
  {
    type: 'CHOICE',
    question_text:
      '호산구·비만세포를 동원하여 연충(기생충) 방어를 담당하며 IL-4·IL-5·IL-13을 분비하는 CD4⁺ 아부류는?',
    options: ['Th2', 'Th1', 'Th17', 'Tfh'],
    answer: 'Th2',
  },
  {
    type: 'CHOICE',
    question_text:
      'IL-17·IL-22를 분비하여 호중구를 동원하고 세포 외 세균·곰팡이를 방어하는 CD4⁺ 아부류는?',
    options: ['Th17', 'Th1', 'Th2', 'Tfh'],
    answer: 'Th17',
  },
  {
    type: 'CHOICE',
    question_text:
      'T세포 사이토카인의 일반적 특성에 대한 설명으로 옳지 않은 것은?',
    options: [
      '한 번 생산되면 자극과 무관하게 지속적으로 대량 분비된다',
      '다면발현성(pleiotropism): 하나의 사이토카인이 복수의 생물학적 활성을 가진다',
      '중복성(redundancy): 여러 사이토카인이 유사한 활성을 공유한다',
      'autocrine·paracrine 방식으로 작용하여 국소 면역을 조절한다',
    ],
    answer: '한 번 생산되면 자극과 무관하게 지속적으로 대량 분비된다',
  },
  {
    type: 'CHOICE',
    question_text:
      '고전(M1) 큰포식세포 활성화와 대체(M2) 큰포식세포 활성화에 대한 설명으로 옳은 것은?',
    options: [
      'M1은 IFN-γ+CD40L로 유도되어 살균(ROS·NO)을 담당하고, M2는 IL-4+IL-13으로 유도되어 조직 회복·섬유증에 기여한다',
      'M1은 IL-4+IL-13으로 유도되어 콜라겐 합성을 증가시킨다',
      'M2는 IFN-γ로 유도되어 강력한 살균능을 가진다',
      'M1과 M2 모두 Th2 세포에 의해 유도된다',
    ],
    answer:
      'M1은 IFN-γ+CD40L로 유도되어 살균(ROS·NO)을 담당하고, M2는 IL-4+IL-13으로 유도되어 조직 회복·섬유증에 기여한다',
  },
  {
    type: 'CHOICE',
    question_text:
      'Th1 세포가 큰포식세포를 고전 경로로 활성화하는 데 함께 작용하는 두 신호는?',
    options: [
      'CD40L(CD154)과 IFN-γ',
      'IL-4와 IL-13',
      'PD-1과 CTLA-4',
      'IL-5와 IL-17',
    ],
    answer: 'CD40L(CD154)과 IFN-γ',
  },
  {
    type: 'CHOICE',
    question_text:
      'Th1 분화를 유도하는 신호 조합으로 가장 적절한 것은?',
    options: [
      'TCR 신호 + IL-12(STAT4) + IFN-γ(STAT1) → T-bet 발현',
      'TCR 신호 + IL-4(STAT6) → GATA-3 발현',
      'TCR 신호 + IL-6·IL-23(STAT3) + TGF-β → RORγT 발현',
      'TCR 신호 + IL-2 단독 → FOXP3 발현',
    ],
    answer: 'TCR 신호 + IL-12(STAT4) + IFN-γ(STAT1) → T-bet 발현',
  },
  {
    type: 'CHOICE',
    question_text:
      'Th2 분화에서 IL-4가 활성화하는 전사인자와 항원 신호와 협력해 발현을 유도하는 마스터 전사인자를 바르게 짝지은 것은?',
    options: [
      'STAT6 → GATA-3',
      'STAT4 → T-bet',
      'STAT3 → RORγT',
      'STAT1 → FOXP3',
    ],
    answer: 'STAT6 → GATA-3',
  },
  {
    type: 'CHOICE',
    question_text:
      'Th17 분화에 대한 설명으로 옳은 것은?',
    options: [
      'TGF-β가 IL-6 또는 IL-1과 함께 존재하면 RORγT 발현을 유도하여 Th17 분화를 촉진한다',
      'TGF-β는 단독으로 항상 Th17 분화를 촉진한다',
      'IL-12가 STAT4를 통해 Th17 분화를 결정한다',
      'Th17 분화에는 TCR 신호가 필요하지 않다',
    ],
    answer:
      'TGF-β가 IL-6 또는 IL-1과 함께 존재하면 RORγT 발현을 유도하여 Th17 분화를 촉진한다',
  },
  {
    type: 'CHOICE',
    question_text:
      'CTL의 퍼포린/그랜자임 살상 경로에 대한 설명으로 옳지 않은 것은?',
    options: [
      '수용체-리간드 결합만으로 작동하며 과립 분비가 전혀 필요 없다',
      '퍼포린이 표적세포 막에 구멍을 내어 그랜자임의 세포질 전달을 돕는다',
      '그랜자임이 caspase를 절단·활성화하여 세포자멸사를 유도한다',
      '면역시냅스 형성 후 MTOC가 재배치되어 과립이 표적세포 방향으로만 분비된다',
    ],
    answer: '수용체-리간드 결합만으로 작동하며 과립 분비가 전혀 필요 없다',
  },
  {
    type: 'CHOICE',
    question_text:
      'CTL의 Fas-FasL 경로에서 표적 세포 내부로 모집되어 카스파제-8 전구체를 모아 DISC(사멸 유도 신호 복합체)를 형성하는 어댑터 단백질은?',
    options: ['FADD', 'STAT4', 'CD40L', 'Properdin'],
    answer: 'FADD',
  },
  {
    type: 'CHOICE',
    question_text:
      '수지상세포가 감염 세포의 항원을 1형 MHC에 제시하여 CD8⁺ T세포 활성화에 기여하는 현상은?',
    options: ['교차제시(cross-presentation)', '연결인식', '클론제거', '항원 소변이'],
    answer: '교차제시(cross-presentation)',
  },
  {
    type: 'CHOICE',
    question_text:
      '병원성 미생물의 CTL 회피 기전과 그 예가 잘못 짝지어진 것은?',
    options: [
      'EBV — TAP transporter를 직접 차단하여 펩티드의 ER 운반을 막음',
      'HSV — ICP47 단백질이 TAP를 차단하여 MHC I-펩티드 복합체 형성 불가',
      'CMV — US11 단백질이 MHC I을 ER에서 세포질로 역전위시켜 분해',
      'Pox 바이러스 — 용해성 사이토카인 수용체를 생산해 IFN-γ를 중화',
    ],
    answer: 'EBV — TAP transporter를 직접 차단하여 펩티드의 ER 운반을 막음',
  },
  {
    type: 'CHOICE',
    question_text:
      '바이러스가 CTL 회피를 위해 1형 MHC 발현을 억제했을 때, 이를 인식하여 감염 세포를 제거하는 숙주의 대응 세포는?',
    options: ['NK세포', 'B림프구', 'Tfh세포', '비만세포'],
    answer: 'NK세포',
  },
  {
    type: 'CHOICE',
    question_text:
      '만성 바이러스 감염이나 암에서 지속적 항원 자극으로 T세포 반응이 일찍 종료되는 "T세포 고갈" 상태의 특징은?',
    options: [
      'PD-1, CTLA-4 등 저해수용체 발현이 증가하고 감염 세포에 반응하지 못한다',
      '사이토카인 분비와 증식 능력이 오히려 증강된다',
      '기억 T세포로의 분화가 가속화된다',
      '저해수용체 발현이 완전히 사라진다',
    ],
    answer:
      'PD-1, CTLA-4 등 저해수용체 발현이 증가하고 감염 세포에 반응하지 못한다',
  },
  {
    type: 'OX',
    question_text:
      '결핵성 나병은 Th1 반응이 우세할 때, 나종성 나병은 Th2 반응이 우세할 때 나타난다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      '나이브(숫) CD8⁺ T세포는 항원을 인식하기만 하면 별도의 공동자극이나 사이토카인 없이도 표적세포를 죽일 수 있다.',
    options: ['O', 'X'],
    answer: 'X',
  },
  {
    type: 'SHORT',
    question_text:
      'Th1 분화를 결정하는 마스터 전사인자의 이름을 쓰시오. (영문)',
    options: [],
    answer: 'T-bet',
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
