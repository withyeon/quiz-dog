import { supabase } from '@/lib/supabase/client'
import type { Database, Json } from '@/types/database.types'
import { isMultiSelectQuestion, splitMultiSelectAnswer } from '@/lib/quiz/multiSelect'

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
  /** 문제 그림 URL. undefined면 건드리지 않고, null이면 지운다. */
  image_url?: string | null
  /** 해설(선택). undefined면 건드리지 않고, null이나 빈 문자열이면 지운다. */
  explanation?: string | null
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

/** 현재 로그인한 선생님의 user id (비로그인 시 null) */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
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

/**
 * setTitle 은 저장할 문제집 이름이다. 구성치기 문제집의 다중 선택 문제(lib/quiz/multiSelect.ts)는
 * answer 가 "마황, 계지, …"라 보기 하나와 같을 수 없으므로, 정답 항목이 모두 보기 안에 있는지로 본다.
 * 세세한 규칙(보기 4~20개 등)은 검수 화면(lib/quiz/questionQuality.ts)이 먼저 걸러 준다.
 */
export function validateQuestionDraft(question: QuestionDraft, setTitle?: string | null): string[] {
  const errors: string[] = []
  const questionText = question.question_text?.trim() ?? ''
  const answer = question.answer?.trim() ?? ''

  if (!question.type) errors.push('문제 유형을 선택해주세요.')
  if (!questionText) errors.push('문제 내용을 입력해주세요.')
  if (!answer) errors.push('정답을 입력해주세요.')

  if (isMultiSelectQuestion({ type: question.type, answer }, setTitle)) {
    const options = normalizeQuestionOptions(question.options)
    const answers = splitMultiSelectAnswer(answer)
    if (options.length < 2) {
      errors.push('객관식 문제는 보기가 2개 이상 필요합니다.')
    }
    if (answers.length < 2) {
      errors.push('여러 개 고르기 문제는 정답이 2개 이상 필요합니다.')
    }
    const missing = answers.filter((item) => !options.includes(item))
    if (missing.length > 0) {
      errors.push(`정답 ${missing.join(', ')}이(가) 보기에 포함되어 있지 않습니다.`)
    }
  } else if (question.type === 'CHOICE') {
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

export function normalizeQuestionDraft(question: QuestionDraft, setTitle?: string | null): Omit<QuestionInsert, 'set_id'> {
  const errors = validateQuestionDraft(question, setTitle)
  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return {
    type: question.type!,
    question_text: question.question_text!.trim(),
    options: normalizeQuestionOptions(question.options),
    answer: question.answer!.trim(),
    // 키가 있을 때만 보낸다. 그림 없는 문제는 image_url 컬럼이 없는 DB에서도 저장돼야 한다.
    ...(question.image_url !== undefined
      ? { image_url: question.image_url?.trim() || null }
      : {}),
    // 해설도 같은 규칙: 키가 있을 때만 보낸다 (explanation 컬럼이 없는 DB에서도 저장돼야 한다).
    ...(question.explanation !== undefined
      ? { explanation: question.explanation?.trim() || null }
      : {}),
  }
}

export function validateQuestionSetMetadata(input: QuestionSetMetadataInput): string[] {
  const errors: string[] = []
  if (!input.title.trim()) errors.push('문제집 이름을 입력해주세요.')
  if (!input.subject) errors.push('과목을 선택해주세요.')
  if (!input.grade) errors.push('대상 학년을 선택해주세요.')
  return errors
}

// Supabase(PostgREST)는 select 한 번의 응답을 최대 1000행(max_rows)에서 에러 없이 잘라 버린다.
// 문제가 1000개를 넘자 문항 수가 조용히 모자라게 나왔으므로(6문제 → 4문제), 행이 많을 수 있는
// 조회는 range 로 1000행씩 나눠 짧은 페이지가 올 때까지 끝까지 읽는다.
// 페이지 사이에 행이 겹치거나 빠지지 않도록, 넘기는 쿼리는 반드시 유일한 컬럼(id)까지 넣어 정렬해야 한다.
// (한 번에 넣은 문제들은 created_at 이 같아서 created_at 만으로는 순서가 고정되지 않는다)
const SELECT_PAGE_SIZE = 1000

async function selectAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += SELECT_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + SELECT_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < SELECT_PAGE_SIZE) return rows
  }
}

