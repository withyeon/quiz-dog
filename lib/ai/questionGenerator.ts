import { GoogleGenerativeAI } from '@google/generative-ai'

export type SourceType = 'topic' | 'youtube' | 'text' | 'pdf' | 'file' | 'exam'

export interface QuestionInput {
  topic?: string
  text?: string
  sourceType: SourceType
  grade?: string
  subject?: string
  /** 생성에 사용할 문항 유형을 제한. 비우면 AI가 자유롭게 섞어서 출제. */
  allowedTypes?: GeneratedQuestion['type'][]
  /** 유형별 정확한 생성 개수. 있으면 allowedTypes보다 우선. */
  typeCounts?: Partial<Record<GeneratedQuestion['type'], number>>
  /** 교사가 추가로 전달한 요청사항 (선택). */
  userPrompt?: string
}

const TYPE_LABEL: Record<GeneratedQuestion['type'], string> = {
  CHOICE: '객관식(CHOICE)',
  SHORT: '주관식(SHORT)',
  OX: 'OX(OX)',
  BLANK: '빈칸(BLANK)',
}

export interface GeneratedQuestion {
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}

const MAX_TEXT_LENGTH = 30000
const QUESTION_TYPES = ['CHOICE', 'SHORT', 'OX', 'BLANK'] as const
const BLANK_PLACEHOLDER = '[            ]'

const PRIMARY_MODEL = 'gemini-2.5-flash'
// 폴백은 별도 쿼터 버킷을 쓰는 경량 모델. gemini-1.5/2.0-flash는 무료 등급에서
// 제거됐거나 쿼터가 0이라 폴백으로 못 씀(404/429). flash-lite는 무료 쿼터가 있고 가벼움.
const FALLBACK_MODEL = 'gemini-2.5-flash-lite'

// 503: 일시적 과부하 → 잠시 후 재시도하면 풀리는 경우가 많음
function isOverloadedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')
}

// 429: 분당/일일 사용량(쿼터) 초과 → 같은 모델 재시도는 무의미, 다른 모델로 폴백
function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  return text.slice(0, MAX_TEXT_LENGTH) + '\n\n[텍스트가 길어 일부만 사용되었습니다]'
}

