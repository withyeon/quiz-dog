'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
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

type Player = Database['public']['Tables']['players']['Row'] & {
  convenience_products?: Product[]
  convenience_money?: number
}

type Question = {
  id: string
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}

type FactoryView = 'lobby' | 'countdown' | 'quiz' | 'wrong' | 'result' | 'selection'

export default function FactoryPage() {
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
  const [questions, setQuestions] = useState<Question[]>([])
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0) // Blooket: 3문제마다 유닛 획득
  const [showOrderModal, setShowOrderModal] = useState(false) // 정답 3개마다 발주 모달
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null) // 제한 시간 남은 초

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

    const gameMode = room.game_mode || 'gold_quest'

    // factory가 아니면 올바른 페이지로 리다이렉트
    if (gameMode !== 'factory') {
      const gameUrl = gameMode === 'gold_quest'
        ? `/game?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'racing'
          ? `/racing?room=${roomCode}&playerId=${playerId}`
          : gameMode === 'battle_royale'
            ? `/battle?room=${roomCode}&playerId=${playerId}`
            : gameMode === 'fishing'
              ? `/fishing?room=${roomCode}&playerId=${playerId}`
              : gameMode === 'cafe'
                ? `/cafe?room=${roomCode}&playerId=${playerId}`
                : gameMode === 'mafia'
                  ? `/mafia?room=${roomCode}&playerId=${playerId}`
                  : gameMode === 'pool'
                    ? `/pool?room=${roomCode}&playerId=${playerId}`
                    : `/factory?room=${roomCode}&playerId=${playerId}`

      if (gameUrl !== window.location.pathname + window.location.search) {
        window.location.href = gameUrl
      }
    }
  }, [room, roomLoading, roomCode, playerId])

  // 현재 플레이어 정보
  const currentPlayer = players.find((p) => p.id === playerId) as Player | undefined

  // 문제 데이터 가져오기 (로드 후 한 번 셔플하여 랜덤 순서)
  useEffect(() => {
    if (!room?.set_id) return

    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }

    const fetchQuestions = async () => {
      try {
        const { data, error } = await ((supabase
          .from('questions') as any)
          .select('*')
          .eq('set_id', room.set_id) as any)

        if (error) throw error

        setQuestions(shuffle((data ?? []) as Question[]))
      } catch (error) {
        console.error('Error fetching questions:', error)
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
  useEffect(() => {
    if (showCountdown) {
      const timer = setTimeout(() => {
        setShowCountdown(false)
        setCurrentView('quiz')
        questionStartTime.current = Date.now()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [showCountdown])

  // 돈 변경 핸들러
  const handleMoneyChange = async (newMoney: number) => {
    setMoney(newMoney)
    if (!playerId) return

    try {
      await ((supabase
        .from('players') as any)
        .update({
          convenience_money: newMoney,
          score: newMoney,
        })
        .eq('id', playerId))
    } catch (error) {
      console.error('Error updating money:', error)
    }
  }

  // 상품 변경 핸들러
  const handleProductsChange = async (newProducts: Product[]) => {
    setProducts(newProducts)
    if (!playerId) return

    try {
      await ((supabase
        .from('players') as any)
        .update({
          convenience_products: newProducts,
        })
        .eq('id', playerId))
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
    const normalizedAnswer = String(answer).trim()
    const normalizedCorrect = String(currentQuestion.answer).trim()
    const correct = normalizedAnswer === normalizedCorrect
    setIsCorrect(correct)

    if (correct) {
      playSFX('correct')

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
      setIsQuizMode(false)
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setIsQuizMode(true)
        setCurrentQuestionIndex(() => pickRandomQuestionIndex())
        setSelectedAnswer('')
        setIsCorrect(false)
        questionStartTime.current = Date.now()
      }, 2000)
    }
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
      if (remaining <= 0) {
        ; (async () => {
          try {
            await ((supabase
              .from('rooms') as any)
              .update({ status: 'finished' })
              .eq('room_code', roomCode))
          } catch (e) {
            console.error('편의점 시간 종료 업데이트 실패:', e)
          }
        })()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [room?.status, roomCode, durationSeconds, startedAt])

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

      <div className="relative z-10 p-4">
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
                      ₩{money.toLocaleString()}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="max-w-6xl mx-auto">
          {/* 카운트다운 */}
          {showCountdown && <Countdown onComplete={() => { }} />}

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

          {/* 퀴즈 */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="space-y-4">
              <QuizView
                question={currentQuestion}
                onAnswer={handleAnswerSubmit}
                onCorrectClick={goToNextQuiz}
                timeLimit={30}
              />

              {/* 편의점 뷰 */}
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
              />
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
              <p className="text-gray-700">다음 문제로 넘어갑니다...</p>
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
