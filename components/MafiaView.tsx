'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMafiaStore } from '@/store/mafiaStore'
import { formatTime, calculateLaunderedCash, calculateTotalMultiplier, SafeVault } from '@/lib/game/mafia'
import { Eye, DollarSign, AlertTriangle, CheckCircle, XCircle, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QuizView from '@/components/QuizView'
import { useAudioContext } from '@/components/AudioProvider'


interface MafiaViewProps {
  onGameEnd?: () => void
  roomCode?: string
  playerId?: string
}

// 더미 문제 데이터
const DUMMY_QUESTIONS = [
  {
    id: '1',
    question_text: '한국의 수도는?',
    options: ['서울', '부산', '대구', '인천'],
    answer: '서울',
  },
  {
    id: '2',
    question_text: '태양계에서 가장 큰 행성은?',
    options: ['지구', '목성', '토성', '화성'],
    answer: '목성',
  },
  {
    id: '3',
    question_text: '2 + 2는?',
    options: ['3', '4', '5', '6'],
    answer: '4',
  },
  {
    id: '4',
    question_text: '한국의 독립기념일은?',
    options: ['3월 1일', '8월 15일', '10월 3일', '12월 25일'],
    answer: '8월 15일',
  },
  {
    id: '5',
    question_text: '지구의 위성은?',
    options: ['화성', '금성', '달', '태양'],
    answer: '달',
  },
]

type MafiaViewType = 'quiz' | 'actionSelect' | 'vaultSelection' | 'vaultResult' | 'investigation' | 'wrong' | 'result'

export default function MafiaView({ onGameEnd, roomCode, playerId }: MafiaViewProps) {
  const {
    status,
    timeRemaining,
    players,
    currentVaults,
    gameLog,
    pendingAction,
    showVaultSelection,
    showInvestigation,
    cheatVaultContents,
    investigatingPlayer,
    investigationResult,
    selectedVaultResult,
    actions,
  } = useMafiaStore()

  const [currentView, setCurrentView] = useState<MafiaViewType>('quiz')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [showCheatCaught, setShowCheatCaught] = useState(false)

  const aiActionInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const questionStartTime = useRef<number>(Date.now())

  const { playBGM, playSFX } = useAudioContext()
  const player = players.find((p) => !p.isAi)
  const aiPlayers = players.filter((p) => p.isAi)
  const currentQuestion = DUMMY_QUESTIONS[currentQuestionIndex % DUMMY_QUESTIONS.length]

  // 타이머
  useEffect(() => {
    if (status === 'playing') {
      timerInterval.current = setInterval(() => {
        actions.tickTimer()
      }, 1000)
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }

    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
      }
    }
  }, [status, actions])

  // AI 자동 행동
  useEffect(() => {
    if (status === 'playing' && currentView === 'quiz') {
      aiActionInterval.current = setInterval(() => {
        actions.aiAction()
      }, 3000) // 3초마다 AI 행동

      return () => {
        if (aiActionInterval.current) {
          clearInterval(aiActionInterval.current)
        }
      }
    }
  }, [status, currentView, actions])

  // 게임 종료 처리
  useEffect(() => {
    if (status === 'ended' && onGameEnd) {
      onGameEnd()
    }
  }, [status, onGameEnd])

  // 로그 자동 스크롤
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameLog])

  // 치팅 발각 효과 감지
  useEffect(() => {
    const lastLog = gameLog[gameLog.length - 1]
    if (lastLog?.message.includes('치팅이 발각되었습니다')) {
      setShowCheatCaught(true)
      setTimeout(() => {
        setShowCheatCaught(false)
      }, 3000)
    }
  }, [gameLog])

  // 정답 후 액션 선택 화면으로 (클릭 시 즉시 이동)
  const goToActionSelect = () => {
    setCurrentView('actionSelect')
    setSelectedAnswer('')
    setIsCorrect(false)
  }

  // 정답 제출 처리
  const handleAnswerSubmit = (answer: string) => {
    if (!answer) {
      // 시간 초과
      playSFX('incorrect')
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setSelectedAnswer('')
        setIsCorrect(false)
        setCurrentQuestionIndex((prev) => prev + 1)
        questionStartTime.current = Date.now()
      }, 2000)
      return
    }

    setSelectedAnswer(answer)
    const normalizedAnswer = String(answer).trim()
    const normalizedCorrect = String(currentQuestion.answer).trim()
    const correct = normalizedAnswer === normalizedCorrect
    setIsCorrect(correct)

    if (correct) {
      playSFX('correct')

      // 정답 시 1.5초 후 자동 또는 정답 클릭 시 즉시 액션 선택으로
      setTimeout(goToActionSelect, 1500)
    } else {
      playSFX('incorrect')
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setSelectedAnswer('')
        setIsCorrect(false)
        setCurrentQuestionIndex((prev) => prev + 1)
        questionStartTime.current = Date.now()
      }, 2000)
    }
  }

  // 금고 열기 선택
  const handleExcavate = () => {
    actions.setPendingAction('excavate')
    setCurrentView('vaultSelection')
  }

  // 조사 선택
  const handleInvestigate = () => {
    actions.setPendingAction('investigate')
    setCurrentView('investigation')
  }

  // 금고 선택
  const handleVaultSelect = (vaultId: string) => {
    actions.selectVault(vaultId)
    setCurrentView('vaultResult')
  }

  // Cheat 버튼 클릭
  const handleCheat = () => {
    actions.useCheatButton()
  }

  // 조사 시작
  const handleStartInvestigation = (targetId: string) => {
    actions.startInvestigation(targetId)
  }

  // 조사 완료 후 다음 문제로
  useEffect(() => {
    if (investigationResult && showInvestigation) {
      setTimeout(() => {
        actions.completeInvestigation()
        setCurrentView('quiz')
        setCurrentQuestionIndex((prev) => prev + 1)
        questionStartTime.current = Date.now()
      }, 2000)
    }
  }, [investigationResult, showInvestigation, actions])

  // 금고 선택 화면이 열리면 자동으로 vaultSelection 뷰로 전환
  useEffect(() => {
    if (showVaultSelection && currentVaults && currentView !== 'vaultSelection') {
      setCurrentView('vaultSelection')
    }
  }, [showVaultSelection, currentVaults, currentView])

  // 금고 결과 화면에서 2초 후 퀴즈로
  useEffect(() => {
    if (selectedVaultResult && currentView === 'vaultResult') {
      playSFX('correct')
      const timer = setTimeout(() => {
        setCurrentView('quiz')
        setCurrentQuestionIndex((prev) => prev + 1)
        questionStartTime.current = Date.now()
        // 결과 초기화
        actions.setPendingAction(null)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [selectedVaultResult, currentView, actions, playSFX])

  const isUrgent = timeRemaining <= 30 && status === 'playing'

  // 금고 보상 아이콘 및 텍스트
  const getVaultDisplay = (vault: SafeVault, isRevealed: boolean) => {
    if (!isRevealed) {
      return { icon: '🔒', text: '???' }
    }

    switch (vault.reward) {
      case 'cash':
        return { icon: '💵', text: `$${vault.amount}` }
      case 'diamond':
        return { icon: '💎', text: `${vault.amount}개` }
      case 'multiplier_1.5':
        return { icon: '⚡', text: 'x1.5 배수' }
      case 'multiplier_2':
        return { icon: '⚡⚡', text: 'x2 배수' }
      case 'empty':
        return { icon: '❌', text: '빈 금고' }
      default:
        return { icon: '🔒', text: '???' }
    }
  }

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black overflow-hidden" style={{ fontFamily: 'BMKkubulim, sans-serif' }}>
      {/* 상단 정보 바 */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-sm border-b-2 border-yellow-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl">⏰</span>
              <span
                className={`text-4xl font-bold ${isUrgent ? 'text-red-500 animate-pulse' : 'text-yellow-400'
                  }`}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
            {player && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-3xl">💰</span>
                  <span className="text-4xl font-bold text-yellow-400">
                    ${calculateLaunderedCash(player).toLocaleString()}
                  </span>
                </div>
                {player.multipliers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">⚡</span>
                    <span className="text-2xl font-bold text-yellow-400">
                      x{calculateTotalMultiplier(player.multipliers).toFixed(1)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="absolute top-16 left-0 right-0 bottom-20 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentView === 'quiz' && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl px-4"
            >
              <QuizView
                question={currentQuestion}
                onAnswer={handleAnswerSubmit}
                onCorrectClick={goToActionSelect}
                timeLimit={30}
              />
            </motion.div>
          )}

          {currentView === 'actionSelect' && (
            <motion.div
              key="actionSelect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl px-4"
            >
              <Card className="border-4 border-yellow-600 bg-black/90 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                  <h2 className="text-4xl font-bold text-yellow-400 mb-6">
                    정답입니다! 무엇을 하시겠습니까?
                  </h2>
                  <div className="grid grid-cols-2 gap-6">
                    <Button
                      onClick={handleExcavate}
                      size="lg"
                      className="h-32 bg-gradient-to-br from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-black font-bold text-2xl"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-5xl">🔐</span>
                        <span>금고 열기</span>
                      </div>
                    </Button>
                    <Button
                      onClick={handleInvestigate}
                      size="lg"
                      className="h-32 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold text-2xl"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Eye className="h-8 w-8" />
                        <span>조사하기</span>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {showVaultSelection && currentVaults && (
            <motion.div
              key="vaultSelection"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-4xl px-4"
            >
              <Card className="border-4 border-yellow-600 bg-black/90 backdrop-blur-sm shadow-2xl">
                <CardContent className="p-8">
                  <h2 className="text-4xl font-bold text-yellow-400 mb-6 text-center">
                    금고를 선택하세요
                  </h2>
                  <div className="grid grid-cols-3 gap-6 mb-6">
                    {currentVaults.map((vault, index) => {
                      const isRevealed = cheatVaultContents !== null
                      // cheatVaultContents가 있으면 해당 금고의 내용을 사용, 없으면 원본 vault 사용
                      const vaultToDisplay = isRevealed && cheatVaultContents
                        ? cheatVaultContents.find(v => v.id === vault.id) || vault
                        : vault
                      const display = getVaultDisplay(vaultToDisplay, isRevealed)
                      return (
                        <motion.button
                          key={vault.id}
                          onClick={() => handleVaultSelect(vault.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          disabled={false}
                          className={`aspect-square rounded-xl border-4 ${
                            isRevealed 
                              ? 'border-blue-500 bg-gradient-to-br from-blue-900 to-blue-700' 
                              : 'border-yellow-600 bg-gradient-to-br from-yellow-900 to-yellow-700'
                          } hover:border-yellow-400 p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all`}
                        >
                          <div className="text-7xl">{display.icon}</div>
                          <div className="text-2xl font-bold text-white">{display.text}</div>
                          {isRevealed && (
                            <div className="text-sm text-blue-300 mt-1">X-Ray</div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                  <Button
                    onClick={handleCheat}
                    size="lg"
                    disabled={false}
                    className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-2xl py-6 shadow-lg border-2 border-red-400"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Eye className="h-6 w-6" />
                      <span>금고 몰래보기</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'investigation' && (
            <motion.div
              key="investigation"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-3xl px-4"
            >
              <Card className="border-4 border-blue-600 bg-black/90 backdrop-blur-sm">
                <CardContent className="p-8">
                  <h2 className="text-4xl font-bold text-blue-400 mb-6 text-center">
                    누구를 조사하시겠습니까?
                  </h2>
                  {investigatingPlayer ? (
                    <div className="text-center py-12">
                      {investigationResult === null ? (
                        <>
                          <div className="text-7xl mb-4 animate-spin">🔍</div>
                          <p className="text-3xl text-gray-300">조사 중...</p>
                        </>
                      ) : investigationResult === 'CHEATER' ? (
                        <>
                          <div className="text-7xl mb-4">🚨</div>
                          <p className="text-4xl font-bold text-red-400 mb-2">CHEATER!</p>
                          <p className="text-2xl text-gray-300">
                            {aiPlayers.find((p) => p.id === investigatingPlayer)?.name}가 치팅 중이었습니다!
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="text-7xl mb-4">✅</div>
                          <p className="text-4xl font-bold text-green-400 mb-2">CLEAR</p>
                          <p className="text-2xl text-gray-300">
                            {aiPlayers.find((p) => p.id === investigatingPlayer)?.name}는 결백했습니다.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiPlayers.map((ai) => (
                        <Button
                          key={ai.id}
                          onClick={() => handleStartInvestigation(ai.id)}
                          size="lg"
                          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-bold text-xl py-6 justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">🕴️</span>
                            <span>{ai.name}</span>
                            {ai.isCheating && (
                              <span className="text-sm bg-red-600 text-white px-2 py-1 rounded">
                                치팅 중
                              </span>
                            )}
                          </div>
                          <div className="text-yellow-400">
                            ${calculateLaunderedCash(ai).toLocaleString()}
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'vaultResult' && selectedVaultResult && (
            <motion.div
              key="vaultResult"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl px-4"
            >
              <Card className="border-4 border-yellow-600 bg-black/90 backdrop-blur-sm shadow-2xl">
                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="mb-6"
                  >
                    <div className="text-9xl mb-4">
                      {getVaultDisplay(selectedVaultResult.vault, true).icon}
                    </div>
                    <h2 className="text-5xl font-bold text-yellow-400 mb-4">
                      {selectedVaultResult.vault.reward === 'empty'
                        ? '빈 금고'
                        : selectedVaultResult.vault.reward === 'cash'
                          ? `$${selectedVaultResult.vault.amount} 획득!`
                          : selectedVaultResult.vault.reward === 'diamond'
                            ? `다이아몬드 ${selectedVaultResult.vault.amount}개 획득!`
                            : selectedVaultResult.vault.reward === 'multiplier_1.5'
                              ? '배수 x1.5 획득!'
                              : '배수 x2 획득!'}
                    </h2>
                    <p className="text-2xl text-gray-300">{selectedVaultResult.log}</p>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div
              key="wrong"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="text-7xl mb-4">❌</div>
              <p className="text-4xl font-bold text-red-400">틀렸습니다!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 우측: 조직원 리스트 */}
      <div className="absolute top-16 right-0 w-80 bottom-20 p-6 border-l-2 border-yellow-600 bg-black/50 overflow-y-auto">
        <h2 className="text-3xl font-bold text-yellow-400 mb-4 flex items-center gap-2">
          <span>👥</span> 조직원
        </h2>
        <div className="space-y-3">
          {aiPlayers.map((ai) => (
            <Card
              key={ai.id}
              className={`border-2 ${ai.status === 'jailed'
                  ? 'border-red-600 bg-red-900/30'
                  : ai.isCheating
                    ? 'border-orange-500 bg-orange-900/30 animate-pulse'
                    : 'border-gray-600 bg-gray-800/50'
                }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🕴️</span>
                    <span className="font-bold text-white text-lg">{ai.name}</span>
                    {ai.isCheating && (
                      <span className="text-sm bg-orange-600 text-white px-2 py-1 rounded">
                        치팅 중
                      </span>
                    )}
                    {ai.status === 'jailed' && (
                      <span className="text-sm bg-red-600 text-white px-2 py-1 rounded">
                        감옥
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-yellow-400 font-semibold text-lg">
                  ${calculateLaunderedCash(ai).toLocaleString()}
                </div>
                {ai.multipliers.length > 0 && (
                  <div className="text-sm text-blue-400 mt-1">
                    배수: x{calculateTotalMultiplier(ai.multipliers).toFixed(1)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 하단: 로그 창 */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-sm border-t-2 border-yellow-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <h3 className="text-xl font-bold text-yellow-400 mb-2 flex items-center gap-2">
            <span>📡</span> 도청 장치
          </h3>
          <div className="h-32 overflow-y-auto bg-black/50 rounded-lg p-3 font-mono text-base space-y-1">
            {gameLog.map((log) => (
              <div
                key={log.id}
                className={`${log.type === 'success'
                    ? 'text-green-400'
                    : log.type === 'warning'
                      ? 'text-yellow-400'
                      : log.type === 'danger'
                        ? 'text-red-400'
                        : 'text-gray-300'
                  }`}
              >
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>



      {/* 치팅 발각 효과 */}
      <AnimatePresence>
        {showCheatCaught && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-red-600/50 animate-pulse" />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
              }}
              className="relative text-9xl font-bold text-white drop-shadow-2xl"
            >
              🚨 발각! 🚨
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
