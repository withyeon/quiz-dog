'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useAudioContext } from '@/components/AudioProvider'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import type { Database, Json } from '@/types/database.types'
import type { Product } from '@/lib/game/convenienceStore'
import {
  QUIZZES_PER_PRODUCT,
  QUIZ_TIME_LIMIT,
  getAnswerSpeed,
  getSpeedBonus,
  getWrongPenalty,
  normalizeSavedProducts,
  roundMoney,
} from '@/lib/game/convenienceStore'
import { DEFAULT_GAME_MODE, getGameModeUrl } from '@/lib/game/modes'
import { isTerminalRoomStatus, type RoomStatus } from '@/lib/game/roomStatus'
import { subscribeRoomRuntimeEvent, type RoomPatchPayload } from '@/lib/realtime/roomChannel'
import { formatServiceError } from '@/lib/services/errors'
import { updatePlayer } from '@/lib/services/players'
import type { AnswerRecord } from '@/hooks/useGameBase'
import {
  checkQuestionAnswer,
  listQuestionsForGame,
  type GameQuestion,
} from '@/lib/services/questions'
import { getQuestionSetTitle } from '@/lib/services/questionSets'

export type StorePlayer = Database['public']['Tables']['players']['Row'] & {
  convenience_money?: number
}

export type FactoryView = 'lobby' | 'prestartQuiz' | 'countdown' | 'quiz' | 'wrong' | 'result' | 'selection'

export const PRE_START_QUIZ_TOTAL = 3

