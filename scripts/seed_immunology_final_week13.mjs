import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 13주차 <종양과 이식장기에 대한 면역> 핵심 20문제
const SET_ID = 'set-immunology-final-week13-2026'

const questionSet = {
  id: SET_ID,
  title: '면역학 기말 13주차 - 종양과 이식 면역',
  description:
    '면역감시, 종양항원의 유형, 종양 거부의 면역기작과 회피, 단클론항체·적응T세포·CAR-T·면역관문억제제·종양백신, 이식항원과 동종인식, 이식 거부 3종, 면역억제 약물, 조혈줄기세포 이식과 GVHD/GVL을 다룬 객관식·OX·주관식 혼합 20문제. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['면역학', '기말', '종양면역', '이식', '13주차'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      '면역감시(immune surveillance)와 암·이식 면역의 치료 목표에 대한 설명으로 옳은 것은?',
    options: [
      '암과 이식 모두 "자기와 유전적으로 다른 세포"에 대한 반응이나, 암에서는 면역 증강이, 이식에서는 면역 억제가 치료 목표이다',
      '암에서는 면역 억제가, 이식에서는 면역 증강이 치료 목표이다',
      '암과 이식 모두 면역 억제가 치료 목표이다',
      '면역감시는 선천면역만 관여하며 적응면역은 무관하다',
    ],
    answer:
      '암과 이식 모두 "자기와 유전적으로 다른 세포"에 대한 반응이나, 암에서는 면역 증강이, 이식에서는 면역 억제가 치료 목표이다',
  },
  {
    type: 'CHOICE',
    question_text:
      '종양항원 중, 무작위 돌연변이로 생긴 새로운 단백질로 정상세포에 없어 관용을 유도하지 않으며 적응면역의 가장 일반적인 표적이 되는 것은?',
    options: ['신생항원(neoantigen)', '과발현 정상 단백질', '조직 특이 단백질', '바이러스 산물'],
    answer: '신생항원(neoantigen)',
  },
  {
    type: 'CHOICE',
    question_text:
      '종양항원 유형과 예가 잘못 짝지어진 것은?',
    options: [
      '증폭·과발현 정상 단백질 — EBV(EBNA), HPV(E6, E7)',
      '비정상 발현 정상 단백질 — 암/고환 항원, CEA, AFP',
      '증폭·과발현 정상 단백질 — 유방암 HER2',
      '종양발생 바이러스 산물 — EBV(EBNA), HPV(E6, E7)',
    ],
    answer: '증폭·과발현 정상 단백질 — EBV(EBNA), HPV(E6, E7)',
  },
  {
    type: 'CHOICE',
    question_text:
      '종양 근절의 주요 면역기작인 CTL 활성화에서, 수지상세포가 종양항원을 프로테아솜으로 처리해 1형 MHC에 제시하여 나이브 CD8⁺ T세포를 활성화하는 과정은?',
    options: ['교차제시(cross-presentation)', '직접 동종인식', '분자모방', '옵소닌화'],
    answer: '교차제시(cross-presentation)',
  },
  {
    type: 'CHOICE',
    question_text:
      '종양의 면역 회피 기전에 해당하지 않는 것은?',
    options: [
      'MHC class I 발현을 증가시켜 CD8 T세포에 항원을 과도하게 제시',
      'β2-microglobulin 돌연변이 등으로 1형 MHC 결핍 → 항원 제시 실패',
      '항원 소실 변종 선택으로 면역 표적 항원 자체를 소실',
      'PD-L1 발현 및 TGF-β·IL-10 등 면역억제 사이토카인 분비',
    ],
    answer:
      'MHC class I 발현을 증가시켜 CD8 T세포에 항원을 과도하게 제시',
  },
  {
    type: 'CHOICE',
    question_text:
      '단클론항체 항암제와 표적 항원이 잘못 짝지어진 것은?',
    options: [
      'Cetuximab(얼비툭스) — CD20',
      'Trastuzumab(허셉틴) — HER2(ErbB2)',
      'Rituximab(맙테라) — CD20',
      'Cetuximab(얼비툭스) — EGFR',
    ],
    answer: 'Cetuximab(얼비툭스) — CD20',
  },
  {
    type: 'CHOICE',
    question_text:
      '항체 매개 종양 죽임 기작에 해당하지 않는 것은?',
    options: [
      '항체가 종양항원에 결합하여 동종반응 T세포를 직접 활성화',
      '보체 활성화 → MAC로 종양세포 용해',
      'NK세포의 ADCC로 종양세포 죽임',
      '성장 수용체(예: HER2) 신호 차단으로 증식 억제',
    ],
    answer: '항체가 종양항원에 결합하여 동종반응 T세포를 직접 활성화',
  },
  {
    type: 'CHOICE',
    question_text:
      'CAR-T 세포 치료에 대한 설명으로 옳지 않은 것은?',
    options: [
      'CAR는 MHC에 제시된 펩티드만 인식할 수 있어 MHC 소실 종양에는 효과가 없다',
      'CAR의 세포 외 도메인은 항체 유래 scFv(VH+VL)로 종양항원을 직접 인식한다',
      'CD3ζ 신호 도메인과 CD28 또는 4-1BB 공동자극 도메인을 포함한다',
      'CD19 표적 CAR-T는 B세포 급성 림프구성 백혈병(ALL)에 사용되며 사이토카인 폭풍이 부작용으로 나타날 수 있다',
    ],
    answer:
      'CAR는 MHC에 제시된 펩티드만 인식할 수 있어 MHC 소실 종양에는 효과가 없다',
  },
  {
    type: 'CHOICE',
    question_text:
      '항-CTLA-4 항체(ipilimumab)의 작용 기전으로 옳은 것은?',
    options: [
      'CTLA-4를 차단하여 B7이 CD28과 결합하게 함으로써 B7-CD28 공동자극 신호를 회복시켜 T세포를 활성화한다',
      'PD-1과 PD-L1의 결합을 차단하여 말초 종양 부위에서 T세포 소진을 역전시킨다',
      'CTLA-4를 활성화하여 T세포 활성화를 억제한다',
      'B7을 직접 차단하여 T세포 활성화를 막는다',
    ],
    answer:
      'CTLA-4를 차단하여 B7이 CD28과 결합하게 함으로써 B7-CD28 공동자극 신호를 회복시켜 T세포를 활성화한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '항-CTLA-4 차단과 항-PD-1/PD-L1 차단의 작용 위치 차이에 대한 설명으로 옳은 것은?',
    options: [
      'CTLA-4 차단은 림프절에서 T세포 초기 활성화 단계에, PD-1/PD-L1 차단은 말초(종양 부위)에서 이미 활성화된 T세포의 소진 역전에 작용한다',
      'CTLA-4 차단은 말초에서, PD-1/PD-L1 차단은 림프절에서 작용한다',
      '두 경로 모두 림프절에서만 작용한다',
      '두 경로를 병용하면 효과가 상쇄된다',
    ],
    answer:
      'CTLA-4 차단은 림프절에서 T세포 초기 활성화 단계에, PD-1/PD-L1 차단은 말초(종양 부위)에서 이미 활성화된 T세포의 소진 역전에 작용한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '종양항원 예방접종에서 "예방적 백신"에 해당하는 것은?',
    options: [
      'HPV 백신 — 종양발생 바이러스 감염 자체를 차단하여 자궁경부암 예방',
      'DC 백신 — 이미 발생한 전립샘암에 대한 면역반응 강화',
      '신생항원 기반 개인 맞춤 백신 — 이미 발생한 종양 제거',
      'CAR-T 치료 — 환자 T세포 재설계',
    ],
    answer:
      'HPV 백신 — 종양발생 바이러스 감염 자체를 차단하여 자궁경부암 예방',
  },
  {
    type: 'CHOICE',
    question_text:
      '동종이식(allograft) 거부반응의 가장 중요한 동종항원 원천은?',
    options: [
      'MHC(HLA) 분자의 다형성',
      '적혈구 표면의 Rh 항원',
      '바이러스 신생항원',
      '공생미생물 항원',
    ],
    answer: 'MHC(HLA) 분자의 다형성',
  },
  {
    type: 'CHOICE',
    question_text:
      '직접 동종인식과 간접 동종인식을 비교한 설명으로 옳은 것은?',
    options: [
      '직접 동종인식은 공여자 DC가 동종 MHC를 제시해 CD8⁺ T세포(CTL)를 활성화(주로 급성 거부), 간접 동종인식은 수여자 DC가 공여자 MHC를 처리·제시해 CD4⁺ T세포를 활성화(주로 만성 거부)한다',
      '직접 동종인식은 수여자 DC가, 간접 동종인식은 공여자 DC가 APC로 작용한다',
      '두 경로 모두 CD8⁺ T세포만 활성화한다',
      '직접 동종인식은 만성 거부, 간접 동종인식은 급성 거부에 주로 관여한다',
    ],
    answer:
      '직접 동종인식은 공여자 DC가 동종 MHC를 제시해 CD8⁺ T세포(CTL)를 활성화(주로 급성 거부), 간접 동종인식은 수여자 DC가 공여자 MHC를 처리·제시해 CD4⁺ T세포를 활성화(주로 만성 거부)한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '동종반응 T세포의 빈도가 특정 외래 항원에 반응하는 T세포보다 훨씬 높은(1~10%) 이유는?',
    options: [
      '가슴샘에서 자기 MHC에 양성 선택된 T세포 중 일부가 구조적으로 유사한 동종 MHC와 교차반응하기 때문',
      '동종 MHC가 모든 T세포를 비특이적으로 활성화하기 때문',
      '동종항원이 공동자극 없이도 T세포를 활성화하기 때문',
      '이식편이 항체를 직접 분비하기 때문',
    ],
    answer:
      '가슴샘에서 자기 MHC에 양성 선택된 T세포 중 일부가 구조적으로 유사한 동종 MHC와 교차반응하기 때문',
  },
  {
    type: 'CHOICE',
    question_text:
      '이식 거부 3종에 대한 설명으로 옳은 것은?',
    options: [
      '초급성 거부(수분~수시간)는 이미 존재하는 항체(혈액형·항-HLA)가 혈관내피세포 항원과 반응해 보체 활성화·혈전증을 일으킨다',
      '급성 거부는 수년에 걸쳐 진행되며 동맥경화 유사 병변을 만든다',
      '만성 거부는 수분 내에 보체 매개 혈관 괴사를 일으킨다',
      '초급성 거부는 현재 효율적인 예방법이 없다',
    ],
    answer:
      '초급성 거부(수분~수시간)는 이미 존재하는 항체(혈액형·항-HLA)가 혈관내피세포 항원과 반응해 보체 활성화·혈전증을 일으킨다',
  },
  {
    type: 'CHOICE',
    question_text:
      '면역억제 약물의 작용 기전이 잘못 짝지어진 것은?',
    options: [
      'Mycophenolate mofetil — Calcineurin 억제로 NFAT 핵 이동 차단',
      'Cyclosporine/Tacrolimus — Calcineurin 억제로 IL-2 등 사이토카인 생성 차단',
      'Rapamycin(Sirolimus) — mTOR 경로 억제로 IL-2 신호 하류 차단',
      'Belatacept(CTLA4-Ig) — B7에 결합해 CD28 공동자극 차단',
    ],
    answer:
      'Mycophenolate mofetil — Calcineurin 억제로 NFAT 핵 이동 차단',
  },
  {
    type: 'CHOICE',
    question_text:
      '이식편대백혈병 효과(GVL)와 이식편대숙주병(GVHD)의 관계에 대한 설명으로 옳은 것은?',
    options: [
      'GVHD를 일으키는 공여자 T세포가 잔류 백혈병세포도 제거하므로, GVHD를 완전히 억제하면 GVL 효과도 소실되어 재발 위험이 증가한다',
      'GVL과 GVHD는 서로 독립적이어서 GVHD를 완전히 억제해도 GVL은 유지된다',
      'GVL은 수여자 T세포가 공여자 조직을 공격하는 현상이다',
      'GVHD를 강화할수록 항상 임상 결과가 좋아진다',
    ],
    answer:
      'GVHD를 일으키는 공여자 T세포가 잔류 백혈병세포도 제거하므로, GVHD를 완전히 억제하면 GVL 효과도 소실되어 재발 위험이 증가한다',
  },
  {
    type: 'OX',
    question_text:
      'ABO 혈액형 항원은 혈관내피세포에도 발현되므로, 혈액형 불일치 장기 이식 시 초급성 거부를 유발할 수 있다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      '조혈줄기세포 이식(HSCT)에서 발생하는 GVHD는 수여자의 T세포가 공여자 조직을 외래로 인식하여 공격함으로써 발생한다.',
    options: ['O', 'X'],
    answer: 'X',
  },
  {
    type: 'SHORT',
    question_text:
      'CAR-T 세포에서 종양항원을 직접 인식하는 세포 외 도메인으로 쓰이는, 항체 유래 단쇄 가변 단편의 약어를 쓰시오. (영문)',
    options: [],
    answer: 'scFv',
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
