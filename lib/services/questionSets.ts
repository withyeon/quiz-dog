import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database.types'

type QuestionSetRow = Database['public']['Tables']['question_sets']['Row']
type QuestionSetInsert = Database['public']['Tables']['question_sets']['Insert']
type QuestionRow = Database['public']['Tables']['questions']['Row']
type QuestionInsert = Database['public']['Tables']['questions']['Insert']
type QuestionUpdate = Database['public']['Tables']['questions']['Update']

export type QuestionSetSummary = QuestionSetRow & {
  question_count: number
}

export type QuestionSetIndexItem = {
  set_id: string
  question_count: number
  created_at: string
}

export type QuestionDraft = {
  type?: QuestionRow['type']
  question_text?: string
  options?: Json | string[] | null
  answer?: string
}

export type QuestionSetMetadataInput = {
  title: string
  description?: string | null
  subject?: string | null
  grade?: string | null
  tags?: Json
}

export type QuestionSetWithQuestions = {
  set: QuestionSetRow | null
  questions: QuestionRow[]
}

export function createQuestionSetId(prefix = 'set'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizeQuestionOptions(options: QuestionDraft['options']): string[] {
  if (Array.isArray(options)) {
    return options.map((option) => String(option).trim()).filter(Boolean)
  }

  return []
}

export function validateQuestionDraft(question: QuestionDraft): string[] {
  const errors: string[] = []
  const questionText = question.question_text?.trim() ?? ''
  const answer = question.answer?.trim() ?? ''

  if (!question.type) errors.push('문제 유형을 선택해주세요.')
  if (!questionText) errors.push('문제 내용을 입력해주세요.')
  if (!answer) errors.push('정답을 입력해주세요.')

  if (question.type === 'CHOICE') {
    const options = normalizeQuestionOptions(question.options)
    if (options.length < 2) {
      errors.push('객관식 문제는 보기가 2개 이상 필요합니다.')
    }
    if (answer && !options.includes(answer)) {
      errors.push('정답이 보기에 포함되어 있지 않습니다.')
    }
  }

  if (question.type === 'OX' && answer && answer !== 'O' && answer !== 'X') {
    errors.push('OX 문제의 정답은 O 또는 X여야 합니다.')
  }

  return errors
}

export function normalizeQuestionDraft(question: QuestionDraft): Omit<QuestionInsert, 'set_id'> {
  const errors = validateQuestionDraft(question)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return {
    type: question.type!,
    question_text: question.question_text!.trim(),
    options: normalizeQuestionOptions(question.options),
    answer: question.answer!.trim(),
  }
}

export function validateQuestionSetMetadata(input: QuestionSetMetadataInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('문제집 이름을 입력해주세요.')
  if (!input.subject) errors.push('과목을 선택해주세요.')
  if (!input.grade) errors.push('대상 학년을 선택해주세요.')
  return errors
}

export async function listQuestionSetsWithCounts(): Promise<QuestionSetSummary[]> {
  const { data: sets, error } = await (supabase
    .from('question_sets') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const summaries = await Promise.all(
    ((sets ?? []) as QuestionSetRow[]).map(async (set) => {
      const { count, error: countError } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('set_id', set.id)

      if (countError) throw countError
      return { ...set, question_count: count ?? 0 }
    })
  )

  return summaries
}

export async function listQuestionSetIndexFromQuestions(): Promise<QuestionSetIndexItem[]> {
  const { data, error } = await (supabase
    .from('questions') as any)
    .select('set_id, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error

  const grouped = ((data ?? []) as Pick<QuestionRow, 'set_id' | 'created_at'>[]).reduce(
    (acc, item) => {
      if (!acc[item.set_id]) {
        acc[item.set_id] = {
          set_id: item.set_id,
          question_count: 0,
          created_at: item.created_at,
        }
      }

      acc[item.set_id].question_count += 1
      return acc
    },
    {} as Record<string, QuestionSetIndexItem>,
  )

  return Object.values(grouped)
}

export async function listQuestionSetsExcept(excludedSetId: string): Promise<QuestionSetRow[]> {
  const { data, error } = await (supabase
    .from('question_sets') as any)
    .select('*')
    .neq('id', excludedSetId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as QuestionSetRow[]
}

export async function getQuestionSetWithQuestions(setId: string): Promise<QuestionSetWithQuestions> {
  const { data: set, error: setError } = await (supabase
    .from('question_sets') as any)
    .select('*')
    .eq('id', setId)
    .maybeSingle()

  if (setError) throw setError

  const { data: questions, error: questionError } = await (supabase
    .from('questions') as any)
    .select('*')
    .eq('set_id', setId)
    .order('created_at', { ascending: true })

  if (questionError) throw questionError

  return {
    set: set as QuestionSetRow | null,
    questions: (questions ?? []) as QuestionRow[],
  }
}

export async function createQuestionSet(input: QuestionSetInsert): Promise<QuestionSetRow> {
  const { data, error } = await (supabase
    .from('question_sets') as any)
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data as QuestionSetRow
}

export async function createQuestionSetWithQuestions(input: {
  metadata: QuestionSetMetadataInput
  questions: QuestionDraft[]
  idPrefix?: string
}): Promise<string> {
  const metadataErrors = validateQuestionSetMetadata(input.metadata)
  if (metadataErrors.length > 0) {
    throw new Error(metadataErrors.join('\n'))
  }

  if (input.questions.length === 0) {
    throw new Error('저장할 문제가 없습니다.')
  }

  const normalizedQuestions = input.questions.map(normalizeQuestionDraft)
  const setId = createQuestionSetId(input.idPrefix)

  await createQuestionSet({
    id: setId,
    title: input.metadata.title.trim(),
    description: input.metadata.description ?? null,
    subject: input.metadata.subject ?? null,
    grade: input.metadata.grade ?? null,
    tags: input.metadata.tags ?? [],
  } as QuestionSetInsert)

  try {
    await insertQuestions(
      normalizedQuestions.map((question) => ({
        ...question,
        set_id: setId,
      }))
    )
  } catch (error) {
    await deleteQuestionSet(setId).catch((rollbackError) => {
      console.error('문제 저장 실패 후 문제집 롤백 실패:', rollbackError)
    })
    throw error
  }

  return setId
}

export async function updateQuestionSetMetadata(
  setId: string,
  input: Partial<QuestionSetMetadataInput>,
): Promise<void> {
  const payload: Database['public']['Tables']['question_sets']['Update'] = {}

  if (input.title !== undefined) payload.title = input.title.trim()
  if (input.description !== undefined) payload.description = input.description
  if (input.subject !== undefined) payload.subject = input.subject
  if (input.grade !== undefined) payload.grade = input.grade
  if (input.tags !== undefined) payload.tags = input.tags

  const { error } = await (supabase
    .from('question_sets') as any)
    .update(payload)
    .eq('id', setId)

  if (error) throw error
}

export async function insertQuestions(questions: QuestionInsert[]): Promise<QuestionRow[]> {
  if (questions.length === 0) return []

  const { data, error } = await (supabase
    .from('questions') as any)
    .insert(questions)
    .select()

  if (error) throw error
  return (data ?? []) as QuestionRow[]
}

export async function createQuestionInSet(setId: string, question: QuestionDraft): Promise<QuestionRow> {
  const normalizedQuestion = normalizeQuestionDraft(question)
  const { data, error } = await (supabase
    .from('questions') as any)
    .insert({
      ...normalizedQuestion,
      set_id: setId,
    } satisfies QuestionInsert)
    .select()
    .single()

  if (error) throw error
  return data as QuestionRow
}

export async function updateQuestion(questionId: string, question: QuestionDraft): Promise<void> {
  const normalizedQuestion = normalizeQuestionDraft(question)
  const payload: QuestionUpdate = {
    type: normalizedQuestion.type,
    question_text: normalizedQuestion.question_text,
    options: normalizedQuestion.options,
    answer: normalizedQuestion.answer,
  }

  const { error } = await (supabase
    .from('questions') as any)
    .update(payload)
    .eq('id', questionId)

  if (error) throw error
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await (supabase
    .from('questions') as any)
    .delete()
    .eq('id', questionId)

  if (error) throw error
}

export async function copyQuestionsIntoSet(setId: string, questions: QuestionDraft[]): Promise<QuestionRow[]> {
  if (questions.length === 0) return []

  const normalizedQuestions = questions.map(normalizeQuestionDraft)
  return insertQuestions(
    normalizedQuestions.map((question) => ({
      ...question,
      set_id: setId,
    }))
  )
}

export async function duplicateQuestionSet(setId: string, title?: string): Promise<string> {
  const { data: sourceSet, error: setError } = await (supabase
    .from('question_sets') as any)
    .select('*')
    .eq('id', setId)
    .single()

  if (setError) throw setError

  const { data: questions, error: questionError } = await (supabase
    .from('questions') as any)
    .select('type, question_text, options, answer')
    .eq('set_id', setId)

  if (questionError) throw questionError

  const newSetId = createQuestionSetId()
  await createQuestionSet({
    id: newSetId,
    title: title ?? `${sourceSet.title} (복사본)`,
    description: sourceSet.description,
    subject: sourceSet.subject,
    grade: sourceSet.grade,
    tags: sourceSet.tags,
  } as QuestionSetInsert)

  await insertQuestions(
    (questions ?? []).map((question: Pick<QuestionRow, 'type' | 'question_text' | 'options' | 'answer'>) => ({
      set_id: newSetId,
      type: question.type,
      question_text: question.question_text,
      options: question.options,
      answer: question.answer,
    }))
  )

  return newSetId
}

export async function deleteQuestionSet(setId: string): Promise<void> {
  const { error } = await (supabase
    .from('question_sets') as any)
    .delete()
    .eq('id', setId)

  if (error) throw error
}

export async function copyQuestionSetFromQuestionsOnly(sourceSetId: string): Promise<string> {
  const { data: questions, error } = await (supabase
    .from('questions') as any)
    .select('type, question_text, options, answer')
    .eq('set_id', sourceSetId)

  if (error) throw error
  if (!questions || questions.length === 0) {
    throw new Error('복사할 문제가 없습니다.')
  }

  const newSetId = createQuestionSetId('library-set')
  await createQuestionSet({
    id: newSetId,
    title: sourceSetId.replace(/^set-/, '문제집 '),
    description: '라이브러리에서 가져온 문제집',
  } as QuestionSetInsert)

  await insertQuestions(
    (questions as Pick<QuestionRow, 'type' | 'question_text' | 'options' | 'answer'>[]).map((question) => ({
      set_id: newSetId,
      type: question.type,
      question_text: question.question_text,
      options: question.options,
      answer: question.answer,
    }))
  )

  return newSetId
}
