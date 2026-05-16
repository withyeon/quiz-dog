'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useZombieStore } from '@/store/zombieStore'
import { formatTime, GAME_CONSTANTS, ZombiePlayer } from '@/lib/game/zombie'
import { Heart, Shield, Sword, Search, Stethoscope, Skull } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import QuizView from '@/components/QuizView'
import { useAudioContext } from '@/components/AudioProvider'

interface ZombieViewProps {
  onGameEnd?: () => void
  roomCode?: string
  playerId?: string
}

const DUMMY_QUESTIONS = [
  { id: '1', question_text: '한국의 수도는?', options: ['서울', '부산', '대구', '인천'], answer: '서울' },
  { id: '2', question_text: '태양계에서 가장 큰 행성은?', options: ['지구', '목성', '토성', '화성'], answer: '목성' },
  { id: '3', question_text: '2 + 2는?', options: ['3', '4', '5', '6'], answer: '4' },
  { id: '4', question_text: '한국의 광복절은?', options: ['3월 1일', '8월 15일', '10월 3일', '12월 25일'], answer: '8월 15일' },
  { id: '5', question_text: '지구의 위성은?', options: ['화성', '금성', '달', '태양'], answer: '달' },
  { id: '6', question_text: '1 + 1은?', options: ['1', '2', '3', '4'], answer: '2' },
  { id: '7', question_text: '물의 화학식은?', options: ['H2O', 'CO2', 'O2', 'NaCl'], answer: 'H2O' },
  { id: '8', question_text: '가장 큰 대륙은?', options: ['아시아', '아프리카', '유럽', '북아메리카'], answer: '아시아' },
]

type ViewState = 'quiz' | 'actionSelect' | 'targetSelect' | 'scanResult' | 'attackResult' | 'wrong' | 'event'

