'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import QuizView from '@/components/QuizView'
import ConvenienceStore from '@/components/ConvenienceStore'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import ScreenFlash from '@/components/ScreenFlash'
import type { Database } from '@/types/database.types'
import type { Product } from '@/lib/game/convenienceStore'
import { getAnswerSpeed, getSpeedBonus } from '@/lib/game/convenienceStore'
import { DEFAULT_GAME_MODE, getGameModeUrl } from '@/lib/game/modes'
import { isRoomHostPlayer } from '@/lib/realtime/roomChannel'
import { updatePlayer } from '@/lib/services/players'
import { finishRoom } from '@/lib/services/rooms'
import {
  checkQuestionAnswer,
  listQuestionsForGame,
  type GameQuestion,
} from '@/lib/services/questions'

type Player = Database['public']['Tables']['players']['Row'] & {
  convenience_products?: Product[]
  convenience_money?: number
}

type FactoryView = 'lobby' | 'countdown' | 'quiz' | 'wrong' | 'result' | 'selection'

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
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0) // Blooket: 3문제마다 유닛 획득
  const [showOrderModal, setShowOrderModal] = useState(false) // 정답 3개마다 발주 모달
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null) // 제한 시간 남은 초
  const [lastAnswerSpeed, setLastAnswerSpeed] = useState<'fast' | 'normal' | 'slow'>('normal') // 마지막 정답 속도
  const [speedBonusDisplay, setSpeedBonusDisplay] = useState<number | null>(null) // 속도 보너스 표시용
  const [stolenProduct, setStolenProduct] = useState<string | null>(null) // 도난당한 상품 이름 표시

  const questionStartTime = useRef<number>(0)

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
  const { playBGM, playSFX } = useAudioContext()

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
  const isRoomHost = useMemo(() => isRoomHostPlayer(playerId, players, []), [playerId, players])

  // 문제 데이터 가져오기 (로드 후 한 번 셔플하여 랜덤 순서)
  useEffect(() => {
    if (!room?.set_id) return
    const setId = room.set_id

    const fetchQuestions = async () => {
      try {
        const loadedQuestions = await listQuestionsForGame(setId, { shuffle: true })
        setQuestions(loadedQuestions)
      } catch (error) {
        const msg =
          error instanceof Error
            ? error.message
            : error && typeof error === 'object' && 'message' in error
              ? String((error as { message?: string }).message)
              : JSON.stringify(error)
        console.error('Error fetching questions:', msg, error)
      }
    }

    fetchQuestions()
  }, [room?.set_id])

  // 무한 반복: 인덱스는 나머지로 사용, 다음 문제는 랜덤 선택
  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex % questions.length] : null

  // 저장된 데이터 불러오기
  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.convenience_money !== undefined) {
        setMoney(currentPlayer.convenience_money)
      }
      if (currentPlayer.convenience_products) {
        setProducts(currentPlayer.convenience_products as Product[])
      }
    }
  }, [currentPlayer])

  // 게임 시작 감지
  useEffect(() => {
    if (room && room.status === 'playing') {
      // 게임이 시작되면 로비에서 카운트다운으로 이동
      if (currentView === 'lobby') {
        setShowCountdown(true)
        setCurrentView('countdown')
        playBGM('game')
      }
    } else if (room && room.status === 'waiting' && currentView !== 'lobby') {
      setCurrentView('lobby')
      setShowCountdown(false)
    }
  }, [room, currentView, playBGM])

  // 카운트다운 완료 후 퀴즈 시작
  const handleCountdownComplete = () => {
    setShowCountdown(false)
    setCurrentView('quiz')
    questionStartTime.current = Date.now()
  }

  // 돈 변경 핸들러
  const handleMoneyChange = async (newMoney: number) => {
    setMoney(newMoney)
    if (!playerId) return

    try {
      await updatePlayer(playerId, {
        convenience_money: newMoney,
        score: newMoney,
      })
    } catch (error) {
      console.error('Error updating money:', error)
    }
  }

  // 상품 변경 핸들러
  const handleProductsChange = async (newProducts: Product[]) => {
    setProducts(newProducts)
    if (!playerId) return

    try {
      await updatePlayer(playerId, {
        convenience_products: newProducts,
      })
    } catch (error) {
      console.error('Error updating products:', error)
    }
  }

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
        handleMoneyChange(money + bonus)
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

      // 🚨 오답 패널티: 상품 도난 (진열대에 상품이 있으면 랜덤 1개 제거)
      if (products.length > 0) {
        const stolenIndex = Math.floor(Math.random() * products.length)
        const stolen = products[stolenIndex]
        setStolenProduct(stolen.name)
        const newProducts = products.filter((_, idx) => idx !== stolenIndex)
        handleProductsChange(newProducts)
        setTimeout(() => setStolenProduct(null), 2500)
      }

      setIsQuizMode(false)
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setIsQuizMode(true)
        setCurrentQuestionIndex(() => pickRandomQuestionIndex())
        setSelectedAnswer('')
        setIsCorrect(false)
        questionStartTime.current = Date.now()
      }, 2500)
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
    if (room?.status !== 'playing' || durationSeconds == null || !startedAt) {
      setRemainingSeconds(null)
      return
    }
    const started = new Date(startedAt).getTime()
    const tick = () => {
      const elapsed = (Date.now() - started) / 1000
      const remaining = Math.max(0, Math.ceil(durationSeconds - elapsed))
      setRemainingSeconds(remaining)
      if (remaining <= 0 && isRoomHost) {
        ; (async () => {
          try {
            await finishRoom(roomCode)
          } catch (e) {
            console.error('편의점 시간 종료 업데이트 실패:', e)
          }
        })()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [durationSeconds, isRoomHost, room?.status, roomCode, startedAt])

  // 게임 종료 감지
  useEffect(() => {
    if (room && room.status === 'finished' && currentView !== 'result') {
      setCurrentView('result')
    }
  }, [room, currentView])

  if (!roomCode || !playerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <p className="text-gray-800">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      <AnimatedBackground />
      <ScreenFlash show={showFlash} color="rgba(34, 197, 94, 0.3)" />

      {/* 속도 보너스 플로팅 표시 */}
      {speedBonusDisplay !== null && (
        <motion.div
          initial={{ opacity: 0, y: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -80, scale: [0.5, 1.2, 1, 0.8] }}
          transition={{ duration: 1.5 }}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-yellow-400 text-gray-900 font-black text-3xl px-6 py-3 rounded-2xl shadow-2xl border-4 border-yellow-600">
            ⚡ +{speedBonusDisplay.toLocaleString()}원 속도 보너스!
          </div>
        </motion.div>
      )}

      <div className="relative z-10 p-4" style={{ fontFamily: 'BMJUA, sans-serif' }}>
        {/* 헤더 */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 rounded-xl p-4 shadow-2xl border-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 flex-shrink-0">
                  <Image src="/store/store.svg" alt="편의점" fill className="object-contain" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">전설의 편의점</h1>
                  <p className="text-xs text-yellow-300">방 코드: {roomCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 남은 시간 (선생님이 설정한 제한 시간) */}
                {remainingSeconds != null && (
                  <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-amber-500">
                    <div className="text-xs text-amber-300 font-semibold mb-1">남은 시간</div>
                    <div className="text-2xl font-bold text-white text-center tabular-nums">
                      {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                )}
                {/* 정답 카운터 */}
                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-blue-500">
                  <div className="text-xs text-blue-300 font-semibold mb-1">
                    다음 상품까지
                  </div>
                  <motion.div
                    key={correctAnswersCount}
                    initial={{ scale: 1.2, color: '#10b981' }}
                    animate={{ scale: 1, color: '#ffffff' }}
                    className="text-2xl font-bold text-white text-center"
                  >
                    {3 - (correctAnswersCount % 3)} 문제
                  </motion.div>
                </div>

                {currentPlayer && (
                  <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-yellow-500">
                    <div className="text-sm text-yellow-300 font-semibold mb-1">
                      {currentPlayer.nickname}
                    </div>
                    <motion.div
                      key={money}
                      initial={{ scale: 1.2, color: '#10b981' }}
                      animate={{ scale: 1, color: '#ffffff' }}
                      className="text-2xl font-bold text-white"
                    >
                      {money.toLocaleString()}원
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
          {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

          {/* 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg text-center"
            >
              <h2 className="text-3xl font-bold mb-4">🏪 전설의 편의점</h2>
              <p className="text-gray-600">3문제마다 상품을 받아 진열대에 배치하세요!</p>
              <p className="text-sm text-gray-500 mt-2">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 + 편의점 — 좌우 분리 레이아웃 */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="flex gap-4 items-start">
              {/* 왼쪽: 퀴즈 */}
              <div className="flex-1 min-w-0 sticky top-4">
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={goToNextQuiz}
                  timeLimit={30}
                  className="bg-white rounded-xl shadow-2xl p-8 w-full border-2 border-gray-200"
                />
              </div>

              {/* 오른쪽: 편의점 */}
              <div className="flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
                <ConvenienceStore
                  money={money}
                  onMoneyChange={handleMoneyChange}
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
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다!</h2>
              {stolenProduct ? (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-700 font-bold text-lg"
                >
                  🚨 도둑이 [{stolenProduct}]을(를) 훔쳐갔습니다!
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
      </div>
    </main>
  )
}
