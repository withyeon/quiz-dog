import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SET_ID = 'set-yakseongga-quiz'

const questionSet = {
  id: SET_ID,
  title: '약성가 퀴즈',
  description:
    '약재 이름이 출제되면 해당 약재의 약성가(2구)를 한글로 적는 주관식 퀴즈입니다. (정답 비교 시 띄어쓰기는 무시됩니다.)',
  subject: '기타',
  grade: '기타',
  tags: ['약성가', '본초', '한약', '주관식'],
}

// [한자 약재명, 한글 약재명, 약성가 1구, 약성가 2구]
const herbs = [
  ['車前子', '차전자', '차전자한안적질', '소변통리대편실'],
  ['木通', '목통', '목통고한체가녕', '소장열폐급통경'],
  ['滑石', '활석', '활석침한활리규', '해갈제번습열료'],
  ['通草', '통초', '통초감담치방광', '소옹산종통유방'],
  ['海金沙', '해금사', '해금사한통소장', '습열종만림역당'],
  ['石葦', '석위', '석위고감리방광', '유뇨혹림발배창'],
  ['萆薢', '비해', '비해고평삼기비', '요배랭통리습탁'],
  ['地膚子', '지부자', '지부자한제소양', '거방광열공최광'],
  ['萹蓄', '편축', '편축고량소개식', '저치아회녀음식'],
  ['瞿麥', '구맥', '구맥고한제림병', '차능타태급통경'],
  ['冬葵子', '동규자', '동규자한치륭방', '활태이산통유방'],
  ['燈心草', '등심초', '등초감담리소수', '륭폐성림습종지'],
  ['三白草', '삼백초', '삼백초한청열독', '리수소종거담의'],
  ['茵蔯蒿', '인진호', '인진고량퇴달황', '사습리수청열량'],
  ['金錢草', '금전초', '금전초량청습열', '통림소종결석전'],
  ['附子', '부자', '부자신열주불수', '궐랭회양의급투'],
  ['川烏頭', '천오두', '천오신열수골풍', '습비한동파적공'],
  ['乾薑', '건강', '건강신열해풍한', '포고축랭허한감'],
  ['肉桂', '육계', '육계신열통혈맥', '온보허한복통극'],
  ['吳茱萸', '오수유', '오수신열산가안', '통치산수제복한'],
  ['蜀椒', '촉초', '천초신열축한습', '온신난비겸살충'],
  ['蓽撥', '필발', '필발신열하기이', '현벽음산곽사리'],
  ['蓽澄茄', '필징가', '필징가신소담식', '축귀제창홰가식'],
  ['丁香', '정향', '정향신온온위신', '심복동통한구제'],
  ['高良薑', '고량강', '량강신열하기량', '전근곽란주식상'],
  ['小茴香', '소회향', '소회신온제산기', '치요복동겸난위'],
  ['胡椒', '호초', '호초신열하기체', '심복랭통질박제'],
  ['陳皮', '진피', '진피신온순기공', '화비류백담취홍'],
  ['靑皮', '청피', '청피고온공기체', '삭견소간안위식'],
  ['枳實', '지실', '지실미한소식비', '파적화담시장기'],
  ['枳殼', '지각', '지각미한해기결', '관장소창불가결'],
  ['木香', '목향', '목향신온능화위', '행간사폐산체기'],
  ['香附子', '향부자', '향부성평소숙식', '개울조경통가식'],
  ['烏藥', '오약', '오약신온심복창', '소변활삭순기창'],
  ['沈香', '침향', '침향난위겸축사', '통천철지강기가'],
  ['川楝子', '천련자', '련자고한치산기', '청간해울겸구충'],
  ['荔枝核', '여지핵', '려지핵온행기결', '거한지통치산기'],
  ['靑木香', '청목향', '청목향한청습열', '평간지통사충상'],
  ['薤白', '해백', '해백신고활통양', '하기산결흉비의'],
  ['檀香', '단향', '단향신온선치곽', '승위진식귀기각'],
  ['柿蒂', '시체', '시체고삽애역의', '시상감량조해가'],
  ['玫瑰花', '매괴화', '매괴화온소간울', '리기조중행어혈'],
  ['大腹皮', '대복피', '복피미온하격기', '건비안위겸소종'],
  ['土木香', '토목향', '토목향온건비위', '행기지통리질가'],
  ['甘松香', '감송향', '감송감향욕기향', '제심복통악기량'],
]

const questions = herbs.map(([hanja, hangul, line1, line2]) => ({
  type: 'SHORT',
  question_text: `[${hanja} (${hangul})] 의 약성가를 한글로 쓰시오.`,
  options: [],
  answer: `${line1} ${line2}`,
}))

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
  console.log(`Seeding 약성가 퀴즈: ${SET_ID} (${questions.length} questions)`)

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

  console.log('Seed complete.')
  console.log(`Inserted questions: ${count ?? 0}`)
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
