import { getAdminSupabase } from '@/lib/supabase/admin'
import { getTeacherPlan } from '@/lib/server/teacherPlan'
import { AI_MONTHLY_LIMIT, kstMonthStartIso, kstNextMonthStartIso, type PlanName } from '@/lib/plans'

export type AiUsage = {
  plan: PlanName
  /** 이번 달(KST) 쓴 횟수 */
  used: number
  /** 이번 달 한도. null 이면 무제한(프로) */
  limit: number | null
  /** 다음 달 1일(KST) ISO — 한도가 다시 차는 때 */
  resetsAt: string
}

// ai_generation_logs 가 아직 없는 DB(sql/20261018_pro_gates.sql 적용 전)에서 난 오류인가
function isMissingTableError(error: unknown): boolean {
  const text = error instanceof Error ? error.message : JSON.stringify(error ?? '')
  return /ai_generation_logs/.test(text) && /(PGRST205|42P01|schema cache|does not exist)/i.test(text)
}

/**
 * 선생님의 이번 달 AI 생성 사용량(서버 전용). 표가 없거나 읽기에 실패하면 0 으로 본다 —
 * 집계가 깨졌다고 문제 만들기를 막으면 안 된다.
 */
export async function getAiUsage(userId: string): Promise<AiUsage> {
  const { plan } = await getTeacherPlan(userId)
  const limit = AI_MONTHLY_LIMIT[plan]
  let used = 0
  try {
    const { count, error } = await (getAdminSupabase().from('ai_generation_logs') as any)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', kstMonthStartIso())
    if (error) {
      if (!isMissingTableError(error)) console.warn('[aiUsage] count failed:', error)
    } else {
      used = count ?? 0
    }
  } catch (error) {
    console.warn('[aiUsage] count failed:', error)
  }
  return { plan, used, limit, resetsAt: kstNextMonthStartIso() }
}

/** 생성 한 번을 기록한다. 실패해도 응답은 막지 않는다(로그만). */
export async function recordAiGeneration(userId: string, sourceType: string, questionCount: number): Promise<void> {
  try {
    const { error } = await (getAdminSupabase().from('ai_generation_logs') as any)
      .insert({ user_id: userId, source_type: sourceType, question_count: questionCount })
    if (error && !isMissingTableError(error)) console.warn('[aiUsage] record failed:', error)
  } catch (error) {
    console.warn('[aiUsage] record failed:', error)
  }
}
