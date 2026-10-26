import { supabase } from '@/lib/supabase/client'
import {
  createQuestionSet,
  createQuestionSetId,
  deleteQuestionSet,
  getQuestionSetWithQuestions,
  updateQuestionSetMetadata,
  validateQuestionSetMetadata,
  type QuestionSetMetadataInput,
} from '@/lib/services/questionSets'
import { buildVocabQuestions, cardsFromQuestions, validateVocabCards, type VocabCard } from '@/lib/vocab/cards'
import type { Database } from '@/types/database.types'

type QuestionSetInsert = Database['public']['Tables']['question_sets']['Insert']

/** sql/20261025_vocab_sets.sql 을 아직 안 돌린 DB면 kind 컬럼이 없다 */
function isMissingKindColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  return (e.code === '42703' || e.code === 'PGRST204') && /kind/.test(e.message ?? '')
}

const MIGRATION_NEEDED_MESSAGE =
  '단어장을 저장하려면 DB 업데이트가 필요해요. (관리자: sql/20261025_vocab_sets.sql 실행)'

function assertValid(metadata: QuestionSetMetadataInput, cards: VocabCard[]) {
  const errors = [...validateQuestionSetMetadata(metadata), ...validateVocabCards(cards).errors]
    .map((message) => message.replace('문제집 이름', '단어장 이름'))
  if (errors.length > 0) throw new Error(errors.join('\n'))
}

/**
 * 카드 순서대로 1ms씩 늘어나는 created_at 을 붙여 넣거나 고친다.
 * 문제 순서는 created_at 으로만 정해지므로(lib/services/questionSets.ts 의 stampAuthoredOrder),
 * 고칠 때도 모든 카드에 다시 붙여야 중간에 끼워 넣은 카드가 제자리에 선다.
 * 새 카드는 id 를 여기서 만들어 기존 카드와 함께 upsert 한 번으로 보낸다.
 */
async function upsertCards(setId: string, cards: VocabCard[]): Promise<void> {
  const base = Date.now()
  const rows = buildVocabQuestions(cards).map((question, index) => ({
    id: question.id ?? crypto.randomUUID(),
    set_id: setId,
    type: question.type,
    question_text: question.question_text,
    options: question.options,
    answer: question.answer,
    created_at: new Date(base + index).toISOString(),
  }))
  const { error } = await (supabase.from('questions') as any).upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

export async function createVocabSet(input: {
  metadata: QuestionSetMetadataInput
  cards: VocabCard[]
  isPublic?: boolean
}): Promise<string> {
  assertValid(input.metadata, input.cards)
  const setId = createQuestionSetId()

  try {
    await createQuestionSet({
      id: setId,
      title: input.metadata.title.trim(),
      description: input.metadata.description ?? null,
      subject: input.metadata.subject ?? null,
      grade: input.metadata.grade ?? null,
      tags: input.metadata.tags ?? [],
      is_public: input.isPublic ?? false,
      kind: 'vocab',
    } as QuestionSetInsert)
  } catch (error) {
    if (isMissingKindColumn(error)) throw new Error(MIGRATION_NEEDED_MESSAGE)
    throw error
  }

  try {
    await upsertCards(setId, input.cards.map(({ term, definition }) => ({ term, definition })))
  } catch (error) {
    await deleteQuestionSet(setId).catch((rollbackError) => {
      console.error('카드 저장 실패 후 단어장 롤백 실패:', rollbackError)
    })
    throw error
  }

  return setId
}

export type LoadedVocabSet = {
  id: string
  title: string
  subject: string
  grade: string
  isPublic: boolean
  isVocab: boolean
  cards: Required<VocabCard>[]
}

export async function getVocabSet(setId: string): Promise<LoadedVocabSet | null> {
  const { set, questions } = await getQuestionSetWithQuestions(setId)
  if (!set) return null
  return {
    id: set.id,
    title: set.title,
    subject: set.subject ?? '',
    grade: set.grade ?? '',
    isPublic: set.is_public,
    isVocab: set.kind === 'vocab',
    cards: cardsFromQuestions(questions),
  }
}

/**
 * 단어장 고치기. 남은 카드는 id 를 유지해(게임 기록의 answer_history 가 문제 id 를 가리킨다) 고치고,
 * 지운 카드만 삭제한다. 보기는 다른 카드의 뜻으로 만들므로 매번 전체를 다시 만든다.
 */
export async function updateVocabSet(input: {
  setId: string
  metadata: QuestionSetMetadataInput
  cards: VocabCard[]
  /** 처음 불러왔을 때의 카드 id (지운 카드를 찾는 데 쓴다) */
  originalIds: string[]
}): Promise<void> {
  assertValid(input.metadata, input.cards)
  const keptIds = new Set(input.cards.map((card) => card.id).filter((id): id is string => Boolean(id)))
  const removedIds = input.originalIds.filter((id) => !keptIds.has(id))

  await updateQuestionSetMetadata(input.setId, input.metadata)
  await upsertCards(input.setId, input.cards)

  // 지울 id 가 많으면 URL 이 길어지므로 나눠 보낸다
  for (let index = 0; index < removedIds.length; index += 100) {
    const { error } = await (supabase.from('questions') as any)
      .delete()
      .eq('set_id', input.setId)
      .in('id', removedIds.slice(index, index + 100))
    if (error) throw error
  }
}
