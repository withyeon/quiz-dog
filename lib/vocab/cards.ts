import type { QuestionDraft } from '@/lib/services/questionSets'

/**
 * 단어장 카드. 문제집에는 객관식 문제로 저장한다 (sql/20261025_vocab_sets.sql 참고):
 *   question_text = 용어, answer = 뜻, options = 뜻 + 다른 카드의 뜻 몇 개
 * 그래서 단어장을 그대로 모든 게임에 쓸 수 있고, 공부 화면은 question_text·answer 만 읽는다.
 */
export type VocabCard = {
  /** 저장된 카드면 questions.id. 새 카드는 없다 */
  id?: string
  term: string
  definition: string
}

/** 학습하기·테스트의 객관식이 보기 4개를 만들 수 있는 최소 장수 */
export const MIN_VOCAB_CARDS = 4
export const MAX_VOCAB_CARDS = 500
export const MAX_VOCAB_TEXT_LENGTH = 300
/** 게임용 보기 수 (정답 1 + 다른 카드의 뜻) */
const GAME_CHOICE_COUNT = 4

export type TermSeparator = 'tab' | 'comma' | 'dash' | 'colon' | 'custom'
export type RowSeparator = 'newline' | 'semicolon' | 'custom'

export type PasteFormat = {
  term: TermSeparator
  row: RowSeparator
  customTerm?: string
  customRow?: string
}

const TERM_SEPARATOR_TEXT: Record<Exclude<TermSeparator, 'custom'>, string> = {
  tab: '\t',
  comma: ',',
  dash: ' - ',
  colon: ':',
}

/**
 * 붙여넣은 글에서 구분자를 짐작한다. 다른 단어장 서비스·엑셀에서 복사하면 대부분 "탭 + 줄바꿈"이고,
 * 선생님이 직접 친 목록은 "apple - 사과" 나 "apple: 사과" 꼴이 많다.
 */
export function detectPasteFormat(text: string): PasteFormat {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const row: RowSeparator = lines.length <= 1 && text.includes(';') ? 'semicolon' : 'newline'
  const rows = row === 'semicolon' ? text.split(';') : lines
  const share = (pattern: RegExp) => rows.filter((line) => pattern.test(line)).length / Math.max(1, rows.length)

  if (text.includes('\t')) return { term: 'tab', row }
  if (share(/\s[-–—]\s/) >= 0.5) return { term: 'dash', row }
  if (share(/:/) >= 0.5) return { term: 'colon', row }
  return { term: 'comma', row }
}

function splitFirst(line: string, separator: TermSeparator, custom?: string): [string, string] {
  // " - " 는 앞뒤 공백이 하나만 있거나 대시 종류가 달라도 받아 준다 ("apple – 사과")
  if (separator === 'dash') {
    const match = line.match(/\s+[-–—]\s+/)
    if (!match || match.index === undefined) return [line, '']
    return [line.slice(0, match.index), line.slice(match.index + match[0].length)]
  }
  const token = separator === 'custom' ? (custom || '\t') : TERM_SEPARATOR_TEXT[separator]
  const index = line.indexOf(token)
  if (index < 0) return [line, '']
  // 뜻 안에 구분자가 또 있어도("run, 달리다, 운영하다") 첫 번째에서만 자른다
  return [line.slice(0, index), line.slice(index + token.length)]
}

/** 붙여넣은 글 → 카드 목록. 빈 줄은 건너뛰고, 구분자가 없는 줄은 뜻이 빈 카드가 된다(편집기에서 표시). */
export function parseVocabText(text: string, format: PasteFormat): VocabCard[] {
  const rowToken = format.row === 'semicolon' ? ';' : format.row === 'custom' ? (format.customRow || '\n') : null
  const rows = rowToken ? text.split(rowToken) : text.split(/\r?\n/)
  return rows
    .map((row) => row.replace(/\r/g, '').trim())
    .filter(Boolean)
    .map((row) => {
      const [term, definition] = splitFirst(row, format.term, format.customTerm)
      return { term: term.trim(), definition: definition.trim() }
    })
    .filter((card) => card.term || card.definition)
}

export function isBlankCard(card: Pick<VocabCard, 'term' | 'definition'>): boolean {
  return !card.term.trim() && !card.definition.trim()
}

export type VocabValidation = {
  /** 저장을 막는 문제 (전체) */
  errors: string[]
  /** 카드 index → 그 카드의 문제 */
  cardErrors: Record<number, string>
}

/** 비어 있는 줄은 저장할 때 버리므로 검사하지 않는다. */
export function validateVocabCards(cards: VocabCard[]): VocabValidation {
  const cardErrors: Record<number, string> = {}
  cards.forEach((card, index) => {
    if (isBlankCard(card)) return
    if (!card.term.trim()) cardErrors[index] = '용어를 적어 주세요.'
    else if (!card.definition.trim()) cardErrors[index] = '뜻을 적어 주세요.'
    else if (card.term.length > MAX_VOCAB_TEXT_LENGTH || card.definition.length > MAX_VOCAB_TEXT_LENGTH) {
      cardErrors[index] = `${MAX_VOCAB_TEXT_LENGTH}자까지 적을 수 있어요.`
    }
  })

  const filled = cards.filter((card) => !isBlankCard(card))
  const errors: string[] = []
  if (Object.keys(cardErrors).length > 0) errors.push('비어 있는 칸이 있는 카드를 채우거나 지워 주세요.')
  if (filled.length < MIN_VOCAB_CARDS) errors.push(`카드는 ${MIN_VOCAB_CARDS}장 이상 있어야 해요.`)
  if (filled.length > MAX_VOCAB_CARDS) errors.push(`카드는 ${MAX_VOCAB_CARDS}장까지 만들 수 있어요.`)
  const distinctDefinitions = new Set(filled.map((card) => card.definition.trim()))
  if (filled.length >= MIN_VOCAB_CARDS && distinctDefinitions.size < 2) {
    errors.push('뜻이 모두 같아서 객관식 보기를 만들 수 없어요.')
  }
  return { errors, cardErrors }
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

/**
 * 카드 → 저장할 객관식 문제. 보기는 정답 뜻 + 다른 카드의 (서로 다른) 뜻 최대 3개를 섞은 것.
 * 뜻 하나를 고치면 다른 카드의 보기에도 들어가 있으므로, 저장할 때마다 전체를 다시 만든다.
 */
export function buildVocabQuestions(cards: VocabCard[], random: () => number = Math.random): (QuestionDraft & { id?: string })[] {
  const filled = cards
    .filter((card) => !isBlankCard(card))
    .map((card) => ({ ...card, term: card.term.trim(), definition: card.definition.trim() }))
  const definitions = Array.from(new Set(filled.map((card) => card.definition)))

  return filled.map((card) => {
    const distractors = shuffle(definitions.filter((definition) => definition !== card.definition), random)
      .slice(0, GAME_CHOICE_COUNT - 1)
    return {
      ...(card.id ? { id: card.id } : {}),
      type: 'CHOICE' as const,
      question_text: card.term,
      options: shuffle([card.definition, ...distractors], random),
      answer: card.definition,
    }
  })
}

/** 저장된 문제 → 카드 (편집기·공부 화면) */
export function cardsFromQuestions(questions: Array<{ id: string; question_text: string; answer: string }>): Required<VocabCard>[] {
  return questions.map((question) => ({
    id: question.id,
    term: question.question_text,
    definition: question.answer,
  }))
}
