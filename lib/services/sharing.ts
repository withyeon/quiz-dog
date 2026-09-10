import { supabase } from '@/lib/supabase/client'
import { createPublicServerClient } from '@/lib/supabase/publicServer'
import type { Database } from '@/types/database.types'

type QuestionSetRow = Database['public']['Tables']['question_sets']['Row']
type QuestionRow = Database['public']['Tables']['questions']['Row']

/**
 * 공유 코드에 쓰는 글자.
 * 0/O, 1/l/I 처럼 눈으로 헷갈리는 글자는 뺐다. 링크는 보통 눌러서 가지만,
 * 인디스쿨 댓글이나 메신저에서 손으로 옮겨 적는 선생님이 반드시 나온다.
 */
const SHARE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_CODE_LENGTH = 8

export function generateShareCode(length = SHARE_CODE_LENGTH): string {
  const alphabet = SHARE_CODE_ALPHABET
  const out: string[] = []

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(length)
    globalThis.crypto.getRandomValues(bytes)
    for (let i = 0; i < length; i += 1) {
      out.push(alphabet[bytes[i] % alphabet.length])
    }
    return out.join('')
  }

  for (let i = 0; i < length; i += 1) {
    out.push(alphabet[Math.floor(Math.random() * alphabet.length)])
  }
  return out.join('')
}

export function buildShareUrl(shareCode: string, origin?: string): string {
  const base = origin
    ?? (typeof window !== 'undefined' ? window.location.origin : 'https://quizdog.kr')
  return `${base}/s/${shareCode}`
}

/** 유니크 인덱스 위반(같은 코드가 이미 있음) */
function isUniqueViolation(error: unknown): boolean {
  return String((error as { code?: unknown })?.code ?? '') === '23505'
}

/**
 * 문제집의 공유 코드를 확보한다. 이미 있으면 그대로 쓴다.
 *
 * 코드를 한 번 만들면 계속 유지하는 게 핵심이다. 공유를 껐다 켤 때마다 새 코드를
 * 발급하면 인디스쿨에 이미 올려둔 링크가 죽는다.
 */
export async function ensureShareCode(setId: string): Promise<string> {
  const { data: existing, error: readError } = await (supabase
    .from('question_sets') as any)
    .select('share_code')
    .eq('id', setId)
    .maybeSingle()

  if (readError) throw readError
  const current = (existing as Pick<QuestionSetRow, 'share_code'> | null)?.share_code
  if (current) return current

  // 충돌은 8자 기준으로 사실상 안 나지만, 나더라도 조용히 다시 뽑는다.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateShareCode()
    const { error } = await (supabase
      .from('question_sets') as any)
      .update({ share_code: candidate })
      .eq('id', setId)
      .is('share_code', null)

    if (!error) {
      // 다른 요청이 먼저 코드를 넣었을 수도 있으니 실제 저장된 값을 다시 읽는다.
      const { data: saved } = await (supabase
        .from('question_sets') as any)
        .select('share_code')
        .eq('id', setId)
        .maybeSingle()
      const code = (saved as Pick<QuestionSetRow, 'share_code'> | null)?.share_code
      if (code) return code
    } else if (!isUniqueViolation(error)) {
      throw error
    }
  }

  throw new Error('공유 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
}

/** 링크 공유 켜기/끄기. 코드는 그대로 두고 노출 여부만 바꾼다. */
export async function setLinkSharing(setId: string, enabled: boolean): Promise<string | null> {
  if (!enabled) {
    const { error } = await (supabase
      .from('question_sets') as any)
      .update({ is_shared: false })
      .eq('id', setId)
    if (error) throw error
    return null
  }

  const shareCode = await ensureShareCode(setId)
  const { error } = await (supabase
    .from('question_sets') as any)
    .update({ is_shared: true, shared_at: new Date().toISOString() })
    .eq('id', setId)
  if (error) throw error

  return shareCode
}