// .in() 에 문제집 id 를 한꺼번에 넣으면 문제집이 늘수록 GET URL 이 길어져 요청이 거절될 수 있어
// 이만큼씩 나눠 보낸다. (id 는 30자 남짓이라 100개면 URL 이 몇 KB 안에 머문다)
const IN_FILTER_CHUNK_SIZE = 100

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += IN_FILTER_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + IN_FILTER_CHUNK_SIZE))
  }
  return chunks
}

/**
 * "내 문제집" 목록. ownerId를 주면 해당 선생님 소유 문제집만 반환한다.
 * (ownerId 미지정 시 전체 — /dev 등 관리 용도)
 * 문항 수는 set별 개별 쿼리(N+1) 대신 한 번에 묶어서 센다.
 */
export async function listQuestionSetsWithCounts(ownerId?: string | null): Promise<QuestionSetSummary[]> {
  let query = (supabase.from('question_sets') as any)
    .select('*')
    .order('created_at', { ascending: false })

  if (ownerId) query = query.eq('owner_id', ownerId)

  const { data: sets, error } = await query
  if (error) throw error

  const rows = (sets ?? []) as QuestionSetRow[]
  if (rows.length === 0) return []

  const setIds = rows.map((set) => set.id)
  // 문항 수를 세려고 set_id 만 읽는데, 전체 문제 행 수가 1000을 넘으므로 페이지로 끝까지 읽는다.
  const questionRowChunks = await Promise.all(
    chunkIds(setIds).map((idChunk) =>
      selectAllPages<Pick<QuestionRow, 'set_id'>>((from, to) =>
        supabase
          .from('questions')
          .select('set_id')
          .in('set_id', idChunk)
          .order('id', { ascending: true })
          .range(from, to),
      ),
    ),
  )

  const countBySet = new Map<string, number>()
  questionRowChunks.flat().forEach((row) => {
    countBySet.set(row.set_id, (countBySet.get(row.set_id) ?? 0) + 1)
  })

  return rows.map((set) => ({ ...set, question_count: countBySet.get(set.id) ?? 0 }))
}

