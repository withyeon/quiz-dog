import { GoogleGenerativeAI } from '@google/generative-ai'

// 2026-10-16 교체: 2.5-flash 는 legacy(limited access)가 됐고 생각 토큰을 못 줄여 10문제에 ~20초·~15원이 들었다.
// 3.6-flash + thinkingLevel low 는 같은 프롬프트에서 ~7초·~7원(2027-01-01 단가 2배 뒤에도 지금 수준), 품질은 더 낫다.
// 3.8-flash 는 품질은 가장 좋지만 503(high demand)이 잦아 보류. 폴백은 별도 쿼터 버킷의 3.5-flash-lite(2.5-lite 는
// 요청한 유형 개수를 어겼다). 생각 토큰은 출력 단가로 과금되므로 low 가 비용의 핵심이다(minimal 은 거부됨).
const PRIMARY_MODEL = 'gemini-3.6-flash'
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'
// SDK(@google/generative-ai) 타입에는 아직 없어 spread 로 넘긴다. 2.5 계열은 이 옵션을 400 으로 거부한다.
const THINKING_CONFIG: Record<string, unknown> = { thinkingConfig: { thinkingLevel: 'low' } }

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

export type ExamExtractionOptions = {
  /**
   * 숨겨진 구성치기(다중 선택) 문제집이면 true (문제집 이름에 '구성치기', lib/quiz/multiSelect.ts).
   * 정답이 여러 개인 문제를 options 에 보기 전체, answer 에 정답들을 쉼표로 이어 쓰게 한다.
   */
  multiSelect?: boolean
}

// 구성치기 문제집에서만 덧붙이는 규칙. 처방 구성(약재 목록)처럼 "모두 고르시오" 문제를 그대로 다중 선택으로 옮긴다.
const MULTI_SELECT_EXTRACTION_RULES = `
정답이 여러 개인 문제(구성치기):
- "구성 약재를 모두 고르시오"처럼 정답이 여러 개인 문제는 type을 "CHOICE"로 두고, options에 보기 전체를 종이 순서대로, answer에 정답 보기 글들을 쉼표(,)로 이어 쓰세요. 예) "options": ["마황", "계지", "행인", "감초", "작약", "석고"], "answer": "마황, 계지, 행인, 감초"
- 정답들은 options에 적은 보기 글과 완전히 같은 글자로 쓰세요. 정답을 나눌 때는 쉼표만 쓰고 | 나 줄바꿈은 쓰지 마세요.
- "보기: 마황, 계지, 행인, …"처럼 보기가 한 줄에 쉼표로 나열돼 있으면 쉼표마다 끊어 options의 원소 하나씩으로 넣으세요. 보기 개수는 종이 그대로 두세요(20개까지).
- 문제 아래에 "정답: 마황, 계지, 행인, 감초"처럼 적힌 줄은 답란이 아니라 정답입니다. 그 줄을 answer에 쓰고 question_text에는 넣지 마세요.
- 정답이 하나뿐인 문제는 위 규칙 그대로 answer에 보기 글 하나만 쓰세요.`

/**
 * Gemini Vision API를 사용해 이미지에서 문제를 직접 추출합니다.
 * 시험지/문제지 이미지를 넣으면 문제 구조를 파싱하여 JSON으로 반환합니다.
 */
export async function extractQuestionsFromImage(
  file: File,
  questionCount?: number,
  options: ExamExtractionOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다. 이미지 분석에는 Gemini API가 필요합니다.')
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64Data = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || getMimeTypeFromName(file.name)
  const prompt = buildExamExtractionPrompt(questionCount, options)

  const parts = [{ text: prompt }, { inlineData: { mimeType, data: base64Data } }]

  const genAI = new GoogleGenerativeAI(apiKey)
  const callModel = async (modelName: string): Promise<string> => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        // 옮겨 적기(전사)가 목적이라 창의성은 0으로. 조금만 올라가도 문장을 다듬거나 보기를 바꿔 쓴다.
        temperature: 0,
        responseMimeType: 'application/json',
        ...THINKING_CONFIG,
      },
    })
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