/** 자료실 등재 여부. 링크 공유와는 독립이다. */
export async function setLibraryListing(setId: string, isPublic: boolean): Promise<void> {
  const { error } = await (supabase
    .from('question_sets') as any)
    .update({ is_public: isPublic })
    .eq('id', setId)
  if (error) throw error
}

/**
 * 사람이 쓴 설명인지 판별한다.
 *
 * 문제집을 AI로 만들거나 자료실에서 가져오면 설명이 자동으로 채워진다
 * ("AI로 생성된 문제집 (file)" 등). 지금 전체의 절반 가까이가 이런 값이라
 * 그대로 두면 인디스쿨·카톡 링크 미리보기 문구가 전부 이 문장으로 나간다.
 * 자리표시자면 없는 것으로 보고, 학년·과목·문항수 요약을 대신 쓴다.
 */
const PLACEHOLDER_DESCRIPTION =
  /^(AI로 생성된 문제집(\s*\(.*\))?|라이브러리에서 가져온 문제집|자료실 문제집)$/

export function meaningfulDescription(description: string | null | undefined): string | null {
  const trimmed = String(description ?? '').trim()
  if (!trimmed || PLACEHOLDER_DESCRIPTION.test(trimmed)) return null
  return trimmed
}

export type SharedQuestionSet = {
  id: string
  shareCode: string
  title: string
  description: string | null
  subject: string | null
  grade: string | null
  tags: string[]
  questionCount: number
  questions: Pick<QuestionRow, 'id' | 'type' | 'question_text' | 'options' | 'answer'>[]
  ownerName: string | null
  forkedFromName: string | null
  likeCount: number
  isPublic: boolean
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
}

/**
 * 공유 링크로 열리는 문제집을 서버에서 읽는다.
 * is_shared 가 꺼져 있으면 없는 것으로 취급한다(링크를 회수한 경우).
 */
export async function getSharedSetByCode(shareCode: string): Promise<SharedQuestionSet | null> {
  const client = createPublicServerClient()

  const { data: set, error } = await (client
    .from('question_sets') as any)
    .select('id, title, description, subject, grade, tags, owner_id, is_public, is_shared, share_code, forked_from')
    .eq('share_code', shareCode)
    // 링크를 켠 문제집이거나, 자료실에 등재된 문제집이면 공개로 본다.
    // (자료실 카드가 이 주소로 연결되므로 둘 다 열려 있어야 한다)
    .or('is_shared.eq.true,is_public.eq.true')
    .maybeSingle()

  if (error || !set) return null

  const row = set as QuestionSetRow & { forked_from: string | null }

  const [{ data: questions }, { count: likeCount }] = await Promise.all([
    (client.from('questions') as any)
      .select('id, type, question_text, options, answer')
      .eq('set_id', row.id)
      .order('created_at', { ascending: true }),
    (client.from('question_set_likes') as any)
      .select('*', { count: 'exact', head: true })
      .eq('set_id', row.id),
  ])

  const ownerName = await lookupDisplayName(client, row.owner_id)
  const forkedFromName = row.forked_from
    ? await lookupForkSourceOwnerName(client, row.forked_from)
    : null

  return {
    id: row.id,
    shareCode,
    title: row.title,
    description: meaningfulDescription(row.description),
    subject: row.subject,
    grade: row.grade,
    tags: normalizeTags(row.tags),
    questionCount: (questions ?? []).length,
    questions: (questions ?? []) as SharedQuestionSet['questions'],
    ownerName,
    forkedFromName,
    likeCount: likeCount ?? 0,
    isPublic: row.is_public,
  }
}

async function lookupDisplayName(
  client: ReturnType<typeof createPublicServerClient>,
  ownerId: string | null,
): Promise<string | null> {
  if (!ownerId) return null
  const { data } = await (client.from('profiles') as any)
    .select('display_name')
    .eq('id', ownerId)
    .maybeSingle()
  const name = (data as { display_name: string | null } | null)?.display_name?.trim()
  return name ? name : null
}

