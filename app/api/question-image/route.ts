import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { uploadQuestionImageBuffer } from '@/lib/server/questionImageStorage'
import {
  QUESTION_IMAGE_MAX_EDGE,
  QUESTION_IMAGE_MAX_UPLOAD_BYTES,
  isAcceptedQuestionImageType,
} from '@/lib/quiz/questionImage'

/**
 * 문제 그림 업로드.
 *
 * 브라우저가 Storage에 직접 쓰지 않고 여기를 거친다. 이유:
 * - 이 앱은 DB가 사실상 공개라 버킷에 anon 쓰기를 열면 누구나 파일을 올릴 수 있다.
 *   여기서는 로그인한 선생님 토큰을 검증하고 서비스 키로만 쓴다.
 * - 원본이 5MB짜리 사진이어도 1280px webp(보통 100KB 안팎)로 줄여 저장하므로
 *   학생 30명이 동시에 받아도 가볍다.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateLimitBucket = new Map<string, number[]>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (rateLimitBucket.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  recent.push(now)
  rateLimitBucket.set(ip, recent)
  return recent.length > RATE_LIMIT_MAX
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
  try {
    if (!isSameOriginRequest(request)) {
      return json(403, { error: '허용되지 않은 요청입니다.' })
    }
    if (isRateLimited(getClientIp(request))) {
      return json(429, { error: '잠시 후 다시 시도해주세요.' })
    }

    // 선생님 로그인 토큰 검증
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return json(401, { error: '로그인이 필요합니다.' })
    }
    const admin = getAdminSupabase()
    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) {
      return json(401, { error: '로그인 정보가 만료되었습니다. 다시 로그인해주세요.' })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return json(400, { error: '이미지 파일이 없습니다.' })
    }
    if (file.size > QUESTION_IMAGE_MAX_UPLOAD_BYTES) {
      return json(413, { error: '8MB 이하 이미지만 올릴 수 있어요.' })
    }
    if (!isAcceptedQuestionImageType(file.type)) {
      return json(415, { error: 'PNG, JPG, WEBP, GIF 이미지만 올릴 수 있어요.' })
    }

    const input = Buffer.from(await file.arrayBuffer())
    let output: Buffer
    let width = 0
    let height = 0
    try {
      const result = await sharp(input, { animated: false })
        .rotate() // 폰 사진의 EXIF 회전 반영
        .resize({
          width: QUESTION_IMAGE_MAX_EDGE,
          height: QUESTION_IMAGE_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true })
      output = result.data
      width = result.info.width
      height = result.info.height
    } catch (error) {
      console.error('문제 그림 변환 실패:', error)
      return json(415, { error: '이미지 파일을 읽을 수 없어요. 다른 파일로 시도해주세요.' })
    }

    let url: string
    try {
      url = await uploadQuestionImageBuffer(admin, userData.user.id, output, `q-${Date.now()}`)
    } catch (uploadError) {
      console.error('문제 그림 업로드 실패:', uploadError)
      return json(500, { error: '그림을 저장하지 못했어요. 잠시 후 다시 시도해주세요.' })
    }
    return json(200, { url, width, height, bytes: output.byteLength })
  } catch (error) {
    console.error('문제 그림 API 오류:', error)
    return json(500, { error: '그림 업로드 중 문제가 생겼어요.' })
  }
}