function buildExamExtractionPrompt(questionCount?: number, options: ExamExtractionOptions = {}): string {
  const countInstruction = questionCount
    ? `문서에 있는 문제를 앞에서부터 차례로 최대 ${questionCount}개까지 옮기세요.`
    : '문서에 있는 모든 문제를 차례로 옮기세요.'

  return `당신은 종이 시험지·문제지를 디지털로 옮겨 적는 전사(轉寫) 담당자입니다. 문제를 새로 만들거나 고치는 사람이 아닙니다.
${countInstruction}

가장 중요한 규칙 — 종이에 적힌 그대로 옮기기:
- 문제 글과 보기는 종이에 쓰인 글자를 한 글자도 바꾸지 말고 그대로 적으세요. 문장을 줄이거나 쉽게 풀어 쓰거나 맞춤법·띄어쓰기를 고치거나 순서를 바꾸는 것은 모두 금지입니다.
- 보기는 종이에 있는 개수와 순서를 그대로 옮기세요. 보기가 2개·3개·5개여도 4개로 늘리거나 줄이지 마세요. 새 보기를 지어내지 마세요.
- 문제를 풀 때 꼭 필요한 지문·보기 상자(<보기> ㄱ. ㄴ. ㄷ. …)·조건·대화문이 있으면 줄이지 말고 그 문제의 question_text 안에 줄바꿈으로 함께 넣으세요. 여러 문제가 한 지문을 공유하면 그 문제들 각각에 같은 지문을 넣으세요.
- 종이에 없는 문제를 만들어 채우지 마세요. 읽을 수 없는 문제는 빼세요.
- 문제 번호(1., 2., ③ 등)와 배점([3점] 등), 답을 적는 칸("답:", "정답:" 뒤의 밑줄·빈 괄호·네모 칸)은 question_text에 포함하지 마세요. 답란은 문제 내용이 아닙니다. 보기 앞의 ①②③·가나다·A B C 기호도 options에 넣지 마세요(기호를 뺀 보기 글만 적습니다).
- 문제 유형은 종이의 형태를 보고 정하세요. 보기에서 고르면 CHOICE, O·X로 답하면 OX, 빈칸(괄호·밑줄)을 채우면 BLANK, 짧은 답을 쓰면 SHORT입니다. 서술형·논술형처럼 문장으로 답하는 문제는 SHORT로 두고 answer는 빈 문자열로 두세요.

출력 형식(JSON만):
{
  "questions": [
    {
      "type": "CHOICE" | "SHORT" | "OX" | "BLANK",
      "question_text": "문제 글 (종이 그대로)",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": "정답",
      "explanation": "정답인 이유 1~2문장 (정답을 알 때만, 모르면 빈 문자열)",
      "figure_box": [ymin, xmin, ymax, xmax] 또는 null
    }
  ]
}

세부 규칙:
- CHOICE: answer는 options에 적은 보기 글과 완전히 같은 문자열로 쓰세요(번호가 아니라 글). 종이에 정답이 표시돼 있으면(동그라미·채점 표시·정답표) 그것을 쓰고, 없으면 직접 풀어서 확신이 있을 때만 적고 아니면 빈 문자열로 두세요.
- OX: options는 ["O", "X"], answer는 "O" 또는 "X".
- BLANK: options는 [], question_text의 빈칸 자리는 [            ]로 바꾸고 answer는 빈칸에 들어갈 말을 쓰세요. 빈칸이 여럿이면 첫 빈칸만 [            ]로 바꾸세요.
- SHORT: options는 [], answer는 종이의 정답을 그대로 쓰세요(모르면 빈 문자열).
- figure_box: 문제를 풀려면 꼭 봐야 하는 그림·도형·표·그래프·지도가 이미지 안에 있으면, 그 그림 영역만 [ymin, xmin, ymax, xmax] 형식(이미지 높이·너비를 각각 0~1000으로 본 비율)으로 적으세요. 문제 글자나 보기 글자는 상자에 넣지 말고 그림만 감싸세요. 그림이 없으면 null, 두 문제가 같은 그림을 공유하면 둘 다 같은 상자를 적으세요.
- explanation: answer가 있을 때만 학생 눈높이로 1~2문장. 문제 글은 고치지 마세요.
- JSON 외의 설명은 쓰지 마세요.${options.multiSelect ? `\n${MULTI_SELECT_EXTRACTION_RULES}` : ''}`
}
