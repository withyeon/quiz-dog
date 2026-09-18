import type { Database } from '@/types/database.types'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import { getGameModeConfig } from '@/lib/game/modes'
import { displayBlankText } from '@/lib/quiz/blankText'

export type Player = Database['public']['Tables']['players']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']

export type AnswerRecord = {
  questionIndex: number
  isCorrect: boolean
  selectedAnswer?: string | number | null
  responseTimeMs?: number
  response_time_ms?: number
}

export type PlayerAnalysis = {
  id: string
  nickname: string
  avatar: string | null
  score: number
  /** 맞힌 "시도" 수. 같은 문제를 두 번 맞히면 2 */
  correctCount: number
  /** 푼 "시도" 수. 정답률의 분모 */
  answeredCount: number
  /** 한 번이라도 받아본 고유 문항 수 */
  servedQuestionCount: number
  /** 이 학생에게 한 번도 나오지 않은 문항 수 */
  unservedQuestionCount: number
  accuracy: number
  avgResponseTimeMs: number | null
  rankByScore: number
  history: AnswerRecord[]
}

export type QuestionAnalysis = {
  index: number
  id: string
  type: string
  text: string
  imageUrl: string | null
  /** 해설(선택). 없으면 null */
  explanation: string | null
  answer: string
  options: string[]
  tag: string
  /** 이 문항이 풀린 총 횟수(모든 학생 × 모든 바퀴) */
  attemptCount: number
  correctCount: number
  /** 시간 초과·미제출도 여기 포함된다 */
  incorrectCount: number
  /** 이 문항을 한 번이라도 받은 학생 수 */
  servedPlayerCount: number
  /** 이 문항이 한 번도 나오지 않은 학생 수 */
  unservedPlayerCount: number
  /** null = 아무도 받지 못한 문항(미출제). 0%와 구분한다 */
  accuracy: number | null
  optionDistribution: Record<string, number>
  wrongStudentsByAnswer: Record<string, string[]>
  topWrongAnswer: [string, number] | null
}

/** 최소 한 명에게는 출제된 문항 — accuracy가 항상 숫자다 */
export type ServedQuestionAnalysis = QuestionAnalysis & { accuracy: number }

export type ResultAnalytics = {
  players: PlayerAnalysis[]
  playersByAccuracy: PlayerAnalysis[]
  questions: QuestionAnalysis[]
  hardestQuestions: ServedQuestionAnalysis[]
  averageAccuracy: number
  /** 전체 학생이 문제를 푼 총 횟수 */
  totalAttempts: number
  totalCorrectAttempts: number
  /** 한 명에게도 나오지 않은 문항 수 */
  unservedQuestionCount: number
  averageScore: number
  completionRate: number
  totalParticipants: number
  totalQuestions: number
  journalSummary: string
}

function toAnswerHistory(value: Player['answer_history']): AnswerRecord[] {
  const entries: unknown[] = Array.isArray(value) ? value : []
  return Array.isArray(value)
    ? entries
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({
        questionIndex: Number(item.questionIndex ?? 0),
        isCorrect: Boolean(item.isCorrect),
        selectedAnswer: item.selectedAnswer as string | number | null | undefined,
        responseTimeMs: typeof item.responseTimeMs === 'number' ? item.responseTimeMs : undefined,
        response_time_ms: typeof item.response_time_ms === 'number' ? item.response_time_ms : undefined,
      }))
    : []
}

function getDisplayScore(player: Player, room?: Room | null): number {
  const mode = getGameModeConfig(room?.game_mode)
  if (mode.leaderboardSort === 'gold') return player.gold ?? player.score ?? 0
  if (mode.leaderboardSort === 'health') return player.health ?? player.score ?? 0
  if (mode.leaderboardSort === 'factory_money') return player.factory_money ?? player.score ?? 0
  if (mode.leaderboardSort === 'claw_points') return player.claw_points ?? player.score ?? 0
  if (mode.leaderboardSort === 'zombie_survived') return player.score ?? 0
  if (mode.leaderboardSort === 'treat_rush_score') return player.score ?? 0
  return player.score ?? 0
}

