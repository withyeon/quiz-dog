import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/types/database.types'

export type QuestionSetFolder = Database['public']['Tables']['question_set_folders']['Row']

export const FOLDER_NAME_MAX_LENGTH = 30

export const FOLDER_MIGRATION_NEEDED_MESSAGE =
  '폴더를 쓰려면 DB 업데이트가 필요해요. (관리자: sql/20261029_question_set_folders.sql 실행)'

/** sql/20261029_question_set_folders.sql 을 아직 안 돌린 DB면 폴더 표나 folder_id 컬럼이 없다 */
function isMissingFolderSchema(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  if (!e) return false
  const message = e.message ?? ''
  if (e.code === 'PGRST205' || e.code === '42P01') return /question_set_folders/.test(message)
  if (e.code === 'PGRST204' || e.code === '42703') return /folder_id/.test(message)
  return false
}

function toFolderError(error: unknown): Error {
  if (isMissingFolderSchema(error)) return new Error(FOLDER_MIGRATION_NEEDED_MESSAGE)
  const e = error as { code?: string } | null
  if (e?.code === '23505') return new Error('같은 이름의 폴더가 이미 있어요.')
  return error instanceof Error ? error : new Error((error as { message?: string })?.message ?? '폴더 작업에 실패했어요.')
}

export function normalizeFolderName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** 화면에 보일 오류 문구. 없으면 쓸 수 있는 이름이다. */
export function validateFolderName(name: string, existing: QuestionSetFolder[], exceptId?: string): string | null {
  const normalized = normalizeFolderName(name)
  if (!normalized) return '폴더 이름을 입력해 주세요.'
  if (normalized.length > FOLDER_NAME_MAX_LENGTH) return `폴더 이름은 ${FOLDER_NAME_MAX_LENGTH}자까지 쓸 수 있어요.`
  if (existing.some((folder) => folder.id !== exceptId && folder.name === normalized)) {
    return '같은 이름의 폴더가 이미 있어요.'
  }
  return null
}

function sortFolders(folders: QuestionSetFolder[]): QuestionSetFolder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))
}

/**
 * 선생님의 폴더 목록. 마이그레이션 전 DB면 available: false 로 알려 주고
 * 목록 화면은 폴더 없이 그대로 보인다.
 */
export async function listQuestionSetFolders(): Promise<{ folders: QuestionSetFolder[]; available: boolean }> {
  const { data, error } = await (supabase.from('question_set_folders') as any)
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingFolderSchema(error)) return { folders: [], available: false }
    throw error
  }
  return { folders: sortFolders((data ?? []) as QuestionSetFolder[]), available: true }
}

export async function createQuestionSetFolder(name: string): Promise<QuestionSetFolder> {
  // owner_id 는 DB 기본값 auth.uid() 로 채워진다
  const { data, error } = await (supabase.from('question_set_folders') as any)
    .insert({ name: normalizeFolderName(name) })
    .select('*')
    .single()

  if (error) throw toFolderError(error)
  return data as QuestionSetFolder
}

export async function renameQuestionSetFolder(folderId: string, name: string): Promise<void> {
  const { error } = await (supabase.from('question_set_folders') as any)
    .update({ name: normalizeFolderName(name) })
    .eq('id', folderId)

  if (error) throw toFolderError(error)
}

/** 폴더만 지운다. 안에 있던 문제집은 DB 가 folder_id 를 NULL 로 돌린다(ON DELETE SET NULL). */
export async function deleteQuestionSetFolder(folderId: string): Promise<void> {
  const { error } = await (supabase.from('question_set_folders') as any)
    .delete()
    .eq('id', folderId)

  if (error) throw toFolderError(error)
}

/** 문제집을 폴더로 옮긴다. folderId 가 null 이면 폴더 밖('폴더 없음')으로 꺼낸다. */
export async function moveQuestionSetsToFolder(setIds: string[], folderId: string | null): Promise<void> {
  if (setIds.length === 0) return
  const { error } = await (supabase.from('question_sets') as any)
    .update({ folder_id: folderId })
    .in('id', setIds)

  if (error) throw toFolderError(error)
}
