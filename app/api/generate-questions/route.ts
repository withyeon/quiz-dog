import { NextRequest, NextResponse } from 'next/server'
import { generateQuestions, parseExamVisionResponse, type QuestionInput, type SourceType } from '@/lib/ai/questionGenerator'

export const maxDuration = 60
export const runtime = 'nodejs'
import { getYouTubeTranscript } from '@/lib/utils/youtube'
import { extractTextFromPDF } from '@/lib/utils/pdf'
import { extractTextFromDOCX } from '@/lib/extractors/docx'
import { extractTextFromPPT, extractTextFromPPTX } from '@/lib/extractors/ppt'
import { extractTextFromFile } from '@/lib/extractors/text'
import { extractQuestionsFromImage, isLikelyScannedPDF } from '@/lib/extractors/image'

const VALID_SOURCE_TYPES: SourceType[] = ['topic', 'youtube', 'text', 'pdf', 'file', 'exam']

// 한 번에 생성 가능한 최대 문제 수 (호출당 AI 비용 상한)
const MAX_QUESTION_COUNT = 20
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

// 간단한 IP 레이트리밋 (인스턴스 메모리 기준 — 서버리스에서는 인스턴스마다 별도이나
// 단순 연타/스크립트 남용을 막는 비용 0짜리 속도 제한)
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 10
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

// 같은 사이트(브라우저)에서 온 요청만 허용 — 외부 사이트/스크립트의 무단 호출 차단
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

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function isImageFile(filename: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getFileExtension(filename))
}

function validateUploadSize(file: File): NextResponse | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null
  return NextResponse.json(
    { error: '파일이 너무 큽니다. 12MB 이하 파일만 업로드해주세요.' },
    { status: 413 },
  )
}