async function lookupForkSourceOwnerName(
  client: ReturnType<typeof createPublicServerClient>,
  sourceSetId: string,
): Promise<string | null> {
  const { data } = await (client.from('question_sets') as any)
    .select('owner_id')
    .eq('id', sourceSetId)
    .maybeSingle()
  return lookupDisplayName(client, (data as { owner_id: string | null } | null)?.owner_id ?? null)
}

/** 공유 페이지 조회수 +1 (실패해도 페이지는 그대로 보여준다) */
export async function bumpShareView(shareCode: string): Promise<void> {
  try {
    const client = createPublicServerClient()
    await (client.rpc as any)('bump_question_set_view', { p_share_code: shareCode })
  } catch {
    // 통계는 부가 기능이므로 조용히 넘어간다.
  }
}

/** 공유받은 문제집으로 실제 게임을 연 횟수 +1 */
export async function bumpSharePlay(setId: string): Promise<void> {
  try {
    await (supabase.rpc as any)('bump_question_set_play', { p_set_id: setId })
  } catch {
    // 통계는 부가 기능이므로 조용히 넘어간다.
  }
}

export type PublicSetCard = {
  id: string
  shareCode: string | null
  title: string
  description: string | null
  subject: string | null
  grade: string | null
  questionCount: number
  likeCount: number
  ownerName: string | null
}

/**
 * 로그인 없이 볼 수 있는 자료실 목록.
 *
 * 서버에서 읽어 정적으로 내보내면 검색엔진에도 잡히고,
 * 인디스쿨 글 하나가 아니라 사이트 자체가 유입 경로가 된다.
 */
export async function listPublicSets(limit = 60): Promise<PublicSetCard[]> {
  const client = createPublicServerClient()

  const { data: sets, error } = await (client
    .from('question_sets') as any)
    .select('id, title, description, subject, grade, owner_id, share_code')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !sets) return []

  const rows = sets as (Pick<QuestionSetRow,
    'id' | 'title' | 'description' | 'subject' | 'grade' | 'owner_id' | 'share_code'>)[]
  if (rows.length === 0) return []

  const setIds = rows.map((row) => row.id)
  const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))]

  // 문항 수와 좋아요는 문제집마다 따로 세면 요청이 수십 번 나간다.
  // 한 번에 받아서 메모리에서 묶는다.
  const [{ data: questionRows }, { data: likeRows }, { data: profileRows }] = await Promise.all([
    (client.from('questions') as any).select('set_id').in('set_id', setIds),
    (client.from('question_set_likes') as any).select('set_id').in('set_id', setIds),
    ownerIds.length > 0
      ? (client.from('profiles') as any).select('id, display_name').in('id', ownerIds)
      : Promise.resolve({ data: [] }),
  ])

  const countBySet = (list: { set_id: string }[] | null) => {
    const counts = new Map<string, number>()
    for (const row of list ?? []) counts.set(row.set_id, (counts.get(row.set_id) ?? 0) + 1)
    return counts
  }

  const questionCounts = countBySet(questionRows as { set_id: string }[] | null)
  const likeCounts = countBySet(likeRows as { set_id: string }[] | null)
  const nameById = new Map(
    ((profileRows ?? []) as { id: string; display_name: string | null }[])
      .map((row) => [row.id, row.display_name?.trim() || null]),
  )

  return rows
    .map((row) => ({
      id: row.id,
      shareCode: row.share_code,
      title: row.title,
      description: meaningfulDescription(row.description),
      subject: row.subject,
      grade: row.grade,
      questionCount: questionCounts.get(row.id) ?? 0,
      likeCount: likeCounts.get(row.id) ?? 0,
      ownerName: row.owner_id ? nameById.get(row.owner_id) ?? null : null,
    }))
    // 문제가 하나도 없는 문제집은 열어봐야 빈 화면이라 목록에서 뺀다.
    .filter((card) => card.questionCount > 0)
}
