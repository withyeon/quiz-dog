import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 면역학 기말 12주차 <면역관용과 자가면역> 핵심 20문제
const SET_ID = 'set-immunology-final-week12-2026'

const questionSet = {
  id: SET_ID,
  title: '면역학 기말 12주차 - 면역관용과 자가면역',
  description:
    '면역관용 일반 원리, 중추/말초관용, 가슴샘 선별과 AIRE, 조절T세포(Treg)와 무반응·소진·세포자멸사, B림프구 관용, 공생미생물·태아 항원 관용, 자가면역의 3요인과 대표 질환을 다룬 객관식·OX·주관식 혼합 20문제. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['면역학', '기말', '면역관용', '자가면역', '12주차'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      '중추관용(central tolerance)에 대한 설명으로 옳은 것은?',
    options: [
      '가슴샘(T세포)과 골수(B세포)에서 발달 중인 미성숙 림프구가 자기항원을 강하게 인식하면 제거·불활성화된다',
      '성숙한 림프구가 말초 조직에서 무반응·세포자멸사로 억제되는 과정이다',
      '조절 T세포(Treg)에 의한 억제만을 의미한다',
      '미생물 항원에 대한 면역반응을 강화하는 과정이다',
    ],
    answer:
      '가슴샘(T세포)과 골수(B세포)에서 발달 중인 미성숙 림프구가 자기항원을 강하게 인식하면 제거·불활성화된다',
  },
  {
    type: 'CHOICE',
    question_text:
      '가슴샘에서의 T세포 선별에 대한 설명으로 옳지 않은 것은?',
    options: [
      '음성선별은 피질에서 일어나며 MHC와 결합하지 못하는 T세포를 제거한다',
      '양성선별은 피질에서 MHC와 결합할 수 있는 T세포만 생존시킨다',
      '음성선별은 수질에서 자기항원에 강하게 결합하는 T세포를 세포자멸사로 제거(클론제거)한다',
      '자기항원에 중간 친화력으로 결합하는 일부 CD4⁺ T세포는 FOXP3⁺ 조절T세포로 분화한다',
    ],
    answer:
      '음성선별은 피질에서 일어나며 MHC와 결합하지 못하는 T세포를 제거한다',
  },
  {
    type: 'CHOICE',
    question_text:
      'AIRE(자가면역조절인자)의 정상 역할과 결손 시 질환을 바르게 설명한 것은?',
    options: [
      'mTEC에서 조직제한항원(인슐린 등)을 발현시켜 자기반응 T세포를 음성선별하며, 결손 시 APS-1이 발생한다',
      'Treg의 FOXP3 발현을 직접 유도하며, 결손 시 IPEX가 발생한다',
      'Fas 매개 세포자멸사를 일으키며, 결손 시 ALPS가 발생한다',
      '말초조직 항원의 발현을 억제하여 관용을 유지한다',
    ],
    answer:
      'mTEC에서 조직제한항원(인슐린 등)을 발현시켜 자기반응 T세포를 음성선별하며, 결손 시 APS-1이 발생한다',
  },
  {
    type: 'CHOICE',
    question_text:
      '조절T세포(Treg)의 표면 표지자 및 핵심 전사인자로 옳은 것은?',
    options: [
      'CD4⁺, CD25⁺, FOXP3⁺ (CTLA-4 고발현)',
      'CD8⁺, CD25⁻, T-bet⁺',
      'CD4⁺, PD-1⁺, RORγT⁺',
      'CD8⁺, FOXP3⁻, GATA-3⁺',
    ],
    answer: 'CD4⁺, CD25⁺, FOXP3⁺ (CTLA-4 고발현)',
  },
  {
    type: 'CHOICE',
    question_text:
      'FOXP3 유전자 돌연변이로 Treg 발달이 결손되어 전신 자가면역(장염·제1형 당뇨병·피부염·갑상샘염)을 일으키는 X연관 열성 질환은?',
    options: ['IPEX 증후군', 'APS-1', 'ALPS', 'XLA'],
    answer: 'IPEX 증후군',
  },
  {
    type: 'CHOICE',
    question_text:
      'Treg의 4가지 억제 기작에 해당하지 않는 것은?',
    options: [
      'AID를 분비하여 효과 T세포의 DNA에 돌연변이를 유발',
      '억제성 사이토카인(IL-10, TGF-β, IL-35) 분비',
      'CTLA-4 고발현으로 APC의 B7을 차단하여 CD28 공동자극 방해',
      '고친화력 IL-2 수용체(CD25)로 IL-2를 소비하여 효과 T세포의 증식 억제',
    ],
    answer: 'AID를 분비하여 효과 T세포의 DNA에 돌연변이를 유발',
  },
  {
    type: 'CHOICE',
    question_text:
      'T세포 무반응(anergy)이 발생하는 기전으로 옳은 것은?',
    options: [
      'TCR 신호(신호1)만 있고 B7-CD28 공동자극(신호2)이 없을 때 T세포가 기능적으로 불활성화된다',
      '신호1과 신호2가 모두 강하게 주어질 때 발생한다',
      '만성 항원 자극으로 PD-1이 증가하여 발생한다',
      'Fas-FasL 결합으로 세포가 사멸하여 발생한다',
    ],
    answer:
      'TCR 신호(신호1)만 있고 B7-CD28 공동자극(신호2)이 없을 때 T세포가 기능적으로 불활성화된다',
  },
  {
    type: 'CHOICE',
    question_text:
      'T세포 소진(exhaustion)에서 발현이 증가하는 억제수용체가 아닌 것은?',
    options: ['CD28', 'PD-1', 'LAG-3', 'TIM-3'],
    answer: 'CD28',
  },
  {
    type: 'CHOICE',
    question_text:
      '면역관문억제제(예: 니볼루맙, 펨브롤리주맙)의 작용과 부작용에 대한 설명으로 옳은 것은?',
    options: [
      'PD-1을 차단해 종양 특이 T세포의 소진을 방지하지만, 자기관용 손상으로 자가면역반응을 유발할 수 있다',
      'PD-1을 활성화하여 T세포 소진을 촉진한다',
      'Treg를 증가시켜 항종양 면역을 억제한다',
      '부작용이 전혀 없어 자가면역과 무관하다',
    ],
    answer:
      'PD-1을 차단해 종양 특이 T세포의 소진을 방지하지만, 자기관용 손상으로 자가면역반응을 유발할 수 있다',
  },
  {
    type: 'CHOICE',
    question_text:
      'FAS 또는 FasL 유전자 돌연변이로 림프구 세포자멸사가 결손되어 림프절 비대, 자가면역성 혈구감소증이 나타나는 질환은?',
    options: ['ALPS(자가면역 림프증식 증후군)', 'IPEX', 'APS-1', 'SLE'],
    answer: 'ALPS(자가면역 림프증식 증후군)',
  },
  {
    type: 'CHOICE',
    question_text:
      'B림프구 중추관용(골수)의 주요 기작 중, 자기항원에 결합하는 미성숙 B세포가 RAG를 재활성화해 경사슬 유전자를 재배열하는 과정은?',
    options: ['수용체 편집(receptor editing)', '클론제거', '무반응', '교차제시'],
    answer: '수용체 편집(receptor editing)',
  },
  {
    type: 'CHOICE',
    question_text:
      '모체-태아 관용 기작에 해당하지 않는 것은?',
    options: [
      '영양막세포의 AIRE 발현으로 부계 MHC를 음성선별',
      '자궁 내 FOXP3⁺ 조절T세포 증가로 부계 MHC 특이 T세포 억제',
      '영양막세포의 IDO 효소 발현으로 트립토판 분해 → T세포 증식 억제',
      '영양막세포의 HLA-G 발현으로 NK세포 활성화 억제',
    ],
    answer: '영양막세포의 AIRE 발현으로 부계 MHC를 음성선별',
  },
  {
    type: 'CHOICE',
    question_text:
      '자가면역 발병에 필요한 3가지 요인에 대한 설명으로 옳지 않은 것은?',
    options: [
      '단일 환경 유발자만 있으면 유전적 소인 없이도 반드시 자가면역이 발생한다',
      'MHC(HLA) 유전자가 가장 강력한 유전적 감수성 인자이다',
      '중추관용 또는 말초관용 기작의 결손이 필요하다',
      '감염·자외선·호르몬 등 환경적 유발자가 작용한다',
    ],
    answer:
      '단일 환경 유발자만 있으면 유전적 소인 없이도 반드시 자가면역이 발생한다',
  },
  {
    type: 'CHOICE',
    question_text:
      'MHC가 자가면역의 가장 강력한 유전적 위험인자인 이유로 옳지 않은 것은?',
    options: [
      'MHC 분자가 직접 자가항체를 생산하여 조직을 손상시키기 때문',
      '특정 MHC 대립유전자가 자기항원 펩티드를 더 효율적으로 제시할 수 있기 때문',
      'MHC가 가슴샘 음성선별에 관여하여 자기반응 T세포를 불완전하게 제거할 수 있기 때문',
      'MHC 분자가 T세포에 항원 펩티드를 제시하는 역할을 하기 때문',
    ],
    answer:
      'MHC 분자가 직접 자가항체를 생산하여 조직을 손상시키기 때문',
  },
  {
    type: 'CHOICE',
    question_text:
      'A군 사슬알균 감염 후 항체가 심장 근육 단백질(미오신)과 교차반응하여 류마티스열(심장염)을 일으키는 자가면역 유발 기전은?',
    options: ['분자모방(molecular mimicry)', '격리 항원 방출', 'IFN-α 과다 생산', '수용체 편집'],
    answer: '분자모방(molecular mimicry)',
  },
  {
    type: 'CHOICE',
    question_text:
      '전신홍반루푸스(SLE)에 대한 설명으로 옳지 않은 것은?',
    options: [
      '주로 IgE 매개 비만세포 탈과립으로 아나필락시스를 일으킨다',
      '항핵항체(ANA), 항dsDNA·항히스톤 항체가 생성된다',
      '항원-항체 면역복합체가 신장·피부·관절에 침착하여 조직을 손상시킨다',
      '자외선 노출 시 증상이 악화되며 여성에서 빈도가 높다(약 9:1)',
    ],
    answer:
      '주로 IgE 매개 비만세포 탈과립으로 아나필락시스를 일으킨다',
  },
  {
    type: 'CHOICE',
    question_text:
      'HLA 대립유전자와 연관 자가면역질환의 짝으로 상대위험도가 가장 높은(~90배) 것은?',
    options: [
      'HLA-B27 — 강직성척추염',
      'HLA-DR3/DR4 — 제1형 당뇨병',
      'HLA-DR4 — 류마티스관절염',
      'HLA-DR2 — 다발성경화증',
    ],
    answer: 'HLA-B27 — 강직성척추염',
  },
  {
    type: 'OX',
    question_text:
      'T세포는 중추관용이, B세포는 말초관용이 주된 관용 기작으로 작동한다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      '위생 가설(hygiene hypothesis)에 따르면 어린 시절 미생물 노출 감소가 조절T세포 발달을 촉진하여 알레르기·자가면역질환을 줄인다.',
    options: ['O', 'X'],
    answer: 'X',
  },
  {
    type: 'SHORT',
    question_text:
      '조절T세포(Treg)의 계통을 결정하는 핵심 전사인자의 이름을 쓰시오. (영문)',
    options: [],
    answer: 'FOXP3',
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
