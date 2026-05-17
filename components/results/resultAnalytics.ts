import type { Database } from '@/types/database.types'
import type { AnalyticsQuestion } from '@/lib/services/questions'
import { getGameModeConfig } from '@/lib/game/modes'

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
  attendanceNo: number
  nickname: string
  avatar: string | null
  score: number
  correctCount: number
  answeredCount: number
  totalCount: number
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
  answer: string
  options: string[]
  tag: string
  correctCount: number
  incorrectCount: number
  unansweredCount: number
  totalCount: number
  accuracy: number
  optionDistribution: Record<string, number>
  wrongStudentsByAnswer: Record<string, string[]>
  topWrongAnswer: [string, number] | null
}

export type ResultAnalytics = {
  players: PlayerAnalysis[]
  playersByAccuracy: PlayerAnalysis[]
  questions: QuestionAnalysis[]
  hardestQuestions: QuestionAnalysis[]
  averageAccuracy: number
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
    const denominator = totalQuestions > 0 ? totalQuestions : answeredCount

    return {
      id: player.id,
      attendanceNo: index + 1,
      nickname: player.nickname,
      avatar: player.avatar,
      score: getDisplayScore(player, room),
      correctCount,
      answeredCount,
      totalCount: denominator,
      accuracy: denominator > 0 ? Math.round((correctCount / denominator) * 100) : 0,
      avgResponseTimeMs: getAverageResponseTime(history),
      rankByScore: playerRank.get(player.id) ?? index + 1,
      history,
    }
  })

  const questionAnalyses = questions.map((question, index) => {
    const optionDistribution: Record<string, number> = {}
    const wrongStudentsByAnswer: Record<string, string[]> = {}
    question.options.forEach((option, optionIndex) => {
      optionDistribution[String(optionIndex + 1)] = 0
      optionDistribution[option] = 0
    })

    let correctCount = 0
    let incorrectCount = 0
    let unansweredCount = 0

    playerAnalyses.forEach((player) => {
      const answer = player.history.find((item) => item.questionIndex === index)
      if (!answer) {
        unansweredCount += 1
        optionDistribution['미응답'] = (optionDistribution['미응답'] ?? 0) + 1
        return
      }

      if (answer.isCorrect) {
        correctCount += 1
        return
      }

      const selectedAnswer = normalizeAnswer(answer.selectedAnswer)
      if (selectedAnswer === '미응답') unansweredCount += 1
      else incorrectCount += 1

      optionDistribution[selectedAnswer] = (optionDistribution[selectedAnswer] ?? 0) + 1
      wrongStudentsByAnswer[selectedAnswer] = [
        ...(wrongStudentsByAnswer[selectedAnswer] ?? []),
        player.nickname,
      ]
    })

    const totalCount = players.length
    const wrongEntries = Object.entries(optionDistribution)
      .filter(([answer]) => answer !== question.answer)
      .sort((a, b) => b[1] - a[1])
    const topWrongAnswer = wrongEntries.find(([, count]) => count > 0) ?? null

    return {
      index,
      id: question.id,
      type: question.type,
      text: question.question_text,
      answer: question.answer,
      options: question.options,
      tag: question.type === 'CHOICE' ? '선택지 이해' : question.type === 'OX' ? '개념 판단' : '서술 응답',
      correctCount,
      incorrectCount,
      unansweredCount,
      totalCount,
      accuracy: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      optionDistribution,
      wrongStudentsByAnswer,
      topWrongAnswer,
    }
  })

  const totalCorrect = playerAnalyses.reduce((sum, player) => sum + player.correctCount, 0)
  const totalPossible = playerAnalyses.reduce((sum, player) => sum + player.totalCount, 0)
  const averageAccuracy = totalPossible > 0 ? Math.round((totalCorrect / totalPossible) * 100) : 0
  const averageScore = playerAnalyses.length > 0
    ? Math.round(playerAnalyses.reduce((sum, player) => sum + player.score, 0) / playerAnalyses.length)
    : 0
  const completionRate = playerAnalyses.length > 0
    ? Math.round((playerAnalyses.filter((player) => player.answeredCount >= totalQuestions && totalQuestions > 0).length / playerAnalyses.length) * 100)
    : 0
  const hardestQuestions = [...questionAnalyses].sort((a, b) => a.accuracy - b.accuracy)
  const evaluation = averageAccuracy >= 80 ? '우수' : averageAccuracy >= 60 ? '양호' : '보충 필요'
  const weakQuestions = hardestQuestions.slice(0, 2).map((question) => `${question.index + 1}번 문항(${question.tag})`)
  const unitName = room?.game_mode ? getGameModeConfig(room.game_mode).shortLabel : '이번 수업'
  const journalSummary = weakQuestions.length > 0
    ? `${unitName} 평균 ${averageAccuracy}%로 ${evaluation}. ${weakQuestions.join(', ')}에서 다수 학생이 어려움을 보임.`
    : `${unitName} 평균 ${averageAccuracy}%로 ${evaluation}.`

  return {
    players: playerAnalyses,
    playersByAccuracy: [...playerAnalyses].sort((a, b) => b.accuracy - a.accuracy || b.score - a.score),
    questions: questionAnalyses,
    hardestQuestions,
    averageAccuracy,
    averageScore,
    completionRate,
    totalParticipants: playerAnalyses.length,
    totalQuestions,
    journalSummary,
  }
}

export function formatResponseTime(value: number | null): string {
  if (value === null) return '-'
  return `${(value / 1000).toFixed(1)}초`
}
