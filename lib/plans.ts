/**
 * 요금제 한도(무료 ↔ 프로). 요금제 페이지(app/pricing/page.tsx)의 문구와 맞춰 둔다.
 * - 게임당 참여 인원: 무료 30명(DB 트리거 players_enforce_limit, sql/20261018_pro_gates.sql 의 free_player_limit() 과 같은 값)
 * - AI 문제 생성: 달마다 무료 10회·프로 300회(ai_generation_logs 로 센다. "새로 만들기"만 세고 다시 만들기·더 만들기는 안 센다)
 * - 문항별 정답률·오답 분석·엑셀 내보내기: 프로만(ProGate, /api/teacher/export-report)
 */
export type PlanName = 'free' | 'pro'

export const FREE_PLAYER_LIMIT = 30

export const AI_MONTHLY_LIMIT: Record<PlanName, number> = { free: 10, pro: 300 }

/** 한도에 걸렸을 때 API 가 돌려주는 코드(화면은 이 코드로 요금제 안내를 띄운다) */
export const AI_QUOTA_ERROR_CODE = 'AI_QUOTA_EXCEEDED'

/** 이번 달 시작(KST 1일 0시)을 ISO 로. 사용량은 한국 달력 기준으로 센다. */
export function kstMonthStartIso(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  return new Date(Date.UTC(y, m, 1) - 9 * 60 * 60 * 1000).toISOString()
}

/** 다음 달 1일(KST) — "언제 다시 쓸 수 있는지" 안내용 */
export function kstNextMonthStartIso(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  return new Date(Date.UTC(y, m + 1, 1) - 9 * 60 * 60 * 1000).toISOString()
}
