import { getAdminSupabase } from '@/lib/supabase/admin'

export type TeacherPlan = {
  plan: 'free' | 'pro'
  /** 프로가 끝나는 때(ISO). 무료면 null */
  proUntil: string | null
}

/**
 * 선생님 요금제(서버 전용). teacher_plans.pro_until 이 지금보다 뒤면 프로.
 * 프로 전용 기능을 막을 때도 이 함수를 쓴다(지금은 이용 코드로만 프로가 생긴다).
 * 표가 아직 없거나 읽기에 실패하면 무료로 본다 — 요금제 조회 때문에 수업이 막히면 안 된다.
 */
export async function getTeacherPlan(userId: string): Promise<TeacherPlan> {
  try {
    // database.types.ts 는 손으로 관리해 새 supabase-js 타입과 맞지 않는다(다른 서비스 코드와 같이 any로 부른다)
    const { data, error } = (await (getAdminSupabase().from('teacher_plans') as any)
      .select('pro_until')
      .eq('user_id', userId)
      .maybeSingle()) as { data: { pro_until: string | null } | null; error: unknown }
    if (error || !data?.pro_until) return { plan: 'free', proUntil: null }
    const proUntil = data.pro_until
    return new Date(proUntil).getTime() > Date.now()
      ? { plan: 'pro', proUntil }
      : { plan: 'free', proUntil: null }
  } catch {
    return { plan: 'free', proUntil: null }
  }
}