export async function listQuestionSetIndexFromQuestions(
  clientId?: string | null,
  options?: { onlyPublic?: boolean },
): Promise<QuestionSetIndexItem[]> {
  const onlyPublic = options?.onlyPublic ?? false
  // 모든 문제 행을 읽어 문제집별로 묶으므로 1000행 제한에 걸리지 않게 페이지로 끝까지 읽는다.
  const data = await selectAllPages<Pick<QuestionRow, 'set_id' | 'created_at'>>((from, to) =>
    (supabase
      .from('questions') as any)
      .select('set_id, created_at')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )

  const grouped = data.reduce(
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

  type IndexSetMeta = Pick<QuestionSetRow, 'id' | 'title' | 'description' | 'subject' | 'grade' | 'tags' | 'is_public'>
  // 문제집 수만큼 id 를 넣으므로 나눠 보낸다. 묶음마다 행이 100개 이하라 1000행 제한에도 걸리지 않는다.
  const setChunks = await Promise.all(
    chunkIds(setIds).map(async (idChunk) => {
      const { data: sets, error: setError } = await (supabase
        .from('question_sets') as any)
        .select('id, title, description, subject, grade, tags, is_public')
        .in('id', idChunk)

      if (setError) throw setError
      return (sets ?? []) as IndexSetMeta[]
    }),
  )
  const setById = new Map(
    setChunks.flat().map((set) => [set.id, set]),
  )

  // 자료실(onlyPublic)에서는 공개로 설정된 문제집만 노출한다.
  const visibleItems = onlyPublic
    ? items.filter((item) => setById.get(item.set_id)?.is_public === true)
    : items

  const visibleSetIds = visibleItems.map((item) => item.set_id)
  const likeSummaryById = await getQuestionSetLikeSummaries(visibleSetIds, clientId)

  return visibleItems.map((item) => {
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

  type LikeRow = { set_id: string; client_id: string; created_at: string }
  // 좋아요도 문제집마다 쌓이는 행이라 언젠가 1000개를 넘는다. 문항 수와 같은 이유로 나눠서 끝까지 읽는다.
  let likes: LikeRow[]
  try {
    const likeChunks = await Promise.all(
      chunkIds(setIds).map((idChunk) =>
        selectAllPages<LikeRow>((from, to) =>
          (supabase
            .from('question_set_likes') as any)
            .select('set_id, client_id, created_at')
            .in('set_id', idChunk)
            .order('id', { ascending: true })
            .range(from, to),
        ),
      ),
    )
    likes = likeChunks.flat()
  } catch (error) {
    if (isMissingLikesTableError(error)) return summaries
    throw error
  }

  likes.forEach((like) => {
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

async function ensureQuestionSetLikeTarget(setId: string): Promise<void> {
  const { data: existingSet, error: setError } = await (supabase
    .from('question_sets') as any)
    .select('id')
    .eq('id', setId)
    .maybeSingle()

  if (setError) throw setError
  if (existingSet) return

  const { count, error: countError } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('set_id', setId)

  if (countError) throw countError
  if (!count) {
    throw new Error('좋아요할 문제집을 찾을 수 없습니다.')
  }

  const { error: insertError } = await (supabase
    .from('question_sets') as any)
    .insert({
      id: setId,
      title: '자료실 문제집',
      description: '자료실 좋아요를 위해 자동 등록된 문제집',
      tags: [],
      is_public: true,
    } satisfies QuestionSetInsert)

  if (insertError && !String(insertError.code ?? '').startsWith('23')) throw insertError
}

export async function toggleQuestionSetLike(
  setId: string,
  clientId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    await ensureQuestionSetLikeTarget(setId)

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

/** 게임 화면 헤더에 띄울 문제집 이름만 가볍게 가져온다. */
export async function getQuestionSetTitle(setId: string): Promise<string | null> {
  const { data, error } = await (supabase
    .from('question_sets') as any)
    .select('title')
    .eq('id', setId)
    .maybeSingle()

  if (error) throw error
  return (data?.title as string | undefined) ?? null
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
    // 예전에 한 번에 넣어 created_at이 같은 문제들은 id로 순서를 고정한다 (stampAuthoredOrder 참고)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (questionError) throw questionError

  return {
    set: set as QuestionSetRow | null,
    questions: (questions ?? []) as QuestionRow[],
  }
}

export async function createQuestionSet(input: QuestionSetInsert): Promise<QuestionSetRow> {
  // owner_id가 명시되지 않았으면 현재 로그인한 선생님으로 자동 지정한다.
  const ownerId = input.owner_id ?? (await getCurrentUserId())
  // 이름은 NFC 로 맞춰 저장한다. macOS 파일 이름(NFD, 자모 분리)에서 온 이름은 똑같이 보여도
  // NFC 로 친 검색어(includes·ilike)에 안 걸린다. 새로 만들기·복사(duplicate·copy)가 모두 여기를 거친다.
  const { data, error } = await (supabase
    .from('question_sets') as any)
    .insert({ ...input, title: input.title.normalize('NFC'), owner_id: ownerId })
    .select()
    .single()

  if (error) throw error
  return data as QuestionSetRow
}

export async function createQuestionSetWithQuestions(input: {
  metadata: QuestionSetMetadataInput
  questions: QuestionDraft[]
  idPrefix?: string
  isPublic?: boolean
}): Promise<string> {
  const metadataErrors = validateQuestionSetMetadata(input.metadata)
  if (metadataErrors.length > 0) {
    throw new Error(metadataErrors.join('\n'))
  }

  if (input.questions.length === 0) {
    throw new Error('저장할 문제가 없습니다.')
  }

  const normalizedQuestions = input.questions.map((question) => normalizeQuestionDraft(question, input.metadata.title))
  const setId = createQuestionSetId(input.idPrefix)

  await createQuestionSet({
    id: setId,
    title: input.metadata.title.trim(),
    description: input.metadata.description ?? null,
    subject: input.metadata.subject ?? null,
    grade: input.metadata.grade ?? null,
    tags: input.metadata.tags ?? [],
    is_public: input.isPublic ?? false,
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

  // 이름 수정도 NFC 로 맞춘다(createQuestionSet 과 같은 이유)
  if (input.title !== undefined) payload.title = input.title.normalize('NFC').trim()
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

/**
 * 한 번에 넣는 문제마다 1ms씩 늘어나는 created_at을 붙인다.
 * 문제 순서는 created_at으로만 정하는데(listQuestionsForGame 등), 한 번에 여러 줄을 넣으면 DB 기본값 NOW()가
 * 모든 줄에 같은 시각을 넣어 순서가 정해지지 않는다. 그러면 문제를 고친(UPDATE) 뒤 첫 문제가 맨 뒤로 가는 식으로
 * 공부 모드의 "문제집 순서"가 뒤섞인다. 기준 시각은 브라우저 시계지만, 한 묶음 안의 앞뒤만 맞으면 된다.
 */
function stampAuthoredOrder(questions: QuestionInsert[]): QuestionInsert[] {
  const base = Date.now()
  return questions.map((question, index) => ({
    ...question,
    created_at: new Date(base + index).toISOString(),
  }))
}

export async function insertQuestions(questions: QuestionInsert[]): Promise<QuestionRow[]> {
  if (questions.length === 0) return []

  const { data, error } = await (supabase
    .from('questions') as any)
    .insert(stampAuthoredOrder(questions))
    .select()

  if (error) throw error
  return (data ?? []) as QuestionRow[]
}

/** setTitle: 문제집 이름(구성치기 다중 선택 검사용, validateQuestionDraft 참고) */
export async function createQuestionInSet(setId: string, question: QuestionDraft, setTitle?: string | null): Promise<QuestionRow> {
  const normalizedQuestion = normalizeQuestionDraft(question, setTitle)
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

/** setTitle: 문제집 이름(구성치기 다중 선택 검사용, validateQuestionDraft 참고) */
export async function updateQuestion(questionId: string, question: QuestionDraft, setTitle?: string | null): Promise<void> {
  const normalizedQuestion = normalizeQuestionDraft(question, setTitle)
  const payload: QuestionUpdate = {
    type: normalizedQuestion.type,
    question_text: normalizedQuestion.question_text,
    options: normalizedQuestion.options,
    answer: normalizedQuestion.answer,
  }
  if (normalizedQuestion.image_url !== undefined) {
    payload.image_url = normalizedQuestion.image_url
  }
  if (normalizedQuestion.explanation !== undefined) {
    payload.explanation = normalizedQuestion.explanation
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

/** setTitle: 가져와 넣을 문제집 이름(구성치기 다중 선택 검사용, validateQuestionDraft 참고) */
export async function copyQuestionsIntoSet(setId: string, questions: QuestionDraft[], setTitle?: string | null): Promise<QuestionRow[]> {
  if (questions.length === 0) return []

  const normalizedQuestions = questions.map((question) => normalizeQuestionDraft(question, setTitle))
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

  // 원본 순서대로 읽어야 사본도 같은 순서로 저장된다
  const { data: questions, error: questionError } = await (supabase
    .from('questions') as any)
    .select('*')
    .eq('set_id', setId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (questionError) throw questionError

  const newSetId = createQuestionSetId()
  await createQuestionSet({
    id: newSetId,
    title: title ?? `${sourceSet.title} (복사본)`,
    description: sourceSet.description,
    subject: sourceSet.subject,
    grade: sourceSet.grade,
    tags: sourceSet.tags,
    forked_from: sourceSet.forked_from ?? null,
    // 단어장 사본도 단어장이다 (kind 컬럼이 없는 DB면 키를 아예 안 보낸다)
    ...(sourceSet.kind ? { kind: sourceSet.kind } : {}),
    // 사본은 원본과 같은 폴더에 둔다 (folder_id 컬럼이 없는 DB면 키를 안 보낸다)
    ...(sourceSet.folder_id ? { folder_id: sourceSet.folder_id } : {}),
  } as QuestionSetInsert)

  await insertQuestions(
    (questions ?? []).map((question: QuestionRow) => ({
      set_id: newSetId,
      type: question.type,
      question_text: question.question_text,
      options: question.options,
      answer: question.answer,
      // 그림은 같은 공개 파일을 가리키게 둔다 (복사본마다 파일을 복제하지 않는다)
      ...(question.image_url ? { image_url: question.image_url } : {}),
      ...(question.explanation ? { explanation: question.explanation } : {}),
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
    // kind(단어장 여부)는 나중에 생긴 컬럼이라 이름으로 고르지 않고 * 로 읽는다
    .select('*')
    .eq('id', sourceSetId)
    .maybeSingle()

  if (setError) throw setError

  // 원본 순서대로 읽어야 사본도 같은 순서로 저장된다
  const { data: questions, error } = await (supabase
    .from('questions') as any)
    .select('*')
    .eq('set_id', sourceSetId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

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
    // 어느 문제집에서 가져왔는지 남긴다 — 사본에도 원작자를 표시하기 위한 것.
    forked_from: sourceSetId,
    ...((sourceSet as Pick<QuestionSetRow, 'kind'> | null)?.kind ? { kind: (sourceSet as QuestionSetRow).kind } : {}),
  } as QuestionSetInsert)

  await insertQuestions(
    (questions as QuestionRow[]).map((question) => ({
      set_id: newSetId,
      type: question.type,
      question_text: question.question_text,
      options: question.options,
      answer: question.answer,
      ...(question.image_url ? { image_url: question.image_url } : {}),
      ...(question.explanation ? { explanation: question.explanation } : {}),
    }))
  )

  return newSetId
}
