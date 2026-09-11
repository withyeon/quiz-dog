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

export async function listQuestionsForGame(
  setId: string,
  options: { shuffle?: boolean } = {},
): Promise<GameQuestion[]> {
  // 만든 순서로 읽는다. 게임은 어차피 섞어 내지만, 공부 모드의 "문제집 순서"는 이 순서를 그대로 쓴다.
  const { data, error } = await selectQuestions(setId, 'id, type, question_text, options, image_url, explanation', true)

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
  }))

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
