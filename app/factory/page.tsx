'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { XCircle, Zap } from 'lucide-react'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useRoomChannel } from '@/hooks/useRoomChannel'
import { useAudioContext } from '@/components/AudioProvider'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import ConvenienceStore from '@/components/ConvenienceStore'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import ScreenFlash from '@/components/ScreenFlash'
import type { Database, Json } from '@/types/database.types'
import type { Product } from '@/lib/game/convenienceStore'
import { formatMoney, getAnswerSpeed, getSpeedBonus, roundMoney } from '@/lib/game/convenienceStore'
import { STORE_BRAND_ICON } from '@/lib/game/storeAssets'
import { DEFAULT_GAME_MODE, getGameModeUrl } from '@/lib/game/modes'
import { isTerminalRoomStatus, type RoomStatus } from '@/lib/game/roomStatus'
import { subscribeRoomRuntimeEvent, type RoomPatchPayload } from '@/lib/realtime/roomChannel'
import { formatServiceError } from '@/lib/services/errors'
import { updatePlayer } from '@/lib/services/players'
import {
  checkQuestionAnswer,
  listQuestionsForGame,
  type GameQuestion,
} from '@/lib/services/questions'

type Player = Database['public']['Tables']['players']['Row'] & {
  convenience_money?: number
}

type FactoryView = 'lobby' | 'prestartQuiz' | 'countdown' | 'quiz' | 'wrong' | 'result' | 'selection'

const PRE_START_QUIZ_TOTAL = 3

