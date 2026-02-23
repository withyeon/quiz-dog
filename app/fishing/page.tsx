'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase/client'
import { usePlayersRealtime } from '@/hooks/usePlayersRealtime'
import { useRoomRealtime } from '@/hooks/useRoomRealtime'
import { useAudioContext } from '@/components/AudioProvider'
import QuizView from '@/components/QuizView'
import GameResult from '@/components/GameResult'
import { History, Zap } from 'lucide-react'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import {
  tryFishing,
  trySpecialItem,
  checkFrenzyEvent,
  type Doll,
  type FishingState,
  type MachineRank,
  type SpecialItem,
  type SpecialItemType,
  getTierColor,
  getTierName,
  calculateTotalPoints,
  getMachineRank,
  getMachineRankName,
} from '@/lib/game/fishing'
import FishingMachine from '@/components/FishingMachine'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row'] & {
  caught_dolls?: Doll[]
  claw_points?: number
}

type Question = {
  id: string
  type: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer: string
}

type FishingView = 'lobby' | 'countdown' | 'quiz' | 'claw' | 'wrong' | 'result'

export default function FishingPage() {
  const [roomCode, setRoomCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<FishingView>('lobby')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [isCorrect, setIsCorrect] = useState(false)
  const [fishingState, setFishingState] = useState<FishingState>('idle')
  const [caughtItem, setCaughtItem] = useState<Doll | null>(null)
  const [fishingResult, setFishingResult] = useState<{
    success: boolean
    doll: Doll | null
    points: number
    message: string
    willFail: boolean
  } | null>(null)
  const [caughtDolls, setCaughtDolls] = useState<Doll[]>([])
  const [showCountdown, setShowCountdown] = useState(false)
  const [correctAnswers, setCorrectAnswers] = useState(0) // 맞춘 문제 수
  const [isFrenzyEvent, setIsFrenzyEvent] = useState(false) // 대성공 이벤트
  const [frenzyTimeLeft, setFrenzyTimeLeft] = useState(0) // 이벤트 남은 시간
  const [savedAnswerTime, setSavedAnswerTime] = useState<number>(30) // 저장된 정답 시간
  const [isClawReady, setIsClawReady] = useState(false) // 인형뽑기 준비 상태
  const [questions, setQuestions] = useState<Question[]>([])
  // 아이템 관련 state
  const [activeItems, setActiveItems] = useState<SpecialItemType[]>([])  // 현재 적용중인 아이템 효과
  const [pendingItem, setPendingItem] = useState<SpecialItem | null>(null) // 방금 뽑은 아이템 (모달용)
  const [showItemModal, setShowItemModal] = useState(false)

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

    // fishing이 아니면 올바른 페이지로 리다이렉트
    if (gameMode !== 'fishing') {
      const gameUrl = gameMode === 'gold_quest'
        ? `/game?room=${roomCode}&playerId=${playerId}`
        : gameMode === 'racing'
          ? `/racing?room=${roomCode}&playerId=${playerId}`
          : gameMode === 'battle_royale'
            ? `/battle?room=${roomCode}&playerId=${playerId}`
            : gameMode === 'factory'
              ? `/factory?room=${roomCode}&playerId=${playerId}`
              : gameMode === 'cafe'
                ? `/cafe?room=${roomCode}&playerId=${playerId}`
                : gameMode === 'mafia'
                  ? `/mafia?room=${roomCode}&playerId=${playerId}`
                  : gameMode === 'pool'
                    ? `/pool?room=${roomCode}&playerId=${playerId}`
                    : `/fishing?room=${roomCode}&playerId=${playerId}`

      if (gameUrl !== window.location.pathname + window.location.search) {
        window.location.href = gameUrl
      }
    }
  }, [room, roomLoading, roomCode, playerId])

  // 현재 플레이어 정보
  const currentPlayer = players.find((p) => p.id === playerId) as Player | undefined

  // 문제 데이터 가져오기
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

  const currentQuestion = questions.length > 0 ? questions[currentQuestionIndex % questions.length] : null
  const machineRank: MachineRank = getMachineRank(correctAnswers)

  // 저장된 인형 불러오기
  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.caught_dolls) {
        setCaughtDolls(currentPlayer.caught_dolls as Doll[])
      }
      // 맞춘 문제 수 계산 (인형 개수로 추정)
      if (currentPlayer.caught_dolls) {
        setCorrectAnswers((currentPlayer.caught_dolls as Doll[]).length)
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

  // 대성공 이벤트 타이머
  useEffect(() => {
    if (isFrenzyEvent && frenzyTimeLeft > 0) {
      const timer = setInterval(() => {
        setFrenzyTimeLeft((prev) => {
          if (prev <= 1) {
            setIsFrenzyEvent(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [isFrenzyEvent, frenzyTimeLeft])

  // 정답 제출 (정답 시 바로 인형뽑기 실행)
  const handleAnswerSubmit = async (answer: string) => {
    if (!currentPlayer || !roomCode || !playerId || !currentQuestion) return

    setSelectedAnswer(answer)
    const normalizedAnswer = String(answer).trim()
    const normalizedCorrect = String(currentQuestion.answer).trim()
    const correct = normalizedAnswer === normalizedCorrect
    setIsCorrect(correct)

    if (correct) {
      playSFX('correct')

      // 정답 시간 계산 및 저장
      const answerTime = (Date.now() - questionStartTime.current) / 1000 // 초 단위
      setSavedAnswerTime(answerTime)

      // 대성공 이벤트 확인 (이벤트가 없을 때만)
      let frenzyActive = isFrenzyEvent
      if (!frenzyActive) {
        frenzyActive = checkFrenzyEvent()
        if (frenzyActive) {
          setIsFrenzyEvent(true)
          setFrenzyTimeLeft(10) // 10초간 지속
          playSFX('item') // 특별 효과음
        }
      }

      // 맞춘 문제 수 증가
      const newCorrectAnswers = correctAnswers + 1
      setCorrectAnswers(newCorrectAnswers)

      // 바로 인형뽑기 실행 - 아이템 먼저 체크
      const newMachineRank = getMachineRank(newCorrectAnswers)

      // 아이템 뽑기 시도 (약 8% 확률)
      const specialItem = trySpecialItem()
      if (specialItem) {
        // 즉시 효과 아이템 처리
        if (specialItem.type === 'COIN_RAIN') {
          // 즉시 점수 지급
          const bonus = specialItem.bonusPoints ?? 150
          try {
            const { data: pd } = await (supabase.from('players') as any).select('score').eq('id', playerId).single()
            await (supabase.from('players') as any).update({ score: (pd?.score || 0) + bonus }).eq('id', playerId)
          } catch (e) { console.error(e) }
        } else if (specialItem.type === 'EXTRA_PULL') {
          // 한 번 더는 나중에 처리 (아이템 모달 닫은 후)
        } else {
          // 버프 아이템: activeItems에 추가
          setActiveItems(prev => [...prev, specialItem.type])
        }
        setPendingItem(specialItem)
        setShowItemModal(true)
        playSFX('item')
        // 아이템 모달이 닫히면 인형뽑기 진행 (handleItemModalClose에서)
        return
      }

      // 아이템 없으면 바로 인형뽑기
      const isLuckyBoosted = activeItems.includes('LUCKY_BOOST')
      const result = tryFishing(answerTime, isLuckyBoosted ? Math.min(5, newMachineRank + 2) as MachineRank : newMachineRank, frenzyActive)
      const isDoubled = activeItems.includes('DOUBLE_SCORE')
      if (isDoubled && result.doll) {
        result.doll.score = result.doll.score * 2
        result.points = result.doll.score
        result.message = `${result.doll.name} 획득! 2배! (+${result.doll.score}점)`
        setActiveItems(prev => prev.filter(t => t !== 'DOUBLE_SCORE'))
      }
      if (isLuckyBoosted) setActiveItems(prev => prev.filter(t => t !== 'LUCKY_BOOST'))
      setFishingResult(result)
      setCaughtItem(result.doll)

      // 인형뽑기 화면으로 이동하고 애니메이션 시작
      setCurrentView('claw')
      setFishingState('down')
      setIsClawReady(false)
      runFishingSequence(result, newCorrectAnswers)
    } else {
      playSFX('incorrect')
      setCurrentView('wrong')
      setTimeout(() => {
        setCurrentView('quiz')
        setCurrentQuestionIndex((prev) => prev + 1)
        setSelectedAnswer('')
        setIsCorrect(false)
        questionStartTime.current = Date.now()
      }, 2000)
    }
  }

  // 정답 확인 후 클릭 시 인형뽑기로 이동
  const handleCorrectAnswerClick = () => {
    // 이미 handleAnswerSubmit에서 인형뽑기로 이동하므로
    // 이 함수는 QuizView의 onCorrectClick 요구사항을 충족하기 위한 것입니다
    // 추가 동작이 필요하면 여기에 작성할 수 있습니다
  }

  // 인형뽑기 화면에서 클릭 시 퀴즈로 이동 (또는 결과 카드 클릭 시 다음 문제로)
  const handleStartFishing = () => {
    if (fishingState !== 'idle') return

    playSFX('click')
    setCurrentView('quiz')
    setFishingState('idle')
    setIsClawReady(false)
    setFishingResult(null)
    setCaughtItem(null)
    questionStartTime.current = Date.now()
  }

  // 집게 애니메이션 시퀀스
  const runFishingSequence = async (
    result: typeof fishingResult,
    newCorrectAnswers: number
  ) => {
    if (!result || !playerId) return

    // 1. 내려가기
    setTimeout(() => {
      setFishingState('grab')

      setTimeout(() => {
        setFishingState('up')

        setTimeout(() => {
          setFishingState('return')

          // 성공: 배출구로 이동 후 놓기 (무조건 성공)
          setTimeout(() => {
            setFishingState('release')

            if (result.success && result.doll) {
              // 인형 획득
              const doll = result.doll
              const newDolls = [...caughtDolls, doll]
              setCaughtDolls(newDolls)
              const totalPoints = calculateTotalPoints(newDolls)

                // DB 업데이트
                ; (async () => {
                  try {
                    await ((supabase
                      .from('players') as any)
                      .update({
                        caught_dolls: newDolls,
                        claw_points: totalPoints,
                        score: totalPoints,
                      })
                      .eq('id', playerId))

                    playSFX('item')
                  } catch (error) {
                    console.error('Error updating doll data:', error)
                  }
                })()
            }

            // 결과 카드 표시 후 다음 문제로
            setTimeout(() => {
              setFishingState('idle')
              setCaughtItem(null)
              // 결과 카드는 유지하고, 클릭 시 다음 문제로
            }, 2000)
          }, 2000)
        }, 1500)
      }, 500)
    }, 1500)
  }

  // 아이템 모달 닫기 → 인형뽑기 진행
  const handleItemModalClose = () => {
    setShowItemModal(false)
    const item = pendingItem
    setPendingItem(null)

    if (!item) return

    if (item.type === 'EXTRA_PULL') {
      // 한 번 더: 바로 인형뽑기 추가 실행
      const isLucky = activeItems.includes('LUCKY_BOOST')
      const result = tryFishing(savedAnswerTime, isLucky ? Math.min(5, machineRank + 2) as MachineRank : machineRank, isFrenzyEvent)
      if (isLucky) setActiveItems(prev => prev.filter(t => t !== 'LUCKY_BOOST'))
      setFishingResult(result)
      setCaughtItem(result.doll)
      setCurrentView('claw')
      setFishingState('down')
      setIsClawReady(false)
      runFishingSequence(result, correctAnswers)
    } else {
      // 버프 아이템: 다음 문제로 (인형 뽑기는 다음 정답 시)
      setCurrentView('quiz')
      setCurrentQuestionIndex(prev => prev + 1)
      setSelectedAnswer('')
      setIsCorrect(false)
      questionStartTime.current = Date.now()
    }
  }

  // 결과 카드 클릭 시 다음 문제로
  const handleResultCardClick = () => {
    setFishingResult(null)
    setCurrentView('quiz')
    setCurrentQuestionIndex((prev) => prev + 1)
    setSelectedAnswer('')
    setIsCorrect(false)
    questionStartTime.current = Date.now()
  }

  // 게임 종료 확인
  useEffect(() => {
    if (currentQuestionIndex >= questions.length && questions.length > 0 && currentView === 'quiz') {
      if (room && room.status !== 'finished') {
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
    }
  }, [currentQuestionIndex, currentView, room, roomCode, questions.length])

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
    <main className={`min-h-screen bg-slate-900 relative overflow-hidden transition-colors duration-1000 ${isFrenzyEvent ? 'bg-gradient-to-b from-purple-900 via-pink-900 to-blue-900' : ''
      }`}>
      <AnimatedBackground />

      {/* 대성공 이벤트 오버레이 */}
      {isFrenzyEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 pointer-events-none z-20"
          style={{
            background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #f9ca24, #f0932b, #eb4d4b)',
            backgroundSize: '400% 400%',
            animation: 'gradient 3s ease infinite',
          }}
        />
      )}

      <div className="relative z-10 p-4" style={{ fontFamily: 'OkDanDan, sans-serif' }}>
        {/* 헤더 */}
        <div className="max-w-6xl mx-auto mb-4">
          <div className={`bg-slate-800 rounded-xl p-4 shadow-2xl border-b-4 transition-all duration-500 ${isFrenzyEvent ? 'border-yellow-500 shadow-yellow-500/50' : 'border-pink-500'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">
                  🕹️
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'OkDanDan, sans-serif' }}>두근두근 인형뽑기</h1>
                  <p className="text-sm text-blue-100">방 코드: {roomCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* 기계 업그레이드 표시 */}
                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-blue-500">
                  <div className="text-sm text-blue-300 font-semibold mb-1">기계 등급</div>
                  <div className="text-xl font-bold text-white">
                    {getMachineRankName(machineRank)}
                  </div>
                  <div className="text-sm text-gray-400">Rank {machineRank}</div>
                </div>

                {/* 대성공 이벤트 표시 */}
                {isFrenzyEvent && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="bg-gradient-to-r from-yellow-400 to-pink-500 rounded-lg px-4 py-2 border-2 border-yellow-300"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="text-white" size={20} />
                      <div>
                        <div className="text-sm font-semibold text-white">대성공!</div>
                        <div className="text-sm text-white">{frenzyTimeLeft}초</div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 활성 아이템 버프 표시 */}
                {activeItems.length > 0 && (
                  <div className="flex gap-1">
                    {activeItems.map((type, i) => {
                      const icons: Record<string, string> = {
                        DOUBLE_SCORE: '⚡',
                        LUCKY_BOOST: '⭐',
                        SHIELD: '🍀',
                      }
                      return (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="bg-indigo-600 border-2 border-indigo-300 rounded-lg px-2 py-1 text-xl"
                          title={type}
                        >
                          {icons[type] ?? '🎁'}
                        </motion.div>
                      )
                    })}
                  </div>
                )}

                <div className="bg-black/50 rounded-lg px-4 py-2 border-2 border-pink-500">
                  <div className="text-base text-pink-300 font-semibold mb-1">
                    {currentPlayer?.nickname || '플레이어'}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {calculateTotalPoints(caughtDolls).toLocaleString()} 점
                  </div>
                </div>
                <div className="bg-black/50 rounded-lg px-3 py-2 border-2 border-green-500">
                  <div className="text-sm text-green-300 font-semibold mb-1">인형</div>
                  <div className="text-xl font-bold text-white">
                    {caughtDolls.length}
                  </div>
                </div>
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
              className="bg-slate-800 rounded-xl p-8 shadow-lg text-center border-4 border-pink-500"
            >
              <h2 className="text-4xl font-bold mb-4 text-white" style={{ fontFamily: 'OkDanDan, sans-serif' }}>🕹️ 인형뽑기 준비 중...</h2>
              <p className="text-lg text-gray-300">선생님이 게임을 시작할 때까지 기다려주세요.</p>
            </motion.div>
          )}

          {/* 퀴즈 */}
          {currentView === 'quiz' && !showCountdown && currentQuestion && (
            <div className="space-y-4">
              <QuizView
                question={currentQuestion}
                onAnswer={handleAnswerSubmit}
                timeLimit={30}
                onCorrectClick={handleCorrectAnswerClick}
              />

              {/* 인벤토리 및 순위 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 인벤토리 */}
                <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                  <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 text-lg">
                    <History size={18} /> 획득한 인형들
                  </h3>
                  <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                    {caughtDolls.length === 0 ? (
                      <div className="col-span-4 text-center text-gray-500 py-10 text-base">
                        아직 뽑은 인형이 없어요.<br />정답을 맞춰보세요!
                      </div>
                    ) : (
                      caughtDolls.map((item, idx) => (
                        <div key={idx} className={`aspect-square ${getTierColor(item.tier)} rounded-lg flex flex-col items-center justify-center border-2 border-white/20 relative group`}>
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <span className={`text-2xl ${item.color}`}>{item.emoji}</span>
                          )}
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                            {item.name} (+{item.score})
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 플레이어 순위 */}
                <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                  <h3 className="font-bold text-slate-300 mb-4 text-center text-lg">순위</h3>
                  <div className="space-y-2">
                    {players
                      .sort((a, b) => {
                        const pointsA = (a as Player).claw_points || 0
                        const pointsB = (b as Player).claw_points || 0
                        return pointsB - pointsA
                      })
                      .slice(0, 5)
                      .map((player, index) => {
                        const isCurrentPlayer = player.id === playerId
                        const points = (player as Player).claw_points || 0
                        const dolls = ((player as Player).caught_dolls as Doll[]) || []

                        return (
                          <div
                            key={player.id}
                            className={`p-3 rounded-lg ${isCurrentPlayer
                              ? 'bg-yellow-500/20 border-2 border-yellow-500'
                              : 'bg-slate-700 border border-slate-600'
                              }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-base">#{index + 1}</span>
                                <span className="text-2xl">{player.avatar || '🎮'}</span>
                                <span className="text-base text-white">{player.nickname}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-base font-bold text-white">{points}점</div>
                                <div className="text-sm text-gray-400">{dolls.length}개</div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 인형뽑기 화면 */}
          {currentView === 'claw' && (
            <div className="space-y-4">
              {/* 결과 카드가 있으면 결과 카드만 표시 */}
              {fishingResult && fishingState === 'release' && fishingResult.doll ? (
                <div className="flex items-center justify-center min-h-[500px]">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    onClick={handleResultCardClick}
                    className="bg-orange-500 border-4 border-white rounded-2xl p-8 shadow-2xl cursor-pointer hover:scale-105 transition-transform max-w-md w-full"
                  >
                    {/* 티어 이름 */}
                    <div className="text-center mb-4">
                      <div className="text-green-500 font-bold text-2xl mb-2">
                        {fishingResult.doll.tier === '일반' ? 'Easy One' :
                          fishingResult.doll.tier === '희귀' ? 'Great Catch' :
                            fishingResult.doll.tier === '영웅' ? 'Rare Find' :
                              fishingResult.doll.tier === '전설' ? 'Epic Grab' : 'Catch of the Day'}
                      </div>
                      <div className="text-white font-black text-5xl mb-6">
                        {fishingResult.doll.name}
                      </div>
                    </div>

                    {/* 인형 이미지 */}
                    <div className="flex justify-center mb-6">
                      <div className="bg-white/20 rounded-2xl p-6 flex items-center justify-center">
                        {fishingResult.doll.image ? (
                          <img src={fishingResult.doll.image} alt={fishingResult.doll.name} className="w-24 h-24 object-contain" />
                        ) : (
                          <span className="text-8xl">{fishingResult.doll.emoji}</span>
                        )}
                      </div>
                    </div>

                    {/* 티어 표시 */}
                    <div className="text-center mb-4">
                      <div className="text-white font-bold text-3xl">
                        {fishingResult.doll.tier === '일반' ? 'F' :
                          fishingResult.doll.tier === '희귀' ? 'D' :
                            fishingResult.doll.tier === '영웅' ? 'B' :
                              fishingResult.doll.tier === '전설' ? 'A' : 'S'} Tier
                      </div>
                    </div>

                    {/* 포인트 */}
                    <div className="text-center">
                      <div className="text-white font-bold text-4xl">
                        {fishingResult.doll.score} 점
                      </div>
                    </div>

                    {/* 클릭 안내 */}
                    <div className="text-center mt-6 text-white/80 text-base">
                      클릭하여 계속
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* 인형뽑기 기계 */}
                  <div className="lg:col-span-2">
                    <FishingMachine
                      fishingState={fishingState}
                      caughtItem={caughtItem}
                      message={
                        fishingState === 'idle'
                          ? "클릭해서 퀴즈를 풀어보세요! 🎣"
                          : fishingResult?.message || "집게가 움직입니다..."
                      }
                      coins={0}
                      onQuizSolve={() => { }}
                      onStartFishing={handleStartFishing}
                      canInteract={fishingState === 'idle'}
                    />
                  </div>

                  {/* 인벤토리 및 순위 */}
                  <div className="space-y-4">
                    {/* 인벤토리 */}
                    <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                      <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 text-lg">
                        <History size={18} /> 획득한 인형들
                      </h3>
                      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                        {caughtDolls.length === 0 ? (
                          <div className="col-span-3 text-center text-gray-500 py-10 text-base">
                            아직 뽑은 인형이 없어요.
                          </div>
                        ) : (
                          caughtDolls.map((item, idx) => (
                            <div key={idx} className={`aspect-square ${getTierColor(item.tier)} rounded-lg flex flex-col items-center justify-center border-2 border-white/20 relative group`}>
                              {item.image ? (
                                <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />
                              ) : (
                                <span className={`text-2xl ${item.color}`}>{item.emoji}</span>
                              )}
                              <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                                {item.name} (+{item.score})
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* 플레이어 순위 */}
                    <div className="bg-slate-800 p-4 rounded-2xl border-4 border-slate-700">
                      <h3 className="font-bold text-slate-300 mb-4 text-center text-lg">순위</h3>
                      <div className="space-y-2">
                        {players
                          .sort((a, b) => {
                            const pointsA = (a as Player).claw_points || 0
                            const pointsB = (b as Player).claw_points || 0
                            return pointsB - pointsA
                          })
                          .slice(0, 5)
                          .map((player, index) => {
                            const isCurrentPlayer = player.id === playerId
                            const points = (player as Player).claw_points || 0
                            const dolls = ((player as Player).caught_dolls as Doll[]) || []

                            return (
                              <div
                                key={player.id}
                                className={`p-3 rounded-lg ${isCurrentPlayer
                                  ? 'bg-yellow-500/20 border-2 border-yellow-500'
                                  : 'bg-slate-700 border border-slate-600'
                                  }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-base">#{index + 1}</span>
                                    <span className="text-2xl">{player.avatar || '🎮'}</span>
                                    <span className="text-base text-white">{player.nickname}</span>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-base font-bold text-white">{points}점</div>
                                    <div className="text-sm text-gray-400">{dolls.length}개</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 오답 */}
          {currentView === 'wrong' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center"
            >
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-5xl font-bold text-red-400 mb-2">틀렸습니다!</h2>
              <p className="text-lg text-gray-300">다음 문제로 넘어갑니다...</p>
            </motion.div>
          )}

          {/* 🎁 특별 아이템 획득 모달 */}
          <AnimatePresence>
            {showItemModal && pendingItem && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={handleItemModalClose}
              >
                <motion.div
                  initial={{ scale: 0.5, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 rounded-3xl p-8 max-w-sm w-full text-center border-4 border-purple-400 shadow-2xl shadow-purple-500/50"
                  onClick={e => e.stopPropagation()}
                >
                  {/* 배경 파티클 효과 */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-3xl bg-gradient-to-r from-yellow-500/20 via-pink-500/20 to-purple-500/20"
                  />

                  <div className="relative z-10">
                    {/* 희귀도 배지 */}
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-4 ${pendingItem.rarity === '전설' ? 'bg-yellow-500 text-yellow-900' :
                        pendingItem.rarity === '희귀' ? 'bg-blue-500 text-white' :
                          'bg-gray-500 text-white'
                      }`}>
                      {pendingItem.rarity} 아이템
                    </div>

                    {/* 아이템 이모지 */}
                    <motion.div
                      animate={{ y: [0, -12, 0], scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-8xl mb-4"
                    >
                      {pendingItem.emoji}
                    </motion.div>

                    <h2 className="text-3xl font-black text-white mb-2">{pendingItem.name}</h2>
                    <p className="text-purple-200 text-base mb-6">{pendingItem.description}</p>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleItemModalClose}
                      className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl font-black text-white text-xl shadow-xl border-2 border-white/30"
                    >
                      {pendingItem.type === 'EXTRA_PULL' ? '🎰 바로 뽑기!' :
                        pendingItem.type === 'COIN_RAIN' ? '🪙 받았어요!' : '✅ 확인!'}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 결과 */}
          {currentView === 'result' && (
            <GameResult
              players={players}
              currentPlayerId={playerId}
              gameMode="fishing"
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </main>
  )
}
