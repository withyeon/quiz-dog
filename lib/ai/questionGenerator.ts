import { GoogleGenerativeAI } from '@google/generative-ai'

export type SourceType = 'topic' | 'youtube' | 'text' | 'pdf' | 'file' | 'exam'

export interface QuestionInput {
  topic?: string
  text?: string
  sourceType: SourceType
  grade?: string
  subject?: string
}

export interface GeneratedQuestion {
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}

const MAX_TEXT_LENGTH = 30000

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  return text.slice(0, MAX_TEXT_LENGTH) + '\n\n[텍스트가 길어 일부만 사용되었습니다]'
}

function buildGenerationPrompt(input: QuestionInput, questionCount: number): string {
  const typeRules = `주의사항:
- BLANK 타입의 경우 question_text에 {{blank}} 플레이스홀더를 사용하세요.
- CHOICE 타입은 반드시 4개의 보기를 제공하세요.
- OX 타입은 options에 ["O", "X"]만 포함하세요.
- SHORT 타입은 options를 빈 배열로 하세요.
- JSON만 출력하고 다른 설명은 포함하지 마세요.`

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

  if (input.sourceType === 'topic') {
    return `${contextHeader}

주제: ${input.topic}

${jsonFormat}

${typeRules}`
  }

  const text = truncateText(input.text || '')
  return `${contextHeader}

다음 텍스트를 기반으로 문제를 생성해주세요:
텍스트:
${text}

${jsonFormat}

${typeRules}
- 텍스트의 핵심 내용을 바탕으로 문제를 만들어주세요.`
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

function validateQuestions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  return questions
    .filter((q) => q.question_text && q.type)
    .map((q) => ({
      type: (['CHOICE', 'SHORT', 'OX', 'BLANK'].includes(q.type) ? q.type : 'CHOICE') as GeneratedQuestion['type'],
      question_text: q.question_text.trim(),
      options: Array.isArray(q.options) ? q.options : [],
      answer: (q.answer || '').trim(),
    }))
}

async function generateQuestionsWithGemini(
  input: QuestionInput,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not found')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = buildGenerationPrompt(input, questionCount)
  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  const questions = parseQuestionsFromJSON(text)
  return validateQuestions(questions)
}

async function generateQuestionsWithOpenAI(
  input: QuestionInput,
  questionCount: number = 5
): Promise<GeneratedQuestion[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not found')

  const prompt = buildGenerationPrompt(input, questionCount)

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
  const text = data.choices[0].message.content

  const questions = parseQuestionsFromJSON(text)
  return validateQuestions(questions)
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
