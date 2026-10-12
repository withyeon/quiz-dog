import type { GeneratedQuestion } from '@/lib/ai/questionGenerator'
import { normalizeQuizAnswer, splitAcceptableAnswers } from '@/lib/quiz/answerMatching'
import {
  MULTI_SELECT_MAX_OPTIONS,
  MULTI_SELECT_MIN_ANSWERS,
  MULTI_SELECT_MIN_OPTIONS,
  isMultiSelectQuestion,
  isGusungchigiSet,
  splitMultiSelectAnswer,
} from '@/lib/quiz/multiSelect'

/**
 * 문제 검수 규칙 — 저장을 막는 '오류'와, 저장은 되지만 한 번 더 보라는 '주의'를 나눈다.
 *
 * 오류는 게임이 깨지는 것(보기 수, 정답-보기 불일치 …)만 둔다.
 * 주의는 학생 화면(휴대폰·제한 시간)에서 풀기 어려운 문제를 미리 알려주는 용도라
 * 선생님이 무시하고 저장해도 된다.
 */

export type QuestionType = GeneratedQuestion['type']

/** 객관식 보기 수. 게임 화면이 2×2 격자라 4개로 고정한다. */
export const CHOICE_OPTION_COUNT = 4
/** 이보다 길면 휴대폰 화면에서 제한 시간 안에 읽기 버겁다 */
export const LONG_QUESTION_LENGTH = 120
/** 주관식 정답이 이보다 길면 오타로 틀리기 쉽다 */
export const LONG_SHORT_ANSWER_LENGTH = 12

export const BLANK_PLACEHOLDER_PATTERN = /\[\s*\]|\{\{blank\}\}/

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  CHOICE: '객관식',
  OX: 'OX',
  SHORT: '주관식',
  BLANK: '빈칸',
}

export const QUESTION_TYPE_HINT: Record<QuestionType, string> = {
  CHOICE: '보기 4개 중 정답 고르기',
  OX: '맞다 · 틀리다 판단하기',
  SHORT: '짧은 답을 직접 쓰기',
  BLANK: '문장 속 빈칸에 들어갈 말 쓰기',
}

function filledOptions(q: GeneratedQuestion): string[] {
  return (q.options || []).map((o) => String(o ?? '').trim()).filter(Boolean)
}

/**
 * 구성치기(다중 선택) 문제의 오류. "보기 4개 / 정답은 보기 중 하나" 대신
 * 보기 4~20개, 중복 없음, 정답의 모든 약재가 보기 안에 있음, 정답 2개 이상을 본다.
 * 채점이 항목마다 normalizeQuizAnswer 로 비교하므로 중복·빈 항목도 같은 기준으로 잡는다.
 */
function getMultiSelectErrors(q: GeneratedQuestion): string[] {
  const errors: string[] = []
  const options = filledOptions(q)
  const answers = splitMultiSelectAnswer(q.answer)

  if (options.length < MULTI_SELECT_MIN_OPTIONS || options.length > MULTI_SELECT_MAX_OPTIONS) {
    errors.push(`여러 개 고르기 보기는 ${MULTI_SELECT_MIN_OPTIONS}~${MULTI_SELECT_MAX_OPTIONS}개여야 해요 (지금 ${options.length}개)`)
  }
  if (options.some((o) => o.includes(','))) {
    errors.push('보기에 쉼표(,)를 넣을 수 없어요 · 쉼표는 정답을 나누는 데 써요')
  }
  // 한자만 있는 보기('麻黃')는 채점 정규화에서 빈 글자가 되어 고르든 안 고르든 똑같이 채점된다
  if (options.some((o) => normalizeQuizAnswer(o) === '')) {
    errors.push('보기마다 한글·영문·숫자가 한 글자 이상 있어야 채점돼요 (예: 마황(麻黃))')
  }
  const normalizedOptions = options.map(normalizeQuizAnswer).filter(Boolean)
  if (new Set(normalizedOptions).size !== normalizedOptions.length) errors.push('같은 보기가 두 번 들어 있어요')

  if (/[\n|]/.test(q.answer)) {
    errors.push('여러 개 고르기 정답은 쉼표(,)로만 나눠요 · | 나 줄바꿈은 쓰지 않아요')
  }
  if (answers.length < MULTI_SELECT_MIN_ANSWERS) {
    errors.push(`정답을 ${MULTI_SELECT_MIN_ANSWERS}개 이상 골라 주세요`)
  }
  if (new Set(answers.map(normalizeQuizAnswer)).size !== answers.length) errors.push('같은 정답이 두 번 들어 있어요')
  const missing = answers.filter((a) => !options.includes(a))
  if (missing.length > 0) errors.push(`정답 ${missing.join(', ')}이(가) 보기 중에 없어요`)

  return errors
}

/**
 * 저장을 막는 오류.
 * setTitle 은 문제집 이름이다. 구성치기 문제집의 다중 선택 문제(lib/quiz/multiSelect.ts)만 다른 규칙으로 본다.
 */
