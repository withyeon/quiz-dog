import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database.types'

export type QuestionType = Database['public']['Tables']['questions']['Row']['type']

export type GameQuestion = {
  id: string
  type: QuestionType
  question_text: string
  options: string[]
  answer: string
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
  const { data, error } = await (supabase
    .from('questions') as any)
    .select('id, type, question_text, options')
    .eq('set_id', setId)

  if (error) throw error

  const questions = ((data ?? []) as Array<{
    id: string
    type: QuestionType
    question_text: string
    options: Json
  }>).map((question) => ({
    id: question.id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    // Do not expose the real answer to clients. Keep a placeholder for legacy props.
    answer: '',
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

export async function listQuestionsForAnalytics(
  setId: string,
): Promise<AnalyticsQuestion[]> {
  const { data, error } = await (supabase
    .from('questions') as any)
    .select('id, set_id, type, question_text, options, answer, created_at')
    .eq('set_id', setId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return ((data ?? []) as Array<{
    id: string
    set_id: string
    type: QuestionType
    question_text: string
    options: Json
    answer: string
    created_at: string
  }>).map((question) => ({
    id: question.id,
    set_id: question.set_id,
    type: question.type,
    question_text: question.question_text,
    options: normalizeQuestionOptions(question.options),
    answer: question.answer,
    created_at: question.created_at,
  }))
}
