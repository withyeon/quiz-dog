import { GoogleGenerativeAI, SchemaType, type Part, type ResponseSchema } from '@google/generative-ai'
import { MAX_VOCAB_CARDS, MAX_VOCAB_TEXT_LENGTH } from '@/lib/vocab/cards'

/**
 * 단어장 AI — 두 가지 길만 있다.
 *   scan    : 종이 단어 목록(사진·PDF)을 카드로 그대로 옮긴다. 시험지 옮기기(lib/extractors/image.ts)처럼
 *             글자를 고치지 않는 것이 핵심이고, 뜻이 비어 있는 단어만 (선생님이 허락하면) AI가 채운다.
 *   extract : 지문(붙여 넣은 글·사진·PDF·문서)에서 학생이 알아야 할 낱말을 골라 뜻과 함께 만든다.
 * 모델·재시도 방식은 문제 만들기와 같다(3.6-flash + thinking low, 과부하·쿼터면 3.5-flash-lite).
 */

const PRIMARY_MODEL = 'gemini-3.6-flash'
const FALLBACK_MODEL = 'gemini-3.5-flash-lite'
const THINKING_CONFIG: Record<string, unknown> = { thinkingConfig: { thinkingLevel: 'low' } }
// 같은 사진 한 장이 3초에 끝나기도, 35초 걸리기도 한다(2026-10-29 실측, 생각 토큰 0 — 서버 쪽 대기).
// 함수 한도 60초 안에 끝나도록 주 모델은 20초까지만 기다리고 경량 모델(~2초)로 넘어간다.
const PRIMARY_TIMEOUT_MS = 20_000
const FALLBACK_TIMEOUT_MS = 25_000

export const MAX_EXTRACT_COUNT = 40
export const MAX_SOURCE_TEXT_LENGTH = 20_000
/** 한 번에 옮기는 카드 상한 (사진 여러 장 합쳐서) */
const MAX_SCAN_CARDS = 200

export type VocabAiMode = 'scan' | 'extract'

export type VocabAiCard = {
  term: string
  definition: string
  /** 종이에 뜻이 없어 AI가 써 넣은 카드 (미리 보기에서 표시) */
  aiFilled?: boolean
}

export type VocabAiInput = {
  mode: VocabAiMode
  /** 사진·PDF (inlineData 로 그대로 넘긴다) */
  files: Array<{ mimeType: string; data: Buffer }>
  /** extract: 붙여 넣은 글이나 문서에서 뽑은 글 */
  text?: string
  grade?: string
  subject?: string
  /** extract: 고를 낱말 수 */
  count?: number
  /** scan: 뜻이 비어 있는 단어를 AI가 채울지 */
  fillMissing?: boolean
}

const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    cards: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          term: { type: SchemaType.STRING },
          definition: { type: SchemaType.STRING },
          filled: { type: SchemaType.BOOLEAN },
        },
        required: ['term', 'definition'],
      },
    },
  },
  required: ['cards'],
}

function audienceLine(grade?: string, subject?: string): string {
  const who = grade && grade !== '전체' ? `${grade} 학생` : '초등 고학년~중학생'
  return subject ? `${who}, 과목: ${subject}` : who
}

/** 뜻풀이 길이·말투를 학년에 맞춘다. 문제 만들기의 학년 기준(lib/ai/questionGenerator.ts)과 같은 구간. */
function definitionGuide(grade?: string): string {
  if (grade === '초1' || grade === '초2') return '뜻풀이는 25자 안팎, 일상에서 쓰는 쉬운 말로. 한자어로 다시 설명하지 마세요.'
  if (grade === '초3' || grade === '초4') return '뜻풀이는 40자 이내, 어려운 한자어는 풀어 쓰세요.'
  if (grade === '초5' || grade === '초6') return '뜻풀이는 50자 이내, 교과서에서 쓰는 말로 정확하게.'
  return '뜻풀이는 60자 이내로 정확하고 간결하게.'
}

