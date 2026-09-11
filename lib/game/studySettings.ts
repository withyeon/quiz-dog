import type { Json } from '@/types/database.types'

/**
 * 공부 모드(game_mode = 'study') 옵션과 시도 기록.
 *
 * 옵션은 rooms.settings.study 에, 시도 기록은 players.attempts 에 jsonb로 둔다.
 * 둘 다 sql/20260911_study_mode.sql 마이그레이션 뒤에 생기는 컬럼이다.
 */

export type StudyFeedbackMode = 'instant' | 'end'
export type StudyQuestionOrder = 'set' | 'shuffle'

export type StudySettings = {
  /** 피드백 시점: 문제마다 바로(instant) / 한 바퀴 끝나고 한 번에(end) */
  feedback: StudyFeedbackMode
  /** 한 바퀴 끝난 뒤 틀린 문제를 다 맞힐 때까지 다시 풀게 할지 */
  retryWrong: boolean
  /** 처음부터 다시 푸는 재도전 횟수. 0 = 무제한 (과제에서만 의미 있다) */
  maxAttempts: number
  /** 문제 순서: 문제집 순서 그대로 / 학생마다 섞기 */
  questionOrder: StudyQuestionOrder
}

export const DEFAULT_STUDY_SETTINGS: StudySettings = {
  feedback: 'instant',
  retryWrong: true,
  maxAttempts: 1,
  questionOrder: 'set',
}

export const STUDY_ATTEMPT_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '1회' },
  { value: 3, label: '3회' },
  { value: 0, label: '무제한' },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** rooms.settings 에서 공부 모드 옵션을 읽는다. 없거나 깨져 있으면 기본값. */
export function parseStudySettings(settings: Json | null | undefined): StudySettings {
  const study = isRecord(settings) && isRecord(settings.study) ? settings.study : null
  if (!study) return { ...DEFAULT_STUDY_SETTINGS }
  const maxAttempts = Number(study.maxAttempts)
  return {
    feedback: study.feedback === 'end' ? 'end' : 'instant',
    retryWrong: study.retryWrong !== false,
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts >= 0 ? maxAttempts : DEFAULT_STUDY_SETTINGS.maxAttempts,
    questionOrder: study.questionOrder === 'shuffle' ? 'shuffle' : 'set',
  }
}

/** rooms.settings 에 넣을 값 */
export function buildRoomSettings(study: StudySettings): Json {
  return {
    study: {
      feedback: study.feedback,
      retryWrong: study.retryWrong,
      maxAttempts: study.maxAttempts,
      questionOrder: study.questionOrder,
    },
  }
}

/** 교사 화면에 보여줄 한 줄 요약 */
export function describeStudySettings(settings: StudySettings): string {
  const attempts = settings.maxAttempts === 0 ? '재도전 무제한' : `재도전 ${settings.maxAttempts}회`
  return [
    settings.feedback === 'instant' ? '바로 정답 확인' : '끝나고 한 번에 채점',
    settings.retryWrong ? '틀린 문제 다시 풀기' : '한 바퀴만',
    attempts,
    settings.questionOrder === 'shuffle' ? '문제 섞기' : '문제집 순서',
  ].join(' · ')
}

// ─── 시도 기록 ───

export type StudyAnswerRecord = {
  /** 문제집 안에서의 문제 위치 (결과·리포트가 쓰는 questionIndex와 같은 기준) */
  questionIndex: number
  isCorrect: boolean
  selectedAnswer?: string
}

export type StudyRetryState = {
  /** 몇 번째 다시 풀기인지 (1부터) */
  round: number
  /** 이번 라운드에서 풀 문제 id 목록 */
  queue: string[]
  /** queue 안에서 다음에 풀 위치 */
  cursor: number
  /** 이번 라운드에서 또 틀린 문제 id */
  wrong: string[]
}

