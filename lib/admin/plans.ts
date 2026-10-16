import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * 관리자 화면의 요금제 규칙(서버 전용).
 * 프로 기간은 teacher_plans.pro_until 하나로 정해진다. 가입 전 예약은 pending_plan_grants(가입 트리거가 적용).
 */

export const PLAN_TRIAL_DAYS = 14

export type AdminSupabase = SupabaseClient<Database>

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/** 붙여 넣은 글에서 이메일만 뽑는다(중복 제거, 소문자). */
export function extractEmails(text: string): { emails: string[]; duplicates: number } {
  const found = text.match(/[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+/g) ?? []
  const seen = new Set<string>()
  let duplicates = 0
  for (const raw of found) {
    const email = normalizeEmail(raw).replace(/[.,;:]+$/, '')
    if (seen.has(email)) duplicates++
    else seen.add(email)
  }
  return { emails: [...seen], duplicates }
}

/** 개월 수 + 보너스 일수를 Postgres interval 문자열로. */
export function toInterval(months: number, bonusDays: number): string {
  const parts: string[] = []
  if (months > 0) parts.push(`${months} mons`)
  if (bonusDays > 0) parts.push(`${bonusDays} days`)
  return parts.join(' ') || '0 days'
}

/** Postgres 가 돌려주는 interval 문구("1 year 14 days", "3 mons")를 개월·일로 되돌린다. */
export function parseInterval(value: string | null | undefined): { months: number; days: number } {
  if (!value) return { months: 0, days: 0 }
  const years = Number(/(-?\d+)\s+years?/.exec(value)?.[1] ?? 0)
  const mons = Number(/(-?\d+)\s+mons?/.exec(value)?.[1] ?? 0)
  const days = Number(/(-?\d+)\s+days?/.exec(value)?.[1] ?? 0)
  return { months: years * 12 + mons, days }
}

/** 기간 문구: "12개월 + 14일". */
export function periodLabel(months: number, days: number): string {
  if (months && days) return `${months}개월 + ${days}일`
  if (months) return `${months}개월`
  return `${days}일`
}

/** 기준 시각에 개월·일을 더한다(달 넘김은 Date 규칙). */
export function addPeriod(from: Date, months: number, days: number): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * 프로 기간을 더한다. 프로가 남아 있으면 그 뒤에 잇고, 없으면 지금부터 센다.
 * 돌려주는 값은 새 만료 시각(ISO).
 */
export async function extendPro(supabase: AdminSupabase, userId: string, months: number, days: number): Promise<string> {
  const { data } = await (supabase.from('teacher_plans') as any).select('pro_until').eq('user_id', userId).maybeSingle()
  const current = data?.pro_until ? new Date(data.pro_until).getTime() : 0
  const base = new Date(Math.max(Date.now(), current))
  const until = addPeriod(base, months, days).toISOString()
  const { error } = await (supabase.from('teacher_plans') as any).upsert({ user_id: userId, pro_until: until, updated_at: new Date().toISOString() })
  if (error) throw error
  return until
}

/** 만료 시각을 그대로 정한다(null 이면 무료). */
export async function setProUntil(supabase: AdminSupabase, userId: string, proUntil: string | null): Promise<void> {
  const { error } = await (supabase.from('teacher_plans') as any).upsert({ user_id: userId, pro_until: proUntil, updated_at: new Date().toISOString() })
  if (error) throw error
}
