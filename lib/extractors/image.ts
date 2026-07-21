import { GoogleGenerativeAI } from '@google/generative-ai'

const PRIMARY_MODEL = 'gemini-2.5-flash'
// 폴백은 별도 쿼터 버킷을 쓰는 경량 모델. gemini-1.5/2.0-flash는 무료 등급에서
// 제거됐거나 쿼터가 0이라 폴백으로 못 씀(404/429). flash-lite는 무료 쿼터가 있고 가벼움.
const FALLBACK_MODEL = 'gemini-2.5-flash-lite'

function isOverloadedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')
}

// 429: 사용량(쿼터) 초과 → 같은 모델 재시도는 무의미, 다른 모델로 폴백
function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
  const prompt = buildExamExtractionPrompt(questionCount)

  const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }]

  const genAI = new GoogleGenerativeAI(apiKey)
  const callModel = async (modelName: string): Promise<string> => {
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContent(parts)
    return result.response.text()
  }

  const delays = [1000, 2000]
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await callModel(PRIMARY_MODEL)
    } catch (error) {
      // 과부하는 잠시 후 주 모델 재시도
      if (isOverloadedError(error) && i < delays.length) {
        await sleep(delays[i])
        continue
      }
      // 과부하 지속/쿼터 초과면 경량 모델로 폴백 (별도 쿼터 버킷)
      if (isOverloadedError(error) || isQuotaError(error)) {
        try {
          return await callModel(FALLBACK_MODEL)
        } catch (fallbackError) {
          if (isQuotaError(fallbackError)) {
            throw new Error('AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 Gemini API 결제를 활성화해주세요.')
          }
          throw fallbackError
        }
      }
      throw error
    }
  }
  throw new Error('unreachable')
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
- 빈칸 채우기는 type: "BLANK", question_text에 [            ] 사용, options: []
- 정답이 이미지에 표시되어 있으면 answer에 넣고, 없으면 빈 문자열로 두세요.
- 문제 번호는 question_text에 포함하지 마세요.
- JSON만 출력하고 다른 설명은 포함하지 마세요.`
}
