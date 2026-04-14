import { NextRequest, NextResponse } from 'next/server'
import { generateQuestions, parseExamVisionResponse, type QuestionInput, type SourceType } from '@/lib/ai/questionGenerator'
import { getYouTubeTranscript } from '@/lib/utils/youtube'
import { extractTextFromPDF } from '@/lib/utils/pdf'
import { extractTextFromDOCX } from '@/lib/extractors/docx'
import { extractTextFromFile } from '@/lib/extractors/text'
import { extractQuestionsFromImage, isLikelyScannedPDF } from '@/lib/extractors/image'

const VALID_SOURCE_TYPES: SourceType[] = ['topic', 'youtube', 'text', 'pdf', 'file', 'exam']

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function isImageFile(filename: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(getFileExtension(filename))
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const sourceType = formData.get('sourceType') as SourceType
    const questionCount = parseInt(formData.get('questionCount') as string) || 5
    const subject = formData.get('subject') as string | undefined
    const grade = formData.get('grade') as string | undefined

    if (!VALID_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json({ error: `지원하지 않는 소스 타입입니다: ${sourceType}` }, { status: 400 })
    }

    // === 주제 입력 ===
    if (sourceType === 'topic') {
      const topic = formData.get('topic') as string
      if (!topic) return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 })

      const questions = await generateQuestions({ sourceType, topic, subject, grade }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 유튜브 ===
    if (sourceType === 'youtube') {
      const youtubeUrl = formData.get('youtubeUrl') as string
      if (!youtubeUrl) return NextResponse.json({ error: '유튜브 URL을 입력해주세요.' }, { status: 400 })

      const transcript = await getYouTubeTranscript(youtubeUrl)
      const questions = await generateQuestions({ sourceType, text: transcript, subject, grade }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 텍스트 직접 입력 ===
    if (sourceType === 'text') {
      const text = formData.get('text') as string
      if (!text) return NextResponse.json({ error: '텍스트를 입력해주세요.' }, { status: 400 })

      const questions = await generateQuestions({ sourceType, text, subject, grade }, questionCount)
      return NextResponse.json({ questions })
    }

    // === 시험지/문제지 (이미지 또는 스캔 PDF) ===
    if (sourceType === 'exam') {
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: '시험지 파일을 업로드해주세요.' }, { status: 400 })

      const ext = getFileExtension(file.name)

      if (isImageFile(file.name)) {
        const visionText = await extractQuestionsFromImage(file, questionCount)
        const questions = parseExamVisionResponse(visionText)
        return NextResponse.json({ questions })
      }

      if (ext === 'pdf') {
        // 텍스트 추출 시도 → 스캔본이면 Vision으로 전환
        const extractedText = await extractTextFromPDF(file)
        if (isLikelyScannedPDF(extractedText)) {
          const visionText = await extractQuestionsFromImage(file, questionCount)
          const questions = parseExamVisionResponse(visionText)
          return NextResponse.json({ questions })
        }
        // 텍스트가 충분하면 AI로 문제 구조 파싱
        const questions = await generateQuestions({ sourceType: 'text', text: extractedText, subject, grade }, questionCount)
        return NextResponse.json({ questions })
      }

      return NextResponse.json({ error: '시험지는 이미지(JPG, PNG) 또는 PDF 파일만 지원합니다.' }, { status: 400 })
    }

    // === 파일 업로드 (일반 학습 자료) ===
    if (sourceType === 'file' || sourceType === 'pdf') {
      const file = formData.get('file') as File
      if (!file) return NextResponse.json({ error: '파일을 업로드해주세요.' }, { status: 400 })

      const ext = getFileExtension(file.name)
      let text = ''

      switch (ext) {
        case 'pdf':
          text = await extractTextFromPDF(file)
          if (isLikelyScannedPDF(text)) {
            // 스캔 PDF인 경우 Vision으로 텍스트 추출 후 문제 생성
            const visionText = await extractQuestionsFromImage(file, questionCount)
            const questions = parseExamVisionResponse(visionText)
            return NextResponse.json({ questions })
          }
          break
        case 'docx':
          text = await extractTextFromDOCX(file)
          break
        case 'txt':
        case 'csv':
          text = await extractTextFromFile(file)
          break
        default:
          return NextResponse.json(
            { error: `지원하지 않는 파일 형식입니다: .${ext}\n지원 형식: PDF, DOCX, TXT, CSV` },
            { status: 400 }
          )
      }

      if (!text || text.trim().length === 0) {
        return NextResponse.json({ error: '파일에서 텍스트를 추출할 수 없습니다.' }, { status: 400 })
      }

      const questions = await generateQuestions({ sourceType: 'text', text, subject, grade }, questionCount)
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
