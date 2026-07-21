import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// 미생물학 기말(감염증론·피부·호흡기·소화기·비뇨생식기·신경계·창상·혈관림프) 핵심 20문제
const SET_ID = 'set-microbiology-final-2026'

const questionSet = {
  id: SET_ID,
  title: '미생물학 기말 핵심 20제',
  description:
    '감염증론, 독소, 피부·호흡기·소화기·비뇨생식기·신경계·창상·혈관림프계 감염의 핵심 내용을 정리한 객관식·OX·주관식 혼합 문제집입니다. (주관식 정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['미생물학', '기말', '감염', '병원체', '혼합유형'],
}

const questions = [
  {
    type: 'CHOICE',
    question_text:
      '감염증 성립의 첫 단계로, 세균의 섬모(Fimbriae)가 정착인자(Adhesin)로 작용하여 숙주 세포에 달라붙는 현상은?',
    options: ['정착(Adhesion)', '발병(Pathogenesis)', '잠복(Latency)', '배설(Excretion)'],
    answer: '정착(Adhesion)',
  },
  {
    type: 'CHOICE',
    question_text: '염증의 5대 소견에 해당하지 않는 것은?',
    options: ['탈모', '통증', '발열', '발적'],
    answer: '탈모',
  },
  {
    type: 'CHOICE',
    question_text:
      '독력(Virulence)의 강도를 나타내는 양적 지표로, 감염 동물의 50%를 사멸시키는 데 필요한 균수나 독소량을 의미하는 것은?',
    options: ['LD50', 'pH', 'IgA', 'CFU'],
    answer: 'LD50',
  },
  {
    type: 'CHOICE',
    question_text:
      'Gram 음성균의 세포벽 구성 성분이며, 세균이 사멸·파괴될 때 유리되고 열에 매우 강한(내열성) 독소는?',
    options: [
      '균체내독소(Endotoxin, LPS)',
      '균체외독소(Exotoxin)',
      '톡소이드(Toxoid)',
      '용혈독소(Hemolysin)',
    ],
    answer: '균체내독소(Endotoxin, LPS)',
  },
  {
    type: 'CHOICE',
    question_text:
      '병원체의 전파 경로 중 혈류를 따라 전신적으로 확산되어 교수가 "가장 위험하다"고 언급한 것은?',
    options: [
      '혈행성 전파(Hematogenous spread)',
      '연속적 전파(Continuous spread)',
      '관강 내 전파(Intraluminal spread)',
      '림프행성 전파(Lymphogenous spread)',
    ],
    answer: '혈행성 전파(Hematogenous spread)',
  },
  {
    type: 'CHOICE',
    question_text:
      '건강한 사람에게는 무해하나 숙주의 저항력이 낮아진 틈을 타 감염을 일으키는 현상은?',
    options: ['기회감염', '잠복감염', '불현성감염', '복수균감염'],
    answer: '기회감염',
  },
  {
    type: 'CHOICE',
    question_text:
      '독소형 식중독으로, 통조림·발효식품에서 발생하며 신경마비(호흡중추 마비)를 일으키는 원인균은?',
    options: [
      'Clostridium botulinum(보툴리눔균)',
      'Vibrio parahaemolyticus(장염비브리오)',
      'Salmonella(살모넬라)',
      'Campylobacter jejuni(캄필로박터)',
    ],
    answer: 'Clostridium botulinum(보툴리눔균)',
  },
  {
    type: 'CHOICE',
    question_text:
      '위점막에서 강력한 Urease를 생산하여 요소를 암모니아로 분해해 위산을 중화하고, 위궤양·위암의 원인이 되는 균은?',
    options: [
      'Helicobacter pylori',
      'Vibrio cholerae',
      'Shigella',
      'Escherichia coli O157:H7',
    ],
    answer: 'Helicobacter pylori',
  },
  {
    type: 'CHOICE',
    question_text:
      '베로독소(Shiga-like toxin)를 생산하여 용혈성 요독 증후군(HUS)을 유발할 수 있는 장관출혈성 대장균의 대표 혈청형은?',
    options: ['O157:H7', 'H5N1', 'L1·L2·L3', 'PRSP'],
    answer: 'O157:H7',
  },
  {
    type: 'CHOICE',
    question_text:
      '수두를 일으킨 뒤 지각신경절에 잠복해 있다가 면역력 저하 시 재활성화되어 대상포진을 유발하는 바이러스는?',
    options: ['VZV(수두-대상포진 바이러스)', 'HSV-1', 'Measles virus', 'Rubella virus'],
    answer: 'VZV(수두-대상포진 바이러스)',
  },
  {
    type: 'CHOICE',
    question_text:
      '홍역(Measles)에서 발진 출현 전 구강 점막에 나타나는 특징적인 흰색 반점으로, 교수가 중요한 특징이라고 언급한 것은?',
    options: ["Koplik's spot", '안장코', "Hutchinson's teeth", 'Negri body'],
    answer: "Koplik's spot",
  },
  {
    type: 'CHOICE',
    question_text:
      '디프테리아·파상풍 예방접종에 쓰이며, 외독소를 포르말린으로 처리해 독성은 없애고 항원성만 남긴 것은?',
    options: ['톡소이드(Toxoid)', '약독화 생백신', '인터페론', '항독소 혈청'],
    answer: '톡소이드(Toxoid)',
  },
  {
    type: 'CHOICE',
    question_text:
      '결핵균(Mycobacterium tuberculosis)은 세포벽의 지질(Mycolic acid) 때문에 어떤 염색에 양성으로 나타나는가?',
    options: ['항산성 염색(Acid-fast stain)', 'Gram 염색', "Albert's 염색", 'India ink 염색'],
    answer: '항산성 염색(Acid-fast stain)',
  },
  {
    type: 'CHOICE',
    question_text: '공수병(광견병) 진단의 결정적 근거가 되는, 감염된 뉴런 세포질 내 호산성 봉입체는?',
    options: ['Negri body', 'Koplik spot', 'Sulfur granule', 'Bubo'],
    answer: 'Negri body',
  },
  {
    type: 'CHOICE',
    question_text:
      '두꺼운 다당류 협막으로 식균작용을 회피하며, India ink 염색으로 진단하고 AIDS 환자에게 수막뇌염을 일으키는 진균은?',
    options: [
      'Cryptococcus neoformans',
      'Candida albicans',
      'Aspergillus',
      'Histoplasma capsulatum',
    ],
    answer: 'Cryptococcus neoformans',
  },
  {
    type: 'CHOICE',
    question_text:
      '토양 속 아포가 깊은 상처를 통해 침입해 혐기성 조건에서 발아하며, tetanospasmin 독소로 개구불능·후궁반장을 일으키는 균은?',
    options: [
      'Clostridium tetani(파상풍균)',
      'Clostridium perfringens(가스괴저균)',
      'Actinomyces israelii',
      'Bacillus anthracis',
    ],
    answer: 'Clostridium tetani(파상풍균)',
  },
  {
    type: 'OX',
    question_text: '균체외독소(Exotoxin)는 Gram 양성균과 음성균 모두에서 생성될 수 있다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'OX',
    question_text:
      '바이러스성 수막염(무균성 수막염)은 일반적으로 세균성 수막염보다 증상이 가볍고 예후가 좋다.',
    options: ['O', 'X'],
    answer: 'O',
  },
  {
    type: 'SHORT',
    question_text:
      '말라리아를 매개하는 모기의 이름을 쓰시오. (한글 또는 학명)',
    options: [],
    answer: '학질모기',
  },
  {
    type: 'SHORT',
    question_text:
      '황색포도구균이 생산하며 혈장을 응고시켜 균을 보호하는 효소의 이름을 쓰시오. (영문)',
    options: [],
    answer: 'Coagulase',
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