function getAverageResponseTime(history: AnswerRecord[]): number | null {
  const values = history
    .map((item) => item.responseTimeMs ?? item.response_time_ms)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (values.length === 0) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function normalizeAnswer(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '미응답'
  return String(value)
}

/**
 * 정답률은 "푼 시도" 기준이다.
 *
 * 카페·낚시처럼 제한 시간 동안 문제가 계속 도는 게임에서는 한 학생이 같은 문제를 여러 번
 * 푼다. 분모는 그 시도 횟수 전부이고, 분자는 그중 맞힌 횟수다. Q1을 두 번 만나 한 번 틀리고
 * 한 번 맞혔으면 1/2 = 50%.
 *
 * 반대로 "그 학생에게 한 번도 나오지 않은 문항"은 분모에 넣지 않는다(미출제). 문제 순서가
 * 섞여서 못 만난 것을 이해하지 못한 것으로 읽으면, 셔플 운이 나쁜 학생이 이해도가 낮은 것처럼
 * 보이기 때문이다. 화면에서도 0%가 아니라 '미출제'로 따로 표시한다.
 */
export function buildResultAnalytics(
  players: Player[],
  questions: AnalyticsQuestion[],
  room?: Room | null,
): ResultAnalytics {
  const totalQuestions = questions.length
  const rankedPlayers = [...players]
    .sort((a, b) => getDisplayScore(b, room) - getDisplayScore(a, room))

  const playerRank = new Map(rankedPlayers.map((player, index) => [player.id, index + 1]))

  const playerAnalyses = rankedPlayers.map((player, index) => {
    const history = toAnswerHistory(player.answer_history)
    const correctCount = history.filter((answer) => answer.isCorrect).length
    const answeredCount = history.length
    const servedQuestions = new Set(
      history
        .map((answer) => answer.questionIndex)
        .filter((questionIndex) => Number.isInteger(questionIndex) && questionIndex >= 0 && questionIndex < totalQuestions),
    )

    return {
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      score: getDisplayScore(player, room),
      correctCount,
      answeredCount,
      servedQuestionCount: servedQuestions.size,
      unservedQuestionCount: Math.max(0, totalQuestions - servedQuestions.size),
      accuracy: answeredCount > 0 ? Math.min(100, Math.round((correctCount / answeredCount) * 100)) : 0,
      avgResponseTimeMs: getAverageResponseTime(history),
      rankByScore: playerRank.get(player.id) ?? index + 1,
      history,
    }
  })

  const questionAnalyses: QuestionAnalysis[] = questions.map((question, index) => {
    const optionDistribution: Record<string, number> = {}
    const wrongStudentsByAnswer: Record<string, Set<string>> = {}
    question.options.forEach((option, optionIndex) => {
      optionDistribution[String(optionIndex + 1)] = 0
      optionDistribution[option] = 0
    })

    let attemptCount = 0
    let correctCount = 0
    let incorrectCount = 0
    let servedPlayerCount = 0

    playerAnalyses.forEach((player) => {
      const attempts = player.history.filter((item) => item.questionIndex === index)
      // 한 번도 받지 못한 학생은 분모에서 빠진다.
      if (attempts.length === 0) return
      servedPlayerCount += 1

      attempts.forEach((attempt) => {
        attemptCount += 1
        if (attempt.isCorrect) {
          correctCount += 1
          return
        }

        // 시간 초과·미제출은 '미응답'으로 모이지만 오답으로 센다.
        incorrectCount += 1
        const selectedAnswer = normalizeAnswer(attempt.selectedAnswer)
        optionDistribution[selectedAnswer] = (optionDistribution[selectedAnswer] ?? 0) + 1
        const students = wrongStudentsByAnswer[selectedAnswer] ?? new Set<string>()
        students.add(player.nickname)
        wrongStudentsByAnswer[selectedAnswer] = students
      })
    })

    const wrongEntries = Object.entries(optionDistribution)
      .filter(([answer]) => answer !== question.answer)
      .sort((a, b) => b[1] - a[1])
    const topWrongAnswer = wrongEntries.find(([, count]) => count > 0) ?? null

    return {
      index,
      id: question.id,
      type: question.type,
      text: displayBlankText(question.question_text),
      imageUrl: question.image_url ?? null,
      explanation: question.explanation ?? null,
      answer: question.answer,
      options: question.options,
      tag: question.type === 'CHOICE' ? '선택지 이해' : question.type === 'OX' ? '개념 판단' : '서술 응답',
      attemptCount,
      correctCount,
      incorrectCount,
      servedPlayerCount,
      unservedPlayerCount: Math.max(0, playerAnalyses.length - servedPlayerCount),
      accuracy: attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : null,
      optionDistribution,
      wrongStudentsByAnswer: Object.fromEntries(
        Object.entries(wrongStudentsByAnswer).map(([answer, students]) => [answer, [...students]]),
      ),
      topWrongAnswer,
    }
  })

  const totalCorrectAttempts = playerAnalyses.reduce((sum, player) => sum + player.correctCount, 0)
  const totalAttempts = playerAnalyses.reduce((sum, player) => sum + player.answeredCount, 0)
  const averageAccuracy = totalAttempts > 0 ? Math.min(100, Math.round((totalCorrectAttempts / totalAttempts) * 100)) : 0
  const averageScore = playerAnalyses.length > 0
    ? Math.round(playerAnalyses.reduce((sum, player) => sum + player.score, 0) / playerAnalyses.length)
    : 0
  // 완주 = 모든 문항을 한 번 이상 받아서 풀었다. 반복 출제 게임에서는 푼 횟수로는 알 수 없다.
  const completionRate = playerAnalyses.length > 0 && totalQuestions > 0
    ? Math.round((playerAnalyses.filter((player) => player.servedQuestionCount >= totalQuestions).length / playerAnalyses.length) * 100)
    : 0

  const servedQuestions = questionAnalyses
    .filter((question): question is ServedQuestionAnalysis => question.accuracy !== null)
  const hardestQuestions = [...servedQuestions].sort((a, b) => a.accuracy - b.accuracy)
  const unservedQuestionCount = questionAnalyses.length - servedQuestions.length

  const unitName = room?.game_mode ? getGameModeConfig(room.game_mode).shortLabel : '이번 수업'
  // 학급 전체를 '우수/보충 필요'로 판정하지 않는다. 숫자와 '무엇을 다시 볼지'만 남긴다.
  const summaryParts = [
    `${unitName} 평균 정답률 ${averageAccuracy}% (${totalAttempts}번 풀어서 ${totalCorrectAttempts}번 정답).`,
  ]
  const weakQuestions = hardestQuestions
    .filter((question) => question.accuracy < 60)
    .slice(0, 2)
    .map((question) => `${question.index + 1}번 문항(${question.tag})`)
  if (weakQuestions.length > 0) {
    summaryParts.push(`${weakQuestions.join(', ')}은 함께 다시 짚어보면 좋겠음.`)
  }
  if (unservedQuestionCount > 0) {
    summaryParts.push(`${unservedQuestionCount}문항은 아직 아무에게도 나오지 않음.`)
  }

  return {
    players: playerAnalyses,
    playersByAccuracy: [...playerAnalyses].sort((a, b) => b.accuracy - a.accuracy || b.score - a.score),
    questions: questionAnalyses,
    hardestQuestions,
    averageAccuracy,
    totalAttempts,
    totalCorrectAttempts,
    unservedQuestionCount,
    averageScore,
    completionRate,
    totalParticipants: playerAnalyses.length,
    totalQuestions,
    journalSummary: summaryParts.join(' '),
  }
}

/** 미출제(아무도 받지 못한 문항)와 0%를 구분해서 보여준다. */
export function formatQuestionAccuracy(accuracy: number | null): string {
  return accuracy === null ? '미출제' : `${accuracy}%`
}

export function formatResponseTime(value: number | null): string {
  if (value === null) return '-'
  return `${(value / 1000).toFixed(1)}초`
}
