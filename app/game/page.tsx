'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { AlertTriangle, Anchor, CheckCircle2, Coins, Radio, ShieldCheck, XCircle } from 'lucide-react'
import QuizView from '@/components/QuizView'
import ShieldPromptModal from '@/components/ShieldPromptModal'
import { useToast } from '@/components/ui/Toast'
import ChestView from '@/components/ChestView'
import GameResult from '@/components/GameResult'
import Countdown from '@/components/Countdown'
import PreStartQuizGate from '@/components/PreStartQuizGate'
import PlayerAvatarDisplay from '@/components/PlayerAvatarDisplay'
import { useGameBase } from '@/hooks/useGameBase'
import { BOX_EVENT_IMAGE, generateBoxEvent, applyBoxEvent, type BoxEvent } from '@/lib/game/goldQuest'
import PlayerSelector from '@/components/PlayerSelector'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import AnswerReveal from '@/components/AnswerReveal'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']
type AttackRequestPayload = {
  requestId: string
  attackerPlayerId: string
  attackerNickname: string
  targetPlayerId: string
  event: BoxEvent
}
type AttackResponsePayload = {
  requestId: string
  attackerPlayerId: string
  targetPlayerId: string
  blocked: boolean
}

export default function GamePage() {
  const {
    roomCode,
    playerId,
    currentView,
    setCurrentView,
    currentQuestionIndex,
    revealedAnswer,
    showCountdown,
    setShowCountdown,
    consecutiveCorrect,
    answerHistory,
    questions,
    questionsLoading,
    questionsError,
    preStartQuizQuestion,
    preStartSubmittedCount,
    preStartQuizTotal,
    shouldShowPreStartQuiz,
    players,
    room,
    roomLoading,
    playersLoading,
    currentPlayer,
    currentQuestion,
    playBGM,
    playSFX,
    handlePreStartQuizAnswer,
    checkAnswer,
    handleWrongAnswer,
    goToNextQuestion,
    sendRoomEvent,
    commitPlayerDelta,
    commitPlayerSteal,
    commitPlayerSwap,
    roomChannelStatus,
  } = useGameBase({ expectedGameMode: 'gold_quest' })

  // 골드퀘스트 원자 변경 어댑터 — 동시 상자 개봉/강탈 시 골드 증발·복제 방지.
  const goldMutator = useMemo(() => ({
    delta: (playerId: string, deltas: { gold?: number; score?: number }, reason?: string) =>
      commitPlayerDelta(playerId, deltas, { reason }).then(() => undefined),
    steal: (victimId: string, thiefId: string, amount: number, reason?: string) =>
      commitPlayerSteal(victimId, thiefId, amount, ['gold', 'score'], reason).then(() => undefined),
    swap: (aId: string, bId: string, reason?: string) =>
      commitPlayerSwap(aId, bId, ['gold', 'score'], reason).then(() => undefined),
  }), [commitPlayerDelta, commitPlayerSteal, commitPlayerSwap])

  const { showToast } = useToast()

  const [selectedChest, setSelectedChest] = useState<number | null>(null)
  const [boxEvent, setBoxEvent] = useState<BoxEvent | null>(null)
  const [isProcessingReward, setIsProcessingReward] = useState(false)
  const [hasShield, setHasShield] = useState(false) // 방어권 보유 여부
  const [shieldNotice, setShieldNotice] = useState<string | null>(null)
  const [pendingEvent, setPendingEvent] = useState<BoxEvent | null>(null) // 플레이어 선택 대기 중인 이벤트
  const [playerSelectTimeLeft, setPlayerSelectTimeLeft] = useState<number>(0)
  // 방어권 사용 여부를 묻는 모달 (네이티브 confirm 대체 — 게임 루프를 막지 않는다)
  const [shieldAsk, setShieldAsk] = useState<{ message: string; expiresAt: number } | null>(null)
  const shieldResolverRef = useRef<((useShield: boolean) => void) | null>(null)
  const hasShieldRef = useRef(false)
  const attackResolversRef = useRef(new Map<string, (blocked: boolean) => void>())
  // 정답 후 상자 화면 자동 전환 타이머 (수동 클릭과 중복 실행 방지)
  const correctTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 상자/플레이어 선택 후 다음 문제 자동 이동 타이머 (중복 점프 방지)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCorrectTimer = () => {
    if (correctTimerRef.current) {
      clearTimeout(correctTimerRef.current)
      correctTimerRef.current = null
    }
  }

  /** 방어권 사용 여부를 모달로 묻는다. 제한 시간이 지나면 자동으로 false. */
  const askShield = useCallback((message: string, timeoutMs = 5000) => {
    return new Promise<boolean>((resolve) => {
      // 앞선 요청이 남아 있으면 먼저 정리한다.
      shieldResolverRef.current?.(false)
      shieldResolverRef.current = resolve
      setShieldAsk({ message, expiresAt: Date.now() + timeoutMs })
    })
  }, [])

  const answerShield = useCallback((useShield: boolean) => {
    const resolve = shieldResolverRef.current
    shieldResolverRef.current = null
    setShieldAsk(null)
    resolve?.(useShield)
  }, [])

  // 제한 시간 초과 시 자동으로 '사용 안 함'
  useEffect(() => {
    if (!shieldAsk) return
    const timer = window.setTimeout(
      () => answerShield(false),
      Math.max(0, shieldAsk.expiresAt - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [shieldAsk, answerShield])

  // 다음 문제 이동 예약: 항상 기존 타이머를 먼저 정리해 중복 점프를 막는다.
  const scheduleAdvance = (action: () => void, delay: number) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null
      action()
    }, delay)
  }

  // 언마운트 시 남은 타이머 정리
  useEffect(() => {
    return () => {
      clearCorrectTimer()
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    }
  }, [])

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
  const isPaused = room?.status === 'paused'
  const quizUnavailableMessage = !room?.set_id
    ? '이 방에 연결된 문제집이 없습니다. 선생님이 문제집을 선택해 새 방을 만들어야 합니다.'
    : questionsError
      ? `문제를 불러오지 못했습니다. ${questionsError}`
      : questions.length === 0
        ? '이 문제집에 표시할 문제가 없습니다. 선생님이 문제를 추가한 뒤 다시 시작해야 합니다.'
        : null

  useEffect(() => {
    hasShieldRef.current = hasShield
  }, [hasShield])

  useEffect(() => {
    if (!shieldNotice) return
    const timer = window.setTimeout(() => setShieldNotice(null), 2200)
    return () => window.clearTimeout(timer)
  }, [shieldNotice])

  useEffect(() => {
    if (!playerId) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.type === 'gold_quest:attack_response') {
        const payload = event.payload as AttackResponsePayload | undefined
        if (!payload || payload.attackerPlayerId !== playerId) return
        const resolve = attackResolversRef.current.get(payload.requestId)
        if (!resolve) return
        attackResolversRef.current.delete(payload.requestId)
        resolve(payload.blocked)
        return
      }

      if (event.type !== 'gold_quest:attack_request') return
      const payload = event.payload as AttackRequestPayload | undefined
      if (!payload || payload.targetPlayerId !== playerId || payload.attackerPlayerId === playerId) return

      const attackName = payload.event.itemName || '공격'

      // 방어권이 없으면 즉시 알리고 응답한다 (모달로 붙잡지 않는다).
      if (!hasShieldRef.current) {
        showToast(`${payload.attackerNickname}님이 ${attackName} 효과를 사용했습니다.`, 'warning')
        void sendRoomEvent('gold_quest:attack_response', {
          requestId: payload.requestId,
          attackerPlayerId: payload.attackerPlayerId,
          targetPlayerId: playerId,
          blocked: false,
        } satisfies AttackResponsePayload)
        return
      }

      // 방어권이 있으면 모달로 묻는다. 공격자는 6초까지 대기하므로 5초 제한.
      void (async () => {
        const useShield = await askShield(
          `${payload.attackerNickname}님이 ${attackName} 효과를 사용했습니다.`,
          5000,
        )

        if (useShield) {
          setHasShield(false)
          setShieldNotice(`${payload.attackerNickname}님의 공격을 방어권으로 막았습니다!`)
          playSFX('item')
        } else {
          showToast(`${payload.attackerNickname}님의 ${attackName} 효과를 맞았습니다.`, 'warning')
        }

        void sendRoomEvent('gold_quest:attack_response', {
          requestId: payload.requestId,
          attackerPlayerId: payload.attackerPlayerId,
          targetPlayerId: playerId,
          blocked: useShield,
        } satisfies AttackResponsePayload)
      })()
    })
  }, [askShield, playerId, playSFX, sendRoomEvent, showToast])

  const waitForShieldResponse = async (event: BoxEvent, targetPlayer: Player): Promise<boolean> => {
    if (!playerId || !currentPlayer) return false
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const blocked = await new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        attackResolversRef.current.delete(requestId)
        resolve(false)
      }, 6000)

      attackResolversRef.current.set(requestId, (nextBlocked) => {
        window.clearTimeout(timer)
        resolve(nextBlocked)
      })

      void sendRoomEvent('gold_quest:attack_request', {
        requestId,
        attackerPlayerId: playerId,
        attackerNickname: currentPlayer.nickname,
        targetPlayerId: targetPlayer.id,
        event,
      } satisfies AttackRequestPayload)
    })

    return blocked
  }
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

  // playerSelect 화면 진입 시 15초 제한: 시간 초과하면 선택 없이 다음 문제로
  useEffect(() => {
    if (currentView !== 'playerSelect' || !pendingEvent || isProcessingReward || boxEvent?.targetPlayerId) return
    const LIMIT = 15
    setPlayerSelectTimeLeft(LIMIT)
    const interval = window.setInterval(() => {
      setPlayerSelectTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval)
          setSelectedChest(null)
          setBoxEvent(null)
          setPendingEvent(null)
          setIsProcessingReward(false)
          goToNextQuestion()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, pendingEvent])

  // 게임 종료 시 playerSelect 화면에 걸려있으면 강제 스킵
  useEffect(() => {
    if (currentView !== 'playerSelect' || !pendingEvent) return
    if (room?.status === 'finished' || room?.status === 'ended') {
      setSelectedChest(null)
      setBoxEvent(null)
      setPendingEvent(null)
      setIsProcessingReward(false)
      goToNextQuestion()
    }
  }, [room?.status, currentView, pendingEvent, goToNextQuestion])

  // 카운트다운 완료 후 게임 시작
  const handleCountdownComplete = () => {
    setShowCountdown(false)
    setCurrentView('quiz')
    // 인덱스 초기화는 useGameBase에서 처리되지만, 필요시 수동 이동
    playBGM('game')
  }

  // 정답 후 상자 선택 화면으로 이동 (제출 후 자동/클릭 공용)
  // 자동(1.5초)과 수동 클릭이 모두 이 함수를 호출하므로, 예약된 자동
  // 타이머를 먼저 정리해 상자를 고른 뒤 뒤늦게 화면이 리셋되는 일을 막는다.
  const goToChestView = () => {
    clearCorrectTimer()
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
      // 연속 4정답 시 방어권 획득 (Gold Quest 전용, 적립 없음)
      if (consecutiveCorrect + 1 >= 4 && !hasShield) {
        setHasShield(true)
        setShieldNotice('4연속 정답 - 방어권 획득!')
        playSFX('item')
      }
      // 정답: 상자 선택 화면으로 (1.5초 후 자동 이동)
      // 배너를 직접 클릭해 먼저 넘어가면 goToChestView가 이 타이머를 정리한다.
      clearCorrectTimer()
      correctTimerRef.current = setTimeout(goToChestView, 1500)
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
        const useShield = await askShield(`${event.itemName} 효과가 나왔습니다.`, 5000)
        if (useShield) {
          setHasShield(false)
          setShieldNotice('방어권으로 손실 효과를 막았습니다!')
          playSFX('item')
          const blockedEvent: BoxEvent = {
            type: 'FAIRY',
            message: '방어권이 손실 효과를 막았다.',
            itemName: '방어권',
            icon: '🛡️',
          }
          setBoxEvent(blockedEvent)

          scheduleAdvance(() => {
            setSelectedChest(null)
            setBoxEvent(null)
            setIsProcessingReward(false)
            goToNextQuestion()
          }, 3000)
          return
        }
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

      await applyBoxEvent(event, playerId, currentPlayer, targetPlayer, goldMutator)

      // 3초 후 다음 문제로
      scheduleAdvance(() => {
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
    if (isProcessingReward || !pendingEvent || !playerId || !currentPlayer) return

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

      const targetBlocked = await waitForShieldResponse(event, targetPlayer)
      if (targetBlocked) {
        const blockedEvent: BoxEvent = {
          type: 'FAIRY',
          message: `${targetPlayer.nickname}님이 방어권으로 공격을 막았다.`,
          itemName: '방어권',
          icon: '🛡️',
        }
        setBoxEvent(blockedEvent)

        scheduleAdvance(() => {
          setSelectedChest(null)
          setBoxEvent(null)
          setPendingEvent(null)
          setIsProcessingReward(false)
          goToNextQuestion()
        }, 3000)
        return
      }

      await applyBoxEvent(event, playerId, currentPlayer, targetPlayer, goldMutator)

      // 이벤트 메시지 업데이트
      setBoxEvent(event)

      // 3초 후 다음 문제로
      scheduleAdvance(() => {
        setSelectedChest(null)
        setBoxEvent(null)
        setPendingEvent(null)
        setIsProcessingReward(false)
        goToNextQuestion()
      }, 3000)
    } catch (error) {
      console.error('Error applying event:', error)
      setPendingEvent(null)
      setBoxEvent(null)
      setIsProcessingReward(false)
      scheduleAdvance(() => goToNextQuestion(), 1000)
    }
  }

  if (!roomCode || !playerId) {
    return (
      <div className="gold-quest-ambient min-h-dvh flex items-center justify-center p-6">
        <div className="gold-quest-panel p-6">
          <p className="font-bold text-[#17262a]">방 코드와 플레이어 ID가 필요합니다.</p>
        </div>
      </div>
    )
  }

  if (roomLoading || playersLoading) {
    return (
      <div className="gold-quest-ambient min-h-dvh flex items-center justify-center p-6">
        <div className="gold-quest-panel p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
          <div className="text-xl font-black text-[#17262a]">로딩 중</div>
        </div>
      </div>
    )
  }

  return (
    <main className="gold-quest-ambient min-h-dvh p-4 sm:p-6 lg:p-8 relative overflow-hidden font-bitbit">
      <div className="max-w-6xl mx-auto relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="gold-quest-ink-panel mb-6 p-4 sm:p-5 text-[#17262a]"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-white/60 bg-white/35 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                <Anchor className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-normal text-amber-700">
                  Treasure Run
                  <span className="h-1 w-1 rounded-full bg-amber-500" />
                  Room {roomCode}
                </div>
                <h1 className="gold-quest-title text-2xl sm:text-3xl font-black leading-none">
                  해적왕의 보물찾기
                </h1>
                <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                  <Radio className="h-4 w-4" />
                  실시간 {roomChannelStatus === 'subscribed' ? '연결됨' : '연결 중'}
                </p>
              </div>
            </div>
            {currentPlayer && (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-stretch">
                <div className="gold-quest-glass-chip rounded-lg px-4 py-3">
                  <div className="text-xs font-bold text-slate-500">플레이어</div>
                  <div className="max-w-[180px] truncate text-lg font-black">{currentPlayer.nickname}</div>
                </div>
                <div className="gold-quest-glass-chip rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Coins className="h-4 w-4 text-amber-600" />
                    골드
                  </div>
                  <div className="text-lg font-black text-amber-700 tabular-nums">{currentPlayer.gold}</div>
                </div>
                <div className={`rounded-lg border px-4 py-3 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] ${
                  hasShield
                    ? 'border-emerald-200/70 bg-emerald-100/45 text-emerald-800'
                    : 'gold-quest-glass-chip text-slate-500'
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

        {shieldNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="mb-6 rounded-lg border border-emerald-300/80 bg-emerald-100/90 px-5 py-4 text-center text-xl font-black text-emerald-900 shadow-lg shadow-emerald-950/10"
          >
            {shieldNotice}
          </motion.div>
        )}

        {/* 카운트다운 */}
        {shouldShowPreStartQuiz && (
          <PreStartQuizGate
            question={preStartQuizQuestion}
            submittedCount={preStartSubmittedCount}
            total={preStartQuizTotal}
            onAnswer={handlePreStartQuizAnswer}
            questionsLoading={questionsLoading}
            questionsError={questionsError}
            variant="goldQuest"
          />
        )}

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
              paused={isPaused}
              variant="glass"
            />
          )}

          {currentView === 'quiz' && !currentQuestion && (
            <div className="gold-quest-panel p-8 sm:p-12 text-center">
              {questionsLoading ? (
                <>
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
                  <h2 className="gold-quest-title text-3xl font-black text-[#17262a]">문제 불러오는 중</h2>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-lg border border-amber-300/70 bg-amber-100/70">
                    <AlertTriangle className="h-8 w-8 text-amber-700" />
                  </div>
                  <h2 className="gold-quest-title text-3xl font-black text-[#17262a]">퀴즈를 시작할 수 없습니다</h2>
                  <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-relaxed text-slate-600">
                    {quizUnavailableMessage || '문제 정보를 찾지 못했습니다. 선생님이 게임을 다시 시작해야 합니다.'}
                  </p>
                </>
              )}
            </div>
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
              ) : isProcessingReward ? (
                <div className="gold-quest-panel p-8 max-w-3xl mx-auto text-center">
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-[#0c3b42]" />
                  <p className="text-xl font-black text-[#17262a]">처리 중...</p>
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
                    `${pendingEvent.type === 'KING'
                      ? '교환할 상대를 선택하세요.'
                      : pendingEvent.type === 'ELF'
                        ? '골드 10%를 가져올 상대를 선택하세요.'
                        : '골드 25%를 가져올 상대를 선택하세요.'} (${playerSelectTimeLeft}초)`
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
              <AnswerReveal answer={revealedAnswer} />
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
          <section className="gold-quest-ink-panel p-4 sm:p-5 text-[#17262a]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="gold-quest-title flex items-center gap-2 text-xl font-black">
                <Image src="/trophy.svg" alt="" width={20} height={20} className="h-5 w-5 object-contain" />
                골드 순위
              </h2>
              <div className="text-xs font-bold text-slate-500">{rankedPlayers.length}명 참가</div>
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
                    className={`relative overflow-hidden rounded-lg border p-3 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] ${
                      isCurrent
                        ? 'border-amber-300/70 bg-amber-100/45'
                        : isTopPlayer
                          ? 'border-red-200/70 bg-red-100/40'
                          : 'gold-quest-glass-chip'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-200/40 to-transparent"
                      style={{ width: `${fill}%` }}
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                          isTopPlayer ? 'bg-red-500 text-white' : 'border border-white/50 bg-white/35 text-slate-700 backdrop-blur-sm'
                        }`}>
                          {index + 1}
                        </div>
                        <PlayerAvatarDisplay
                          avatar={player.avatar}
                          nickname={player.nickname}
                          fallback="P"
                          className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-white/55 bg-white/35 text-2xl backdrop-blur-sm"
                          sizes="40px"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-black">{player.nickname}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-black text-[#163238]">
                                나
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-lg font-black text-amber-700 tabular-nums">
                          <Image src="/gold-quest/gold-stack.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" />
                          {gold}
                        </div>
                        <div className="text-xs font-bold text-slate-500">골드</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
      <AnimatePresence>
        {shieldAsk && (
          <ShieldPromptModal
            message={shieldAsk.message}
            expiresAt={shieldAsk.expiresAt}
            onAnswer={answerShield}
          />
        )}
      </AnimatePresence>
      {isPaused && currentView !== 'lobby' && currentView !== 'result' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-sm">
          <div className="rounded-2xl bg-white px-8 py-6 text-center text-3xl font-black text-slate-900 shadow-2xl">
            선생님이 잠깐 멈췄어요
          </div>
        </div>
      )}
    </main>
  )
}