export type StudyAttempt = {
  id: string
  startedAt: string
  finishedAt: string | null
  /** 첫 바퀴 문제 id 순서 */
  order: string[]
  /** 첫 바퀴에서 다음에 풀 위치 */
  cursor: number
  /** 첫 바퀴 답 기록. players.answer_history 와 같은 모양 */
  history: StudyAnswerRecord[]
  /** 진행 중인 다시 풀기 라운드. 없으면 null */
  retry: StudyRetryState | null
  /** 다시 풀기에서 답한 횟수 */
  retryAnswered: number
  /** 다시 풀기까지 마쳐 전부 맞혔는지 */
  mastered: boolean
  /** 첫 바퀴 정답 수 (= 이 시도의 점수) */
  correct: number
  total: number
}

export function createStudyAttempt(order: string[]): StudyAttempt {
  const seed = Math.random().toString(36).slice(2, 10)
  return {
    id: `attempt-${Date.now()}-${seed}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    order,
    cursor: 0,
    history: [],
    retry: null,
    retryAnswered: 0,
    mastered: false,
    correct: 0,
    total: order.length,
  }
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toHistory(value: unknown): StudyAnswerRecord[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isRecord)
    .map((item) => ({
      questionIndex: Number(item.questionIndex ?? 0),
      isCorrect: Boolean(item.isCorrect),
      ...(typeof item.selectedAnswer === 'string' ? { selectedAnswer: item.selectedAnswer } : {}),
    }))
}

/** players.attempts 를 읽는다. 모양이 깨진 항목은 버린다. */
export function parseStudyAttempts(value: Json | null | undefined): StudyAttempt[] {
  if (!Array.isArray(value)) return []
  const attempts: StudyAttempt[] = []
  for (const raw of value) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.startedAt !== 'string') continue
    const order = toStringArray(raw.order)
    const retry = isRecord(raw.retry)
      ? {
          round: Math.max(1, Number(raw.retry.round) || 1),
          queue: toStringArray(raw.retry.queue),
          cursor: Math.max(0, Number(raw.retry.cursor) || 0),
          wrong: toStringArray(raw.retry.wrong),
        }
      : null
    attempts.push({
      id: raw.id,
      startedAt: raw.startedAt,
      finishedAt: typeof raw.finishedAt === 'string' ? raw.finishedAt : null,
      order,
      cursor: Math.min(order.length, Math.max(0, Number(raw.cursor) || 0)),
      history: toHistory(raw.history),
      retry,
      retryAnswered: Math.max(0, Number(raw.retryAnswered) || 0),
      mastered: Boolean(raw.mastered),
      correct: Math.max(0, Number(raw.correct) || 0),
      total: Math.max(0, Number(raw.total) || order.length),
    })
  }
  return attempts
}

export function countFinishedAttempts(attempts: StudyAttempt[]): number {
  return attempts.filter((attempt) => attempt.finishedAt !== null).length
}

/** 아직 다시 풀 수 있는지. maxAttempts 0 = 무제한 */
export function canStartNewAttempt(attempts: StudyAttempt[], settings: StudySettings): boolean {
  if (settings.maxAttempts === 0) return true
  return countFinishedAttempts(attempts) < settings.maxAttempts
}

/**
 * 대표 시도 = 첫 바퀴 정답 수가 가장 높은 시도 (동점이면 나중 것).
 * 진행 중인 시도도 지금까지의 정답 수로 후보에 들어간다 — 실시간 수업에서 순위표가 바로 움직이도록.
 */
export function getBestAttempt(attempts: StudyAttempt[]): StudyAttempt | null {
  let best: StudyAttempt | null = null
  for (const attempt of attempts) {
    if (!best || attempt.correct >= best.correct) best = attempt
  }
  return best
}

/** 한 바퀴 안에서의 정답률(%) */
export function attemptAccuracy(attempt: StudyAttempt): number {
  return attempt.total > 0 ? Math.round((attempt.correct / attempt.total) * 100) : 0
}

export function isStudyMode(mode: string | null | undefined): boolean {
  return mode === 'study'
}
