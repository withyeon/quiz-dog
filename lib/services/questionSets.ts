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
  title?: string | null
  description?: string | null
  subject?: string | null
  grade?: string | null
  tags?: Json
  like_count: number
  weekly_like_count: number
  monthly_like_count: number
  liked_by_client: boolean
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

export type QuestionSetLikeSummary = {
  setId: string
  likeCount: number
  weeklyLikeCount: number
  monthlyLikeCount: number
  likedByClient: boolean
}

export function createQuestionSetId(prefix = 'set'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isGeneratedQuestionSetTitle(title: string, setId: string): boolean {
  const normalizedTitle = title.trim()
  if (!normalizedTitle) return true
  if (normalizedTitle === setId) return true
  if (normalizedTitle === setId.replace(/^set-/, '문제집 ')) return true
  if (/^(library-)?문제집\s+\d{10,}-[a-z0-9]+$/i.test(normalizedTitle)) return true

  return false
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

export async function listQuestionSetIndexFromQuestions(clientId?: string | null): Promise<QuestionSetIndexItem[]> {
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
          like_count: 0,
          weekly_like_count: 0,
          monthly_like_count: 0,
          liked_by_client: false,
        }
      }

      acc[item.set_id].question_count += 1
      return acc
    },
    {} as Record<string, QuestionSetIndexItem>,
  )

  const items = Object.values(grouped)
  const setIds = items.map((item) => item.set_id)

  if (setIds.length === 0) return items

  const { data: sets, error: setError } = await (supabase
    .from('question_sets') as any)
    .select('id, title, description, subject, grade, tags')
    .in('id', setIds)

  if (setError) throw setError

  const setById = new Map(
    ((sets ?? []) as Pick<QuestionSetRow, 'id' | 'title' | 'description' | 'subject' | 'grade' | 'tags'>[])
      .map((set) => [set.id, set]),
  )

  const likeSummaryById = await getQuestionSetLikeSummaries(setIds, clientId)

  return items.map((item) => {
    const set = setById.get(item.set_id)
    const likeSummary = likeSummaryById.get(item.set_id)
    return {
      ...item,
      title: set?.title ?? null,
      description: set?.description ?? null,
      subject: set?.subject ?? null,
      grade: set?.grade ?? null,
      tags: set?.tags ?? [],
      like_count: likeSummary?.likeCount ?? 0,
      weekly_like_count: likeSummary?.weeklyLikeCount ?? 0,
      monthly_like_count: likeSummary?.monthlyLikeCount ?? 0,
      liked_by_client: likeSummary?.likedByClient ?? false,
    }
  })
}

function isMissingLikesTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = String((error as { message?: unknown }).message ?? '')
  const code = String((error as { code?: unknown }).code ?? '')
  return code === '42P01' || message.includes('question_set_likes')
}

export async function getQuestionSetLikeSummaries(
  setIds: string[],
  clientId?: string | null,
): Promise<Map<string, QuestionSetLikeSummary>> {
  const summaries = new Map<string, QuestionSetLikeSummary>(
    setIds.map((setId) => [setId, {
      setId,
      likeCount: 0,
      weeklyLikeCount: 0,
      monthlyLikeCount: 0,
      likedByClient: false,
    } satisfies QuestionSetLikeSummary]),
  )

  if (setIds.length === 0) return summaries

  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)
  const monthAgo = new Date(now)
  monthAgo.setMonth(now.getMonth() - 1)

  const { data, error } = await (supabase
    .from('question_set_likes') as any)
    .select('set_id, client_id, created_at')
    .in('set_id', setIds)

  if (error) {
    if (isMissingLikesTableError(error)) return summaries
    throw error
  }

  ;((data ?? []) as Array<{ set_id: string; client_id: string; created_at: string }>).forEach((like) => {
    const summary = summaries.get(like.set_id)
    if (!summary) return

    const likedAt = new Date(like.created_at)
    summary.likeCount += 1
    if (likedAt >= weekAgo) summary.weeklyLikeCount += 1
    if (likedAt >= monthAgo) summary.monthlyLikeCount += 1
    if (clientId && like.client_id === clientId) summary.likedByClient = true
  })

  return summaries
}

export async function toggleQuestionSetLike(
  setId: string,
  clientId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const { error } = await (supabase
      .from('question_set_likes') as any)
      .insert({ set_id: setId, client_id: clientId })

    if (error && !String(error.code ?? '').startsWith('23')) throw error
    return
  }

  const { error } = await (supabase
    .from('question_set_likes') as any)
    .delete()
    .eq('set_id', setId)
    .eq('client_id', clientId)

  if (error) throw error
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
  const { data: sourceSet, error: setError } = await (supabase
    .from('question_sets') as any)
    .select('title, description, subject, grade, tags')
    .eq('id', sourceSetId)
    .maybeSingle()

  if (setError) throw setError

  const { data: questions, error } = await (supabase
    .from('questions') as any)
    .select('type, question_text, options, answer')
    .eq('set_id', sourceSetId)

  if (error) throw error
  if (!questions || questions.length === 0) {
    throw new Error('복사할 문제가 없습니다.')
  }

  const newSetId = createQuestionSetId('library-set')
  const sourceTitle = (sourceSet as Pick<QuestionSetRow, 'title'> | null)?.title?.trim()
  const copyTitle = sourceTitle && !isGeneratedQuestionSetTitle(sourceTitle, sourceSetId)
    ? sourceTitle
    : '자료실 문제집'

  await createQuestionSet({
    id: newSetId,
    title: copyTitle,
    description: (sourceSet as Pick<QuestionSetRow, 'description'> | null)?.description ?? '라이브러리에서 가져온 문제집',
    subject: (sourceSet as Pick<QuestionSetRow, 'subject'> | null)?.subject ?? null,
    grade: (sourceSet as Pick<QuestionSetRow, 'grade'> | null)?.grade ?? null,
    tags: (sourceSet as Pick<QuestionSetRow, 'tags'> | null)?.tags ?? [],
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
