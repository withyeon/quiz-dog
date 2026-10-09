import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai'

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
  /**
   * 이미 만들어 둔 문제 목록(문제 글). 한 문제만 다시 만들거나 몇 개 더 만들 때,
   * 같은 내용을 또 묻지 않도록 AI에게 알려준다.
   */
  avoidQuestions?: string[]
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
  /** 선생님이 검수 화면에서 붙인 문제 그림 URL (AI는 채우지 않는다) */
  image_url?: string | null
  /** 해설(선택). AI가 정답인 이유를 1~2문장으로 쓰고, 선생님이 검수 화면에서 고친다 */
  explanation?: string | null
}

const MAX_TEXT_LENGTH = 30000
const QUESTION_TYPES = ['CHOICE', 'SHORT', 'OX', 'BLANK'] as const
const BLANK_PLACEHOLDER = '[            ]'
const MAX_AVOID_QUESTIONS = 40

const PRIMARY_MODEL = 'gemini-2.5-flash'
// 폴백은 별도 쿼터 버킷을 쓰는 경량 모델. gemini-1.5/2.0-flash는 무료 등급에서
// 제거됐거나 쿼터가 0이라 폴백으로 못 씀(404/429). flash-lite는 무료 쿼터가 있고 가벼움.
const FALLBACK_MODEL = 'gemini-2.5-flash-lite'

// 구조화 출력 스키마 — 모델이 형식을 어기는 일(유형 오타, options 누락, 마크다운 감싸기)을
// API 단계에서 막는다. 스키마를 거부하는 모델/버전이면 스키마 없이 한 번 더 부른다.
const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          type: { type: SchemaType.STRING, format: 'enum', enum: [...QUESTION_TYPES] },
          question_text: { type: SchemaType.STRING },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          answer: { type: SchemaType.STRING },
          explanation: { type: SchemaType.STRING },
        },
        required: ['type', 'question_text', 'options', 'answer', 'explanation'],
      },
    },
  },
  required: ['questions'],
}

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

// 400: 요청 형식 거부. 대개 responseSchema를 못 받는 경우라 스키마 없이 다시 시도한다.
function isBadRequestError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('400') || msg.includes('INVALID_ARGUMENT') || /schema/i.test(msg)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  return text.slice(0, MAX_TEXT_LENGTH) + '\n\n[텍스트가 길어 일부만 사용되었습니다]'
}

/**
 * 학년별 출제 기준. "학년에 맞춰 주세요"만으로는 모델이 늘 중학생 수준으로 쓴다.
 * 문장 길이·어휘·사고 수준을 숫자로 못 박아야 초등 저학년 문제가 진짜 쉬워진다.
 */