function buildScanPrompt(input: VocabAiInput): string {
  const missingRule = input.fillMissing
    ? `- 종이에 뜻이 적혀 있지 않은 단어(단어만 나열된 목록, 뜻 칸이 빈 학습지)는 ${audienceLine(input.grade, input.subject)}에게 맞는 뜻을 직접 써 넣고 "filled": true 로 표시하세요. 영어 등 외국어 단어는 한국어 뜻(대표 뜻 1~3개, 쉼표로), 한국어 낱말은 쉬운 뜻풀이로 쓰세요. ${definitionGuide(input.grade)}
- 종이에 뜻이 있는 카드는 "filled": false 입니다.`
    : `- 종이에 뜻이 적혀 있지 않은 단어는 definition 을 빈 문자열로 두세요. 뜻을 지어내지 마세요. "filled" 는 항상 false 입니다.`

  return `당신은 종이 단어장·단어 목록을 디지털 낱말 카드로 옮겨 적는 전사(轉寫) 담당자입니다. 새로 만들거나 고치는 사람이 아닙니다.
첨부한 이미지(또는 PDF)에서 "용어(낱말)와 그 뜻"의 짝을 찾아, 페이지 순서대로 위에서 아래로(두 단이면 왼쪽 단 먼저) 최대 ${MAX_SCAN_CARDS}개까지 모두 옮기세요. 이미지가 여러 장이면 첨부한 순서대로 이어서 옮기세요.

가장 중요한 규칙 — 종이에 적힌 그대로:
- term 과 definition 은 종이 글자를 그대로 적으세요. 철자·맞춤법·띄어쓰기를 고치거나, 뜻을 줄이거나 바꿔 쓰지 마세요.
- 한 단어에 뜻이 여러 개면 종이에 적힌 순서대로 쉼표(, )로 이어 한 카드의 definition 에 넣으세요.
- 품사 표시(n. v. adj. 명 동 형 등)가 뜻 앞에 있으면 definition 맨 앞에 종이 그대로 남기세요.
- 번호(1. ① 01), 글머리표, 체크 칸, 발음 기호([ˈæpl] /æ/), 쪽수·머리글·단원 제목은 넣지 마세요.
- 예문·유의어·반의어 칸은 넣지 마세요. 표(단어 | 뜻 | 예문)라면 단어와 뜻 칸만 옮기세요.
- 손글씨도 읽되, 읽을 수 없는 단어는 짐작해서 채우지 말고 그 카드를 빼세요.
- 같은 단어가 두 번 나오면 처음 것만 옮기세요.
${missingRule}
- 단어 목록이 아니라 이야기·설명 글(지문)만 있는 이미지라면 낱말을 골라내지 말고 "cards": [] 로 답하세요.

출력 형식(JSON만):
{ "cards": [ { "term": "용어", "definition": "뜻", "filled": false } ] }`
}

function buildExtractPrompt(input: VocabAiInput): string {
  const count = Math.max(1, Math.min(MAX_EXTRACT_COUNT, input.count ?? 15))
  const hasFiles = input.files.length > 0
  const source = [
    hasFiles ? '첨부한 이미지·PDF 속 글' : '',
    input.text ? '아래 [글]' : '',
  ].filter(Boolean).join('과 ')

  return `당신은 ${audienceLine(input.grade, input.subject)}을 위한 단어장을 만드는 선생님입니다.
${source}에서 학생이 꼭 알아야 할 핵심 낱말을 ${count}개 골라, 뜻과 함께 낱말 카드로 만드세요.

고르는 기준:
- 글을 이해하는 데 꼭 필요하면서, 이 학년 학생이 잘 모를 만한 낱말·교과 용어·숙어를 고르세요.
- 누구나 아는 쉬운 일상어, 사람 이름·땅 이름 같은 고유 명사는 빼세요(그 글의 핵심 개념이면 넣어도 됩니다).
- 같은 낱말을 두 번 넣지 마세요. 글에 알맞은 낱말이 ${count}개보다 적으면 있는 만큼만 만드세요. 글에 없는 낱말을 더하지 마세요.
- 글에 나온 순서대로 적으세요.

카드 쓰는 법:
- term: 사전에 실리는 기본형으로 쓰세요. 영어는 원형(ran → run, children → child), 한국어 용언은 '-다' 꼴(달렸다 → 달리다). 숙어는 덩어리째(look forward to).
- definition: 이 글에서 쓰인 뜻을 중심으로 쓰세요.
  · 영어 등 외국어 낱말이면 한국어 뜻을 짧게(대표 뜻 1~3개, 쉼표로, 30자 이내).
  · 한국어 낱말이면 쉬운 말로 한 문장 뜻풀이. ${definitionGuide(input.grade)} 뜻풀이 안에 그 낱말 자체를 쓰지 마세요.
- "filled" 는 항상 false 로 두세요.

출력 형식(JSON만):
{ "cards": [ { "term": "낱말", "definition": "뜻", "filled": false } ] }${input.text ? `\n\n[글]\n${input.text.slice(0, MAX_SOURCE_TEXT_LENGTH)}` : ''}`
}

function isOverloadedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('503') || msg.includes('Service Unavailable') || msg.includes('high demand') || msg.includes('overloaded')
}

function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')
}

function isBadRequestError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('400') || msg.includes('INVALID_ARGUMENT') || /schema/i.test(msg)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function callGemini(parts: Part[], temperature: number): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.')
  const genAI = new GoogleGenerativeAI(apiKey)

  const callModel = async (modelName: string, useSchema: boolean, timeout: number) => {
    const model = genAI.getGenerativeModel(
      {
        model: modelName,
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          ...(modelName === PRIMARY_MODEL ? THINKING_CONFIG : {}),
          ...(useSchema ? { responseSchema: RESPONSE_SCHEMA } : {}),
        },
      },
      { timeout },
    )
    const result = await model.generateContent(parts)
    return result.response.text()
  }

  const delays = [1000, 2000]
  let useSchema = true
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await callModel(PRIMARY_MODEL, useSchema, PRIMARY_TIMEOUT_MS)
    } catch (error) {
      // 스키마를 못 받는 경우(400) → 스키마 없이 바로 다시
      if (useSchema && isBadRequestError(error) && !isQuotaError(error) && !isOverloadedError(error)) {
        useSchema = false
        continue
      }
      if (isOverloadedError(error) && i < delays.length) {
        await sleep(delays[i])
        continue
      }
      // 과부하 지속·쿼터·시간 초과·연결 오류는 경량 모델로 (별도 쿼터 버킷)
      break
    }
  }
  try {
    return await callModel(FALLBACK_MODEL, useSchema, FALLBACK_TIMEOUT_MS)
  } catch (fallbackError) {
    console.warn('[vocabGenerator] fallback failed:', fallbackError)
    if (isQuotaError(fallbackError)) {
      throw new Error('AI 사용량 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.')
    }
    throw new Error('AI가 지금 답하지 않아요. 잠시 후 다시 시도해 주세요.')
  }
}

function clean(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_VOCAB_TEXT_LENGTH)
}

/** 모델 응답 → 카드. 빈 용어·중복 용어는 버리고, 뜻이 빈 카드는 남긴다(편집기에서 표시되어 채울 수 있다). */
export function parseVocabAiResponse(text: string, limit: number): VocabAiCard[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return []
    try { parsed = JSON.parse(match[0]) } catch { return [] }
  }
  const raw = Array.isArray(parsed) ? parsed : (parsed as { cards?: unknown })?.cards
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const cards: VocabAiCard[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const term = clean(record.term)
    const definition = clean(record.definition)
    if (!term) continue
    const key = term.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({ term, definition, ...(record.filled === true && definition ? { aiFilled: true } : {}) })
    if (cards.length >= limit) break
  }
  return cards
}

export async function generateVocabCards(input: VocabAiInput): Promise<VocabAiCard[]> {
  const prompt = input.mode === 'scan' ? buildScanPrompt(input) : buildExtractPrompt(input)
  const parts: Part[] = [
    { text: prompt },
    ...input.files.map((file) => ({ inlineData: { mimeType: file.mimeType, data: file.data.toString('base64') } })),
  ]
  // 옮기기는 창의성 0(조금만 올라가도 뜻을 다듬어 쓴다), 뽑기는 낱말 고르기라 약간만
  const text = await callGemini(parts, input.mode === 'scan' ? 0 : 0.3)
  const limit = input.mode === 'scan' ? Math.min(MAX_SCAN_CARDS, MAX_VOCAB_CARDS) : Math.min(MAX_EXTRACT_COUNT, input.count ?? 15)
  return parseVocabAiResponse(text, limit)
}
