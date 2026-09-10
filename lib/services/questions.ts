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
}

// image_url 컬럼이 아직 없는 DB(마이그레이션 전)에서도 게임이 멈추지 않게,
// 컬럼 없음 오류면 그림 없이 다시 읽는다.
function isMissingImageColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return e.code === '42703' || e.code === 'PGRST204' || /image_url/.test(e.message ?? '')
}

async function selectQuestions(setId: string, columns: string, order: boolean) {
  let query = (supabase.from('questions') as any).select(columns).eq('set_id', setId)
  if (order) query = query.order('created_at', { ascending: true })
  const result = await query
  if (result.error && columns.includes('image_url') && isMissingImageColumn(result.error)) {
    return selectQuestions(setId, columns.replace(/,\s*image_url/, ''), order)
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
  const { data, error } = await selectQuestions(setId, 'id, type, question_text, options, image_url', false)

  if (error) throw error

  const questions = ((data ?? []) as Array<{
    id: string
    type: QuestionType
    question_text: string
    options: Json
    image_url?: string | null
  }>).map((question) => ({
    id: question.id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    // Do not expose the real answer to clients. Keep a placeholder for legacy props.
    answer: '',
    image_url: question.image_url ?? null,
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
    'id, set_id, type, question_text, options, answer, created_at, image_url',
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
  }>).map((question) => ({
    id: question.id,
    set_id: question.set_id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    answer: question.answer,
    created_at: question.created_at,
    image_url: question.image_url ?? null,
  }))
}
