import { NextRequest, NextResponse } from 'next/server'
import { generateVocabCards, MAX_EXTRACT_COUNT, MAX_SOURCE_TEXT_LENGTH, type VocabAiMode } from '@/lib/ai/vocabGenerator'
import { extractTextFromDOCX } from '@/lib/extractors/docx'
import { extractTextFromHWP } from '@/lib/extractors/hwp'
import { extractTextFromPPT, extractTextFromPPTX } from '@/lib/extractors/ppt'
import { extractTextFromFile } from '@/lib/extractors/text'
import { createRateLimiter, getClientIp, isSameOriginRequest } from '@/lib/server/aiRequestGuards'
import { resolveTeacherUserId } from '@/lib/server/teacherAuth'
import { getAiUsage, recordAiGeneration } from '@/lib/server/aiUsage'
import { AI_QUOTA_ERROR_CODE } from '@/lib/plans'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * 단어장 AI: 종이 단어 목록 사진·PDF 옮기기(scan) / 지문에서 낱말 뽑기(extract).
 * 문제 만들기(/api/generate-questions)와 같은 월 AI 사용 횟수를 쓴다(카드가 하나라도 나온 호출만 센다).
 */

const MAX_FILES = 5
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const isRateLimited = createRateLimiter(60_000, 10)

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/** 문서 파일(extract 전용)은 글만 꺼내 프롬프트에 넣는다. 사진·PDF 는 Gemini 가 직접 읽는다. */
async function extractDocumentText(file: File, ext: string): Promise<string | null> {
  switch (ext) {
    case 'docx': return extractTextFromDOCX(file)
    case 'hwp':
    case 'hwpx': return extractTextFromHWP(file)
    case 'pptx': return extractTextFromPPTX(file)
    case 'ppt': return extractTextFromPPT(file)
    case 'txt':
    case 'csv': return extractTextFromFile(file)
    default: return null
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }
    if (isRateLimited(getClientIp(request))) {
      return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 })
    }
    const teacherId = await resolveTeacherUserId(request)
    if (!teacherId) return NextResponse.json({ error: '로그인이 필요해요. 다시 로그인한 뒤 시도해 주세요.' }, { status: 401 })

    const formData = await request.formData()
    const mode = formData.get('mode') as VocabAiMode
    if (mode !== 'scan' && mode !== 'extract') {
      return NextResponse.json({ error: '처리할 수 없는 요청입니다.' }, { status: 400 })
    }

    const uploads = formData.getAll('files').filter((value): value is File => value instanceof File && value.size > 0)
    if (uploads.length > MAX_FILES) {
      return NextResponse.json({ error: `파일은 한 번에 ${MAX_FILES}개까지 올릴 수 있어요.` }, { status: 400 })
    }
    if (uploads.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: '파일이 너무 커요. 합쳐서 12MB 이하로 올려 주세요.' }, { status: 413 })
    }

    const files: Array<{ mimeType: string; data: Buffer }> = []
    const documentTexts: string[] = []
    for (const file of uploads) {
      const ext = getFileExtension(file.name)
      const mimeType = file.type.startsWith('image/') ? file.type : ext === 'pdf' ? 'application/pdf' : IMAGE_MIME[ext]
      if (mimeType) {
        files.push({ mimeType, data: Buffer.from(await file.arrayBuffer()) })
        continue
      }
      const text = mode === 'extract' ? await extractDocumentText(file, ext) : null
      if (text === null) {
        return NextResponse.json(
          { error: mode === 'scan' ? '사진(JPG·PNG) 또는 PDF 파일만 올릴 수 있어요.' : `지원하지 않는 파일 형식이에요: .${ext}` },
          { status: 400 },
        )
      }
      if (text.trim()) documentTexts.push(text.trim())
    }

    const rawText = formData.get('text')
    const text = [typeof rawText === 'string' ? rawText.trim() : '', ...documentTexts]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, MAX_SOURCE_TEXT_LENGTH)

    if (mode === 'scan' && files.length === 0) {
      return NextResponse.json({ error: '단어 목록 사진이나 PDF를 올려 주세요.' }, { status: 400 })
    }
    if (mode === 'extract' && files.length === 0 && !text) {
      return NextResponse.json({ error: '단어를 뽑을 글을 붙여 넣거나 파일을 올려 주세요.' }, { status: 400 })
    }

    const usage = await getAiUsage(teacherId)
    if (usage.limit !== null && usage.used >= usage.limit) {
      const upgrade = usage.plan === 'pro' ? '' : ' Pro 요금제로 올리면 횟수 제한 없이 만들 수 있어요.'
      return NextResponse.json(
        { error: `이번 달 AI 만들기 ${usage.limit}회를 모두 썼어요.${upgrade}`, code: AI_QUOTA_ERROR_CODE, usage },
        { status: 402 },
      )
    }

    const grade = formData.get('grade')
    const subject = formData.get('subject')
    const count = Math.max(1, Math.min(MAX_EXTRACT_COUNT, parseInt(String(formData.get('count') ?? ''), 10) || 15))
    const cards = await generateVocabCards({
      mode,
      files,
      text: mode === 'extract' ? text : undefined,
      grade: typeof grade === 'string' && grade ? grade : undefined,
      subject: typeof subject === 'string' && subject ? subject : undefined,
      count,
      fillMissing: formData.get('fillMissing') === '1',
    })

    // 카드가 하나도 안 나온 호출(지문 사진을 옮기기로 올린 경우 등)은 교사가 안내만 보므로 횟수를 깎지 않는다
    if (cards.length > 0) await recordAiGeneration(teacherId, `vocab_${mode}`, cards.length)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error('Error generating vocab cards:', error)
    const message = error instanceof Error ? error.message : '단어 카드를 만들지 못했어요.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
