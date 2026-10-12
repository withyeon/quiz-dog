import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database.types'

export type QuestionType = Database['public']['Tables']['questions']['Row']['type']

export type GameQuestion = {
  id: string
  type: QuestionType
  question_text: string
  options: string[]
  answer: string
  /** 문제 그림 공개 URL. 없으면 null */
  image_url: string | null
  /** 해설(선택). 공부 모드 정답 확인과 결과 복습에 보인다. 없으면 null */
  explanation: string | null
  /**
   * 숨겨진 구성치기(다중 선택) 문제면 true. 정답을 안 받는 학생 화면 대신 서버가 판정해 붙인다
   * (lib/quiz/multiSelect.ts). 일반 문제에는 이 키가 아예 없다.
   */
  multiSelect?: boolean
}

// 나중에 추가된 컬럼(image_url, explanation)이 아직 없는 DB(마이그레이션 전)에서도 게임이 멈추지 않게,
// 컬럼 없음 오류면 그 컬럼을 빼고 다시 읽는다. 오류 메시지에 컬럼 이름이 없으면 뒤에 추가된 것부터 뺀다.
const OPTIONAL_QUESTION_COLUMNS = ['explanation', 'image_url'] as const

function findMissingOptionalColumn(error: unknown, columns: string): string | null {
  const e = error as { code?: string; message?: string } | null
  if (!e) return null
  const message = e.message ?? ''
  const isMissingColumn = e.code === '42703' || e.code === 'PGRST204' || /does not exist/i.test(message)
  if (!isMissingColumn) return null
  const named = OPTIONAL_QUESTION_COLUMNS.find((column) => columns.includes(column) && message.includes(column))
  return named ?? OPTIONAL_QUESTION_COLUMNS.find((column) => columns.includes(column)) ?? null
}

async function selectQuestions(setId: string, columns: string, order: boolean) {
  let query = (supabase.from('questions') as any).select(columns).eq('set_id', setId)
  if (order) query = query.order('created_at', { ascending: true })
  const result = await query
  const missingColumn = result.error ? findMissingOptionalColumn(result.error, columns) : null
  if (missingColumn) {
    return selectQuestions(setId, columns.replace(new RegExp(`,\\s*${missingColumn}`), ''), order)
  }
  return result
}

export type AnalyticsQuestion = GameQuestion & {
  set_id: string
  created_at: string
}

export function normalizeQuestionOptions(options: Json): string[] {
  return Array.isArray(options)
    ? options.map((option) => String(option))
    : []
}

export function shuffleQuestions<T>(questions: T[]): T[] {
  const shuffled = [...questions]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }
  return shuffled
}

let multiSelectRpcWarned = false

/**
 * 구성치기(다중 선택) 문제 id 목록. 서버가 lib/quiz/multiSelect.ts 와 같은 규칙으로 판정한다
 * (sql/20261012_multi_select_answers.sql). 구성치기 문제집이 아니면 빈 목록이다.
 * RPC 가 아직 없거나(SQL 미적용) 실패하면 빈 목록 — 그러면 모든 문제가 기존처럼 동작하고,
 * 서버 채점도 아직 옛 함수라 화면과 채점이 서로 어긋나지 않는다.
 */
async function listMultiSelectQuestionIds(setId: string): Promise<Set<string>> {
  try {
    const { data, error } = await (supabase.rpc as any)('list_multi_select_question_ids', { p_set_id: setId })
    if (error) throw error
    return new Set(Array.isArray(data) ? data.map((id: unknown) => String(id)) : [])
  } catch (error) {
    if (!multiSelectRpcWarned) {
      multiSelectRpcWarned = true
      console.warn('구성치기 문제 목록을 못 읽어 모든 문제를 일반 문제로 보여줍니다:', error)
    }
    return new Set()
  }
}

export async function listQuestionsForGame(
  setId: string,
  options: { shuffle?: boolean } = {},
): Promise<GameQuestion[]> {
  // 만든 순서로 읽는다. 게임은 어차피 섞어 내지만, 공부 모드의 "문제집 순서"는 이 순서를 그대로 쓴다.
  // 구성치기 표시는 문제 목록과 함께(병렬로) 읽어, 문제가 화면에 뜰 때 이미 붙어 있게 한다.
  // (따로 읽으면 표시가 늦게 붙는 사이 다중 선택 문제가 일반 객관식처럼 잠깐 보일 수 있다)
  const [{ data, error }, multiSelectIds] = await Promise.all([
    selectQuestions(setId, 'id, type, question_text, options, image_url, explanation', true),
    listMultiSelectQuestionIds(setId),
  ])

  if (error) throw error

  const questions = ((data ?? []) as Array<{
    id: string
    type: QuestionType
    question_text: string
    options: Json
    image_url?: string | null
    explanation?: string | null
  }>).map((question) => ({
    id: question.id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    // Do not expose the real answer to clients. Keep a placeholder for legacy props.
    answer: '',
    image_url: question.image_url ?? null,
    explanation: question.explanation ?? null,
    ...(multiSelectIds.has(question.id) ? { multiSelect: true } : {}),
  }))

  // 객관식→단답식 전환(/dev 토글·닉네임 장난)은 여기서 하지 않는다. 닉네임은 문제를 다 불러온 뒤에야
  // 알 수 있어서, 게임 훅이 hooks/usePlayFlags.ts 의 usePlayQuestions 로 화면에 쓸 때 바꾼다.
  return options.shuffle ? shuffleQuestions(questions) : questions
}

export async function checkQuestionAnswer(
  questionId: string,
  submittedAnswer: string,
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('check_question_answer', {
    p_question_id: questionId,
    p_submitted_answer: submittedAnswer,
  })

  if (error) throw error
  return Boolean(data)
}

/**
 * 오답 시 정답을 보여주기 위해 정답 텍스트를 가져온다.
 * (학습용 퀴즈이므로 제출 이후 정답 공개를 허용)
 * 정답을 가져오지 못하면 null 을 반환한다.
 */
export async function getQuestionAnswer(questionId: string): Promise<string | null> {
  const { data, error } = await (supabase.rpc as any)('get_question_answer', {
    p_question_id: questionId,
  })

  if (error) {
    console.error('정답 조회 실패:', error)
    return null
  }
  return typeof data === 'string' ? data : null
}

export async function listQuestionsForAnalytics(
  setId: string,
): Promise<AnalyticsQuestion[]> {
  const { data, error } = await selectQuestions(
    setId,
    'id, set_id, type, question_text, options, answer, created_at, image_url, explanation',
    true,
  )

  if (error) throw error

  return ((data ?? []) as Array<{
    id: string
    set_id: string
    type: QuestionType
    question_text: string
    options: Json
    answer: string
    created_at: string
    image_url?: string | null
    explanation?: string | null
  }>).map((question) => ({
    id: question.id,
    set_id: question.set_id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    answer: question.answer,
    created_at: question.created_at,
    image_url: question.image_url ?? null,
    explanation: question.explanation ?? null,
  }))
}
