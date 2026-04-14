'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import QuizView from '@/components/QuizView'
import BettingView from '@/components/BettingView'
import BetResultView from '@/components/BetResultView'
import DoubleDownView from '@/components/DoubleDownView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import { useGameBase } from '@/hooks/useGameBase'
import {
  INITIAL_SCORE,
  MIN_SCORE,
  calculateBetResult,
  calculateDoubleDownResult,
  getStreakMultiplier,
  isRescueRound,
  shouldGetRescue,
  getPlayerRank,
} from '@/lib/game/allinQuiz'

type AllInView =
  | 'lobby'
  | 'countdown'
  | 'betting'
  | 'quiz'
  | 'betResult'
  | 'doubleDown'
  | 'doubleDownQuiz'
  | 'doubleDownResult'
  | 'wrong'
  | 'result'

export default function AllInPage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    currentQuestionIndex,
    selectedAnswer,
    isCorrect,
    showCountdown,
    setShowCountdown,
    consecutiveCorrect,
    answerHistory,
    questions,
    players,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    playBGM,
    playSFX,
    checkAnswer,
    goToNextQuestion,
    isAnswerLocked,
  } = useGameBase({ expectedGameMode: 'allin' })

  const [betAmount, setBetAmount] = useState(0)
  const [betOptionId, setBetOptionId] = useState('')
  const [previousScore, setPreviousScore] = useState(0)
  const [hasRescueBoost, setHasRescueBoost] = useState(false)
  const [doubleDownReward, setDoubleDownReward] = useState(0)
  const [scoreBeforeDouble, setScoreBeforeDouble] = useState(0)
  const [resultScore, setResultScore] = useState<number | null>(null)
  const [localScore, setLocalScore] = useState<number | null>(null)

  const scoreSyncRef = useRef<number | null>(null)
  const currentScore = localScore ?? currentPlayer?.score ?? INITIAL_SCORE

  const streakMultiplier = getStreakMultiplier(consecutiveCorrect)

  useEffect(() => {
    if (currentPlayer?.score == null) return

    if (scoreSyncRef.current !== null) {
      if (currentPlayer.score === scoreSyncRef.current) {
        scoreSyncRef.current = null
      } else {
        return
      }
    }

    setLocalScore(currentPlayer.score)
  }, [currentPlayer?.score])

  // 최초 입장 시 초기 점수 세팅
  useEffect(() => {
    if (!playerId || !currentPlayer) return
    if (currentPlayer.score === 0) {
      scoreSyncRef.current = INITIAL_SCORE
      setLocalScore(INITIAL_SCORE)
      ;(supabase
        .from('players') as any)
        .update({ score: INITIAL_SCORE })
        .eq('id', playerId)
        .then(({ error }: { error: any }) => {
          if (error) console.error('초기 점수 설정 실패:', error)
        })
    }
  }, [playerId, currentPlayer])

  // 게임 상태가 playing으로 바뀌면 betting으로 전환
  useEffect(() => {
    if (currentView === 'quiz' && !isAnswerLocked && betAmount === 0) {
      setCurrentView('betting')
    }
  }, [currentView, isAnswerLocked, betAmount, setCurrentView])

  const handleCountdownComplete = () => {
    setShowCountdown(false)
    setCurrentView('betting')
    playBGM('game')
  }

  // 구원 라운드 체크
  useEffect(() => {
    if (
      currentView === 'betting' &&
      isRescueRound(currentQuestionIndex) &&
      playerId
    ) {
      const rank = getPlayerRank(
        playerId,
        players.map((p) => ({ id: p.id, score: p.score })),
      )
      if (shouldGetRescue(rank, players.length)) {
        setHasRescueBoost(true)
      }
    }
  }, [currentView, currentQuestionIndex, playerId, players])

  const handleBet = useCallback(
    (amount: number, optionId: string) => {
      playSFX('click')
      setBetAmount(amount)
      setBetOptionId(optionId)
      setPreviousScore(currentScore)
      setCurrentView('quiz')
    },
    [currentScore, playSFX, setCurrentView],
  )

  const updateScore = useCallback(
    async (newScore: number) => {
      if (!playerId) return
      const safeScore = Math.max(MIN_SCORE, newScore)
      scoreSyncRef.current = safeScore
      setLocalScore(safeScore)
      const { error } = await (supabase
        .from('players') as any)
        .update({ score: safeScore })
        .eq('id', playerId)
      if (error) {
        scoreSyncRef.current = null
        throw error
      }
    },
    [playerId],
  )

  const handleAnswerSubmit = useCallback(
    async (answer: string) => {
      const correct = await checkAnswer(answer)

      if (correct) {
        playSFX('correct')
        const newScore = calculateBetResult(currentScore, betAmount, true)
        await updateScore(newScore)
        setPreviousScore(currentScore)
        setResultScore(newScore)

        setTimeout(() => {
          setCurrentView('betResult')
        }, 1500)
      } else {
        playSFX('incorrect')
        const newScore = calculateBetResult(currentScore, betAmount, false)
        await updateScore(newScore)
        setPreviousScore(currentScore)
        setResultScore(newScore)

        setTimeout(() => {
          setCurrentView('betResult')
        }, 1500)
      }
      return correct
    },
    [checkAnswer, currentScore, betAmount, playSFX, updateScore, setCurrentView],
  )

  const handleBetResultContinue = useCallback(() => {
    if (isCorrect && betOptionId !== 'safe') {
      const settledScore = resultScore ?? currentScore
      setDoubleDownReward(betAmount)
      setScoreBeforeDouble(settledScore)
      setCurrentView('doubleDown')
    } else {
      setBetAmount(0)
      setBetOptionId('')
      setHasRescueBoost(false)
      setResultScore(null)
      goToNextQuestion()
      setTimeout(() => setCurrentView('betting'), 50)
    }
  }, [
    isCorrect,
    betOptionId,
    betAmount,
    resultScore,
    currentScore,
    goToNextQuestion,
    setCurrentView,
  ])

  const handleDoubleDownAccept = useCallback(() => {
    playSFX('click')
    setCurrentView('doubleDownQuiz')
  }, [playSFX, setCurrentView])

  const handleDoubleDownDecline = useCallback(() => {
    playSFX('click')
    setBetAmount(0)
    setBetOptionId('')
    setHasRescueBoost(false)
    setResultScore(null)
    goToNextQuestion()
    setTimeout(() => setCurrentView('betting'), 50)
  }, [playSFX, goToNextQuestion, setCurrentView])

  const handleDoubleDownAnswer = useCallback(
    async (answer: string) => {
      const correct = await checkAnswer(answer)
      const baseScore = scoreBeforeDouble || currentScore
      const newScore = calculateDoubleDownResult(
        baseScore,
        doubleDownReward,
        correct,
      )

      if (correct) {
        playSFX('correct')
      } else {
        playSFX('incorrect')
      }

      await updateScore(newScore)
      setPreviousScore(baseScore)
      setResultScore(newScore)

      setTimeout(() => {
        setCurrentView('doubleDownResult')
      }, 1500)
      return correct
    },
    [checkAnswer, scoreBeforeDouble, currentScore, doubleDownReward, playSFX, updateScore, setCurrentView],
  )

  const handleDoubleDownResultContinue = useCallback(() => {
    setBetAmount(0)
    setBetOptionId('')
    setDoubleDownReward(0)
    setScoreBeforeDouble(0)
    setHasRescueBoost(false)
    setResultScore(null)
    goToNextQuestion()
    setTimeout(() => setCurrentView('betting'), 50)
  }, [goToNextQuestion, setCurrentView])

  // 리더보드 정렬
  const displayPlayers = players.map((player) =>
    player.id === playerId ? { ...player, score: currentScore } : player,
  )
  const sortedPlayers = [...displayPlayers].sort((a, b) => b.score - a.score)
  const myRank =
    sortedPlayers.findIndex((p) => p.id === playerId) + 1

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
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8 relative overflow-hidden">
      <AnimatedBackground />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-xl shadow-2xl p-4 mb-6 border-4 border-indigo-400 relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-20">
            <div
              className="h-full w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
              }}
            />
          </div>

          <div className="relative flex items-center justify-between">
            <div>
              <h1
                className="text-2xl sm:text-3xl font-black text-white"
                style={{ fontFamily: 'DNFBitBitv2, sans-serif' }}
              >
                💎 올인 퀴즈
              </h1>
              <p className="text-sm text-indigo-200">방 코드: {roomCode}</p>
            </div>
            {currentPlayer && (
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-right bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2"
              >
                <div className="text-lg font-bold text-white">
                  {currentPlayer.nickname}
                </div>
                <div className="text-sm text-indigo-200 font-semibold">
                  💰 {currentScore.toLocaleString()}점 | #{myRank}위
                </div>
                {streakMultiplier > 1 && (
                  <div className="text-xs text-amber-300 font-bold">
                    🔥 {consecutiveCorrect}연속!
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 카운트다운 */}
        {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

        {/* 게임 화면 */}
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {/* 로비 */}
            {currentView === 'lobby' && (
              <motion.div
                key="lobby"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-xl shadow-2xl p-12 text-center border-2 border-gray-200"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="inline-block mb-6"
                >
                  <div className="text-6xl">💎</div>
                </motion.div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  게임 대기 중...
                </h2>
                <p className="text-gray-600 text-lg mb-6">
                  선생님이 게임을 시작할 때까지 기다려주세요.
                </p>
                <div className="flex items-center justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-3 h-3 bg-indigo-500 rounded-full"
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* 베팅 */}
            {currentView === 'betting' && (
              <motion.div
                key="betting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <BettingView
                  currentScore={currentScore}
                  streakMultiplier={streakMultiplier}
                  hasRescueBoost={hasRescueBoost}
                  consecutiveCorrect={consecutiveCorrect}
                  questionNumber={currentQuestionIndex + 1}
                  onBet={handleBet}
                />
              </motion.div>
            )}

            {/* 퀴즈 */}
            {currentView === 'quiz' && currentQuestion && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* 베팅 금액 표시 */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-4"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-lg">
                    🎯 {betAmount.toLocaleString()}점 베팅 중!
                  </span>
                </motion.div>
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  timeLimit={30}
                />
              </motion.div>
            )}

            {/* 베팅 결과 */}
            {currentView === 'betResult' && (
              <motion.div
                key="betResult"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <BetResultView
                  isCorrect={isCorrect}
                  betAmount={betAmount}
                  previousScore={previousScore}
                  newScore={resultScore ?? currentScore}
                  consecutiveCorrect={consecutiveCorrect}
                  onContinue={handleBetResultContinue}
                  autoAdvanceDelay={isCorrect && betOptionId !== 'safe' ? 3000 : 2500}
                />
              </motion.div>
            )}

            {/* 더블다운 선택 */}
            {currentView === 'doubleDown' && (
              <motion.div
                key="doubleDown"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <DoubleDownView
                  originalReward={doubleDownReward}
                  onAccept={handleDoubleDownAccept}
                  onDecline={handleDoubleDownDecline}
                />
              </motion.div>
            )}

            {/* 더블다운 퀴즈 */}
            {currentView === 'doubleDownQuiz' && currentQuestion && (
              <motion.div
                key="doubleDownQuiz"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-4"
                >
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-full font-bold text-lg shadow-lg">
                    🎲 더블 찬스! 맞히면 +
                    {(doubleDownReward * 2).toLocaleString()}점
                  </span>
                </motion.div>
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleDoubleDownAnswer}
                  timeLimit={20}
                />
              </motion.div>
            )}

            {/* 더블다운 결과 */}
            {currentView === 'doubleDownResult' && (
              <motion.div
                key="doubleDownResult"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <BetResultView
                  isCorrect={isCorrect}
                  betAmount={isCorrect ? doubleDownReward * 2 : doubleDownReward}
                  previousScore={previousScore}
                  newScore={resultScore ?? currentScore}
                  consecutiveCorrect={consecutiveCorrect}
                  onContinue={handleDoubleDownResultContinue}
                />
              </motion.div>
            )}

            {/* 오답 */}
            {currentView === 'wrong' && (
              <motion.div
                key="wrong"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="bg-red-50 rounded-xl shadow-2xl p-12 text-center border-2 border-red-300"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                  className="text-8xl mb-6"
                >
                  ❌
                </motion.div>
                <h2 className="text-5xl font-bold text-red-600 mb-4">
                  틀렸습니다!
                </h2>
                <p className="text-gray-700 text-lg">
                  잠시 후 다음 문제로 이동합니다...
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 게임 결과 */}
        {currentView === 'result' && (
          <GameResult
            players={players}
            currentPlayerId={playerId}
            answerHistory={answerHistory}
            questions={questions}
            gameMode={'gold_quest'}
          />
        )}

        {/* 실시간 리더보드 */}
        {currentView !== 'result' && currentView !== 'lobby' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-50 to-purple-100 rounded-xl shadow-lg p-4 sm:p-6 border-2 border-indigo-200"
          >
            <h2 className="text-lg font-bold mb-3 text-gray-800 flex items-center gap-2">
              💰 실시간 순위
            </h2>
            <div className="space-y-2">
              {sortedPlayers.slice(0, 8).map((player, index) => {
                const isMe = player.id === playerId
                const rankEmoji =
                  index === 0
                    ? '👑'
                    : index === 1
                      ? '🥈'
                      : index === 2
                        ? '🥉'
                        : ''

                return (
                  <motion.div
                    key={player.id}
                    layout
                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                      isMe
                        ? 'bg-indigo-100 border-indigo-500 shadow-md'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-500 w-8 text-center">
                        {rankEmoji || `#${index + 1}`}
                      </span>
                      <span className="text-xl">
                        {player.avatar || '🎮'}
                      </span>
                      <span
                        className={`font-semibold ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}
                      >
                        {player.nickname}
                        {isMe && (
                          <span className="ml-1 text-xs bg-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                            나
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="font-black text-gray-800">
                      {player.score.toLocaleString()}점
                    </div>
                  </motion.div>
                )
              })}
              {sortedPlayers.length > 8 && (
                <p className="text-center text-sm text-gray-400">
                  외 {sortedPlayers.length - 8}명
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  )
}