export async function POST(request: NextRequest) {
  try {
    // 외부 사이트/스크립트의 무단 호출 차단 (브라우저 동일 출처만 허용)
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
    }

    // 연타/스크립트 남용으로 인한 AI 비용 폭탄 방지
    if (isRateLimited(getClientIp(request))) {
      return NextResponse.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      )
    }

    const formData = await request.formData()
    const sourceType = formData.get('sourceType') as SourceType
    const requestedCount = parseInt(formData.get('questionCount') as string) || 5
    const questionCount = Math.min(MAX_QUESTION_COUNT, Math.max(1, requestedCount))
    const subject = formData.get('subject') as string | undefined
    const grade = formData.get('grade') as string | undefined

    // 선택된 문항 유형 (없으면 AI가 자유롭게 섞어서 출제)
    const VALID_TYPES = ['CHOICE', 'SHORT', 'OX', 'BLANK'] as const
    let allowedTypes: Array<(typeof VALID_TYPES)[number]> | undefined
    const rawTypes = formData.get('questionTypes')
    if (typeof rawTypes === 'string' && rawTypes.trim()) {
      try {
        const parsed = JSON.parse(rawTypes)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((t): t is (typeof VALID_TYPES)[number] =>
            VALID_TYPES.includes(t))
          if (filtered.length > 0) allowedTypes = filtered
        }
      } catch {
        // 형식이 잘못되면 무시하고 자유 출제
      }
    }

    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json({ error: `지원하지 않는 소스 타입입니다: ${sourceType}` }, { status: 400 })
    }

    // === 주제 입력 ===
    if (sourceType === 'topic') {
      const topic = formData.get('topic') as string
      if (!topic) return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 })

      const questions = await generateQuestions({ sourceType, topic, subject, grade, allowedTypes }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 유튜브 ===
    if (sourceType === 'youtube') {
      const youtubeUrl = formData.get('youtubeUrl') as string
      if (!youtubeUrl) return NextResponse.json({ error: '유튜브 URL을 입력해주세요.' }, { status: 400 })

      const transcript = await getYouTubeTranscript(youtubeUrl)
      const questions = await generateQuestions({ sourceType, text: transcript, subject, grade, allowedTypes }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 텍스트 직접 입력 ===
    if (sourceType === 'text') {
      const text = formData.get('text') as string
      if (!text) return NextResponse.json({ error: '텍스트를 입력해주세요.' }, { status: 400 })

      const questions = await generateQuestions({ sourceType, text, subject, grade, allowedTypes }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 시험지/문제지 (이미지 또는 스캔 PDF) ===
    if (sourceType === 'exam') {
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: '시험지 파일을 업로드해주세요.' }, { status: 400 })
      const sizeError = validateUploadSize(file)
      if (sizeError) return sizeError

      const ext = getFileExtension(file.name)

      if (isImageFile(file.name)) {
        const visionText = await extractQuestionsFromImage(file, questionCount)
        const questions = parseExamVisionResponse(visionText).slice(0, questionCount)
        return NextResponse.json({ questions })
      }

      if (ext === 'pdf') {
        // 텍스트 추출 시도 → 스캔본이면 Vision으로 전환
        const extractedText = await extractTextFromPDF(file)
        if (isLikelyScannedPDF(extractedText)) {
          const visionText = await extractQuestionsFromImage(file, questionCount)
          const questions = parseExamVisionResponse(visionText).slice(0, questionCount)
          return NextResponse.json({ questions })
        }
        // 텍스트가 충분하면 AI로 문제 구조 파싱
        const questions = await generateQuestions({ sourceType: 'text', text: extractedText, subject, grade, allowedTypes }, questionCount)
        return NextResponse.json({ questions })
      }

      return NextResponse.json({ error: '시험지는 이미지(JPG, PNG) 또는 PDF 파일만 지원합니다.' }, { status: 400 })
    }

    // === 파일 업로드 (일반 학습 자료) ===
    if (sourceType === 'file' || sourceType === 'pdf') {
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: '파일을 업로드해주세요.' }, { status: 400 })
      const sizeError = validateUploadSize(file)
      if (sizeError) return sizeError

      const ext = getFileExtension(file.name)
      let text = ''

      switch (ext) {
        case 'pdf':
          text = await extractTextFromPDF(file)
          if (isLikelyScannedPDF(text)) {
            // 스캔 PDF인 경우 Vision으로 텍스트 추출 후 문제 생성
            const visionText = await extractQuestionsFromImage(file, questionCount)
            const questions = parseExamVisionResponse(visionText).slice(0, questionCount)
            return NextResponse.json({ questions })
          }
          break
        case 'docx':
          text = await extractTextFromDOCX(file)
          break
        case 'pptx':
          text = await extractTextFromPPTX(file)
          break
        case 'ppt':
          text = await extractTextFromPPT(file)
          break
        case 'txt':
        case 'csv':
          text = await extractTextFromFile(file)
          break
        default:
          return NextResponse.json(
            { error: `지원하지 않는 파일 형식입니다: .${ext}\n지원 형식: PDF, DOCX, PPTX, PPT, TXT, CSV` },
            { status: 400 }
          )
      }

      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: '파일에서 텍스트를 추출할 수 없습니다.' }, { status: 400 })
      }

      const questions = await generateQuestions({ sourceType: 'text', text, subject, grade, allowedTypes }, questionCount)
      return NextResponse.json({ questions })
    }

    return NextResponse.json({ error: '처리할 수 없는 요청입니다.' }, { status: 400 })
  } catch (error) {
    console.error('Error generating questions:', error)
    const errorMessage = error instanceof Error ? error.message : '문제 생성 중 오류가 발생했습니다.'

    if (errorMessage.includes('API key') || errorMessage.includes('not found') || errorMessage.includes('API_KEY')) {
      return NextResponse.json(
        { error: 'AI API 키가 설정되지 않았습니다. GEMINI_API_KEY 또는 OPENAI_API_KEY 환경 변수를 설정해주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
