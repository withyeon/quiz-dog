import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { normalizePromoCode, verifyPromoCode } from '@/lib/promoCode'

/**
 * 위드현 이용 코드 등록(내 정보 → 내 플랜).
 *
 * 서명 확인은 여기서, 사용 기록과 기간 연장은 DB 함수 redeem_promo_code 가 한 트랜잭션으로 한다.
 * 서명이 40비트라 맞혀 넣기는 사실상 불가능하지만, 틀린 코드를 계속 넣는 것은 막는다(선생님마다 15분에 10번).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FAIL_WINDOW_MS = 15 * 60_000
const FAIL_MAX = 10
const failBucket = new Map<string, number[]>()

function recentFails(userId: string): number[] {
  const now = Date.now()
  const recent = (failBucket.get(userId) ?? []).filter((t) => now - t < FAIL_WINDOW_MS)
  failBucket.set(userId, recent)
  return recent
}

function recordFail(userId: string) {
  failBucket.set(userId, [...recentFails(userId), Date.now()])
}

function isSameOriginRequest(request: NextRequest): boolean {
  const host = request.headers.get('host') ?? ''
  const source = request.headers.get('origin') ?? request.headers.get('referer') ?? ''
  if (!host || !source) return false
  try {
    return new URL(source).host === host
  } catch {
    return false
  }
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status })
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return json(403, { error: '허용되지 않은 요청입니다.' })
  }
  const userId = await resolveTeacherUserId(request)
  if (!userId) return json(401, { error: '로그인이 필요합니다.' })

  if (recentFails(userId).length >= FAIL_MAX) {
    return json(429, { error: '코드를 여러 번 잘못 입력했어요. 15분 뒤에 다시 시도해 주세요.' })
  }

  const secret = process.env.WITHYEON_PROMO_CODE_SECRET?.trim()
  if (!secret || secret.length < 16) {
    return json(503, { error: '지금은 코드를 등록할 수 없어요. 잠시 후 다시 시도해 주세요.' })
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null
  const kind = verifyPromoCode(secret, body?.code)
  if (!kind) {
    recordFail(userId)
    return json(400, {
      error: '코드를 다시 확인해 주세요. 납품정보서나 메일에 적힌 16자리 코드를 그대로 입력하면 돼요.',
    })
  }

  try {
    // database.types.ts 는 손으로 관리해 새 supabase-js 타입과 맞지 않는다(lib/services/sharing.ts 와 같이 any로 부른다)
    const { data, error } = (await (getAdminSupabase().rpc as any)('redeem_promo_code', {
      p_code: normalizePromoCode(body?.code),
      p_kind: kind.key,
      p_user_id: userId,
      p_months: kind.months,
    })) as { data: string | null; error: { code?: string; message?: string } | null }
    if (error) {
      if (error.code === '23505') {
        recordFail(userId)
        return json(400, { error: '이미 퀴즈독에서 사용된 코드예요.' })
      }
      console.error('[promo-code] 등록 실패:', error.code, error.message)
      return json(500, { error: '등록하지 못했어요. 잠시 후 다시 시도해 주세요.' })
    }
    return json(200, { success: true, plan: 'pro', proUntil: data })
  } catch (error) {
    console.error('[promo-code] 등록 실패:', error instanceof Error ? error.name : 'unknown')
    return json(500, { error: '등록하지 못했어요. 잠시 후 다시 시도해 주세요.' })
  }
}
