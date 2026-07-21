import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const CATEGORIES = ['general', 'bug', 'question_error', 'payment', 'suggestion', 'other']
const MAX_MESSAGE = 2000

// 간단한 IP 레이트리밋 (인스턴스 메모리 기준)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5
const rateBucket = new Map<string, number[]>()

function getClientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (rateBucket.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  rateBucket.set(ip, recent)
  return recent.length > RATE_LIMIT_MAX
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin) return true // 일부 브라우저는 same-origin POST에 origin 미포함
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** 공개 문의/문제신고 제출 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  }
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const message = String(body?.message ?? '').trim()
    const category = CATEGORIES.includes(body?.category) ? body.category : 'general'
    const contact = body?.contact ? String(body.contact).slice(0, 200) : null
    const roomCode = body?.room_code ? String(body.room_code).slice(0, 20) : null
    const pageUrl = body?.page_url ? String(body.page_url).slice(0, 500) : null
    const userEmail = body?.user_email ? String(body.user_email).slice(0, 200) : null

    if (!message) {
      return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
    }

    const supabase = getAdminSupabase()
    const { error } = await (supabase.from('feedback') as any).insert({
      category,
      message: message.slice(0, MAX_MESSAGE),
      contact,
      room_code: roomCode,
      page_url: pageUrl,
      user_email: userEmail,
    })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('피드백 제출 오류:', error)
    return NextResponse.json({ error: '제출에 실패했습니다.' }, { status: 500 })
  }
}
