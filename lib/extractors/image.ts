import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * Gemini Vision API를 사용해 이미지에서 문제를 직접 추출합니다.
 * 시험지/문제지 이미지를 넣으면 문제 구조를 파싱하여 JSON으로 반환합니다.
 */
export async function extractQuestionsFromImage(
  file: File,
  questionCount?: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. 이미지 분석에는 Gemini API가 필요합니다.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64Data = Buffer.from(arrayBuffer).toString('base64')

  const mimeType = file.type || getMimeTypeFromName(file.name)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = buildExamExtractionPrompt(questionCount)

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ])

  const response = await result.response
  return response.text()
}

/**
 * PDF가 스캔본(이미지 기반)인지 판단하기 위해,
 * 텍스트 추출 결과가 너무 적으면 이미지 기반으로 간주합니다.
 */
export function isLikelyScannedPDF(extractedText: string): boolean {
  const cleaned = extractedText.replace(/\s+/g, ' ').trim()
  return cleaned.length < 50
}

function getMimeTypeFromName(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  }
  return mimeMap[ext || ''] || 'image/jpeg'
}

function buildExamExtractionPrompt(questionCount?: number): string {
  const countInstruction = questionCount
    ? `이미지에서 최대 ${questionCount}개의 문제를 추출해주세요.`
    : '이미지에서 모든 문제를 추출해주세요.'

  return `당신은 시험지/문제지 이미지를 분석하는 전문가입니다.
${countInstruction}

이미지에 있는 문제를 정확히 읽고, 아래 JSON 형식으로 변환해주세요.

출력 형식:
{
  "questions": [
    {
      "type": "CHOICE" | "SHORT" | "OX" | "BLANK",
      "question_text": "문제 텍스트",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": "정답 (알 수 있는 경우)"
    }
  ]
}

규칙:
- 보기가 있는 문제는 type: "CHOICE", options에 보기를 넣으세요.
- O/X 문제는 type: "OX", options: ["O", "X"]
- 단답형은 type: "SHORT", options: []
- 빈칸 채우기는 type: "BLANK", question_text에 {{blank}} 사용, options: []
- 정답이 이미지에 표시되어 있으면 answer에 넣고, 없으면 빈 문자열로 두세요.
- 문제 번호는 question_text에 포함하지 마세요.
- JSON만 출력하고 다른 설명은 포함하지 마세요.`
}
