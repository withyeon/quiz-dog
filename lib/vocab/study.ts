import { shuffle } from '@/lib/vocab/cards'

/**
 * 단어장 공부 화면(app/cards/[code])의 규칙. 화면 없이 돌아가는 순수 함수만 둔다.
 *
 * 공부 방식 넷:
 *  - 카드 뒤집기: 앞면을 보고 떠올린 뒤 뒤집어 "알아요 / 아직이에요"로 나눈다.
 *  - 익히기: 7장씩 묶어, 처음엔 객관식으로 → 맞히면 직접 쓰기로 → 쓰기까지 맞히면 "다 외움".
 *  - 쓰기: 모든 카드를 직접 써서 답한다. 틀린 카드만 모아 다음 바퀴를 돈다.
 *  - 시험 보기: 참/거짓·객관식·쓰기를 섞은 시험지 한 장. 다 풀고 한 번에 채점한다.
 */

export type StudyCard = { id: string; term: string; definition: string }

/** 학생이 답으로 고르거나 쓸 쪽. 'term' 이면 뜻을 보여 주고 용어를 답한다 */
export type AnswerSide = 'term' | 'definition'

export function promptOf(card: StudyCard, answerWith: AnswerSide): string {
  return answerWith === 'term' ? card.definition : card.term
}

export function answerOf(card: StudyCard, answerWith: AnswerSide): string {
  return answerWith === 'term' ? card.term : card.definition
}

/** 정답 + 다른 카드에서 뽑은 (겹치지 않는) 오답으로 보기를 만든다. */
export function buildChoices(
  card: StudyCard,
  cards: StudyCard[],
  answerWith: AnswerSide,
  count = 4,
  random: () => number = Math.random,
): string[] {
  const answer = answerOf(card, answerWith)
  const seen = new Set([normalizeVocabAnswer(answer)])
  const distractors: string[] = []
  for (const other of shuffle(cards, random)) {
    if (distractors.length >= count - 1) break
    const text = answerOf(other, answerWith)
    const key = normalizeVocabAnswer(text)
    if (seen.has(key)) continue
    seen.add(key)
    distractors.push(text)
  }
  return shuffle([answer, ...distractors], random)
}

// ─── 쓰기 채점 ───
// 게임용 채점(lib/quiz/answerMatching.ts)은 한글·영문·숫자 말고는 다 지워서 일본어·악센트 글자가 사라진다.
// 단어장은 외국어가 많아 글자는 모두 남기고, 띄어쓰기·문장부호·대소문자만 무시한다.

function stripMarks(value: string): string {
  return value.replace(/[\s\p{P}\p{S}]/gu, '')
}

export function normalizeVocabAnswer(value: string): string {
  return stripMarks(String(value ?? '').normalize('NFKC').toLowerCase())
}

/** 괄호 속 보충 설명은 안 써도 된다: "(동) 달리다" → "달리다" */
function withoutParentheses(value: string): string {
  return value.replace(/\([^)]*\)|\[[^\]]*\]|（[^）]*）/g, ' ')
}

/**
 * 직접 쓴 답이 맞았는지. 다음 중 하나면 정답:
 *  - 띄어쓰기·문장부호·대소문자를 빼고 같다
 *  - 괄호 속 설명을 빼고 같다
 *  - 뜻이 "달리다, 운영하다"처럼 여러 개면 그중 하나와 같다
 * 그래도 억울한 경우를 위해 화면에 "내 답도 맞아요" 버튼을 둔다.
 */
export function isVocabAnswerCorrect(input: string, correct: string): boolean {
  const submitted = normalizeVocabAnswer(input)
  if (!submitted) return false
  const candidates = new Set<string>([
    normalizeVocabAnswer(correct),
    normalizeVocabAnswer(withoutParentheses(correct)),
  ])
  const parts = withoutParentheses(correct).split(/[,;/·|、，]/)
  if (parts.length > 1) {
    for (const part of parts) candidates.add(normalizeVocabAnswer(part))
  }
  candidates.delete('')
  return candidates.has(submitted)
}

// ─── 익히기 ───

/** 0 = 처음 보는 카드, 1 = 익히는 중(객관식 맞힘), 2 = 다 외움 */
export type LearnLevel = 0 | 1 | 2
export type LearnQuestionKind = 'choice' | 'written'

export type LearnOptions = {
  answerWith: AnswerSide
  /** 객관식 단계를 쓸지 */
  useChoice: boolean
  /** 쓰기 단계를 쓸지 */
  useWritten: boolean
  shuffle: boolean
}

export const LEARN_ROUND_SIZE = 7

export type LearnRound = {
  number: number
  cardIds: string[]
  cursor: number
  /** 이번 묶음에서 맞힌/틀린 결과 (요약 화면용) */
  results: Record<string, boolean>
}

export type LearnState = {
  levels: Record<string, LearnLevel>
  round: LearnRound | null
}

export function emptyLearnState(): LearnState {
  return { levels: {}, round: null }
}

export function levelOf(state: LearnState, cardId: string): LearnLevel {
  return state.levels[cardId] ?? 0
}

export function countLevels(state: LearnState, cards: StudyCard[]): Record<LearnLevel, number> {
  const counts: Record<LearnLevel, number> = { 0: 0, 1: 0, 2: 0 }
  for (const card of cards) counts[levelOf(state, card.id)] += 1
  return counts
}