function buildGenerationPrompt(input: QuestionInput, questionCount: number, repairNote?: string): string {
  const counts = input.typeCounts
    ? (Object.entries(input.typeCounts) as Array<[GeneratedQuestion['type'], number]>)
        .filter(([, n]) => n > 0)
    : []
  const allowed = (input.allowedTypes && input.allowedTypes.length > 0)
    ? input.allowedTypes
    : null

  let typeRestriction: string
  if (counts.length > 0) {
    // 유형별 정확 개수 지정
    typeRestriction = `- 유형별로 정확히 다음 개수만큼 생성하세요: ${counts.map(([t, n]) => `${TYPE_LABEL[t]} ${n}개`).join(', ')}.\n- 지정된 유형 외에는 절대 만들지 말고, 각 유형의 개수를 정확히 맞추세요.`
  } else if (allowed) {
    typeRestriction = `- 반드시 다음 유형만 사용하세요: ${allowed.map((t) => TYPE_LABEL[t]).join(', ')}. 그 외 유형은 절대 만들지 마세요.\n- 가능하면 지정된 유형들을 골고루 섞어 출제하세요.`
  } else {
    typeRestriction = '- CHOICE(객관식) 위주로 하되 OX, SHORT를 적절히 섞어 다양하게 출제하세요.'
  }

  // 교사 추가 요청은 품질 규칙보다 우선 (단, 형식·개수·유형 규칙은 유지)
  const userRequest = input.userPrompt && input.userPrompt.trim()
    ? `\n\n[교사의 추가 요청 — 최대한 반영하되 아래 형식·개수·유형 규칙은 반드시 지킬 것]\n${input.userPrompt.trim()}`
    : ''

  const typeRules = `출제 품질 규칙:
- 정확히 ${questionCount}개를 생성하세요. 더 적거나 많으면 실패입니다.
${typeRestriction}
- 각 문제는 서로 다른 핵심 개념을 물어야 하며, 같은 질문을 표현만 바꿔 반복하지 마세요.
- CHOICE 타입은 보기 4개를 정확히 제공하고 answer는 보기 문자열 중 하나와 완전히 같아야 합니다.
- OX 타입은 options가 ["O", "X"]이고 answer는 "O" 또는 "X"만 가능합니다.
- SHORT 타입은 options를 []로 두고, answer는 학생이 입력할 짧은 정답만 쓰세요.
- BLANK 타입은 question_text에 ${BLANK_PLACEHOLDER} 플레이스홀더를 정확히 1개 넣고, answer는 빈칸에 들어갈 말만 쓰세요.
- 문제 텍스트에는 정답이 그대로 노출되지 않게 하세요.
- 초등/중등/고등 학년 수준에 맞는 어휘와 문장 길이를 사용하세요.
- 한국어 수업에서 바로 쓸 수 있도록 자연스럽고 명확한 문장으로 작성하세요.
- JSON만 출력하고 마크다운, 설명, 사과문, 주석은 절대 포함하지 마세요.`

  const jsonFormat = `각 문제는 다음 JSON 형식으로 출력해주세요:
{
  "questions": [
    {
      "type": "CHOICE" | "SHORT" | "OX" | "BLANK",
      "question_text": "문제 텍스트",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": "정답"
    }
  ]
}`

  const targetDesc = []
  if (input.grade) {
    targetDesc.push(`학습 대상: ${input.grade} (이 대상의 어휘 수준과 인지 능력에 철저히 맞춰 난이도를 조절하세요)`)
  }
  if (input.subject) {
    targetDesc.push(`과목 카테고리: ${input.subject} (해당 과목의 특성을 반영하여 출제하세요)`)
  }
  const contextHeader = targetDesc.length > 0
    ? `다음 조건에 맞춰 한국어 퀴즈 문제 ${questionCount}개를 생성해주세요.\n${targetDesc.join('\n')}`
    : `한국 초/중/고등학교 수준의 퀴즈 문제 ${questionCount}개를 생성해주세요.`
  const repairSection = repairNote ? `\n\n이전 응답의 문제점:\n${repairNote}\n위 문제를 반드시 고쳐 다시 생성하세요.` : ''

  if (input.sourceType === 'topic') {
    return `${contextHeader}

주제: ${input.topic}
${repairSection}

${jsonFormat}

${typeRules}${userRequest}`
  }

  const text = truncateText(input.text || '')
  return `${contextHeader}

다음 텍스트를 기반으로 문제를 생성해주세요:
텍스트:
${text}
${repairSection}

${jsonFormat}

${typeRules}
- 텍스트 기반 생성에서는 제공된 텍스트의 사실만 사용하고, 텍스트에 없는 세부 사실을 지어내지 마세요.
- 텍스트가 부족하면 일반 상식으로 채우지 말고, 확인 가능한 핵심 내용 중심으로 문제를 구성하세요.${userRequest}`
}

function parseQuestionsFromJSON(text: string): GeneratedQuestion[] {
  // 1) JSON 코드 블록 안의 내용 추출 시도
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    const parsed = JSON.parse(codeBlockMatch[1].trim())
    return parsed.questions || []
  }

  // 2) 가장 바깥쪽 { ... } 추출
  let depth = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (text[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1)
        try {
          const parsed = JSON.parse(candidate)
          if (parsed.questions) return parsed.questions
        } catch {
          // 다음 매칭 시도
        }
        start = -1
      }
    }
  }

  // 3) 배열 직접 반환인 경우
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    const parsed = JSON.parse(arrayMatch[0])
    if (Array.isArray(parsed)) return parsed
  }

  throw new Error('AI 응답에서 문제 JSON을 추출할 수 없습니다.')
}

function asString(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeForCompare(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '')
}

