'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import QuizView from '@/components/QuizView'
import SchoolRacingTrack from '@/components/SchoolRacingTrack'
import ItemCard from '@/components/ItemCard'
import ItemEffectOverlay from '@/components/ItemEffectOverlay'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import {
  generateSchoolRacingItem,
  calculateMoveDistance,
  applySchoolItemEffect,
  type SchoolRacingItem,
  type SchoolRacingItemType,
  type SchoolItemEffect,
  TRACK_LENGTH,
} from '@/lib/game/schoolRacing'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  position?: number
}

// 더미 문제 데이터
type Question = {
  id: string
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}


type RacingView = 'lobby' | 'countdown' | 'quiz' | 'item' | 'wrong' | 'result'

export default function RacingPage() {
  const [roomCode, setRoomCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<RacingView>('lobby')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [answerTime, setAnswerTime] = useState(0)
  const [acquiredItem, setAcquiredItem] = useState<SchoolRacingItem | null>(null)
  const [activeItems, setActiveItems] = useState<SchoolRacingItem[]>([])
  const [showCountdown, setShowCountdown] = useState(false)
  const [activeEffect, setActiveEffect] = useState<{ type: SchoolRacingItemType; fromPlayer?: string } | null>(null)
  const [isStunned, setIsStunned] = useState(false) // 기절 효과
  const [isBlinded, setIsBlinded] = useState(false) // 화면 가리기 효과
  const [isMinified, setIsMinified] = useState(false) // 화면 축소 효과
  const [isFrozen, setIsFrozen] = useState(false) // 얼리기 효과
  const [hasShield, setHasShield] = useState(false) // 방패 효과
  const [spicyPepperCount, setSpicyPepperCount] = useState(0) // 매운 고추 남은 횟수
  const [previousRank, setPreviousRank] = useState<number>(0)
  const [rankChange, setRankChange] = useState<{ type: 'up' | 'down' | null; value: number }>({ type: null, value: 0 })
  const [speedBoostActive, setSpeedBoostActive] = useState(false)
  const [showRankChange, setShowRankChange] = useState(false)
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0) // 연속 정답 카운트
  const [showReversal, setShowReversal] = useState(false) // 역전 효과
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0) // 정답 횟수 (아이템 획득용)

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

    // racing이 아니면 올바른 페이지로 리다이렉트
    if (gameMode !== 'racing') {
      const gameUrl = gameMode === 'gold_quest'
        ? `/game?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'battle_royale'
          ? `/battle?room=${roomCode}&playerId=${playerId}`
          : gameMode === 'fishing'
            ? `/fishing?room=${roomCode}&playerId=${playerId}`
            : gameMode === 'factory'
              ? `/factory?room=${roomCode}&playerId=${playerId}`
              : gameMode === 'cafe'
                ? `/cafe?room=${roomCode}&playerId=${playerId}`
                : gameMode === 'mafia'
                  ? `/mafia?room=${roomCode}&playerId=${playerId}`
                  : gameMode === 'pool'
                    ? `/pool?room=${roomCode}&playerId=${playerId}`
                    : `/racing?room=${roomCode}&playerId=${playerId}`

      if (gameUrl !== window.location.pathname + window.location.search) {
        window.location.href = gameUrl
      }
    }
  }, [room, roomLoading, roomCode, playerId])

  // 문제 데이터 가져오기
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    if (!room?.set_id) return

    const fetchQuestions = async () => {
      try {
        const { data, error } = await ((supabase
          .from('questions') as any)
          .select('*')
          .eq('set_id', room.set_id) as any)

        if (error) throw error

        setQuestions(data as Question[])
      } catch (error) {
        console.error('Error fetching questions:', error)
      }
    }

    fetchQuestions()
  }, [room?.set_id])

  // 현재 플레이어 정보
  const currentPlayer = players.find((p) => p.id === playerId) as Player | undefined
  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex % questions.length] : null

  // 순위 계산
  const sortedPlayers = [...players].sort((a, b) => (b.position || 0) - (a.position || 0))

  // 현재 플레이어 순위 계산
  const currentRank = sortedPlayers.findIndex(p => p.id === playerId) + 1

  // 순위 변동 감지
  useEffect(() => {
    if (previousRank > 0 && currentRank > 0 && previousRank !== currentRank) {
      const change = previousRank - currentRank
      if (change > 0) {
        // 순위 상승 - 역전 효과!
        setRankChange({ type: 'up', value: change })
        setShowRankChange(true)
        setShowReversal(true)
        playSFX('correct')
      } else if (change < 0) {
        // 순위 하락
        setRankChange({ type: 'down', value: Math.abs(change) })
        setShowRankChange(true)
        setTimeout(() => {
          setShowRankChange(false)
        }, 2000)
      }
    }
    setPreviousRank(currentRank)
  }, [currentRank, previousRank, playSFX])

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
      }, 4000) // 3초 카운트다운 + 1초 여유
      return () => clearTimeout(timer)
    }
  }, [showCountdown])

  // 정답 후 다음 퀴즈로 (아이템 없을 때 클릭 시 즉시 이동)
  const goToNextQuiz = () => {
    setCurrentView('quiz')
    setCurrentQuestionIndex((prev) => prev + 1)
    setSelectedAnswer('')
    setIsCorrect(false)
    questionStartTime.current = Date.now()
  }

  // 정답 제출
  const handleAnswerSubmit = async (answer: string) => {
    if (!currentPlayer || !roomCode || !currentQuestion) return

    const timeElapsed = (Date.now() - questionStartTime.current) / 1000
    setAnswerTime(timeElapsed)
    setSelectedAnswer(answer)

    const normalizedAnswer = String(answer).trim()
    const normalizedCorrect = String(currentQuestion.answer).trim()
    const correct = normalizedAnswer === normalizedCorrect
    setIsCorrect(correct)

    if (correct) {
      playSFX('correct')

      // 연속 정답 카운트 증가
      const newConsecutive = consecutiveCorrect + 1
      setConsecutiveCorrect(newConsecutive)

      // 이동 거리 계산 (연속 정답 보너스 포함)
      let baseDistance = calculateMoveDistance(timeElapsed, 30, newConsecutive)

      // 매운 고추 효과: 2배 가치
      const spicyPepperActive = activeItems.find(item => item.type === 'SPICY_PEPPER')
      if (spicyPepperActive && spicyPepperCount > 0) {
        baseDistance *= 2
        const newCount = spicyPepperCount - 1
        setSpicyPepperCount(newCount)
        if (newCount === 0) {
          setActiveItems(prev => prev.filter(i => i.type !== 'SPICY_PEPPER'))
        }
      }

      // 아이템 효과 적용
      let finalDistance = baseDistance

      // 위치 업데이트
      const newPosition = (currentPlayer.position || 0) + finalDistance
      const newScore = (currentPlayer.score || 0) + finalDistance

      try {
        await ((supabase
          .from('players') as any)
          .update({
            position: newPosition,
            score: newScore,
          })
          .eq('id', playerId))

        // Blooket Racing: 4문제마다 2개 파워업 획득
        const newCorrectCount = correctAnswersCount + 1
        setCorrectAnswersCount(newCorrectCount)

        // 4문제마다 아이템 획득
        if (newCorrectCount % 4 === 0) {
          // 아이템 획득 사운드 및 효과
          playSFX('item')

          // 아이템 생성 및 화면 전환
          const item1 = generateSchoolRacingItem()
          setAcquiredItem(item1)
          setCurrentView('item')
          // 아이템 화면은 useEffect에서 5초 후 자동으로 다음 문제로 넘어감
        } else {
          // 아이템 없으면 1초 후 자동 또는 정답 클릭 시 즉시
          setTimeout(goToNextQuiz, 1000)
        }
      } catch (error) {
        console.error('Error updating position:', error)
      }
    } else {
      playSFX('incorrect')
      // 오답 시 연속 정답 카운트 리셋
      setConsecutiveCorrect(0)

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

  // 아이템 사용
  const handleUseItem = async (item: SchoolRacingItem) => {
    if (!currentPlayer || !roomCode) return

    playSFX('click')

    // 방패가 있으면 해로운 파워업 차단
    if (hasShield && (item.type === 'WHOOSH' || item.type === 'ROCKET_ATTACK' ||
      item.type === 'BUSY_BEES' || item.type === 'FREEZE' || item.type === 'MINIFY' ||
      item.type === 'BLOOK_FIESTA')) {
      setHasShield(false)
      setActiveEffect({ type: 'MIGHTY_SHIELD', fromPlayer: currentPlayer.nickname })
      setTimeout(() => setActiveEffect(null), 2000)

      // 아이템 사용 완료
      setAcquiredItem(null)
      setCurrentView('quiz')
      setSelectedAnswer('')
      setIsCorrect(false)
      setCurrentQuestionIndex((prev) => prev + 1)
      questionStartTime.current = Date.now()
      return
    }

    // 아이템 효과 적용
    const effect = applySchoolItemEffect(
      item,
      playerId!,
      players.map(p => ({ id: p.id, position: p.position || 0 })),
      currentPlayer.position || 0
    )

    // 아이템 효과에 따라 처리
    if ((effect.type === 'ENERGY_BOOST' || effect.type === 'SODA_BLAST') && effect.value !== undefined) {
      // 즉시 이동
      try {
        await ((supabase
          .from('players') as any)
          .update({
            position: Math.min(TRACK_LENGTH, (currentPlayer.position || 0) + effect.value),
            score: (currentPlayer.score || 0) + effect.value
          })
          .eq('id', playerId))
        setSpeedBoostActive(true)
        setTimeout(() => setSpeedBoostActive(false), 2000)
      } catch (error) {
        console.error('Error using item:', error)
      }
    } else if (effect.type === 'SPICY_PEPPER' && effect.duration) {
      // 매운 고추: 다음 3문제 2배 가치
      setSpicyPepperCount(effect.duration)
      setActiveItems(prev => [...prev, item])
    } else if (effect.type === 'MIGHTY_SHIELD') {
      // 강력한 방패: 다음 해로운 파워업 차단
      setHasShield(true)
      setActiveItems(prev => [...prev, item])
    } else if ((effect.type === 'WHOOSH' || effect.type === 'ROCKET_ATTACK' || effect.type === 'BUSY_BEES')
      && effect.targetPlayerId && effect.value !== undefined) {
      // 뒤로 밀기 효과
      try {
        const targetPlayer = players.find(p => p.id === effect.targetPlayerId)
        if (targetPlayer) {
          await ((supabase
            .from('players') as any)
            .update({
              position: Math.max(0, (targetPlayer.position || 0) + effect.value),
            })
            .eq('id', effect.targetPlayerId))

          // 타겟 플레이어가 나인 경우
          if (effect.targetPlayerId === playerId) {
            setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
            setTimeout(() => setActiveEffect(null), 2000)
          }
        }
      } catch (error) {
        console.error('Error applying push effect:', error)
      }
    } else if (effect.type === 'FREEZE' && effect.targetPlayerId && effect.duration) {
      // 얼리기: 타겟 플레이어가 나인 경우
      if (effect.targetPlayerId === playerId) {
        setIsFrozen(true)
        setTimeout(() => setIsFrozen(false), effect.duration * 1000)
      }
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => setActiveEffect(null), effect.duration * 1000)
    } else if (effect.type === 'MINIFY' && effect.affectsAll) {
      // 화면 축소: 모든 플레이어
      setIsMinified(true)
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => {
        setIsMinified(false)
        setActiveEffect(null)
      }, (effect.duration || 5) * 1000)
    } else if (effect.type === 'BLOOK_FIESTA' && effect.affectsAll) {
      // 블록 피에스타: 모든 플레이어 화면에 블록 표시
      setIsBlinded(true)
      setActiveEffect({ type: effect.type, fromPlayer: currentPlayer.nickname })
      setTimeout(() => {
        setIsBlinded(false)
        setActiveEffect(null)
      }, (effect.duration || 5) * 1000)
    }

    // 아이템 사용 완료
    setAcquiredItem(null)
    setCurrentView('quiz')
    setSelectedAnswer('')
    setIsCorrect(false)
    setCurrentQuestionIndex((prev) => prev + 1)
    questionStartTime.current = Date.now()
  }

  // 아이템 건너뛰기
  const handleSkipItem = useCallback(() => {
    setAcquiredItem(null)
    setCurrentView('quiz')
    setSelectedAnswer('')
    setIsCorrect(false)
    setCurrentQuestionIndex((prev) => prev + 1)
    questionStartTime.current = Date.now()
  }, [])

  // 아이템 화면에서 자동으로 다음 문제로 넘어가기 (5초 후)
  useEffect(() => {
    if (currentView === 'item' && acquiredItem) {
      const timer = setTimeout(() => {
        handleSkipItem()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [currentView, acquiredItem, handleSkipItem])

  // 게임 종료 체크 (첫 번째 플레이어가 결승선 통과 시)
  useEffect(() => {
    if (!room || room.status === 'finished') return

    // 모든 플레이어 중 가장 앞선 플레이어 확인
    const sortedPlayers = [...players].sort((a, b) => (b.position || 0) - (a.position || 0))
    const topPlayer = sortedPlayers[0]

    if (topPlayer && (topPlayer.position || 0) >= TRACK_LENGTH) {
      // 첫 번째 플레이어가 결승선 통과 시 게임 종료
      ; (async () => {
        try {
          await ((supabase
            .from('rooms') as any)
            .update({ status: 'finished' })
            .eq('room_code', roomCode) as any)
        } catch (error) {
          console.error('Error finishing game:', error)
        }
      })()
    }
  }, [players, room, roomCode])

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
    <main className="min-h-screen bg-gray-50 relative overflow-hidden">
      <AnimatedBackground />
      {activeEffect && (
        <ItemEffectOverlay
          effectType={activeEffect.type}
          fromPlayer={activeEffect.fromPlayer}
        />
      )}
      {isBlinded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-orange-900/80 backdrop-blur-sm z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="text-6xl"
          >
            {activeEffect?.type === 'BLOOK_FIESTA' ? '🎉' : '🚧'}
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-20 text-2xl font-bold text-white"
          >
            {activeEffect?.type === 'BLOOK_FIESTA'
              ? '블록 피에스타로 화면이 가려졌습니다!'
              : '공사중 표지판으로 화면이 가려졌습니다!'}
          </motion.div>
        </motion.div>
      )}
      {isMinified && (
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: 0.7 }}
          exit={{ scale: 1 }}
          className="fixed inset-0 z-40 pointer-events-none"
        />
      )}
      {isStunned && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-red-900/50 backdrop-blur-sm z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1], rotate: [0, 360] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-8xl"
          >
            ⏰
          </motion.div>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-20 text-2xl font-bold text-white"
          >
            자명종 소리가 너무 시끄러워서 문제를 못 풀겠어요!
          </motion.div>
        </motion.div>
      )}
      {showReversal && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 2, 1.5], opacity: [0, 1, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            className="text-9xl font-black text-yellow-400 drop-shadow-2xl"
            style={{ textShadow: '0 0 20px rgba(255, 215, 0, 0.8)' }}
          >
            역전!!
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-10 p-4">
        {/* 헤더 - 게임스러운 디자인 */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded-xl p-4 shadow-2xl border-4 border-yellow-500 relative overflow-hidden">
            {/* 배경 패턴 */}
            <div className="absolute inset-0 opacity-10">
              <div className="h-full w-full" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
              }} />
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">
                  🏃
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    미션: 등교 임파서블
                  </h1>
                  <p className="text-xs text-yellow-300 font-semibold">방 코드: {roomCode} | 8:59 AM - 교문 닫히는 중!</p>
                </div>
              </div>

              {/* 플레이어 정보 - 게이지 스타일 */}
              <div className="flex items-center gap-4">
                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-yellow-500">
                  <div className="text-sm text-yellow-300 font-semibold mb-1">
                    {currentPlayer?.nickname || '플레이어'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-300">위치:</span>
                    <span className="text-lg font-bold text-white">
                      {Math.floor(currentPlayer?.position || 0)}m / {TRACK_LENGTH}m
                    </span>
                  </div>
                </div>

                {/* 순위 표시 - 드라마틱한 디자인 */}
                <motion.div
                  animate={showRankChange ? {
                    scale: [1, 1.3, 1],
                    rotate: rankChange.type === 'up' ? [0, -10, 10, 0] : [0, 10, -10, 0]
                  } : {}}
                  transition={{ duration: 0.5 }}
                  className={`bg-black/50 rounded-lg px-4 py-2 border-2 ${rankChange.type === 'up' ? 'border-green-500 shadow-lg shadow-green-500/50' :
                    rankChange.type === 'down' ? 'border-red-500 shadow-lg shadow-red-500/50' :
                      'border-blue-500'
                    }`}
                >
                  <div className="text-xs text-blue-300 font-semibold mb-1">순위</div>
                  <div className="flex items-center gap-2">
                    <motion.div
                      key={currentRank}
                      initial={{ scale: 0.5, y: -20 }}
                      animate={{ scale: 1, y: 0 }}
                      className={`text-2xl font-bold ${rankChange.type === 'up' ? 'text-green-400' :
                        rankChange.type === 'down' ? 'text-red-400' :
                          'text-white'
                        }`}
                    >
                      #{currentRank || '-'}
                    </motion.div>
                    {showRankChange && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className={`text-lg font-bold ${rankChange.type === 'up' ? 'text-green-400' : 'text-red-400'
                          }`}
                      >
                        {rankChange.type === 'up' ? `↑${rankChange.value}` : `↓${rankChange.value}`}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* 연속 정답 표시 */}
                {consecutiveCorrect >= 3 && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-yellow-500">
                    <div className="text-xs text-yellow-300 font-semibold mb-1">연속 정답</div>
                    <div className="flex items-center gap-1">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="text-lg font-bold text-yellow-300"
                      >
                        🔥
                      </motion.div>
                      <div className="text-lg font-bold text-white">
                        {consecutiveCorrect}연속!
                      </div>
                    </div>
                  </div>
                )}

                {/* 매운 고추 효과 표시 */}
                {spicyPepperCount > 0 && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-red-500">
                    <div className="text-xs text-red-300 font-semibold mb-1">매운 고추</div>
                    <div className="flex items-center gap-1">
                      <span className="text-lg">🌶️</span>
                      <div className="text-lg font-bold text-white">
                        {spicyPepperCount}문제 남음 (2배)
                      </div>
                    </div>
                  </div>
                )}

                {/* 방패 효과 표시 */}
                {hasShield && (
                  <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-yellow-500">
                    <div className="text-xs text-yellow-300 font-semibold mb-1">방패</div>
                    <div className="flex items-center gap-1">
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-lg"
                      >
                        🛡️
                      </motion.div>
                      <div className="text-lg font-bold text-white">
                        보호 중
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="max-w-6xl mx-auto">
          {/* 카운트다운 */}
          {showCountdown && (
            <Countdown onComplete={() => { }} />
          )}

          {/* 로비 */}
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl p-8 shadow-lg text-center"
            >
              <h2 className="text-3xl font-bold mb-4">🏃 등교 준비 중...</h2>
              <p className="text-gray-600">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <p className="text-sm text-gray-500 mt-2">8:59 AM까지 교문이 닫힙니다!</p>
            </motion.div>
          )}

          {/* 순위 변동 알림 */}
          {showRankChange && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.5 }}
              className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 ${rankChange.type === 'up'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-red-500 to-rose-600'
                } text-white px-8 py-4 rounded-xl shadow-2xl border-4 border-white/50`}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 0.5 }}
                  className="text-4xl"
                >
                  {rankChange.type === 'up' ? '🚀' : '😢'}
                </motion.div>
                <div>
                  <div className="text-2xl font-bold">
                    {rankChange.type === 'up'
                      ? `역전!! ${rankChange.value}단계 상승!`
                      : `순위 ${rankChange.value}단계 하락...`}
                  </div>
                  <div className="text-sm opacity-90">
                    현재 순위: #{currentRank}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 퀴즈 */}
          {currentView === 'quiz' && !showCountdown && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 기절/얼리기 상태일 때 퀴즈 비활성화 */}
              {(isStunned || isFrozen) ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-900 rounded-xl p-8 shadow-lg text-center border-4 border-red-500"
                >
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="text-6xl mb-4"
                  >
                    {isFrozen ? '❄️' : '⏰'}
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    {isFrozen ? '얼어붙었다!' : '기절했다!'}
                  </h2>
                  <p className="text-red-200">
                    {isFrozen ? '7초간 문제를 못 풀겠어요...' : '너무 시끄러워서 문제를 못 풀겠어요...'}
                  </p>
                </motion.div>
              ) : currentQuestion ? (
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={goToNextQuiz}
                  timeLimit={30}
                />
              ) : (
                <div className="text-center p-8 bg-white/80 rounded-xl">
                  <p>문제를 불러오는 중이거나 문제가 없습니다.</p>
                </div>
              )}

              {/* 레이스 트랙 */}
              <div className="bg-gradient-to-br from-blue-100 to-green-100 rounded-2xl p-4 shadow-2xl border-4 border-gray-800">
                <SchoolRacingTrack
                  players={players as Player[]}
                  currentPlayerId={playerId}
                  trackLength={TRACK_LENGTH}
                />
              </div>

              {/* 활성 아이템 표시 - 게임스러운 디자인 */}
              {activeItems.length > 0 && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 rounded-xl p-4 shadow-2xl border-4 border-purple-400"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <h3 className="text-sm font-bold text-white">활성 아이템:</h3>
                    <div className="flex gap-3">
                      {activeItems.map((item, index) => (
                        <motion.div
                          key={index}
                          animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                          className="text-3xl cursor-pointer"
                          title={item.name}
                        >
                          {item.icon}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* 아이템 획득 - 더 게임스러운 디자인 */}
          {currentView === 'item' && acquiredItem && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="relative"
            >
              {/* 배경 효과 */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 rounded-2xl blur-3xl -z-10"
              />

              <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl border-4 border-yellow-500 relative overflow-hidden">
                {/* 배경 패턴 */}
                <div className="absolute inset-0 opacity-10">
                  <div className="h-full w-full" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px)'
                  }} />
                </div>

                <div className="relative z-10">
                  <motion.h2
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-4xl font-bold text-center mb-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 bg-clip-text text-transparent"
                  >
                    🎁 아이템 획득! 🎁
                  </motion.h2>

                  <div className="flex justify-center mb-8">
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <ItemCard item={acquiredItem} />
                    </motion.div>
                  </div>

                  <div className="flex gap-4 justify-center">
                    <motion.button
                      whileHover={{ scale: 1.1, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleUseItem(acquiredItem)}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-2xl hover:shadow-green-500/50 transition-all border-2 border-white/50 relative overflow-hidden"
                    >
                      <motion.div
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      />
                      <span className="relative z-10">⚡ 사용하기</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSkipItem}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-10 py-4 rounded-xl font-bold text-lg shadow-xl transition-all border-2 border-white/30"
                    >
                      건너뛰기
                    </motion.button>
                  </div>

                  {/* 자동 진행 카운트다운 */}
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    className="mt-6 h-2 bg-yellow-500/30 rounded-full overflow-hidden"
                  >
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500" />
                  </motion.div>
                  <p className="text-center text-gray-400 text-sm mt-2">5초 후 자동으로 다음 문제로 진행됩니다</p>
                </div>
              </div>
            </motion.div>
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
            />
          )}
        </div>
      </div>
    </main>
  )
}