function getGradeGuide(grade?: string): string {
  if (!grade || grade === '전체') {
    return '학습 대상이 정해지지 않았습니다. 초등 고학년부터 중학생까지 누구나 풀 수 있는 수준으로, 한 문장 60자 이내의 쉬운 말로 쓰세요.'
  }
  if (grade === '초1' || grade === '초2') {
    return `학습 대상: ${grade}. 한 문장 25자 안팎, 일상에서 쓰는 쉬운 말만 쓰고 한자어·추상어는 피하세요. 보기는 1~3단어로 짧게, 숫자는 한 자리~두 자리 범위. 그림 없이 글만으로 이해되는 상황을 고르세요.`
  }
  if (grade === '초3' || grade === '초4') {
    return `학습 대상: ${grade}. 교과서에 나오는 핵심 용어는 쓰되 한 문장 45자 이내로, 어려운 한자어는 풀어 쓰세요. 묻는 것은 한 가지만. 계산이 필요하면 두 단계 이하로.`
  }
  if (grade === '초5' || grade === '초6') {
    return `학습 대상: ${grade}. 개념 사이의 관계나 이유를 묻는 문제를 섞되 한 문장 60자 이내로 쓰세요. 교과서 용어를 정확히 쓰고, 실생활 예시를 활용하세요.`
  }
  if (grade === '중학교') {
    return '학습 대상: 중학생. 교과 용어를 정확히 쓰고, 단순 암기 외에 적용·비교 문제를 절반 가까이 넣으세요. 한 문장 70자 이내.'
  }
  if (grade === '고등학교') {
    return '학습 대상: 고등학생. 개념의 적용·분석을 묻고 선지의 변별력을 높이세요. 다만 게임용이므로 한 문장 80자 이내로 간결하게.'
  }
  return `학습 대상: ${grade}. 이 대상의 어휘 수준과 인지 능력에 맞춰 난이도를 조절하세요.`
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

  // 이미 있는 문제와 겹치지 않게 (한 문제 다시 만들기 · 몇 개 더 만들기)
  const avoidList = (input.avoidQuestions ?? [])
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_AVOID_QUESTIONS)
  const avoidSection = avoidList.length > 0
    ? `\n\n[이미 만들어 둔 문제 — 아래와 같은 내용·같은 정답을 묻는 문제는 만들지 말고, 아직 다루지 않은 개념을 고르세요]\n${avoidList.map((q) => `- ${q}`).join('\n')}`
    : ''

  const qualityRules = `출제 품질 규칙:
- 정확히 ${questionCount}개를 생성하세요. 더 적거나 많으면 실패입니다.
${typeRestriction}
- 이 문제는 학생들이 휴대폰 화면에서 제한 시간(약 20초) 안에 푸는 게임용입니다. 문제는 한 번 읽고 바로 이해되게 80자 이내로, 보기는 각각 20자 이내로 쓰세요.
- 각 문제는 서로 다른 핵심 개념을 물어야 하며, 같은 질문을 표현만 바꿔 반복하지 마세요. 주제의 주요 하위 개념을 고르게 다루세요.
- 난이도는 쉬움 40% · 보통 40% · 어려움 20%로 섞고, 쉬운 문제부터 차례로 배치하세요.
- 문제 텍스트에 정답이 그대로 드러나지 않게 하세요. 문제 번호, '다음 중', '위 글에서', '본문에 따르면', '이 영상에서' 같은 표현은 쓰지 마세요. 학생은 자료를 보지 못하고 문제만 봅니다.
- CHOICE: 보기 4개를 정확히 제공하고 answer는 보기 문자열 중 하나와 완전히 같아야 합니다. 오답 보기는 정답과 같은 범주·비슷한 길이로, 학생이 흔히 헷갈리는 개념(오개념)을 반영해 그럴듯하게 만드세요. '모두 맞다', '정답 없음', '위의 모든 것' 같은 보기와 보기 앞의 번호·기호(①, A. 등), 보기 끝의 마침표는 금지입니다.
- OX: options는 ["O", "X"], answer는 "O" 또는 "X"만 가능합니다. 한 문장에 사실 하나만 담고, 부정문('~이 아니다')이나 이중 부정은 쓰지 마세요. O와 X가 비슷한 개수로 나오게 하세요.
- SHORT: options는 []로 두고, answer는 학생이 그대로 입력할 수 있는 한 낱말 또는 짧은 구(12자 이내)로 쓰세요. 고유명사·교과 용어·숫자처럼 철자가 하나로 정해지는 답만 내고, 문장으로 답하는 서술형은 금지입니다. 같은 뜻으로 흔히 쓰는 다른 표기가 있으면 '|'로 이어서 모두 적으세요(예: "세종대왕|세종"). 숫자 답은 단위 없이 숫자만 쓰세요.
- BLANK: question_text에 ${BLANK_PLACEHOLDER} 플레이스홀더를 정확히 1개 넣고, answer는 빈칸에 들어갈 핵심 용어 하나만 쓰세요. 빈칸 앞뒤 문맥만으로 답이 하나로 정해져야 합니다. SHORT와 같은 '|' 규칙을 따릅니다.
- explanation: 학생에게 말하듯 1~2문장으로 왜 그것이 정답인지 쓰세요. 객관식이면 가장 헷갈리는 오답이 왜 아닌지도 짧게 덧붙이세요. 정답만 되풀이하지 마세요.
- 한국어 수업에서 바로 쓸 수 있도록 자연스럽고 명확한 문장으로, 맞춤법을 지켜 작성하세요.
- JSON만 출력하고 마크다운, 설명, 사과문, 주석은 절대 포함하지 마세요.`

  const jsonFormat = `각 문제는 다음 JSON 형식으로 출력해주세요:
{
  "questions": [
    {
      "type": "CHOICE" | "SHORT" | "OX" | "BLANK",
      "question_text": "문제 텍스트",
      "options": ["보기1", "보기2", "보기3", "보기4"],
      "answer": "정답",
      "explanation": "정답인 이유를 학생 눈높이로 1~2문장"
    }
  ]
}`

  const targetDesc = [getGradeGuide(input.grade)]
  if (input.subject) {
    targetDesc.push(`과목: ${input.subject}. 이 과목에서 해당 학년이 실제로 배우는 범위(교육과정 성취기준) 안에서만 출제하고, 아직 배우지 않는 상위 개념은 쓰지 마세요.`)
  }
  const contextHeader = `당신은 한국 초·중·고 수업에서 쓸 퀴즈를 만드는 베테랑 교사입니다. 다음 조건에 맞춰 한국어 퀴즈 문제 ${questionCount}개를 만들어 주세요.\n${targetDesc.join('\n')}`
  const repairSection = repairNote ? `\n\n이전 응답의 문제점:\n${repairNote}\n위 문제를 반드시 고쳐 다시 생성하세요.` : ''

  if (input.sourceType === 'topic') {
    return `${contextHeader}

주제: ${input.topic}
- 주제가 단원명이면 그 단원의 핵심 개념·용어·대표 사례를 고르게 다루고, 한 개념에 몰리지 않게 하세요.
- 주제에 학년·학교급이 적혀 있으면 그 수준을 우선합니다.
${repairSection}${avoidSection}

${jsonFormat}

${qualityRules}${userRequest}`
  }

  const text = truncateText(input.text || '')
  return `${contextHeader}

다음 자료를 바탕으로 문제를 만들어 주세요.
자료:
${text}
${repairSection}${avoidSection}

${jsonFormat}

${qualityRules}
- 자료에 있는 사실만 사용하고, 자료에 없는 세부 사실을 지어내지 마세요. 자료가 부족하면 일반 상식으로 채우지 말고 확인 가능한 핵심 내용에 집중하세요.
- 자료의 핵심 개념·주요 사실을 우선하고, 지엽적인 숫자·이름 나열이나 자료의 형식(쪽 번호, 제목, 작성자)에 관한 문제는 내지 마세요.
- 자료가 자막·발표 자료라면 인사말·광고·오타·반복 같은 군더더기는 무시하고 내용만 보세요.
- 문제는 자료 없이도 풀 수 있게 독립적으로 쓰세요. 학생은 자료를 보지 못합니다.${userRequest}`
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

