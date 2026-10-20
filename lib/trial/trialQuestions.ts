import { getQuestionSetWithQuestions, listQuestionSetIndexFromQuestions } from '@/lib/services/questionSets'

/** 체험 방에 쓸 문제집의 최소 문항 수 — 2분 동안 끊기지 않을 만큼 */
export const TRIAL_MIN_QUESTIONS = 5

export type TrialSet = { id: string; title: string; questionCount: number }

/** 주소로 받은 문제집(?set=)을 체험에 쓸 수 있으면 돌려준다 */
export async function loadTrialSet(setId: string): Promise<TrialSet | null> {
  const { set, questions } = await getQuestionSetWithQuestions(setId)
  if (!set || questions.length < TRIAL_MIN_QUESTIONS) return null
  return { id: set.id, title: set.title, questionCount: questions.length }
}

/**
 * 자료실 "이번 주 바로 쓰는 퀴즈"와 같은 순서(이번 주 좋아요 → 전체 좋아요 → 최신)로 첫 문제집을 고른다.
 * 공개 문제집이 하나도 없으면 null — 그때는 체험을 열 수 없다고 안내한다.
 */
export async function loadFeaturedTrialSet(clientId: string): Promise<TrialSet | null> {
  const index = await listQuestionSetIndexFromQuestions(clientId, { onlyPublic: true })
  const best = index
    .filter((item) => item.question_count >= TRIAL_MIN_QUESTIONS)
    .sort((a, b) =>
      b.weekly_like_count - a.weekly_like_count
      || b.like_count - a.like_count
      || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  if (!best) return null
  return { id: best.set_id, title: best.title?.trim() || '자료실 문제집', questionCount: best.question_count }
}