export default function ZombieView({ onGameEnd }: ZombieViewProps) {
  const {
    status, timeRemaining, roundNumber, players, gameLog, winner, winReason,
    scanCooldown, lastScanResult, lastAttackResult, currentEvent, actions,
  } = useZombieStore()

  const [currentView, setCurrentView] = useState<ViewState>('quiz')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const { playSFX } = useAudioContext()

  const myPlayer = players.find(p => !p.isAi)
  const otherPlayers = players.filter(p => p.isAi)
  const currentQuestion = DUMMY_QUESTIONS[currentQuestionIndex % DUMMY_QUESTIONS.length]
  const isZombie = myPlayer?.role === 'zombie'
  const isUrgent = timeRemaining <= 60 && status === 'playing'

  const humanCount = players.filter(p => p.role === 'human').length
  const zombieCount = players.filter(p => p.role === 'zombie').length

  // Timer
  useEffect(() => {
    if (status === 'playing') {
      timerInterval.current = setInterval(() => actions.tickTimer(), 1000)
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current)
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current) }
  }, [status, actions])

  // Game end
  useEffect(() => {
    if (status === 'ended' && onGameEnd) onGameEnd()
  }, [status, onGameEnd])

  // Log auto-scroll
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [gameLog])

  // Clear results after delay
  useEffect(() => {
    if (lastScanResult) {
      const t = setTimeout(() => {
        actions.clearScanResult()
        setCurrentView('quiz')
        setCurrentQuestionIndex(p => p + 1)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [lastScanResult, actions])

  useEffect(() => {
    if (lastAttackResult) {
      const t = setTimeout(() => {
        actions.clearAttackResult()
        setCurrentView('quiz')
        setCurrentQuestionIndex(p => p + 1)
      }, 2500)
      return () => clearTimeout(t)
    }
  }, [lastAttackResult, actions])

  useEffect(() => {
    if (currentEvent) {
      const t = setTimeout(() => {
        actions.clearEvent()
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [currentEvent, actions])

  const handleAnswerSubmit = (answer: string) => {
    if (!answer) {
      playSFX('incorrect')
      actions.onWrongAnswer()
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setCurrentQuestionIndex(p => p + 1)
      }, 1500)
      return false
    }
    const correct = answer === currentQuestion.answer
    if (correct) {
      playSFX('correct')
      actions.onCorrectAnswer()
      actions.processAiRound()
      setTimeout(() => setCurrentView('actionSelect'), 1000)
    } else {
      playSFX('incorrect')
      actions.onWrongAnswer()
      actions.processAiRound()
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setCurrentQuestionIndex(p => p + 1)
      }, 1500)
    }
    return correct
  }

  const handleHumanAction = (action: 'heal' | 'shield') => {
    actions.performAction(action)
    playSFX('correct')
    setCurrentView('quiz')
    setCurrentQuestionIndex(p => p + 1)
  }

  const handleScanSelect = () => setCurrentView('targetSelect')

  const handleTargetSelect = (targetId: string, action: 'attack' | 'scan') => {
    actions.performAction(action, targetId)
    playSFX(action === 'attack' ? 'incorrect' : 'click')
    setCurrentView(action === 'attack' ? 'attackResult' : 'scanResult')
  }

  const overlayColor = isZombie
    ? 'rgba(5, 46, 22, 0.5)' // Dark green for zombie
    : 'rgba(30, 27, 75, 0.5)' // Dark indigo for human
  const accentColor = isZombie ? 'text-green-400' : 'text-blue-400'
  const borderColor = isZombie ? 'border-green-600' : 'border-blue-600'

  return (
    <div 
      className="relative w-full h-screen overflow-hidden" 
      style={{ 
        fontFamily: 'DNFBitBitv2, sans-serif',
        backgroundImage: `linear-gradient(${overlayColor}, rgba(0,0,0,0.7)), url('/zombie/background.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${isZombie ? 'bg-green-500/20' : 'bg-blue-500/20'}`}
            style={{ width: 4 + Math.random() * 8, height: 4 + Math.random() * 8, left: `${Math.random() * 100}%` }}
            animate={{ y: [window?.innerHeight || 800, -20], opacity: [0, 0.6, 0] }}
            transition={{ duration: 4 + Math.random() * 6, repeat: Infinity, delay: Math.random() * 5 }}
          />
        ))}
      </div>

      {/* Top HUD */}
      <div className={`absolute top-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-sm border-b-2 ${borderColor} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              <span className={`text-3xl font-bold tabular-nums ${isUrgent ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatTime(timeRemaining)}
              </span>
            </div>
            {/* Round */}
            <div className="text-lg text-gray-400">R{roundNumber}</div>
          </div>

          {/* Role badge */}
          <div className={`px-4 py-1 rounded-full border-2 ${isZombie ? 'border-green-500 bg-green-950/80' : 'border-blue-500 bg-blue-950/80'}`}>
            <span className="text-2xl mr-2">{isZombie ? '🧟' : '🧑'}</span>
            <span className={`text-lg font-bold ${isZombie ? 'text-green-400' : 'text-blue-400'}`}>
              {isZombie ? '좀비' : '인간'}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-green-400">
              <span>🧑</span>
              <span className="font-bold text-lg">{humanCount}</span>
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <span>🧟</span>
              <span className="font-bold text-lg">{zombieCount}</span>
            </div>
            {myPlayer && !isZombie && (
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-red-500" />
                <span className="text-lg font-bold text-red-400">{myPlayer.health}</span>
                {myPlayer.shield > 0 && (
                  <>
                    <Shield className="h-5 w-5 text-cyan-400" />
                    <span className="text-lg font-bold text-cyan-400">{myPlayer.shield}</span>
                  </>
                )}
              </div>
            )}
            {myPlayer && isZombie && (
              <div className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-red-500" />
                <span className="text-lg font-bold text-red-400">{myPlayer.attackPower}</span>
                <span className="text-sm text-gray-400">감염: {myPlayer.infectCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="absolute top-14 left-0 right-80 bottom-36 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {currentView === 'quiz' && (
            <motion.div key="quiz" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              <QuizView question={currentQuestion} onAnswer={handleAnswerSubmit} onCorrectClick={() => setCurrentView('actionSelect')} timeLimit={GAME_CONSTANTS.ROUND_DURATION} />
            </motion.div>
          )}

          {currentView === 'actionSelect' && (
            <motion.div key="actionSelect" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full max-w-2xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90 backdrop-blur-sm`}>
                <CardContent className="p-8 text-center">
                  <h2 className={`text-3xl font-bold ${accentColor} mb-6`}>
                    ✅ 정답! 행동을 선택하세요
                  </h2>

                  {isZombie ? (
                    /* Zombie actions */
                    <div className="grid grid-cols-1 gap-4">
                      <Button onClick={() => { setCurrentView('targetSelect') }} size="lg" className="h-24 bg-gradient-to-br from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white font-bold text-xl">
                        <div className="flex flex-col items-center gap-2">
                          <Skull className="h-8 w-8" />
                          <span>🧟 인간 공격하기</span>
                          <span className="text-sm opacity-80">공격력: {myPlayer?.attackPower}</span>
                        </div>
                      </Button>
                    </div>
                  ) : (
                    /* Human actions */
                    <div className="grid grid-cols-3 gap-4">
                      <Button onClick={() => handleHumanAction('heal')} size="lg" className="h-28 bg-gradient-to-br from-emerald-700 to-emerald-600 hover:from-emerald-800 hover:to-emerald-700 text-white font-bold text-lg">
                        <div className="flex flex-col items-center gap-2">
                          <Stethoscope className="h-7 w-7" />
                          <span>💚 치료</span>
                          <span className="text-xs opacity-80">HP +{GAME_CONSTANTS.HUMAN_HEAL_AMOUNT}</span>
                        </div>
                      </Button>
                      <Button onClick={() => handleHumanAction('shield')} size="lg" className="h-28 bg-gradient-to-br from-cyan-700 to-cyan-600 hover:from-cyan-800 hover:to-cyan-700 text-white font-bold text-lg">
                        <div className="flex flex-col items-center gap-2">
                          <Shield className="h-7 w-7" />
                          <span>🛡️ 방어막</span>
                          <span className="text-xs opacity-80">+{GAME_CONSTANTS.HUMAN_SHIELD_AMOUNT}</span>
                        </div>
                      </Button>
                      <Button onClick={handleScanSelect} disabled={scanCooldown > 0} size="lg" className="h-28 bg-gradient-to-br from-purple-700 to-purple-600 hover:from-purple-800 hover:to-purple-700 text-white font-bold text-lg disabled:opacity-40">
                        <div className="flex flex-col items-center gap-2">
                          <Search className="h-7 w-7" />
                          <span>🔍 스캔</span>
                          <span className="text-xs opacity-80">{scanCooldown > 0 ? `쿨다운 ${scanCooldown}R` : '역할 확인'}</span>
                        </div>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'targetSelect' && (
            <motion.div key="targetSelect" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-3xl px-4">
              <Card className={`border-4 ${borderColor} bg-black/90 backdrop-blur-sm`}>
                <CardContent className="p-6">
                  <h2 className={`text-3xl font-bold ${accentColor} mb-4 text-center`}>
                    {isZombie ? '🧟 공격할 대상 선택' : '🔍 스캔할 대상 선택'}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto">
                    {otherPlayers.filter(p => isZombie ? (p.role === 'human') : true).map(p => (
                      <Button
                        key={p.id}
                        onClick={() => handleTargetSelect(p.id, isZombie ? 'attack' : 'scan')}
                        size="lg"
                        className="h-20 bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg justify-start px-4"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <span className="text-2xl">👤</span>
                          <div className="text-left flex-1">
                            <div className="truncate">{p.name}</div>
                            {!isZombie && <div className="text-xs text-gray-400">정체불명</div>}
                            {isZombie && <div className="text-xs text-red-300">HP: {p.health} {p.shield > 0 ? `🛡️${p.shield}` : ''}</div>}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                  <Button onClick={() => setCurrentView('actionSelect')} variant="outline" className="w-full mt-4 border-gray-600 text-gray-300">
                    ← 돌아가기
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentView === 'scanResult' && lastScanResult && (
            <motion.div key="scanResult" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <div className="text-8xl mb-4">{lastScanResult.isZombie ? '🧟' : '✅'}</div>
              </motion.div>
              <p className={`text-4xl font-bold ${lastScanResult.isZombie ? 'text-red-400' : 'text-green-400'}`}>
                {lastScanResult.isZombie ? '좀비 발견!' : '인간 확인!'}
              </p>
              <p className="text-xl text-gray-300 mt-2">
                {players.find(p => p.id === lastScanResult.playerId)?.name}
              </p>
            </motion.div>
          )}

          {currentView === 'attackResult' && lastAttackResult && (
            <motion.div key="attackResult" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} className="text-center">
              <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.3, repeat: 3 }}>
                <div className="text-8xl mb-4">{lastAttackResult.infected ? '🧟' : '⚔️'}</div>
              </motion.div>
              <p className={`text-4xl font-bold ${lastAttackResult.infected ? 'text-green-400' : 'text-red-400'}`}>
                {lastAttackResult.infected ? '감염 성공!' : `${lastAttackResult.damage} 데미지!`}
              </p>
              <p className="text-xl text-gray-300 mt-2">
                {players.find(p => p.id === lastAttackResult.targetId)?.name}
              </p>
            </motion.div>
          )}

          {currentView === 'wrong' && (
            <motion.div key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <div className="text-7xl mb-4">❌</div>
              <p className="text-4xl font-bold text-red-400">틀렸습니다!</p>
              {myPlayer?.role === 'human' && (
                <p className="text-xl text-gray-400 mt-2">체력 -{GAME_CONSTANTS.WRONG_PENALTY_HUMAN}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right sidebar - Player list */}
      <div className={`absolute top-14 right-0 w-80 bottom-36 p-4 border-l-2 ${borderColor} bg-black/50 overflow-y-auto`}>
        <h2 className={`text-xl font-bold ${accentColor} mb-3 flex items-center gap-2`}>
          👥 플레이어 ({humanCount}🧑 / {zombieCount}🧟)
        </h2>
        <div className="space-y-2">
          {/* My player first */}
          {myPlayer && (
            <Card className={`border-2 ${isZombie ? 'border-green-500 bg-green-950/40' : 'border-blue-500 bg-blue-950/40'}`}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isZombie ? '🧟' : '🧑'}</span>
                    <span className="font-bold text-white text-sm">{myPlayer.name} (나)</span>
                  </div>
                  {!isZombie ? (
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3 text-red-500" />
                      <span className="text-red-400 text-sm font-bold">{myPlayer.health}</span>
                      {myPlayer.shield > 0 && <>
                        <Shield className="h-3 w-3 text-cyan-400 ml-1" />
                        <span className="text-cyan-400 text-sm font-bold">{myPlayer.shield}</span>
                      </>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Sword className="h-3 w-3 text-red-500" />
                      <span className="text-red-400 text-sm font-bold">{myPlayer.attackPower}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* Other players - role hidden */}
          {otherPlayers.map(p => (
            <Card key={p.id} className={`border ${p.role === 'zombie' && isZombie ? 'border-green-700/50 bg-green-950/20' : 'border-gray-700 bg-gray-800/30'}`}>
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{isZombie ? (p.role === 'zombie' ? '🧟' : '👤') : '👤'}</span>
                    <span className="text-white text-xs truncate max-w-[120px]">{p.name}</span>
                  </div>
                  {isZombie ? (
                    <span className="text-xs text-gray-400">
                      {p.role === 'human' ? `HP:${p.health}` : '🧟'}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">???</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom log */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-sm border-t-2 ${borderColor} shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <h3 className={`text-sm font-bold ${accentColor} mb-1 flex items-center gap-2`}>
            📡 생존 로그
          </h3>
          <div className="h-24 overflow-y-auto bg-black/50 rounded-lg p-2 font-mono text-xs space-y-0.5">
            {gameLog.slice(-20).map(log => (
              <div key={log.id} className={`${log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : log.type === 'danger' ? 'text-red-400' : log.type === 'infection' ? 'text-purple-400' : 'text-gray-300'}`}>
                [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Random Event Overlay */}
      <AnimatePresence>
        {currentEvent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-black/60" />
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5 }} className="relative bg-gray-900 border-4 border-yellow-500 rounded-2xl p-8 max-w-lg text-center shadow-2xl">
              <div className="text-6xl mb-4">⚡</div>
              <p className="text-2xl font-bold text-yellow-400">{currentEvent.description}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