/**
 * 시험지 옮기기용: 줄바꿈은 살리고(보기 상자 ㄱ·ㄴ·ㄷ, 지문 단락) 줄 안의 공백만 정리한다.
 * 화면(QuizView·검수 textarea)은 줄바꿈을 그대로 보여 준다.
 */
function asVerbatimString(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    // 종이의 답란("답: ______", "정답: (    )")은 문제 내용이 아니므로 뗀다
    .filter((line) => !/^(답|정답)\s*[:：]?\s*[_＿\-—–()\[\]□\s]*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 비교용 키. 글자·숫자·한글(자모 ㄱ·ㄴ·ㄷ 포함)만 남긴다.
// "ㄱ, ㄷ" 같은 조합형 보기나 "+", "×" 같은 기호 보기는 키가 비어 서로 같은 보기로 오해되므로 원문을 그대로 키로 쓴다.
function normalizeForCompare(value: string): string {
  const key = value.normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣ㄱ-ㆎ]/g, '')
  return key || value.normalize('NFKC').replace(/\s+/g, '')
}

function normalizeQuestionType(type: unknown): GeneratedQuestion['type'] {
  const normalized = String(type ?? '').toUpperCase()
  if ((QUESTION_TYPES as readonly string[]).includes(normalized)) return normalized as GeneratedQuestion['type']
  if (['MULTIPLE_CHOICE', 'MCQ', 'SELECT'].includes(normalized)) return 'CHOICE'
  if (['TRUE_FALSE', 'TF', 'BOOL'].includes(normalized)) return 'OX'
  if (['FILL_BLANK', 'FILL_IN_THE_BLANK'].includes(normalized)) return 'BLANK'
  return 'SHORT'
}