/** 0..n-1 인덱스를 섞어서 돌려준다 (Fisher–Yates). */
function shuffleIndexes(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/**
 * 전설의 편의점 한 판의 상태와 규칙.
 * 편의점은 useGameBase를 쓰지 않고 방·플레이어·문제·정답 기록·제한 시간을 직접 다룬다.
 * 페이지(app/factory/page.tsx)는 돌려준 값으로 화면만 그린다.
 */
export function useConvenienceStoreGame() {
  const router = useRouter()
  const [roomCode, setRoomCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<FactoryView>('lobby')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [money, setMoney] = useState(0)
  const [isQuizMode, setIsQuizMode] = useState(false)
  const [questions, setQuestions] = useState<GameQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [questionSetTitle, setQuestionSetTitle] = useState<string | null>(null)
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0) // Blooket: 3문제마다 유닛 획득
  const [showOrderModal, setShowOrderModal] = useState(false) // 정답 3개마다 발주 모달
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null) // 제한 시간 남은 초
  const [lastAnswerSpeed, setLastAnswerSpeed] = useState<'fast' | 'normal' | 'slow'>('normal') // 마지막 정답 속도
  const [speedBonusDisplay, setSpeedBonusDisplay] = useState<number | null>(null) // 속도 보너스 표시용
  const [wrongPenalty, setWrongPenalty] = useState<number | null>(null) // 오답 패널티 표시
  const { revealedAnswer, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [preStartSubmittedCount, setPreStartSubmittedCount] = useState(0)
  const [preStartQuestionIndex, setPreStartQuestionIndex] = useState(0)
  const [preStartOrder, setPreStartOrder] = useState<number[]>([])
  const [isPreStartAnswerLocked, setIsPreStartAnswerLocked] = useState(false)

  const questionStartTime = useRef<number>(0)
  const moneyRef = useRef(0)
  // 정답 후 1초 자동 이동 / 오답 후 3초 복귀 타이머. "다음" 버튼을 눌러 먼저 넘어가면
  // 이 타이머를 반드시 지워야 한다 — 안 지우면 새 문제가 뜨고 곧바로 또 다른 문제로 바뀐다.
  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 정답/오답 기록. 편의점은 useGameBase를 쓰지 않아 여기서 직접 players.answer_history에 동기화한다.
  // 이게 없으면 학생 결과·선생님 리포트에 "0번 풀어서 0번 정답"으로 나온다.
  const [answerHistory, setAnswerHistory] = useState<AnswerRecord[]>([])
  const answerHistoryRef = useRef<AnswerRecord[]>([])
  const syncedHistoryLengthRef = useRef(0)
  const hasRestoredHistoryRef = useRef(false)
  const canSyncAnswerHistoryRef = useRef(true)

  // URL에서 roomCode와 playerId 가져오기
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('room')
      const id = params.get('playerId')
      if (code) setRoomCode(code)
      if (id) setPlayerId(id)
    }
  }, [])

  const { players, loading: playersLoading } = usePlayersRealtime({ roomCode })
  const { room, loading: roomLoading } = useRoomRealtime({ roomCode })
  const { sendEvent: sendRoomEvent } = useRoomChannel({
    roomCode,
    playerId,
    role: 'student',
    enabled: Boolean(roomCode),
  })
  const { playBGM, playSFX } = useAudioContext()

  const commitPlayerPatch = useCallback(async (
    patch: Partial<StorePlayer> & Record<string, unknown>,
    reason: string,
  ) => {
    if (!playerId) return

    void sendRoomEvent('player:patch', {
      playerId,
      patch,
      reason,
    })
    await updatePlayer(playerId, patch)
  }, [playerId, sendRoomEvent])

  // ─── 정답 기록 DB 동기화 ───
  // flushAnswerHistory: 지금까지 쌓인 기록을 바로 저장. 게임 종료 직전에 호출해 마지막 답이 누락되지 않게 한다.
  const flushAnswerHistory = useCallback(async () => {
    if (!playerId || !canSyncAnswerHistoryRef.current) return
    const history = answerHistoryRef.current
    if (history.length === 0 || history.length === syncedHistoryLengthRef.current) return
    try {
      await updatePlayer(playerId, { answer_history: history as unknown as Json[] })
      syncedHistoryLengthRef.current = history.length
    } catch (error) {
      const message = formatServiceError(error)
      console.error('정답 기록 동기화 실패:', message, error)
      // 구형 스키마에는 answer_history 컬럼이 없을 수 있다 → 이후 시도 중단
      if (message.includes('answer_history') || message.includes('42703') || message.includes('column')) {
        canSyncAnswerHistoryRef.current = false
      }
    }
  }, [playerId])

  // 게임 모드 확인 및 리다이렉트
  useEffect(() => {
    if (!room || roomLoading) return

    const gameMode = room.game_mode || DEFAULT_GAME_MODE

    // factory가 아니면 올바른 페이지로 리다이렉트
    if (gameMode !== 'factory') {
      const gameUrl = getGameModeUrl(gameMode, roomCode, playerId || '')

      if (gameUrl !== window.location.pathname + window.location.search) {
        router.replace(gameUrl)
      }
    }
  }, [room, roomLoading, roomCode, playerId, router])

  // 현재 플레이어 정보
  const currentPlayer = players.find((p) => p.id === playerId) as StorePlayer | undefined
  const isPaused = room?.status === 'paused'

  const forceFinishForStudent = useCallback((reason = 'forced_finish') => {
    setCurrentView('result')
    setShowCountdown(false)
    if (roomCode && playerId) {
      // 결과 페이지는 DB의 answer_history를 읽으므로, 이동 전에 아직 저장 안 된 기록을 먼저 밀어 넣는다.
      void flushAnswerHistory().finally(() => {
        router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=${encodeURIComponent(reason)}`)
      })
    }
  }, [flushAnswerHistory, playerId, roomCode, router])

  useEffect(() => {
    if (!roomCode) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.roomCode !== roomCode) return

      if (event.type === 'game:finished') {
        const payload = event.payload as { reason?: string } | undefined
        forceFinishForStudent(payload?.reason || 'game_finished_event')
        return
      }

      if (event.type === 'room:patch') {
        const payload = event.payload as RoomPatchPayload | undefined
        if (isTerminalRoomStatus(payload?.patch?.status as RoomStatus | undefined)) {
          forceFinishForStudent(payload?.reason || 'room_finished_patch')
        }
      }
    })
  }, [forceFinishForStudent, roomCode])

  // 문제 데이터 가져오기 (로드 후 한 번 셔플하여 랜덤 순서)
  useEffect(() => {
    if (!room?.set_id) return
    const setId = room.set_id

    const fetchQuestions = async () => {
      setQuestionsLoading(true)
      setQuestionsError(null)
      try {
        // 섞지 않고 문제집 순서 그대로 둔다. answer_history의 questionIndex가 결과 화면(문제집 순서)과
        // 같은 번호를 가리켜야 "복습할 문제"가 실제 틀린 문항을 보여준다. 본게임은 어차피 랜덤 출제.
        const loadedQuestions = await listQuestionsForGame(setId)
        setQuestions(loadedQuestions)
        // 시작 전 3문제만 학생마다 다른 순서로 나오도록 인덱스 순서를 따로 섞는다.
        setPreStartOrder(shuffleIndexes(loadedQuestions.length))
      } catch (error) {
        const msg = formatServiceError(error)
        console.error('Error fetching questions:', msg, error)
        setQuestions([])
        setQuestionsError(msg)
      } finally {
        setQuestionsLoading(false)
      }
    }

    fetchQuestions()
  }, [room?.set_id])

  // 헤더에 띄울 문제집 이름 (편의점은 공용 훅을 쓰지 않아 여기서 직접 가져온다)
  useEffect(() => {
    const setId = room?.set_id
    if (!setId) {
      setQuestionSetTitle(null)
      return
    }
    let isMounted = true
    getQuestionSetTitle(setId)
      .then((title) => {
        if (isMounted) setQuestionSetTitle(title)
      })
      .catch((error) => {
        console.error('Error fetching question set title:', formatServiceError(error))
        if (isMounted) setQuestionSetTitle(null)
      })
    return () => {
      isMounted = false
    }
  }, [room?.set_id])

  // 무한 반복: 인덱스는 나머지로 사용, 다음 문제는 랜덤 선택
  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex % questions.length] : null
  const preStartQuizQuestion = questions.length > 0
    ? questions[preStartOrder[preStartQuestionIndex % questions.length] ?? (preStartQuestionIndex % questions.length)]
    : null
  const isPreStartQuizComplete = preStartSubmittedCount >= PRE_START_QUIZ_TOTAL

  // 저장된 데이터 불러오기
  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.convenience_money !== undefined) {
        setMoney(currentPlayer.convenience_money)
      }
      if (currentPlayer.convenience_products) {
        setProducts(normalizeSavedProducts(currentPlayer.convenience_products as unknown as Product[]))
      }
      // 새로고침 방어: DB에 남은 기록을 한 번만 복구 (이후엔 로컬 기록이 원본)
      if (!hasRestoredHistoryRef.current) {
        hasRestoredHistoryRef.current = true
        const saved = currentPlayer.answer_history
        if (Array.isArray(saved) && saved.length > 0) {
          const restored = saved as unknown as AnswerRecord[]
          answerHistoryRef.current = restored
          syncedHistoryLengthRef.current = restored.length
          setAnswerHistory(restored)
        }
      }
    }
  }, [currentPlayer])

  // 연속 답변을 묶어 DB 쓰기 횟수를 줄인다 (2초 debounce).
  useEffect(() => {
    if (!playerId || answerHistory.length === 0) return
    const timer = window.setTimeout(() => { void flushAnswerHistory() }, 2000)
    return () => window.clearTimeout(timer)
  }, [answerHistory, playerId, flushAnswerHistory])

  const recordAnswer = useCallback((record: AnswerRecord & { responseTimeMs?: number }) => {
    const next = [...answerHistoryRef.current, record]
    answerHistoryRef.current = next
    setAnswerHistory(next)
  }, [])

  // 게임 시작 감지
  useEffect(() => {
    if (room && room.status === 'playing') {
      // 게임이 시작되면 로비에서 카운트다운으로 이동
      if (currentView === 'lobby') {
        if (isPreStartQuizComplete) {
          setShowCountdown(true)
          setCurrentView('countdown')
        } else {
          setShowCountdown(false)
          setCurrentView('prestartQuiz')
        }
        playBGM('game')
      }
    } else if (room && room.status === 'waiting' && currentView !== 'lobby') {
      setCurrentView('lobby')
      setShowCountdown(false)
      setPreStartSubmittedCount(0)
      setPreStartQuestionIndex(0)
      setIsPreStartAnswerLocked(false)
    }
  }, [currentView, isPreStartQuizComplete, playBGM, room])

  // 카운트다운 완료 후 퀴즈 시작
  const handleCountdownComplete = () => {
    setShowCountdown(false)
    setCurrentView('quiz')
    questionStartTime.current = Date.now()
  }

  const handlePreStartQuizAnswer = async (answer: string) => {
    if (!preStartQuizQuestion || isPreStartAnswerLocked || isPreStartQuizComplete) return false

    setIsPreStartAnswerLocked(true)
    const submittedAnswer = String(answer).trim()
    let correct = false

    if (submittedAnswer !== '') {
      try {
        correct = await checkQuestionAnswer(preStartQuizQuestion.id, submittedAnswer)
      } catch (err) {
        console.error('Error checking pre-start answer on server:', err)
        correct = false
      }
    }

    const nextCount = Math.min(PRE_START_QUIZ_TOTAL, preStartSubmittedCount + 1)
    window.setTimeout(() => {
      setPreStartSubmittedCount(nextCount)
      setPreStartQuestionIndex((prev) => prev + 1)
      setIsPreStartAnswerLocked(false)

      if (nextCount >= PRE_START_QUIZ_TOTAL) {
        setShowCountdown(true)
        setCurrentView('countdown')
      }
    }, 650)

    return correct
  }

  // money 상태를 ref와 동기화 (DB 로드/실시간 갱신 포함)
  useEffect(() => {
    moneyRef.current = money
  }, [money])

  // 돈 증감 핸들러 — moneyRef를 동기적으로 누적해 동시 갱신(자동 수익 + 보너스/패널티) 레이스 방지.
  // 절대값 set 대신 delta를 적용하므로, RPC await 중 들어온 자동 수익이 덮어써지지 않는다.
  const applyMoneyDelta = useCallback((delta: number) => {
    const next = roundMoney(moneyRef.current + delta)
    moneyRef.current = next
    setMoney(next)
    if (!playerId) return

    void commitPlayerPatch({
      convenience_money: next,
      factory_money: next,
      score: next,
    }, 'factory_money_update')
  }, [commitPlayerPatch, playerId])

  // 상품 변경 핸들러
  const handleProductsChange = useCallback(async (newProducts: Product[]) => {
    setProducts(newProducts)
    if (!playerId) return

    try {
      await commitPlayerPatch({
        convenience_products: newProducts as unknown as Json,
      }, 'factory_products_update')
    } catch (error) {
      console.error('Error updating products:', error)
    }
  }, [commitPlayerPatch, playerId])

  // 퀴즈 시작
  const handleQuizStart = () => {
    setIsQuizMode(true)
    setCurrentView('quiz')
    questionStartTime.current = Date.now()
  }

  // 다음 문제: 랜덤 인덱스로 무한 반복
  // 직전 문제와 같은 인덱스는 피한다. 같은 문제가 다시 뽑히면 question.id가 바뀌지 않아
  // QuizView가 답 제출 상태(버튼 잠김)에서 초기화되지 않고 그대로 멈춘다.
  const pickRandomQuestionIndex = (prev: number) => {
    const total = Math.max(1, questions.length)
    if (total <= 1) return 0
    const next = Math.floor(Math.random() * (total - 1))
    return next >= prev % total ? next + 1 : next
  }

  const clearNextQuestionTimer = () => {
    if (nextQuestionTimerRef.current) {
      clearTimeout(nextQuestionTimerRef.current)
      nextQuestionTimerRef.current = null
    }
  }

  // 언마운트 시 대기 중인 문제 전환 타이머 정리
  useEffect(() => clearNextQuestionTimer, [])

  // 정답 후 다음 문제로 (3의 배수 아닐 때 클릭 시 즉시 이동)
  const goToNextQuiz = () => {
    clearNextQuestionTimer()
    setIsQuizMode(true)
    setCurrentView('quiz')
    setCurrentQuestionIndex((prev) => pickRandomQuestionIndex(prev))
    setSelectedAnswer('')
    setIsCorrect(false)
    questionStartTime.current = Date.now()
  }

  // 정답 제출
  const handleAnswerSubmit = async (answer: string) => {
    if (!currentPlayer || !roomCode || !playerId || !currentQuestion) return

    setSelectedAnswer(answer)
    // 팩토리 로직 반영 전에 기본 답안 체크 (RPC 호출)
    let correct = false
    try {
      correct = await checkQuestionAnswer(currentQuestion.id, answer)
    } catch (err) {
      console.error('Error checking answer on server:', err)
      correct = false
    }

    setIsCorrect(correct)

    const answerTimeMs = Date.now() - questionStartTime.current
    recordAnswer({
      questionIndex: questions.length > 0 ? currentQuestionIndex % questions.length : 0,
      isCorrect: correct,
      selectedAnswer: String(answer).trim(),
      responseTimeMs: answerTimeMs,
    })

    if (correct) {
      playSFX('correct')

      // 정답 속도 계산
      const speed = getAnswerSpeed(answerTimeMs, QUIZ_TIME_LIMIT)
      setLastAnswerSpeed(speed)

      // 속도 보너스 골드 지급
      const bonus = getSpeedBonus(answerTimeMs, QUIZ_TIME_LIMIT)
      if (bonus > 0) {
        applyMoneyDelta(bonus)
        setSpeedBonusDisplay(bonus)
        setTimeout(() => setSpeedBonusDisplay(null), 1500)
      }

      // Blooket 스타일: 3문제마다 상품 획득
      const newCorrectCount = correctAnswersCount + 1
      setCorrectAnswersCount(newCorrectCount)

      // 3문제마다 발주(상품 선택) 모달 표시
      if (newCorrectCount % QUIZZES_PER_PRODUCT === 0) {
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 300)
        playSFX('item')
        setShowOrderModal(true) // 발주 모달 열기
      } else {
        // 3의 배수가 아니면 1초 후 자동 또는 정답 클릭 시 즉시 (둘 중 먼저 실행된 쪽만 이동)
        clearNextQuestionTimer()
        nextQuestionTimerRef.current = setTimeout(goToNextQuiz, 1000)
      }
    } else {
      playSFX('incorrect')

      // 오답 패널티: 상품을 빼앗기지는 않되, 매출 일부를 잃어 템포만 살짝 늦춘다.
      const penalty = getWrongPenalty(moneyRef.current)
      if (penalty > 0) {
        applyMoneyDelta(-penalty)
        setWrongPenalty(penalty)
        setTimeout(() => setWrongPenalty(null), 2500)
      }

      setIsQuizMode(false)
      setCurrentView('wrong')
      revealAnswer(currentQuestion?.id)
      clearNextQuestionTimer()
      nextQuestionTimerRef.current = setTimeout(() => {
        nextQuestionTimerRef.current = null
        setCurrentView('quiz')
        setIsQuizMode(true)
        setCurrentQuestionIndex((prev) => pickRandomQuestionIndex(prev))
        setSelectedAnswer('')
        setIsCorrect(false)
        clearRevealedAnswer()
        questionStartTime.current = Date.now()
      }, 3000)
    }
    return correct
  }

  // 상품 선택(발주) 완료 후 모달 닫고 다음 문제로 (랜덤)
  const handleProductSelected = () => {
    clearNextQuestionTimer()
    setShowOrderModal(false)
    setIsQuizMode(true)
    setCurrentView('quiz')
    setCurrentQuestionIndex((prev) => pickRandomQuestionIndex(prev))
    setSelectedAnswer('')
    setIsCorrect(false)
    questionStartTime.current = Date.now()
  }

  // 편의점: 선생님이 설정한 제한 시간이 되면 자동 종료 (돈 많은 순 순위)
  const durationSeconds = (room as { duration_seconds?: number } | null)?.duration_seconds ?? null
  const roomStartedAt = (room as { started_at?: string | null } | null)?.started_at ?? null

  // ─── 과제 모드: 제한 시간은 방이 아니라 "이 학생이 게임에 들어간 시각"부터 센다 ───
  // useGameBase와 같은 규칙인데, 편의점은 공용 훅을 쓰지 않아 여기서 직접 처리한다.
  // 학생마다 다른 시간에 들어오므로 room.started_at을 쓰면 늦게 온 학생은 시작하자마자 끝난다.
  const isHomework = Boolean((room as { is_homework?: boolean | null } | null)?.is_homework)
  const homeworkDueAt = (room as { due_at?: string | null } | null)?.due_at ?? null
  const playerStartedAt = (currentPlayer as { started_at?: string | null } | undefined)?.started_at ?? null
  const hasCurrentPlayer = Boolean(currentPlayer)
  const [localSessionStart, setLocalSessionStart] = useState<string | null>(null)
  /** 이 학생의 세션 시작 시각. 일반 방은 room.started_at, 과제 방은 학생 개인 시작 시각. */
  const sessionStartedAt = isHomework ? (playerStartedAt ?? localSessionStart) : roomStartedAt

  // 과제: 시작 전 퀴즈를 마치고 게임에 들어간 시각을 한 번 기록한다. 플레이어 행이 로드된 뒤에만
  // 기록한다(재입장 때 DB의 started_at을 보기 전에 새 시각을 쓰면 제한 시간이 처음부터 다시 간다).
  // DB 반영 전에도 바로 세도록 sessionStorage에 먼저 적는다.
  useEffect(() => {
    if (!isHomework || room?.status !== 'playing' || !isPreStartQuizComplete) return
    if (!roomCode || !playerId || !hasCurrentPlayer || typeof window === 'undefined') return
    if (playerStartedAt || localSessionStart) return

    const storageKey = `hw_start_${roomCode}_${playerId}`
    try {
      const saved = window.sessionStorage.getItem(storageKey)
      if (saved) {
        setLocalSessionStart(saved)
        return
      }
    } catch {
      // sessionStorage 접근 불가(프라이빗 모드 등) — DB 기록으로 진행
    }

    const now = new Date().toISOString()
    setLocalSessionStart(now)
    try {
      window.sessionStorage.setItem(storageKey, now)
    } catch {
      // 저장 실패해도 DB 패치로 복구된다
    }
    commitPlayerPatch({ started_at: now }, 'homework_session_start').catch((error) => {
      console.error('과제 시작 시각 기록 실패:', error)
    })
  }, [
    commitPlayerPatch, hasCurrentPlayer, isHomework, isPreStartQuizComplete, localSessionStart,
    playerId, playerStartedAt, room?.status, roomCode,
  ])

  useEffect(() => {
    const timerStartMs = sessionStartedAt ? new Date(sessionStartedAt).getTime() : null

    if (room?.status !== 'playing' || durationSeconds == null || !timerStartMs) {
      setRemainingSeconds(null)
      return
    }
    // 카운트다운 표시만 담당한다. 일반 방에서 시간 종료 시 학생 화면 전환은 교사 대시보드
    // (유일한 권위자)의 finished 기록을 받아 처리하고, 학생은 DB에 쓰지 않는다.
    // 과제 방은 선생님 화면이 없으므로 아래 로컬 종료 효과가 결과로 넘긴다.
    const tick = () => {
      const elapsed = (Date.now() - timerStartMs) / 1000
      setRemainingSeconds(Math.max(0, Math.ceil(durationSeconds - elapsed)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [durationSeconds, room?.status, sessionStartedAt])

  // 과제 방에는 진행을 끝내 줄 선생님 화면이 없으므로, 개인 제한 시간과 제출 마감 중 먼저 오는
  // 쪽에서 학생 화면을 스스로 결과로 넘긴다 (useGameBase의 로컬 종료와 같은 규칙).
  const homeworkFinishedRef = useRef(false)
  useEffect(() => {
    if (!isHomework || room?.status !== 'playing' || !sessionStartedAt || !durationSeconds) return

    const startedMs = new Date(sessionStartedAt).getTime()
    if (!Number.isFinite(startedMs) || durationSeconds <= 0) return

    let deadlineMs = startedMs + durationSeconds * 1000
    if (homeworkDueAt) {
      const dueMs = new Date(homeworkDueAt).getTime()
      if (Number.isFinite(dueMs)) deadlineMs = Math.min(deadlineMs, dueMs)
    }

    const tick = () => {
      if (homeworkFinishedRef.current) return
      if (Date.now() >= deadlineMs) {
        homeworkFinishedRef.current = true
        forceFinishForStudent('factory_time_up_local')
      }
    }
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [durationSeconds, forceFinishForStudent, homeworkDueAt, isHomework, room?.status, sessionStartedAt])

  // 게임 종료 감지
  useEffect(() => {
    if (room && isTerminalRoomStatus(room.status) && currentView !== 'result') {
      forceFinishForStudent(`room_status_${room.status}`)
    }
  }, [currentView, forceFinishForStudent, room])

  return {
    roomCode,
    playerId,
    room,
    roomLoading,
    players,
    playersLoading,
    currentPlayer,
    isPaused,
    currentView,
    showCountdown,
    showFlash,
    questionSetTitle,
    questions,
    questionsLoading,
    questionsError,
    currentQuestion,
    preStartQuizQuestion,
    preStartSubmittedCount,
    products,
    money,
    isQuizMode,
    isCorrect,
    selectedAnswer,
    correctAnswersCount,
    showOrderModal,
    remainingSeconds,
    lastAnswerSpeed,
    speedBonusDisplay,
    wrongPenalty,
    revealedAnswer,
    // 핸들러
    handleCountdownComplete,
    handlePreStartQuizAnswer,
    handleAnswerSubmit,
    goToNextQuiz,
    handleQuizStart,
    applyMoneyDelta,
    handleProductsChange,
    handleProductSelected,
  }
}
