'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, CheckCircle2, ChevronRight, Loader2, RotateCcw, Sparkles, XCircle } from 'lucide-react'
import QuizView from '@/components/QuizView'
import Countdown from '@/components/Countdown'
import Leaderboard from '@/components/Leaderboard'
import GameTimeBadge from '@/components/GameTimeBadge'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { toast } from '@/components/ui/Toaster'
import { useGameBase } from '@/hooks/useGameBase'
import {
  checkQuestionAnswer,
  listQuestionsForAnalytics,
  type AnalyticsQuestion,
  type GameQuestion,
} from '@/lib/services/questions'
import { updatePlayer } from '@/lib/services/players'
import { formatServiceError } from '@/lib/services/errors'
import { isHomeworkPastDue } from '@/lib/game/roomStatus'
import { displayBlankText } from '@/lib/quiz/blankText'
import { splitAcceptableAnswers } from '@/lib/quiz/answerMatching'
import {
  attemptAccuracy,
  canStartNewAttempt,
  countFinishedAttempts,
  createStudyAttempt,
  getBestAttempt,
  parseStudyAttempts,
  parseStudySettings,
  type StudyAttempt,
  type StudySettings,
} from '@/lib/game/studySettings'
import type { Json } from '@/types/database.types'

/**
 * 공부 모드 학생 화면.
 *
 * 게임 없이 문제만 차근차근 푼다. 흐름은
 *   (실시간 수업: 로비 → 카운트다운) → 첫 바퀴 → 한 바퀴 요약 → [틀린 문제 다시 풀기]* → 끝
 * 이고, 과제 방은 카운트다운 없이 바로 시작한다.
 *
 * 진행 상황은 players.attempts 에 시도 단위로 저장한다(답할 때마다). 새로고침하거나 다른 기기에서
 * 같은 닉네임으로 들어와도 이어서 푼다. 대표(최고 점수) 시도는 players.score / answer_history 에
 * 복사해서 순위표·결과·리포트가 다른 게임과 같은 방식으로 읽게 한다.
 * 옵션(피드백 시점·다시 풀기·재도전 횟수·문제 순서)은 rooms.settings.study 에서 온다.
 */

