'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import QuizView from '@/components/QuizView'
import ChestView from '@/components/ChestView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import AnimatedBackground from '@/components/AnimatedBackground'
import { useGameBase } from '@/hooks/useGameBase'
import { generateBoxEvent, applyBoxEvent, type BoxEvent } from '@/lib/game/goldQuest'
import PlayerSelector from '@/components/PlayerSelector'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type GameView = 'lobby' | 'countdown' | 'quiz' | 'chest' | 'playerSelect' | 'wrong' | 'result'

export default function GamePage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    currentQuestionIndex,
    setCurrentQuestionIndex,
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
    handleWrongAnswer,
    goToNextQuestion,
    sendRoomEvent,
    commitPlayerPatch,
    roomChannelStatus,
  } = useGameBase({ expectedGameMode: 'gold_quest' })

  const [selectedChest, setSelectedChest] = useState<number | null>(null)
  const [boxEvent, setBoxEvent] = useState<BoxEvent | null>(null)
  const [isProcessingReward, setIsProcessingReward] = useState(false)
  const [hasShield, setHasShield] = useState(false) // 방어권 보유 여부
  const [pendingEvent, setPendingEvent] = useState<BoxEvent | null>(null) // 플레이어 선택 대기 중인 이벤트

  // 뺏기(엘프/마법사)인데 뺏을 상대가 없으면 2초 후 다음 문제로
  const selectableForSteal = pendingEvent && (pendingEvent.type === 'ELF' || pendingEvent.type === 'WIZARD')
    ? players.filter((p) => p.id !== playerId && (p.gold ?? 0) > 0)
    : []
  useEffect(() => {
    if (currentView !== 'playerSelect' || !pendingEvent || pendingEvent.type === 'KING') return
    if (pendingEvent.type === 'ELF' || pendingEvent.type === 'WIZARD') {
      if (selectableForSteal.length === 0) {
        const t = setTimeout(() => {
          setSelectedChest(null)
          setBoxEvent(null)
          setPendingEvent(null)
          setIsProcessingReward(false)
          goToNextQuestion()
        }, 2000)
        return () => clearTimeout(t)
      }
    }
  }, [currentView, pendingEvent, selectableForSteal.length, goToNextQuestion])

  // 카운트다운 완료 후 게임 시작
  const handleCountdownComplete = () => {
    setShowCountdown(false)
    setCurrentView('quiz')
    // 인덱스 초기화는 useGameBase에서 처리되지만, 필요시 수동 이동
    playBGM('game')
  }

  // 정답 후 상자 선택 화면으로 이동 (제출 후 자동/클릭 공용)
  const goToChestView = () => {
    setCurrentView('chest')
    setSelectedChest(null)
    setBoxEvent(null)
    setIsProcessingReward(false)
  }

  // 뒤집혀진 퀴즈 화면에서 호출될 '골드퀘스트'용 커스텀 핸들러
  const handleAnswerSubmit = async (answer: string) => {
    const correct = await checkAnswer(answer)

    if (correct) {
      playSFX('correct')
      // 연속 3정답 시 방어권 획득 (Gold Quest 전용)
      if (consecutiveCorrect + 1 >= 3 && !hasShield) {
        setHasShield(true)
        playSFX('item')
      }
      // 정답: 상자 선택 화면으로 (1.5초 후 자동 이동)
      setTimeout(goToChestView, 1500)
    } else {
      playSFX('incorrect')
      handleWrongAnswer() // 공통 오답 처리 (wrong 뷰 -> 다음 문제)
    }
    return correct
  }

  // 상자 선택 처리
  const handleChestSelect = async (chestIndex: number) => {
    if (isProcessingReward || !playerId || !currentPlayer) return

    setIsProcessingReward(true)
    setSelectedChest(chestIndex)

    try {
      playSFX('click')

      // 해적 컨셉 보상 생성
      const event = generateBoxEvent(currentPlayer.gold, players, playerId, false)
      setBoxEvent(event)
      void sendRoomEvent('game:effect', {
        mode: 'gold_quest',
        actorPlayerId: playerId,
        chestIndex,
        event,
      })

      // 긍정 효과 사운드
      if (event.type === 'GOLD_STACK' || event.type === 'JESTER' || event.type === 'UNICORN') {
        playSFX('item')
      }

      // 방어권이 있고 부정 효과인 경우 방어권 사용
      const isNegativeEvent = event.type === 'SLIME_MONSTER' ||
        event.type === 'DRAGON' ||
        event.type === 'ELF' ||
        event.type === 'WIZARD' ||
        event.type === 'KING'

      if (hasShield && isNegativeEvent) {
        setHasShield(false)
        playSFX('item')
        // 방어권으로 막힌 이벤트는 NOTHING으로 변경
        const blockedEvent: BoxEvent = {
          type: 'FAIRY',
          message: '방어권이 보호했다! 🛡️',
          itemName: '방어권',
          icon: '🛡️',
        }
        setBoxEvent(blockedEvent)

        setTimeout(() => {
          setSelectedChest(null)
          setBoxEvent(null)
          setIsProcessingReward(false)
          goToNextQuestion()
        }, 3000)
        return
      }

      // King (Swap), Elf, Wizard는 플레이어 선택 필요
      if (event.type === 'KING' || event.type === 'ELF' || event.type === 'WIZARD') {
        setPendingEvent(event)
        setCurrentView('playerSelect')
        setIsProcessingReward(false)
        return
      }

      // 일반 이벤트 처리
      const targetPlayer = event.targetPlayerId
        ? players.find((p) => p.id === event.targetPlayerId) || null
        : null

      await applyBoxEvent(event, playerId, currentPlayer, targetPlayer, (targetPlayerId, patch) =>
        commitPlayerPatch(targetPlayerId, patch, 'gold_quest_reward')
      )
      void sendRoomEvent('room:snapshot-hint', { reason: 'gold_quest_reward' })

      // 3초 후 다음 문제로
      setTimeout(() => {
        setSelectedChest(null)
        setBoxEvent(null)
        setIsProcessingReward(false)
        goToNextQuestion()
      }, 3000)
    } catch (error) {
      console.error('Error updating reward:', error)
      setIsProcessingReward(false)
    }
  }

  // 플레이어 선택 처리 (King/Elf/Wizard)
  const handlePlayerSelect = async (targetPlayerId: string) => {
    if (!pendingEvent || !playerId || !currentPlayer) return

    playSFX('click')
    setIsProcessingReward(true)

    try {
      const targetPlayer = players.find((player) => player.id === targetPlayerId) as Player | null
      if (!targetPlayer) {
        setIsProcessingReward(false)
        return
      }

      // 이벤트에 선택한 플레이어 ID와 값 설정
      const event: BoxEvent = {
        ...pendingEvent,
        targetPlayerId,
      }

      // Elf와 Wizard의 경우 훔칠 골드 양 계산
      if (pendingEvent.type === 'ELF' && targetPlayer.gold > 0) {
        event.value = Math.floor(targetPlayer.gold * 0.1)
        event.message = `엘프가 ${targetPlayer.nickname}님의 골드 10%를 훔쳤다! +${event.value} 골드 🧝`
      } else if (pendingEvent.type === 'WIZARD' && targetPlayer.gold > 0) {
        event.value = Math.floor(targetPlayer.gold * 0.25)
        event.message = `마법사가 ${targetPlayer.nickname}님의 골드 25%를 훔쳤다! +${event.value} 골드 🧙`
      } else if (pendingEvent.type === 'KING') {
        event.message = `왕이 ${targetPlayer.nickname}님과 골드를 교환했다! 👑`
      }

      await applyBoxEvent(event, playerId, currentPlayer, targetPlayer, (targetId, patch) =>
        commitPlayerPatch(targetId, patch, 'gold_quest_target_reward')
      )
      void sendRoomEvent('room:snapshot-hint', { reason: 'gold_quest_target_reward' })

      // 이벤트 메시지 업데이트
      setBoxEvent(event)

      // 3초 후 다음 문제로
      setTimeout(() => {
        setSelectedChest(null)
        setBoxEvent(null)
        setPendingEvent(null)
        setIsProcessingReward(false)
        goToNextQuestion()
      }, 3000)
    } catch (error) {
      console.error('Error applying event:', error)
      setIsProcessingReward(false)
    }
  }

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
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 relative overflow-hidden">
      <AnimatedBackground />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* 헤더 - Gold Quest 테마 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 rounded-xl shadow-2xl p-4 mb-6 border-4 border-yellow-400 relative overflow-hidden"
        >
          {/* 골드 배경 패턴 */}
          <div className="absolute inset-0 opacity-20">
            <div className="h-full w-full" style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
            }} />
          </div>

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center justify-center"
              >
                <Image src="/gold-quest/gold-stack.svg" alt="골드" width={36} height={36} className="w-9 h-9" />
              </motion.div>
              <div>
                <Image
                  src="/gold-quest.png"
                  alt="Gold Quest"
                  width={200}
                  height={40}
                  className="h-8 w-auto"
                />
                <p className="text-sm text-yellow-100">
                  방 코드: {roomCode} · 실시간 {roomChannelStatus === 'subscribed' ? '연결됨' : '연결 중'}
                </p>
              </div>
            </div>
            {currentPlayer && (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-right bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2"
              >
                <div className="flex items-center gap-2 justify-end mb-1">
                  <div className="text-lg font-bold text-white">{currentPlayer.nickname}</div>
                  {hasShield && (
                    <motion.span
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="text-xl"
                      title="방어권 보유 중"
                    >
                      🛡️
                    </motion.span>
                  )}
                </div>
                <div className="text-sm text-yellow-300 font-semibold flex items-center gap-1.5">
                  <Image src="/gold-quest/gold-stack.svg" alt="골드" width={18} height={18} className="w-[18px] h-[18px]" />
                  {currentPlayer.gold} Gold | {currentPlayer.score}점
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* 카운트다운 */}
        {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

        {/* 게임 화면 */}
        <div className="mb-6">
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-xl shadow-2xl p-12 text-center border-2 border-gray-200"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="inline-block mb-6"
              >
                <div className="text-6xl">🎮</div>
              </motion.div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                게임 대기 중...
              </h2>
              <p className="text-gray-600 text-lg mb-6">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-primary-500 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
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

          {currentView === 'quiz' && currentQuestion && (
            <QuizView
              question={currentQuestion}
              onAnswer={handleAnswerSubmit}
              onCorrectClick={goToChestView}
              timeLimit={30}
            />
          )}

          {currentView === 'chest' && (
            <ChestView
              key={currentQuestionIndex} // 문제가 바뀔 때마다 컴포넌트 재마운트
              onChestSelect={handleChestSelect}
              selectedChest={selectedChest}
              reward={boxEvent}
              isProcessing={isProcessingReward}
            />
          )}

          {currentView === 'playerSelect' && pendingEvent && (
            <>
              {/* 선택 완료 후 결과 메시지 (뺏기/교환 적용됨) */}
              {boxEvent?.targetPlayerId ? (
                <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-xl shadow-2xl p-8 max-w-3xl mx-auto border-4 border-amber-400 text-center">
                  <p className="text-xl font-bold text-gray-900 mb-2">{boxEvent.message}</p>
                  <p className="text-sm text-gray-600">잠시 후 다음 문제로 넘어갑니다.</p>
                </div>
              ) : (
                <PlayerSelector
                  players={players.filter((p) => {
                    if (p.id === playerId) return false // 자기 자신 제외
                    if (pendingEvent.type === 'KING') return true
                    return (p.gold ?? 0) > 0 // Elf/Wizard: 골드 있는 상대만
                  })}
                  currentPlayerId={playerId || ''}
                  onSelect={handlePlayerSelect}
                  title={
                    pendingEvent.type === 'KING'
                      ? '골드 교환'
                      : pendingEvent.type === 'ELF'
                        ? '엘프: 골드 10% 뺏기'
                        : '마법사: 골드 25% 뺏기'
                  }
                  description={
                    pendingEvent.type === 'KING'
                      ? '누구와 골드를 교환할까요?'
                      : pendingEvent.type === 'ELF'
                        ? '뺏을 상대를 골라주세요!'
                        : '뺏을 상대를 골라주세요!'
                  }
                  icon={pendingEvent.icon || '⚔️'}
                  emptyMessage={
                    pendingEvent.type === 'ELF' || pendingEvent.type === 'WIZARD'
                      ? '골드가 있는 상대가 없어요.'
                      : undefined
                  }
                />
              )}
            </>
          )}

          {currentView === 'wrong' && (
            <motion.div
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
              <h2 className="text-5xl font-bold text-red-600 mb-4 neon-glow">틀렸습니다!</h2>
              <p className="text-gray-700 text-lg">3초 후 다음 문제로 이동합니다...</p>
              <div className="mt-6 flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-red-500 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

        </div>

        {/* 게임 결과 화면 */}
        {currentView === 'result' && (
          <GameResult
            players={players}
            currentPlayerId={playerId}
            answerHistory={answerHistory}
            questions={questions}
          />
        )}

        {/* 플레이어 순위 (결과 화면이 아닐 때만 표시) */}
        {currentView !== 'result' && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-lg shadow-lg p-6 border-2 border-yellow-300">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 flex items-center gap-2">
              <Image src="/gold-quest/gold-stack.svg" alt="골드" width={28} height={28} className="w-7 h-7" />
              골드 순위
            </h2>
            <div className="space-y-2">
              {players
                .sort((a, b) => b.score - a.score)
                .map((player, index) => {
                  const isTopPlayer = index === 0
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 ${player.id === playerId
                        ? 'bg-indigo-50 border-indigo-500'
                        : isTopPlayer
                          ? 'bg-red-100 border-red-500'
                          : 'bg-white border-amber-200'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-600">#{index + 1}</span>
                        <span className="text-2xl">{player.avatar || '🏴‍☠️'}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{player.nickname}</span>
                            {isTopPlayer && (
                              <motion.span
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="text-lg"
                                title="현상수배!"
                              >
                                🎯
                              </motion.span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {player.is_online ? '🟢' : '🔴'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-800">{player.score}점</div>
                        <div className="text-sm text-yellow-600 flex items-center gap-1.5">
                          <Image src="/gold-quest/gold-stack.svg" alt="골드" width={16} height={16} className="w-4 h-4" />
                          {player.gold} Gold
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