// 보기 앞의 번호·기호(①, 1., A), 가) 등)와 끝의 마침표를 떼어 낸다.
// "1.5", "3.14"처럼 숫자 뒤에 바로 숫자가 오면 소수점이므로 번호로 보지 않는다.
function cleanOptionText(option: string): string {
  return option
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
    .replace(/^[A-Ea-e가-마][\).]\s*/, '')
    .replace(/^[1-9]\)\s*/, '')
    .replace(/^[1-9]\.(?!\d)\s*/, '')
    .replace(/\.$/, '')
    .trim()
}

function dedupeOptions(options: unknown): string[] {
  if (!Array.isArray(options)) return []
  const seen = new Set<string>()
  return options
    .map((option) => cleanOptionText(asString(option)))
    .filter((option) => {
      if (!option) return false
      const key = normalizeForCompare(option)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// 정답이 "③", "3", "3번", "C", "다" 같은 보기 번호(기호)로만 적혀 있으면 그 자리의 보기를 돌려준다.
const CHOICE_LABEL_INDEX: Record<string, number> = {
  '①': 0, '②': 1, '③': 2, '④': 3, '⑤': 4,
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
  A: 0, B: 1, C: 2, D: 3, E: 4,
  '가': 0, '나': 1, '다': 2, '라': 3, '마': 4,
}

function resolveChoiceLabel(answer: string, options: string[]): string | null {
  const label = answer
    .trim()
    .toUpperCase()
    .replace(/^\(|\)$/g, '')
    .replace(/\s*번$/, '')
    .replace(/[.)]$/, '')
    .trim()
  const index = CHOICE_LABEL_INDEX[label]
  if (index === undefined) return null
  return options[index] ?? null
}

function normalizeChoiceAnswer(answer: string, options: string[]): string {
  const byLabel = resolveChoiceLabel(answer, options)
  if (byLabel) return byLabel

  const cleaned = cleanOptionText(answer)
  const answerKey = normalizeForCompare(cleaned)
  return options.find((option) => normalizeForCompare(option) === answerKey) ?? cleaned
}

function normalizeOxAnswer(answer: string): 'O' | 'X' | '' {
  const value = normalizeForCompare(answer)
  if (['o', 'true', 'yes', '맞음', '맞다', '참', '정답'].includes(value)) return 'O'
  if (['x', 'false', 'no', '아님', '아니다', '거짓', '오답'].includes(value)) return 'X'
  return ''
}

// 시험지에 흔한 빈칸 표기: "(      )", "(  ㉠  )", "______", "□□" → 앱의 빈칸 표시로 통일
// (asVerbatimString이 공백을 한 칸으로 줄이므로 괄호 안 공백 수는 따지지 않는다)
const PAPER_BLANK_SOURCE = '\\(\\s*\\)|\\(\\s*[㉠-㉭]\\s*\\)|_{3,}|□{2,}'

function ensureBlankPlaceholder(questionText: string, answer: string, verbatim = false): string {
  if (/\[\s*\]|\{\{blank\}\}/.test(questionText) || questionText.includes(BLANK_PLACEHOLDER)) {
    return questionText.replace(/\{\{blank\}\}|\[\s*\]/g, BLANK_PLACEHOLDER)
  }

  if (verbatim && new RegExp(PAPER_BLANK_SOURCE).test(questionText)) {
    // 빈칸이 여럿이면 첫 번째만 답 칸으로 쓰고 나머지는 그대로 둔다 (게임은 빈칸 하나만 받는다)
    let replaced = false
    return questionText.replace(new RegExp(PAPER_BLANK_SOURCE, 'g'), (match) => {
      if (replaced) return match
      replaced = true
      return BLANK_PLACEHOLDER
    })
  }

  if (answer && questionText.includes(answer)) {
    return questionText.replace(answer, BLANK_PLACEHOLDER)
  }

  return `${questionText} ${BLANK_PLACEHOLDER}`
}

// 모델은 정답을 첫 번째나 마지막 보기에 두는 버릇이 있다. 섞어서 자리로 찍지 못하게 한다.
function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

type NormalizeOptions = {
  /** AI가 만든 문제: 정답 자리로 찍지 못하게 보기를 섞는다 */
  shuffleChoices?: boolean
  /**
   * 시험지 옮기기: 종이에 적힌 대로 보존한다.
   * - 줄바꿈 유지, 보기 수·순서 그대로(4개가 아니어도 버리거나 깎지 않음 → 검수 화면이 알려 준다)
   * - 정답을 못 읽었어도 문제를 버리지 않는다(선생님이 검수에서 채움)
   * - 정답이 보기와 안 맞아도 보기를 덧붙이지 않는다
   */
  verbatim?: boolean
}

function normalizeQuestion(rawQuestion: unknown, { shuffleChoices = false, verbatim = false }: NormalizeOptions = {}): GeneratedQuestion | null {
  if (!rawQuestion || typeof rawQuestion !== 'object') return null
  const raw = rawQuestion as Partial<GeneratedQuestion>
  const type = normalizeQuestionType(raw.type)
  let questionText = verbatim ? asVerbatimString(raw.question_text) : asString(raw.question_text)
  let answer = asString(raw.answer)
  let options = dedupeOptions(raw.options)
  // 해설은 선택. 너무 길면 자른다 (화면에 카드로 보여주는 글이라 몇 문장이면 충분하다).
  const explanationText = asString(raw.explanation).slice(0, 400)
  const explanation = explanationText ? { explanation: explanationText } : {}

  if (!questionText) return null
  if (!answer && !verbatim) return null

  if (verbatim) {
    // 종이 시험지 그대로: 형식만 맞추고 내용은 손대지 않는다
    if (type === 'CHOICE') {
      if (options.length === 0) return null
      const matched = answer ? normalizeChoiceAnswer(answer, options) : ''
      return { type, question_text: questionText, options, answer: matched, ...explanation }
    }
    if (type === 'OX') {
      return { type, question_text: questionText, options: ['O', 'X'], answer: normalizeOxAnswer(answer), ...explanation }
    }
    if (type === 'BLANK') {
      questionText = ensureBlankPlaceholder(questionText, answer, true)
      return { type, question_text: questionText, options: [], answer, ...explanation }
    }
    return { type: 'SHORT', question_text: questionText, options: [], answer, ...explanation }
  }

  if (type === 'CHOICE') {
    answer = normalizeChoiceAnswer(answer, options)
    if (!options.some((option) => normalizeForCompare(option) === normalizeForCompare(answer))) {
      options = [...options, answer]
    }
    if (options.length < 4) return null
    if (options.length > 4) {
      const answerOption = options.find((option) => normalizeForCompare(option) === normalizeForCompare(answer)) ?? answer
      const others = options.filter((option) => normalizeForCompare(option) !== normalizeForCompare(answerOption)).slice(0, 3)
      // 정답을 항상 마지막에 두면 자리로 찍힌다 → 원래 자리 근처에 끼워 넣는다
      const insertAt = Math.min(others.length, Math.max(0, options.indexOf(answerOption)))
      options = [...others.slice(0, insertAt), answerOption, ...others.slice(insertAt)]
    }
    const matchedAnswer = options.find((option) => normalizeForCompare(option) === normalizeForCompare(answer))
    if (!matchedAnswer) return null
    if (shuffleChoices) options = shuffleArray(options)
    return { type, question_text: questionText, options, answer: matchedAnswer, ...explanation }
  }

  if (type === 'OX') {
    answer = normalizeOxAnswer(answer)
    if (!answer) return null
    return { type, question_text: questionText, options: ['O', 'X'], answer, ...explanation }
  }

  if (type === 'BLANK') {
    questionText = ensureBlankPlaceholder(questionText, answer)
    if (!questionText.includes(BLANK_PLACEHOLDER)) return null
    return { type, question_text: questionText, options: [], answer, ...explanation }
  }

  return { type: 'SHORT', question_text: questionText, options: [], answer, ...explanation }
}

// 시험지는 "다음 중 옳은 것은?"처럼 같은 글이 여러 번 나오므로 보기까지 합쳐서 같을 때만 중복으로 본다
function questionDedupeKey(question: GeneratedQuestion, verbatim: boolean): string {
  const text = normalizeForCompare(question.question_text)
  if (!verbatim) return text
  return `${text}|${question.options.map(normalizeForCompare).join('|')}`
}

function validateQuestions(questions: unknown[], questionCount?: number, normalizeOptions: NormalizeOptions = {}): GeneratedQuestion[] {
  const seen = new Set<string>()
  const normalizedQuestions: GeneratedQuestion[] = []

  for (const rawQuestion of questions) {
    const question = normalizeQuestion(rawQuestion, normalizeOptions)
    if (!question) continue

    const key = questionDedupeKey(question, normalizeOptions.verbatim === true)
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
  useSchema: boolean,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      ...(useSchema ? { responseSchema: RESPONSE_SCHEMA } : {}),
      // 너무 낮으면 오답 보기가 뻔해지고, 너무 높으면 형식을 어긴다
      temperature: 0.5,
    },
  })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function callGeminiWithRetry(apiKey: string, prompt: string): Promise<string> {
  const delays = [1000, 2000]
  let useSchema = true
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await callGeminiModel(apiKey, PRIMARY_MODEL, prompt, useSchema)
    } catch (error) {
      // 스키마를 못 받는 경우(400) → 스키마 없이 바로 다시
      if (useSchema && isBadRequestError(error) && !isQuotaError(error) && !isOverloadedError(error)) {
        useSchema = false
        continue
      }
      // 과부하는 잠시 후 주 모델 재시도
      if (isOverloadedError(error) && i < delays.length) {
        await sleep(delays[i])
        continue
      }
      // 과부하가 지속되거나 쿼터 초과면 경량 모델로 폴백 (별도 쿼터 버킷)
      if (isOverloadedError(error) || isQuotaError(error)) {
        try {
          return await callGeminiModel(apiKey, FALLBACK_MODEL, prompt, useSchema)
        } catch (fallbackError) {
          if (useSchema && isBadRequestError(fallbackError) && !isQuotaError(fallbackError)) {
            return callGeminiModel(apiKey, FALLBACK_MODEL, prompt, false)
          }
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
    const questions = validateQuestions(parseQuestionsFromJSON(text), questionCount, { shuffleChoices: true })
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

    const questions = validateQuestions(parseQuestionsFromJSON(text), questionCount, { shuffleChoices: true })
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
 * 시험지는 종이에 적힌 대로 옮기는 것이 목적이라 보기를 섞지 않고, 보기 수·정답 유무로 문제를 버리지 않는다
 * (형식이 안 맞는 문제는 검수 화면이 빨간 표시로 알려 준다).
 */
export function parseExamVisionResponse(visionText: string): GeneratedQuestion[] {
  const questions = parseQuestionsFromJSON(visionText)
  return validateQuestions(questions, undefined, { verbatim: true })
}

/** 시험지 이미지 안 그림 영역. Gemini 규약: [ymin, xmin, ymax, xmax], 0~1000 비율 */
export type FigureBox = [number, number, number, number]

export type ExamVisionItem = {
  question: GeneratedQuestion
  figureBox: FigureBox | null
}

export function parseFigureBox(value: unknown): FigureBox | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const nums = value.map((v) => Number(v))
  if (nums.some((n) => !Number.isFinite(n))) return null
  // 0~1 비율로 답한 경우도 받아준다
  const scale = Math.max(...nums) <= 1 ? 1000 : 1
  const [ymin, xmin, ymax, xmax] = nums.map((n) => Math.max(0, Math.min(1000, n * scale)))
  // 이미지의 3% 미만짜리 상자는 글자 한 줄을 잘못 잡은 것일 가능성이 높다
  if (ymax - ymin < 30 || xmax - xmin < 30) return null
  return [ymin, xmin, ymax, xmax]
}

/**
 * parseExamVisionResponse와 같은 검증·중복 제거를 거치되, 문제마다 그림 영역을 같이 돌려준다.
 * (normalizeQuestion은 알려진 필드만 남기므로 figure_box는 원본에서 따로 읽는다)
 */
export function parseExamVisionResponseWithFigures(visionText: string): ExamVisionItem[] {
  const rawQuestions = parseQuestionsFromJSON(visionText)
  const seen = new Set<string>()
  const items: ExamVisionItem[] = []

  for (const rawQuestion of rawQuestions) {
    const question = normalizeQuestion(rawQuestion, { verbatim: true })
    if (!question) continue
    const key = questionDedupeKey(question, true)
    if (seen.has(key)) continue
    seen.add(key)
    const figureBox = parseFigureBox((rawQuestion as { figure_box?: unknown } | null)?.figure_box)
    items.push({ question, figureBox })
  }

  return items
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