type Phase = 'loading' | 'question' | 'feedback' | 'summary' | 'finished' | 'exhausted'

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const seconds = Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`
}

export default function StudyPage() {
  const {
    roomCode,
    playerId,
    currentView,
    room,
    roomLoading,
    players,
    currentPlayer,
    questions,
    questionsLoading,
    questionsError,
    showCountdown,
    handleCountdownComplete,
    isHomework,
    sessionStartedAt,
    playSFX,
  } = useGameBase({ expectedGameMode: 'study', preStartQuizTotal: 0, manageAnswerHistory: false })

  const settings = useMemo<StudySettings>(() => {
    const parsed = parseStudySettings(room?.settings)
    // 실시간 수업은 한 번 도는 세션이라 재도전은 과제에서만
    return isHomework ? parsed : { ...parsed, maxAttempts: 1 }
  }, [isHomework, room?.settings])

  const [attempts, setAttempts] = useState<StudyAttempt[]>([])
  const [current, setCurrent] = useState<StudyAttempt | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [lastResult, setLastResult] = useState<{ correct: boolean; answer: string } | null>(null)
  const [answerKey, setAnswerKey] = useState<Map<string, AnalyticsQuestion> | null>(null)
  const [quizNonce, setQuizNonce] = useState(0)
  const attemptsRef = useRef<StudyAttempt[]>([])
  const initializedRef = useRef(false)
  const pendingPatchRef = useRef<Record<string, unknown> | null>(null)
  const persistTimerRef = useRef<number | null>(null)

  // 과제 방은 카운트다운 없이 바로 시작한다. 훅에는 완료를 알려야 'quiz'로 넘어온다.
  useEffect(() => {
    if (isHomework && showCountdown) handleCountdownComplete()
  }, [handleCountdownComplete, isHomework, showCountdown])

  const questionById = useMemo(() => new Map<string, GameQuestion>(questions.map((q) => [q.id, q])), [questions])
  const questionIndexById = useMemo(() => new Map<string, number>(questions.map((q, index) => [q.id, index])), [questions])

  // ── 저장: 시도 기록 전체 + 대표(최고) 시도의 점수·정답 기록 ──
  const flushPersist = useCallback(() => {
    const patch = pendingPatchRef.current
    if (!patch || !playerId) return
    pendingPatchRef.current = null
    updatePlayer(playerId, patch).catch((error) => {
      console.error('공부 기록 저장 실패:', formatServiceError(error))
    })
  }, [playerId])

  const persist = useCallback((nextAttempts: StudyAttempt[], immediate = false) => {
    const best = getBestAttempt(nextAttempts)
    pendingPatchRef.current = {
      attempts: nextAttempts as unknown as Json,
      score: best?.correct ?? 0,
      answer_history: (best?.history ?? []) as unknown as Json[],
    }
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    if (immediate) {
      flushPersist()
      return
    }
    persistTimerRef.current = window.setTimeout(flushPersist, 800)
  }, [flushPersist])

  // 화면을 떠날 때 아직 안 보낸 기록을 보낸다
  useEffect(() => () => {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current)
    flushPersist()
  }, [flushPersist])

  const updateAttempt = useCallback((next: StudyAttempt, immediate = false) => {
    const previous = attemptsRef.current
    const list = previous.some((attempt) => attempt.id === next.id)
      ? previous.map((attempt) => (attempt.id === next.id ? next : attempt))
      : [...previous, next]
    attemptsRef.current = list
    setAttempts(list)
    setCurrent(next)
    persist(list, immediate)
  }, [persist])

  const startNewAttempt = useCallback(() => {
    const ids = questions.map((question) => question.id)
    const order = settings.questionOrder === 'shuffle' ? shuffle(ids) : ids
    setLastResult(null)
    updateAttempt(createStudyAttempt(order), true)
    setPhase('question')
  }, [questions, settings.questionOrder, updateAttempt])

  // ── 세션 시작: 저장된 시도가 있으면 이어서, 없으면 새로 ──
  useEffect(() => {
    if (initializedRef.current) return
    if (currentView !== 'quiz' || !currentPlayer || questions.length === 0) return
    initializedRef.current = true

    const ids = new Set(questions.map((question) => question.id))
    // 문제집이 바뀌어 문제 id가 맞지 않는 미완료 시도는 버린다
    const saved = parseStudyAttempts(currentPlayer.attempts)
      .filter((attempt) => attempt.finishedAt !== null || attempt.order.every((id) => ids.has(id)))
    attemptsRef.current = saved
    setAttempts(saved)

    const unfinished = saved.find((attempt) => attempt.finishedAt === null)
    if (unfinished) {
      setCurrent(unfinished)
      const inProgress = unfinished.retry
        ? unfinished.retry.cursor < unfinished.retry.queue.length
        : unfinished.cursor < unfinished.order.length
      setPhase(inProgress ? 'question' : 'summary')
      return
    }
    // 이미 끝까지 푼 기록이 있으면 그 결과를 보여주고, 새 시도는 학생이 버튼을 눌러야 시작한다
    // (다시 들어왔다고 재도전 횟수를 써 버리지 않게).
    if (saved.length > 0) {
      setCurrent(saved[saved.length - 1])
      setPhase(canStartNewAttempt(saved, settings) ? 'finished' : 'exhausted')
      return
    }
    startNewAttempt()
  }, [currentPlayer, currentView, questions, settings, startNewAttempt])

  // ── 지금 보여줄 문제 (피드백 중에는 방금 답한 문제를 그대로 둔다) ──
  const displayedQuestionId = useMemo(() => {
    if (!current) return null
    const slot = current.retry ? current.retry.queue : current.order
    const cursor = current.retry ? current.retry.cursor : current.cursor
    return slot[phase === 'feedback' ? cursor - 1 : cursor] ?? null
  }, [current, phase])
  const displayedQuestion = displayedQuestionId ? questionById.get(displayedQuestionId) ?? null : null
  const inRetry = Boolean(current?.retry)

  const advance = useCallback((attempt: StudyAttempt) => {
    setLastResult(null)
    const remaining = attempt.retry
      ? attempt.retry.cursor < attempt.retry.queue.length
      : attempt.cursor < attempt.order.length
    setPhase(remaining ? 'question' : 'summary')
  }, [])

  const handleAnswer = useCallback(async (answer: string): Promise<boolean | undefined> => {
    if (!current || !displayedQuestion || phase !== 'question') return undefined

    let correct = false
    try {
      correct = await checkQuestionAnswer(displayedQuestion.id, answer)
    } catch (error) {
      toast.error('채점에 실패했어요. 다시 답해 주세요: ' + formatServiceError(error))
      setQuizNonce((value) => value + 1)
      return undefined
    }
    playSFX(correct ? 'correct' : 'incorrect')

    const next: StudyAttempt = current.retry
      ? {
          ...current,
          retryAnswered: current.retryAnswered + 1,
          retry: {
            ...current.retry,
            cursor: current.retry.cursor + 1,
            wrong: correct ? current.retry.wrong : [...current.retry.wrong, displayedQuestion.id],
          },
        }
      : {
          ...current,
          cursor: current.cursor + 1,
          correct: current.correct + (correct ? 1 : 0),
          history: [
            ...current.history,
            {
              questionIndex: questionIndexById.get(displayedQuestion.id) ?? 0,
              isCorrect: correct,
              selectedAnswer: answer,
            },
          ],
        }
    // 한 바퀴(또는 다시 풀기 라운드)가 끝나는 답은 바로 저장한다. 빠르게 연달아 답하면
    // 디바운스가 계속 미뤄져서, 요약 화면이 떠 있는데 DB(순위표·리포트)는 몇 문제 뒤처질 수 있다.
    const roundDone = next.retry
      ? next.retry.cursor >= next.retry.queue.length
      : next.cursor >= next.order.length
    updateAttempt(next, roundDone)

    // 다시 풀기 라운드는 언제나 바로 확인한다 — 공부하는 중이니까
    if (settings.feedback === 'instant' || current.retry) {
      setLastResult({ correct, answer })
      setPhase('feedback')
      return correct
    }
    // 끝나고 채점: 결과를 보여주지 않고 잠깐 뒤 다음 문제로
    window.setTimeout(() => advance(next), 350)
    return undefined
  }, [advance, current, displayedQuestion, phase, playSFX, questionIndexById, settings.feedback, updateAttempt])

  // ── 한 바퀴(또는 다시 풀기 라운드) 결과 ──
  const wrongIds = useMemo(() => {
    if (!current) return []
    if (current.retry) return current.retry.wrong
    return current.history
      .filter((record) => !record.isCorrect)
      .map((record) => questions[record.questionIndex]?.id)
      .filter((id): id is string => Boolean(id))
  }, [current, questions])

  // 요약·마무리 화면의 정답 표시에만 정답 목록을 읽는다 (결과 화면과 같은 조회)
  useEffect(() => {
    if ((phase !== 'summary' && phase !== 'finished' && phase !== 'exhausted') || answerKey || !room?.set_id) return
    let cancelled = false
    void listQuestionsForAnalytics(room.set_id).then((rows) => {
      if (!cancelled) setAnswerKey(new Map(rows.map((row) => [row.id, row])))
    }).catch((error) => console.error('정답 목록 조회 실패:', formatServiceError(error)))
    return () => { cancelled = true }
  }, [answerKey, phase, room?.set_id])

  const startRetry = useCallback(() => {
    if (!current || wrongIds.length === 0) return
    setLastResult(null)
    updateAttempt({
      ...current,
      retry: { round: (current.retry?.round ?? 0) + 1, queue: wrongIds, cursor: 0, wrong: [] },
    }, true)
    setPhase('question')
  }, [current, updateAttempt, wrongIds])

  const finishAttempt = useCallback((mastered: boolean) => {
    if (!current) return
    updateAttempt({ ...current, finishedAt: new Date().toISOString(), mastered, retry: null }, true)
    setPhase('finished')
  }, [current, updateAttempt])

  // ─────────────── 화면 ───────────────

  if (!roomCode || !playerId) {
    return (
      <StudyShell>
        <Notice title="잘못된 접근이에요" body="방 코드와 참가자 정보가 필요해요. 로비에서 다시 들어와 주세요." />
      </StudyShell>
    )
  }

  if (roomLoading || !room) {
    return (
      <StudyShell>
        <Notice title="방 정보를 불러오는 중..." spinner />
      </StudyShell>
    )
  }

  const resultHref = `/student/game/${roomCode}/result?playerId=${playerId}`
  const pastDue = isHomeworkPastDue(room)
  const canRetryFromStart = isHomework && !pastDue && canStartNewAttempt(attempts, settings)
  const bestAttempt = getBestAttempt(attempts)
  const totalInRound = current ? (current.retry ? current.retry.queue.length : current.order.length) : 0
  const cursorInRound = current ? (current.retry ? current.retry.cursor : current.cursor) : 0
  const shownNumber = Math.min(phase === 'feedback' ? cursorInRound : cursorInRound + 1, Math.max(1, totalInRound))
  const isLastInRound = current ? cursorInRound >= totalInRound : false
  const nickname = currentPlayer?.nickname ?? ''

  return (
    <StudyShell>
      {!isHomework && showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      {room.status === 'paused' && currentView !== 'lobby' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-6">
          <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-xl">
            <p className="text-2xl font-black text-slate-900">잠시 멈췄어요</p>
            <p className="mt-2 font-bold text-slate-500">선생님이 다시 시작하면 이어서 풀 수 있어요</p>
          </div>
        </div>
      )}

      {/* 머리말 */}
      <header className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-100 bg-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-xl">📖</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black text-sky-600">공부 모드</div>
          <div className="truncate text-sm font-bold text-slate-700">
            {currentView === 'lobby'
              ? '선생님이 시작하면 문제가 나와요'
              : current
                ? (inRetry ? `틀린 문제 다시 풀기 ${current.retry?.round}회차` : '한 문제씩 차근차근')
                : '준비 중'}
          </div>
        </div>
        {currentPlayer && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5">
            <PlayerAvatarDisplay
              avatar={currentPlayer.avatar}
              nickname={nickname}
              fallback="🐶"
              className="relative h-8 w-8 overflow-hidden rounded-full bg-white text-lg"
              sizes="32px"
            />
            <span className="text-sm font-black text-slate-700">{nickname}</span>
          </div>
        )}
        {!isHomework && room.duration_seconds ? (
          <GameTimeBadge startedAt={sessionStartedAt} durationSeconds={room.duration_seconds} status={room.status} />
        ) : null}
      </header>

      <AnimatePresence mode="wait">
        {currentView === 'lobby' && (
          <motion.section key="lobby" {...fade} className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-sky-500" />
              <h1 className="text-2xl font-black text-slate-900">함께 공부할 준비 완료!</h1>
              <p className="mt-2 font-bold text-slate-500">문제가 하나씩 나오고, 답하면 바로 정답을 확인할 수 있어요.</p>
            </div>
            <Leaderboard players={players} currentPlayerId={playerId} gameMode="study" title="참가자" />
          </motion.section>
        )}

        {currentView !== 'lobby' && (questionsLoading || (phase === 'loading' && !questionsError && questions.length > 0)) && (
          <motion.div key="loading" {...fade}>
            <Notice title="문제를 불러오는 중..." spinner />
          </motion.div>
        )}

        {currentView !== 'lobby' && (questionsError || (!questionsLoading && questions.length === 0)) && (
          <motion.div key="error" {...fade}>
            <Notice
              title="문제를 열 수 없어요"
              body={questionsError ?? '이 문제집에 풀 문제가 없어요. 선생님께 알려 주세요.'}
            />
          </motion.div>
        )}

        {current && displayedQuestion && (phase === 'question' || phase === 'feedback') && (
          <motion.section key={`q-${current.id}-${current.retry?.round ?? 0}-${displayedQuestion.id}`} {...fade} className="space-y-4">
            {/* 진행 */}
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between text-sm font-black">
                <span className="text-slate-600">
                  {inRetry ? '다시 풀기' : '문제'} {shownNumber} / {totalInRound}
                </span>
                <span className="text-emerald-600">
                  {inRetry
                    ? `아직 틀린 문제 ${current.retry?.wrong.length ?? 0}개`
                    : `맞힌 문제 ${current.correct}개`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-400 transition-all"
                  style={{ width: `${Math.round((cursorInRound / Math.max(1, totalInRound)) * 100)}%` }}
                />
              </div>
            </div>

            <QuizView
              key={`${current.id}-${current.retry?.round ?? 0}-${displayedQuestion.id}-${quizNonce}`}
              question={{
                id: displayedQuestion.id,
                type: displayedQuestion.type,
                question_text: displayedQuestion.question_text,
                options: displayedQuestion.options,
                image_url: displayedQuestion.image_url,
              }}
              onAnswer={handleAnswer}
              onCorrectClick={phase === 'feedback' ? () => advance(current) : undefined}
              className="font-bitbit mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            />

            {phase === 'feedback' && lastResult && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl space-y-3">
                {displayedQuestion.explanation && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                    <div className="mb-1 flex items-center gap-2 text-sm font-black text-sky-700">
                      <Sparkles className="h-4 w-4" />
                      해설
                    </div>
                    <p className="whitespace-pre-wrap text-base font-bold leading-relaxed text-slate-700">
                      {displayedQuestion.explanation}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => advance(current)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-600"
                >
                  {isLastInRound ? '결과 보기' : '다음 문제'}
                  <ChevronRight className="h-5 w-5" />
                </button>
              </motion.div>
            )}
          </motion.section>
        )}

        {current && phase === 'summary' && (
          <motion.section key={`summary-${current.id}-${current.retry?.round ?? 0}`} {...fade} className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              {inRetry ? (
                <>
                  <h2 className="text-2xl font-black text-slate-900">다시 풀기 {current.retry?.round}회차 끝!</h2>
                  <p className="mt-2 text-lg font-bold text-slate-600">
                    {wrongIds.length === 0
                      ? '이제 전부 맞혔어요. 대단해요!'
                      : `${(current.retry?.queue.length ?? 0) - wrongIds.length}개를 맞혔고, ${wrongIds.length}개가 남았어요.`}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-slate-900">한 바퀴 다 풀었어요!</h2>
                  <p className="mt-2 text-lg font-bold text-slate-600">
                    {current.total}문제 중 {current.correct}개 정답 · {attemptAccuracy(current)}% · {formatDuration(current.startedAt, null)}
                  </p>
                </>
              )}
            </div>

            {wrongIds.length > 0 && (
              <WrongList ids={wrongIds} questions={questions} answerKey={answerKey} attempt={current} />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {settings.retryWrong && wrongIds.length > 0 ? (
                <>
                  <button
                    type="button"
                    onClick={startRetry}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-600"
                  >
                    <RotateCcw className="h-5 w-5" />
                    틀린 문제 {wrongIds.length}개 다시 풀기
                  </button>
                  <button
                    type="button"
                    onClick={() => finishAttempt(false)}
                    className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-lg font-black text-slate-600 transition hover:bg-slate-50"
                  >
                    여기서 끝내기
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => finishAttempt(wrongIds.length === 0)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-600 sm:col-span-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {wrongIds.length === 0 ? '모두 맞혔어요! 결과 보기' : '결과 보기'}
                </button>
              )}
            </div>
          </motion.section>
        )}

        {(phase === 'finished' || phase === 'exhausted') && (
          <motion.section key={`finished-${phase}`} {...fade} className="mx-auto max-w-2xl space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
              <div className="text-5xl">{(phase === 'finished' ? current : bestAttempt)?.mastered ? '🏆' : '📖'}</div>
              <h2 className="mt-3 text-2xl font-black text-slate-900">
                {phase === 'exhausted' ? '이 과제는 다 풀었어요' : '공부 끝!'}
              </h2>
              {(() => {
                const shown = phase === 'finished' ? current : bestAttempt
                if (!shown) return null
                return (
                  <p className="mt-2 text-lg font-bold text-slate-700">
                    {shown.total}문제 중 {shown.correct}개 정답 · {attemptAccuracy(shown)}%
                    {shown.mastered && ' · 틀린 문제까지 모두 맞혔어요'}
                  </p>
                )
              })()}
              {countFinishedAttempts(attempts) > 1 && (
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {countFinishedAttempts(attempts)}번 풀었어요 · 가장 잘 푼 기록이 남아요
                </p>
              )}
            </div>

            {phase === 'finished' && current && wrongIds.length > 0 && !current.mastered && (
              <WrongList ids={wrongIds} questions={questions} answerKey={answerKey} attempt={current} />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={resultHref}
                className="flex items-center justify-center gap-2 rounded-2xl bg-slate-800 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-slate-900"
              >
                자세한 결과 보기
              </Link>
              {canRetryFromStart ? (
                <button
                  type="button"
                  onClick={startNewAttempt}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-4 text-lg font-black text-white shadow-sm transition hover:bg-sky-600"
                >
                  <RotateCcw className="h-5 w-5" />
                  처음부터 다시 풀기
                </button>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-sm font-bold text-slate-500">
                  {isHomework
                    ? (pastDue ? '제출 기간이 끝났어요' : '다시 풀기 횟수를 다 썼어요')
                    : '선생님이 끝내면 결과 화면으로 넘어가요'}
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </StudyShell>
  )
}

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
}

function StudyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#f7fbff] px-4 py-5 font-bitbit text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  )
}

function Notice({ title, body, spinner }: { title: string; body?: string; spinner?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      {spinner && <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-slate-400" />}
      <p className="text-xl font-black text-slate-900">{title}</p>
      {body && <p className="mt-2 font-bold text-slate-500">{body}</p>}
      {!spinner && (
        <Link href="/lobby" className="mt-4 inline-block text-sm font-black text-sky-600 hover:underline">로비로 돌아가기</Link>
      )}
    </div>
  )
}

function WrongList({
  ids, questions, answerKey, attempt,
}: {
  ids: string[]
  questions: GameQuestion[]
  answerKey: Map<string, AnalyticsQuestion> | null
  attempt: StudyAttempt
}) {
  const questionById = new Map(questions.map((question) => [question.id, question]))
  return (
    <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-orange-700">
        <XCircle className="h-4 w-4" />
        틀린 문제 {ids.length}개
      </div>
      <ol className="space-y-2">
        {ids.map((id, index) => {
          const question = questionById.get(id)
          if (!question) return null
          const answered = attempt.history.find((record) => questions[record.questionIndex]?.id === id)
          const correctAnswer = answerKey?.get(id)?.answer
          return (
            <li key={id} className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-black text-slate-400">{index + 1}</div>
              <div className="mt-1 font-bold text-slate-900">{displayBlankText(question.question_text)}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-bold">
                {answered?.selectedAnswer !== undefined && (
                  <span className="text-orange-700">내 답: {answered.selectedAnswer || '미응답'}</span>
                )}
                {correctAnswer && (
                  <span className="text-emerald-700">정답: {splitAcceptableAnswers(correctAnswer).join(' / ')}</span>
                )}
              </div>
              {question.explanation && (
                <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{question.explanation}</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