/** 이 카드에 낼 문제 종류. 객관식을 껐으면 바로 쓰기, 쓰기를 껐으면 계속 객관식 */
export function learnQuestionKind(level: LearnLevel, options: LearnOptions): LearnQuestionKind {
  if (!options.useChoice) return 'written'
  if (!options.useWritten) return 'choice'
  return level >= 1 ? 'written' : 'choice'
}

/** 다음 묶음을 고른다. 익히는 중인 카드를 먼저, 그다음 새 카드. 다 외웠으면 null */
export function startLearnRound(
  state: LearnState,
  cards: StudyCard[],
  options: LearnOptions,
  random: () => number = Math.random,
): LearnState {
  const pending = cards.filter((card) => levelOf(state, card.id) < 2)
  if (pending.length === 0) return { ...state, round: null }

  const ordered = options.shuffle ? shuffle(pending, random) : pending
  const inProgress = ordered.filter((card) => levelOf(state, card.id) === 1)
  const fresh = ordered.filter((card) => levelOf(state, card.id) === 0)
  const picked = [...inProgress, ...fresh].slice(0, LEARN_ROUND_SIZE)

  return {
    ...state,
    round: {
      number: (state.round?.number ?? 0) + 1,
      cardIds: options.shuffle ? shuffle(picked.map((card) => card.id), random) : picked.map((card) => card.id),
      cursor: 0,
      results: {},
    },
  }
}

/** 답을 반영한다. 맞히면 한 단계 오르고, 틀리면 그대로(쓰기에서 틀려도 객관식으로 내려가지 않는다). */
export function answerLearnCard(state: LearnState, cardId: string, correct: boolean, options: LearnOptions): LearnState {
  const level = levelOf(state, cardId)
  const kind = learnQuestionKind(level, options)
  let next: LearnLevel = level
  if (correct) {
    // 한 종류만 켰으면 그 문제를 한 번 맞히면 다 외운 것으로 본다
    next = kind === 'written' || !options.useWritten ? 2 : 1
  }
  const round = state.round
  return {
    levels: { ...state.levels, [cardId]: next },
    round: round
      ? {
        ...round,
        // 같은 묶음에서 다시 나와도 첫 결과를 남긴다
        results: cardId in round.results ? round.results : { ...round.results, [cardId]: correct },
      }
      : null,
  }
}

/** 다음 카드로. 묶음 끝이면 cursor 가 cardIds.length 가 된다(요약 화면) */
export function advanceLearn(state: LearnState): LearnState {
  if (!state.round) return state
  return { ...state, round: { ...state.round, cursor: state.round.cursor + 1 } }
}

export function isLearnRoundDone(state: LearnState): boolean {
  return Boolean(state.round && state.round.cursor >= state.round.cardIds.length)
}

// ─── 시험 보기 ───

export type TestQuestionKind = 'truefalse' | 'choice' | 'written'

export const TEST_KIND_LABEL: Record<TestQuestionKind, string> = {
  truefalse: '참 / 거짓',
  choice: '객관식',
  written: '쓰기',
}

export type TestQuestion =
  | { kind: 'truefalse'; cardId: string; prompt: string; shown: string; answer: string; isTrue: boolean }
  | { kind: 'choice'; cardId: string; prompt: string; choices: string[]; answer: string }
  | { kind: 'written'; cardId: string; prompt: string; answer: string }

export type TestOptions = {
  count: number
  kinds: TestQuestionKind[]
  answerWith: AnswerSide
}

/**
 * 시험지를 만든다. 카드를 섞어 count 장 고른 뒤 고른 유형에 고르게 나누고,
 * 유형별로 묶어 참/거짓 → 객관식 → 쓰기 순서로 낸다(쉬운 것부터).
 */
export function buildTest(cards: StudyCard[], options: TestOptions, random: () => number = Math.random): TestQuestion[] {
  const kinds = (['truefalse', 'choice', 'written'] as const).filter((kind) => options.kinds.includes(kind))
  if (kinds.length === 0 || cards.length === 0) return []
  const picked = shuffle(cards, random).slice(0, Math.max(1, Math.min(options.count, cards.length)))

  const questions = picked.map((card, index): TestQuestion => {
    const kind = kinds[index % kinds.length]
    const prompt = promptOf(card, options.answerWith)
    const answer = answerOf(card, options.answerWith)
    if (kind === 'truefalse') {
      const others = cards.filter((other) => normalizeVocabAnswer(answerOf(other, options.answerWith)) !== normalizeVocabAnswer(answer))
      const isTrue = others.length === 0 || random() < 0.5
      const shown = isTrue ? answer : answerOf(others[Math.floor(random() * others.length)], options.answerWith)
      return { kind, cardId: card.id, prompt, shown, answer, isTrue }
    }
    if (kind === 'choice') {
      return { kind, cardId: card.id, prompt, choices: buildChoices(card, cards, options.answerWith, 4, random), answer }
    }
    return { kind, cardId: card.id, prompt, answer }
  })

  return kinds.flatMap((kind) => questions.filter((question) => question.kind === kind))
}

/** 시험 답 채점. 참/거짓은 'true'/'false', 객관식은 고른 보기 글자, 쓰기는 쓴 글자 */
export function gradeTestAnswer(question: TestQuestion, response: string | undefined): boolean {
  if (response === undefined || response === '') return false
  if (question.kind === 'truefalse') return (response === 'true') === question.isTrue
  if (question.kind === 'choice') return response === question.answer
  return isVocabAnswerCorrect(response, question.answer)
}
