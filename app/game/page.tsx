'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Anchor, CheckCircle2, Coins, Radio, ShieldCheck, Trophy, XCircle } from 'lucide-react'
import QuizView from '@/components/QuizView'
import ChestView from '@/components/ChestView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import { useGameBase } from '@/hooks/useGameBase'
import { BOX_EVENT_IMAGE, generateBoxEvent, applyBoxEvent, type BoxEvent } from '@/lib/game/goldQuest'
import PlayerSelector from '@/components/PlayerSelector'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

export default function GamePage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    currentQuestionIndex,
    showCountdown,
    setShowCountdown,
    consecutiveCorrect,
    answerHistory,
    questions,
    players,
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

  // 가져오기(엘프/마법사)인데 대상이 없으면 2초 후 다음 문제로
  const selectableForSteal = pendingEvent && (pendingEvent.type === 'ELF' || pendingEvent.type === 'WIZARD')
    ? players.filter((p) => p.id !== playerId && (p.gold ?? 0) > 0)
    : []
  const rankedPlayers = [...players].sort((a, b) => {
    const goldDiff = (b.gold ?? 0) - (a.gold ?? 0)
    if (goldDiff !== 0) return goldDiff
    return (b.score ?? 0) - (a.score ?? 0)
  })
  const leaderGold = Math.max(1, ...rankedPlayers.map((player) => player.gold ?? 0))
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
        event.type === 'DRAGON'

      if (hasShield && isNegativeEvent) {
        setHasShield(false)
        playSFX('item')
        // 방어권으로 막힌 이벤트는 NOTHING으로 변경
        const blockedEvent: BoxEvent = {
          type: 'FAIRY',
          message: '방어권이 손실 효과를 막았다.',
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
        event.message = `${targetPlayer.nickname}님의 골드 10%를 가져왔다. +${event.value} 골드`
      } else if (pendingEvent.type === 'WIZARD' && targetPlayer.gold > 0) {
        event.value = Math.floor(targetPlayer.gold * 0.25)
        event.message = `${targetPlayer.nickname}님의 골드 25%를 가져왔다. +${event.value} 골드`
      } else if (pendingEvent.type === 'KING') {
        event.message = `${targetPlayer.nickname}님과 골드를 교환했다.`
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
      <div className="gold-quest-ambient min-h-screen flex items-center justify-center p-6">
        <div className="gold-quest-panel p-6">
          <p className="font-bold text-[#17262a]">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="gold-quest-ambient min-h-screen flex items-center justify-center p-6">
        <div className="gold-quest-panel p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
          <div className="text-xl font-black text-[#17262a]">로딩 중</div>
        </div>
      </div>
    )
  }

  return (
    <main className="gold-quest-ambient min-h-screen p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gold-quest-ink-panel mb-6 p-4 sm:p-5 text-white"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-amber-200/25 bg-white/10">
                <Anchor className="h-6 w-6 text-amber-200" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-normal text-amber-200/90">
                  Treasure Run
                  <span className="h-1 w-1 rounded-full bg-amber-200/70" />
                  Room {roomCode}
                </div>
                <h1 className="gold-quest-title text-2xl sm:text-3xl font-black leading-none">
                  해적왕의 보물찾기
                </h1>
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-teal-50/80">
                  <Radio className="h-4 w-4" />
                  실시간 {roomChannelStatus === 'subscribed' ? '연결됨' : '연결 중'}
                </p>
              </div>
            </div>
            {currentPlayer && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch">
                <div className="rounded-lg border border-white/[0.12] bg-white/10 px-4 py-3">
                  <div className="text-xs font-bold text-teal-50/70">플레이어</div>
                  <div className="max-w-[180px] truncate text-lg font-black">{currentPlayer.nickname}</div>
                </div>
                <div className="rounded-lg border border-white/[0.12] bg-white/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-50/70">
                    <Coins className="h-4 w-4 text-amber-200" />
                    골드
                  </div>
                  <div className="text-lg font-black text-amber-100 tabular-nums">{currentPlayer.gold}</div>
                </div>
                <div className="rounded-lg border border-white/[0.12] bg-white/10 px-4 py-3">
                  <div className="text-xs font-bold text-teal-50/70">점수</div>
                  <div className="text-lg font-black tabular-nums">{currentPlayer.score}</div>
                </div>
                <div className={`rounded-lg border px-4 py-3 ${
                  hasShield
                    ? 'border-emerald-200/35 bg-emerald-300/15 text-emerald-50'
                    : 'border-white/[0.12] bg-white/[0.08] text-teal-50/70'
                }`}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    방어권
                  </div>
                  {hasShield && (
                    <div className="text-lg font-black">보유</div>
                  )}
                  {!hasShield && <div className="text-lg font-black">없음</div>}
                </div>
              </div>
            )}
          </div>
        </motion.header>

        {/* 카운트다운 */}
        {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

        {/* 게임 화면 */}
        <div className="mb-6">
          {currentView === 'lobby' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="gold-quest-panel p-8 sm:p-12 text-center"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/70 bg-amber-100/70"
              >
                <Anchor className="h-8 w-8 text-[#0c3b42]" />
              </motion.div>
              <h2 className="gold-quest-title text-4xl font-black text-[#17262a] mb-4">
                게임 대기 중
              </h2>
              <p className="text-gray-600 text-lg mb-6">선생님이 게임을 시작할 때까지 기다려주세요.</p>
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 bg-[#0c3b42] rounded-full"
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
              variant="goldQuest"
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
              {/* 선택 완료 후 결과 메시지 (가져오기/교환 적용됨) */}
              {boxEvent?.targetPlayerId ? (
                <div className="gold-quest-panel p-8 max-w-3xl mx-auto text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-emerald-300/70 bg-emerald-50">
                    <CheckCircle2 className="h-8 w-8 text-emerald-700" />
                  </div>
                  <p className="text-xl font-black text-[#17262a] mb-2">{boxEvent.message}</p>
                  <p className="text-sm font-semibold text-slate-500">잠시 후 다음 문제로 넘어갑니다.</p>
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
                        ? '엘프의 밀서'
                        : '마법사의 계약서'
                  }
                  description={
                    pendingEvent.type === 'KING'
                      ? '교환할 상대를 선택하세요.'
                      : pendingEvent.type === 'ELF'
                        ? '골드 10%를 가져올 상대를 선택하세요.'
                        : '골드 25%를 가져올 상대를 선택하세요.'
                  }
                  icon={pendingEvent.icon || '⚔️'}
                  iconImage={BOX_EVENT_IMAGE[pendingEvent.type]}
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
              className="gold-quest-panel p-8 sm:p-12 text-center border-red-200"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-red-200 bg-red-50"
              >
                <XCircle className="h-12 w-12 text-red-600" />
              </motion.div>
              <h2 className="gold-quest-title text-4xl sm:text-5xl font-black text-red-700 mb-4">틀렸습니다</h2>
              <p className="text-gray-700 text-lg font-semibold">3초 후 다음 문제로 이동합니다.</p>
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
          <section className="gold-quest-ink-panel p-4 sm:p-5 text-white">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="gold-quest-title flex items-center gap-2 text-xl font-black">
                <Trophy className="h-5 w-5 text-amber-200" />
                골드 순위
              </h2>
              <div className="text-xs font-bold text-teal-50/70">{rankedPlayers.length}명 참가</div>
            </div>
            <div className="grid gap-2">
              {rankedPlayers.map((player, index) => {
                const isTopPlayer = index === 0
                const isCurrent = player.id === playerId
                const gold = player.gold ?? 0
                const fill = Math.max(6, Math.round((gold / leaderGold) * 100))
                return (
                  <div
                    key={player.id}
                    className={`relative overflow-hidden rounded-lg border p-3 ${
                      isCurrent
                        ? 'border-amber-200/70 bg-amber-100/[0.16]'
                        : isTopPlayer
                          ? 'border-red-200/40 bg-red-100/[0.12]'
                          : 'border-white/10 bg-white/[0.08]'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-300/[0.22] to-transparent"
                      style={{ width: `${fill}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                          isTopPlayer ? 'bg-red-500 text-white' : 'bg-white/[0.12] text-amber-100'
                        }`}>
                          #{index + 1}
                        </div>
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-2xl">
                          {player.avatar || 'P'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-black">{player.nickname}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-[#163238]">
                                나
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-teal-50/[0.65]">
                            <span className={`h-2 w-2 rounded-full ${player.is_online ? 'bg-emerald-300' : 'bg-slate-400'}`} />
                            {player.is_online ? '온라인' : '오프라인'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-lg font-black text-amber-100 tabular-nums">
                          <Image src="/gold-quest/gold-stack.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                          {gold}
                        </div>
                        <div className="text-xs font-bold text-teal-50/[0.65]">{player.score}점</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