export function getQuestionErrors(q: GeneratedQuestion, setTitle?: string | null): string[] {
  const errors: string[] = []
  const text = q.question_text.trim()
  const answer = q.answer.trim()

  if (!text) errors.push('문제 내용이 비어 있어요')
  if (!answer) errors.push('정답이 비어 있어요')

  if (isMultiSelectQuestion(q, setTitle)) {
    errors.push(...getMultiSelectErrors(q))
  } else if (q.type === 'CHOICE') {
    const options = filledOptions(q)
    if (options.length !== CHOICE_OPTION_COUNT) {
      // 구성치기 문제집에서는 보기를 늘려 놓고 정답을 하나만 고른 경우가 많아, 여러 개 고르기로 바꾸는 법을 함께 알려 준다
      const multiSelectHint = isGusungchigiSet(setTitle) ? ' · 정답을 2개 이상 고르면 여러 개 고르기 문제가 돼요' : ''
      errors.push(`객관식 보기는 ${CHOICE_OPTION_COUNT}개여야 해요 (지금 ${options.length}개)${multiSelectHint}`)
    }
    const unique = new Set(options.map((o) => o.replace(/\s+/g, '')))
    if (unique.size !== options.length) errors.push('같은 보기가 두 번 들어 있어요')
    if (answer && !options.includes(answer)) errors.push('정답이 보기 중에 없어요 · 번호를 눌러 정답을 골라 주세요')
  }

  if (q.type === 'OX' && answer && answer !== 'O' && answer !== 'X') {
    errors.push('OX 문제의 정답은 O 또는 X여야 해요')
  }

  if (q.type === 'BLANK' && text && !BLANK_PLACEHOLDER_PATTERN.test(text)) {
    errors.push('빈칸 문제에는 빈칸 표시 [            ]가 하나 필요해요')
  }

  return errors
}

/** 저장은 되지만 한 번 더 볼 만한 점. setTitle 은 getQuestionErrors 와 같다. */
export function getQuestionWarnings(q: GeneratedQuestion, setTitle?: string | null): string[] {
  const warnings: string[] = []
  const text = q.question_text.trim()
  const answer = q.answer.trim()
  if (!text || !answer) return warnings

  if (text.length > LONG_QUESTION_LENGTH) {
    warnings.push(`문제가 길어요 (${text.length}자) · 게임에서는 80자 안팎이 읽기 좋아요`)
  }

  if (isMultiSelectQuestion(q, setTitle)) {
    // 일반 객관식 주의(정답 길이·문제 글에 정답)는 약재 목록에는 맞지 않아 보지 않는다
    const options = filledOptions(q)
    const answers = splitMultiSelectAnswer(answer)
    if (options.length > 0 && answers.length >= options.length) {
      warnings.push('보기가 모두 정답이에요 · 헷갈리는 오답 약재를 섞어 주세요')
    }
  } else if (q.type === 'CHOICE') {
    const options = filledOptions(q)
    if (answer.length >= 2 && text.includes(answer)) {
      warnings.push('정답이 문제 글에 그대로 들어 있어요')
    }
    const others = options.filter((o) => o !== answer)
    if (others.length >= 2 && answer.length > 12) {
      const avg = others.reduce((sum, o) => sum + o.length, 0) / others.length
      if (answer.length >= avg * 1.8) warnings.push('정답 보기가 다른 보기보다 눈에 띄게 길어요 · 길이로 찍을 수 있어요')
    }
  }

  if (q.type === 'SHORT' || q.type === 'BLANK') {
    const candidates = splitAcceptableAnswers(answer)
    if (candidates.some((c) => c.length > LONG_SHORT_ANSWER_LENGTH)) {
      warnings.push('정답이 길어요 · 짧은 낱말이나 숫자가 채점에 유리해요')
    }
    if (q.type === 'SHORT' && candidates.some((c) => c.length >= 2 && text.includes(c))) {
      warnings.push('정답이 문제 글에 그대로 들어 있어요')
    }
  }

  if (q.type === 'OX' && /지\s*않|아니다|아닌\s/.test(text)) {
    warnings.push('부정문은 학생이 헷갈리기 쉬워요 · 긍정문으로 바꿔 보세요')
  }

  return warnings
}

export function countQuestionIssues(questions: GeneratedQuestion[], setTitle?: string | null): { errors: number; warnings: number } {
  return questions.reduce(
    (acc, q) => ({
      errors: acc.errors + getQuestionErrors(q, setTitle).length,
      warnings: acc.warnings + getQuestionWarnings(q, setTitle).length,
    }),
    { errors: 0, warnings: 0 },
  )
}

/** 유형을 바꿀 때 보기·정답을 새 유형에 맞게 정리한다 */
export function convertQuestionType(q: GeneratedQuestion, nextType: QuestionType): GeneratedQuestion {
  if (nextType === q.type) return q
  if (nextType === 'OX') {
    return { ...q, type: 'OX', options: ['O', 'X'], answer: q.answer === 'O' || q.answer === 'X' ? q.answer : '' }
  }
  if (nextType === 'CHOICE') {
    const kept = (q.options || []).filter((o) => o !== 'O' && o !== 'X')
    const options = [...kept]
    while (options.length < CHOICE_OPTION_COUNT) options.push('')
    const answer = options.includes(q.answer) ? q.answer : ''
    return { ...q, type: 'CHOICE', options: options.slice(0, Math.max(CHOICE_OPTION_COUNT, kept.length)), answer }
  }
  // SHORT · BLANK: 보기 없이 정답만. OX에서 넘어오면 O/X 정답은 의미가 없어 비운다.
  const answer = q.type === 'OX' ? '' : q.answer
  return { ...q, type: nextType, options: [], answer }
}

export function createBlankQuestion(type: QuestionType): GeneratedQuestion {
  return {
    type,
    question_text: '',
    options: type === 'OX' ? ['O', 'X'] : type === 'CHOICE' ? ['', '', '', ''] : [],
    answer: '',
    explanation: '',
  }
}