export default function FactoryPage() {
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
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0) // Blooket: 3문제마다 유닛 획득
  const [showOrderModal, setShowOrderModal] = useState(false) // 정답 3개마다 발주 모달
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null) // 제한 시간 남은 초
  const [lastAnswerSpeed, setLastAnswerSpeed] = useState<'fast' | 'normal' | 'slow'>('normal') // 마지막 정답 속도
  const [speedBonusDisplay, setSpeedBonusDisplay] = useState<number | null>(null) // 속도 보너스 표시용
  const [wrongPenalty, setWrongPenalty] = useState<number | null>(null) // 오답 패널티 표시
  const { revealedAnswer, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [preStartSubmittedCount, setPreStartSubmittedCount] = useState(0)
  const [preStartQuestionIndex, setPreStartQuestionIndex] = useState(0)
  const [isPreStartAnswerLocked, setIsPreStartAnswerLocked] = useState(false)

  const questionStartTime = useRef<number>(0)
  const moneyRef = useRef(0)

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
    patch: Partial<Player> & Record<string, unknown>,
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
  const currentPlayer = players.find((p) => p.id === playerId) as Player | undefined
  const isPaused = room?.status === 'paused'

  const forceFinishForStudent = useCallback((reason = 'forced_finish') => {
    setCurrentView('result')
    setShowCountdown(false)
    if (roomCode && playerId) {
      router.replace(`/student/game/${roomCode}/result?playerId=${playerId}&reason=${encodeURIComponent(reason)}`)
    }
  }, [playerId, roomCode, router])

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
        const loadedQuestions = await listQuestionsForGame(setId, { shuffle: true })
        setQuestions(loadedQuestions)
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

  // 무한 반복: 인덱스는 나머지로 사용, 다음 문제는 랜덤 선택
  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex % questions.length] : null
  const preStartQuizQuestion = questions.length > 0 ? questions[preStartQuestionIndex % questions.length] : null
  const isPreStartQuizComplete = preStartSubmittedCount >= PRE_START_QUIZ_TOTAL

  // 저장된 데이터 불러오기
  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.convenience_money !== undefined) {
        setMoney(currentPlayer.convenience_money)
      }
      if (currentPlayer.convenience_products) {
        setProducts(currentPlayer.convenience_products as unknown as Product[])
      }
    }
  }, [currentPlayer])

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
  const pickRandomQuestionIndex = () => Math.floor(Math.random() * Math.max(1, questions.length))

  // 정답 후 다음 문제로 (3의 배수 아닐 때 클릭 시 즉시 이동)
  const goToNextQuiz = () => {
    setIsQuizMode(true)
    setCurrentView('quiz')
    setCurrentQuestionIndex(() => pickRandomQuestionIndex())
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

    if (correct) {
      playSFX('correct')

      // 정답 속도 계산
      const answerTimeMs = Date.now() - questionStartTime.current
      const speed = getAnswerSpeed(answerTimeMs, 30)
      setLastAnswerSpeed(speed)

      // 속도 보너스 골드 지급
      const bonus = getSpeedBonus(answerTimeMs, 30)
      if (bonus > 0) {
        applyMoneyDelta(bonus)
        setSpeedBonusDisplay(bonus)
        setTimeout(() => setSpeedBonusDisplay(null), 1500)
      }

      // Blooket 스타일: 3문제마다 상품 획득
      const newCorrectCount = correctAnswersCount + 1
      setCorrectAnswersCount(newCorrectCount)

      // 3문제마다 발주(상품 선택) 모달 표시
      if (newCorrectCount % 3 === 0) {
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 300)
        playSFX('item')
        setShowOrderModal(true) // 발주 모달 열기
      } else {
        // 3의 배수가 아니면 1초 후 자동 또는 정답 클릭 시 즉시
        setTimeout(goToNextQuiz, 1000)
      }
    } else {
      playSFX('incorrect')

      // 오답 패널티: 상품을 빼앗기지는 않되, 매출 일부를 잃어 템포만 살짝 늦춘다.
      if (moneyRef.current > 0) {
        const penalty = roundMoney(Math.min(Math.max(moneyRef.current * 0.08, 100), 2000))
        applyMoneyDelta(-penalty)
        setWrongPenalty(penalty)
        setTimeout(() => setWrongPenalty(null), 2500)
      }

      setIsQuizMode(false)
      setCurrentView('wrong')
      revealAnswer(currentQuestion?.id)
      setTimeout(() => {
        setCurrentView('quiz')
        setIsQuizMode(true)
        setCurrentQuestionIndex(() => pickRandomQuestionIndex())
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
    setShowOrderModal(false)
    setIsQuizMode(true)
    setCurrentView('quiz')
    setCurrentQuestionIndex(() => pickRandomQuestionIndex())
    setSelectedAnswer('')
    setIsCorrect(false)
    questionStartTime.current = Date.now()
  }

  // 편의점: 선생님이 설정한 제한 시간이 되면 자동 종료 (돈 많은 순 순위)
  const durationSeconds = (room as { duration_seconds?: number } | null)?.duration_seconds ?? null
  const startedAt = (room as { started_at?: string | null } | null)?.started_at ?? null

  useEffect(() => {
    const timerStartMs = startedAt ? new Date(startedAt).getTime() : null

    if (room?.status !== 'playing' || durationSeconds == null || !timerStartMs) {
      setRemainingSeconds(null)
      return
    }
    // 카운트다운 표시만 담당한다. 시간 종료 시 학생 화면 전환은 useGameBase의 로컬 종료가,
    // 방의 finished 기록은 교사 대시보드(유일한 권위자)가 담당한다. 학생은 DB에 쓰지 않는다.
    const tick = () => {
      const elapsed = (Date.now() - timerStartMs) / 1000
      setRemainingSeconds(Math.max(0, Math.ceil(durationSeconds - elapsed)))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [durationSeconds, room?.status, startedAt])

  // 게임 종료 감지
  useEffect(() => {
    if (room && isTerminalRoomStatus(room.status) && currentView !== 'result') {
      forceFinishForStudent(`room_status_${room.status}`)
    }
  }, [currentView, forceFinishForStudent, room])

  if (!roomCode || !playerId) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
      </div>
    )
  }

  return (
    <main className="factory-ambient relative min-h-dvh overflow-hidden font-bitbit">
      <ScreenFlash show={showFlash} color="rgba(34, 197, 94, 0.3)" />

      {/* 속도 보너스 플로팅 표시 */}
      {speedBonusDisplay !== null && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.5, 1.2, 1, 0.8] }}
          transition={{ duration: 1.5 }}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-yellow-400 text-gray-900 font-black text-3xl px-6 py-3 rounded-2xl shadow-2xl border-4 border-yellow-600 flex items-center gap-2">
            <Zap size={28} className="fill-current" />
            +{formatMoney(speedBonusDisplay)} 속도 보너스!
          </div>
        </motion.div>
      )}

      <div className="relative z-10 p-4">
        {/* 헤더 */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="rounded-xl border-2 border-emerald-200/90 bg-white/92 p-4 shadow-xl shadow-emerald-900/10 backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 sm:h-16 sm:w-16">
                  <Image src={STORE_BRAND_ICON} alt="편의점" fill className="object-contain" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-emerald-950 sm:text-2xl">전설의 편의점</h1>
                  <p className="text-xs font-bold text-emerald-700">방 코드: {roomCode}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* 남은 시간 (선생님이 설정한 제한 시간) */}
                {remainingSeconds != null && (
                  <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-1.5 sm:px-4 sm:py-2">
                    <div className="mb-0.5 whitespace-nowrap text-xs font-semibold text-amber-800 sm:mb-1">남은 시간</div>
                    <div className="text-center text-xl font-bold tabular-nums text-amber-950 sm:text-2xl">
                      {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                )}
                {/* 정답 카운터 */}
                <div className="rounded-lg border-2 border-sky-300 bg-sky-50 px-3 py-1.5 sm:px-4 sm:py-2">
                  <div className="mb-0.5 whitespace-nowrap text-xs font-semibold text-sky-800 sm:mb-1">
                    다음 상품까지
                  </div>
                  <motion.div
                    key={correctAnswersCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="whitespace-nowrap text-center text-xl font-bold text-sky-950 sm:text-2xl"
                  >
                    {3 - (correctAnswersCount % 3)} 문제
                  </motion.div>
                </div>

                {currentPlayer && (
                  <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-1.5 sm:px-4 sm:py-2">
                    <div className="mb-0.5 max-w-[120px] truncate text-sm font-semibold text-emerald-800 sm:mb-1">
                      {currentPlayer.nickname}
                    </div>
                    <motion.div
                      key={money}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="whitespace-nowrap text-xl font-bold text-emerald-950 sm:text-2xl"
                    >
                      {formatMoney(money)}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="max-w-[1600px] mx-auto">
          {/* 카운트다운 */}
          {currentView === 'prestartQuiz' && (
            <PreStartQuizGate
              question={preStartQuizQuestion}
              submittedCount={preStartSubmittedCount}
              total={PRE_START_QUIZ_TOTAL}
              onAnswer={handlePreStartQuizAnswer}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
            />
          )}

          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {/* 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg text-center"
            >
              <div className="mb-4 flex items-center justify-center gap-3">
                <Image src={STORE_BRAND_ICON} alt="편의점" width={48} height={48} unoptimized className="object-contain" />
                <h2 className="text-3xl font-bold">전설의 편의점</h2>
              </div>
              <p className="text-gray-600">3문제마다 상품을 받고, 9칸을 채운 뒤 더 좋은 상품으로 교체하세요!</p>
              <p className="text-sm text-gray-500 mt-2">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 + 편의점 — 좌우 분리 레이아웃 (모바일은 세로 스택) */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {/* 왼쪽: 퀴즈 */}
              <div className="w-full min-w-0 lg:flex-1 lg:sticky lg:top-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={goToNextQuiz}
                  timeLimit={30}
                  paused={isPaused}
                  variant="glass"
                  className="lg-panel lg-ink-outline font-bitbit w-full p-5 sm:p-8"
                />
              </div>

              {/* 오른쪽: 편의점 */}
              <div className="w-full min-w-0 lg:flex-1 lg:overflow-y-auto lg:max-h-[calc(100dvh-160px)]">
                <ConvenienceStore
                  money={money}
                  onMoneyDelta={applyMoneyDelta}
                  products={products}
                  onProductsChange={handleProductsChange}
                  onQuizStart={handleQuizStart}
                  canInteract={!isQuizMode}
                  quizCorrect={isCorrect && currentView === 'quiz'}
                  onProductSelected={handleProductSelected}
                  showOrderModal={showOrderModal}
                  answerSpeed={lastAnswerSpeed}
                />
              </div>
            </div>
          )}

          {/* 오답 */}
          {currentView === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center"
            >
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100">
                <XCircle size={48} />
              </div>
              <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다!</h2>
              <AnswerReveal answer={revealedAnswer} />
              {wrongPenalty ? (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-700 font-bold text-lg"
                >
                  매출 정산 실수! {formatMoney(wrongPenalty)}을 잃었습니다.
                </motion.p>
              ) : (
                <p className="text-gray-700">다음 문제로 넘어갑니다...</p>
              )}
            </motion.div>
          )}

          {/* 결과 */}
          {currentView === 'result' && (
            <GameResult
              players={players}
              currentPlayerId={playerId}
              gameMode="factory"
            />
          )}
        </div>
        {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
              선생님이 잠깐 멈췄어요
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