function normalizeQuestionType(type: unknown): GeneratedQuestion['type'] {
  const normalized = String(type ?? '').toUpperCase()
  if ((QUESTION_TYPES as readonly string[]).includes(normalized)) return normalized as GeneratedQuestion['type']
  if (['MULTIPLE_CHOICE', 'MCQ', 'SELECT'].includes(normalized)) return 'CHOICE'
  if (['TRUE_FALSE', 'TF', 'BOOL'].includes(normalized)) return 'OX'
  if (['FILL_BLANK', 'FILL_IN_THE_BLANK'].includes(normalized)) return 'BLANK'
  return 'SHORT'
}

function dedupeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return []
  const seen = new Set<string>()
  return options
    .map((option) => asString(option).replace(/^[A-Da-d][\).]\s*/, ''))
    .filter((option) => {
      if (!option) return false
      const key = normalizeForCompare(option)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function normalizeChoiceAnswer(answer: string, options: string[]): string {
  const labelIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, '1': 0, '2': 1, '3': 2, '4': 3 }
  const label = answer.toUpperCase().replace(/[^A-D1-4]/g, '')
  if (label && labelIndex[label] !== undefined && options[labelIndex[label]]) {
    return options[labelIndex[label]]
  }

  const answerKey = normalizeForCompare(answer)
  return options.find((option) => normalizeForCompare(option) === answerKey) ?? answer
}

function normalizeOxAnswer(answer: string): 'O' | 'X' | '' {
  const value = normalizeForCompare(answer)
  if (['o', 'true', 'yes', '맞음', '맞다', '참', '정답'].includes(value)) return 'O'
  if (['x', 'false', 'no', '아님', '아니다', '거짓', '오답'].includes(value)) return 'X'
  return ''
}

function ensureBlankPlaceholder(questionText: string, answer: string): string {
  if (/\[\s*\]|\{\{blank\}\}/.test(questionText) || questionText.includes(BLANK_PLACEHOLDER)) {
    return questionText.replace(/\{\{blank\}\}|\[\s*\]/g, BLANK_PLACEHOLDER)
  }

  if (answer && questionText.includes(answer)) {
    return questionText.replace(answer, BLANK_PLACEHOLDER)
  }

  return `${questionText} ${BLANK_PLACEHOLDER}`
}

function normalizeQuestion(rawQuestion: unknown): GeneratedQuestion | null {
  if (!rawQuestion || typeof rawQuestion !== 'object') return null
  const raw = rawQuestion as Partial<GeneratedQuestion>
  const type = normalizeQuestionType(raw.type)
  let questionText = asString(raw.question_text)
  let answer = asString(raw.answer)
  let options = dedupeOptions(raw.options)

  if (!questionText || !answer) return null

  if (type === 'CHOICE') {
    answer = normalizeChoiceAnswer(answer, options)
    if (!options.some((option) => normalizeForCompare(option) === normalizeForCompare(answer))) {
      options = [...options, answer]
    }
    if (options.length < 4) return null
    if (options.length > 4) {
      const answerOption = options.find((option) => normalizeForCompare(option) === normalizeForCompare(answer)) ?? answer
      options = options.filter((option) => normalizeForCompare(option) !== normalizeForCompare(answerOption)).slice(0, 3)
      options.push(answerOption)
    }
    const matchedAnswer = options.find((option) => normalizeForCompare(option) === normalizeForCompare(answer))
    if (!matchedAnswer) return null
    return { type, question_text: questionText, options, answer: matchedAnswer }
  }

  if (type === 'OX') {
    answer = normalizeOxAnswer(answer)
    if (!answer) return null
    return { type, question_text: questionText, options: ['O', 'X'], answer }
  }

  if (type === 'BLANK') {
    questionText = ensureBlankPlaceholder(questionText, answer)
    if (!questionText.includes(BLANK_PLACEHOLDER)) return null
    return { type, question_text: questionText, options: [], answer }
  }

  return { type: 'SHORT', question_text: questionText, options: [], answer }
}

function validateQuestions(questions: unknown[], questionCount?: number): GeneratedQuestion[] {
  const seen = new Set<string>()
  const normalizedQuestions: GeneratedQuestion[] = []

  for (const rawQuestion of questions) {
    const question = normalizeQuestion(rawQuestion)
    if (!question) continue

    const key = normalizeForCompare(question.question_text)
    if (seen.has(key)) continue
    seen.add(key)
    normalizedQuestions.push(question)
  }

  return typeof questionCount === 'number'
    ? normalizedQuestions.slice(0, questionCount)
    : normalizedQuestions
}

function buildRepairNote(requestedCount: number, receivedCount: number): string {
  return [
    `요청한 문제 수는 ${requestedCount}개였지만 저장 가능한 문제는 ${receivedCount}개뿐이었습니다.`,
    '보기 개수, 정답-보기 일치, OX 정답, 빈칸 플레이스홀더, 중복 문제 규칙을 모두 만족해야 합니다.',
  ].join('\n')
}

async function callGeminiModel(
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.35,
    },
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function callGeminiWithRetry(apiKey: string, prompt: string): Promise<string> {
  const delays = [1000, 2000]
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await callGeminiModel(apiKey, PRIMARY_MODEL, prompt)
    } catch (error) {
      // 과부하는 잠시 후 주 모델 재시도
      if (isOverloadedError(error) && i < delays.length) {
        await sleep(delays[i])
        continue
      }
      // 과부하가 지속되거나 쿼터 초과면 경량 모델로 폴백 (별도 쿼터 버킷)
      if (isOverloadedError(error) || isQuotaError(error)) {
        try {
          return await callGeminiModel(apiKey, FALLBACK_MODEL, prompt)
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

async function generateQuestionsWithGemini(
  input: QuestionInput,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not found')

  let repairNote: string | undefined
  let bestQuestions: GeneratedQuestion[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildGenerationPrompt(input, questionCount, repairNote)
    const text = await callGeminiWithRetry(apiKey, prompt)
    const questions = validateQuestions(parseQuestionsFromJSON(text), questionCount)
    if (questions.length > bestQuestions.length) bestQuestions = questions
    if (questions.length >= questionCount) return questions
    repairNote = buildRepairNote(questionCount, questions.length)
  }

  if (bestQuestions.length > 0) return bestQuestions
  throw new Error('AI가 저장 가능한 문제를 만들지 못했습니다. 주제나 자료를 조금 더 구체적으로 입력해주세요.')
}

async function generateQuestionsWithOpenAI(
  input: QuestionInput,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not found')

  let repairNote: string | undefined
  let bestQuestions: GeneratedQuestion[] = []

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildGenerationPrompt(input, questionCount, repairNote)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates educational quiz questions in Korean. Always respond with valid JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || 'OpenAI 문제 생성 요청에 실패했습니다.')
    }
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('OpenAI 응답에 문제 내용이 없습니다.')

    const questions = validateQuestions(parseQuestionsFromJSON(text), questionCount)
    if (questions.length > bestQuestions.length) bestQuestions = questions
    if (questions.length >= questionCount) return questions
    repairNote = buildRepairNote(questionCount, questions.length)
  }

  if (bestQuestions.length > 0) return bestQuestions
  throw new Error('AI가 저장 가능한 문제를 만들지 못했습니다. 주제나 자료를 조금 더 구체적으로 입력해주세요.')
}

/**
 * 시험지/문제지에서 추출된 Vision AI 응답을 파싱합니다.
 * extractQuestionsFromImage()의 raw 텍스트를 받아 GeneratedQuestion[]으로 변환합니다.
 */
export function parseExamVisionResponse(visionText: string): GeneratedQuestion[] {
  const questions = parseQuestionsFromJSON(visionText)
  return validateQuestions(questions)
}

export async function generateQuestions(
  input: QuestionInput,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  if (process.env.GEMINI_API_KEY) {
    return generateQuestionsWithGemini(input, questionCount)
  }
  if (process.env.OPENAI_API_KEY) {
    return generateQuestionsWithOpenAI(input, questionCount)
  }
  throw new Error('AI API 키가 설정되지 않았습니다. GEMINI_API_KEY 또는 OPENAI_API_KEY를 설정해주세요.')
}
