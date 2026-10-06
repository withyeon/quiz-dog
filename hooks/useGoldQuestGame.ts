'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { toast } from '@/components/ui/Toaster'
import { getPlayerById } from '@/lib/services/players'
import { useGameBase } from '@/hooks/useGameBase'
import {
  GOLD_STEAL_RATE,
  SHIELD_STREAK,
  applyBoxEvent,
  generateBoxEvent,
  toPercent,
  type BoxEvent,
} from '@/lib/game/goldQuest'
import { subscribeRoomRuntimeEvent } from '@/lib/realtime/roomChannel'
import type { Database } from '@/types/database.types'

export type GoldQuestPlayer = Database['public']['Tables']['players']['Row']

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
  /** 피해자가 방어권으로 막았는지 */
  blocked: boolean
}
/** 공격이 확정된 뒤 피해자 화면에 결과를 알리는 이벤트 */
type AttackNoticePayload = {
  attackerPlayerId: string
  targetPlayerId: string
  message: string
}

/** 공격 요청에 대한 피해자의 최종 결과 (공격자 대기 resolver로 전달) */
type AttackResult = {
  blocked: boolean
}

// 골드 뺏기(엘프/마법사) 방어권: 피해자가 방어 여부를 결정할 수 있는 시간.
const SHIELD_DECISION_MS = 5000
// 공격자가 피해자 응답을 기다릴 때 결정 시간 위에 더 얹는 네트워크 왕복 여유.
// (요청 도달 + 응답 도달 지연을 흡수) — 이 버퍼가 너무 작으면 정상 방어가
// 타임아웃 뒤 도착해 무시되어 방어가 간헐적으로 실패한다.
const SHIELD_NETWORK_BUFFER_MS = 3000

/**
 * 해적왕의 보물찾기(골드퀘스트) 한 판의 상태와 규칙.
 * 상자 보상·방어권·골드 가져오기/교환의 요청-응답 흐름을 모두 여기서 처리하고,
 * 페이지(app/game/page.tsx)는 돌려준 값으로 화면만 그린다.
 */
export function useGoldQuestGame() {
  const base = useGameBase({ expectedGameMode: 'gold_quest' })
  const {
    playerId,
    currentView,
    setCurrentView,
    consecutiveCorrect,
    questions,
    questionsError,
    players,
    room,
    currentPlayer,
    playSFX,
    checkAnswer,
    handleWrongAnswer,
    goToNextQuestion,
    sendRoomEvent,
    commitPlayerDelta,
    commitPlayerSteal,
    commitPlayerSwap,
    commitPlayerPatch,
  } = base

  // 골드퀘스트 원자 변경 어댑터 — 동시 상자 개봉/강탈 시 골드 증발·복제 방지.
  const goldMutator = useMemo(() => ({
    delta: (playerId: string, deltas: { gold?: number; score?: number }, reason?: string) =>
      commitPlayerDelta(playerId, deltas, { reason }).then(() => undefined),
    steal: (victimId: string, thiefId: string, amount: number, reason?: string) =>
      commitPlayerSteal(victimId, thiefId, amount, ['gold', 'score'], reason).then(() => undefined),
    swap: (aId: string, bId: string, reason?: string) =>
      commitPlayerSwap(aId, bId, ['gold', 'score'], reason).then(() => undefined),
  }), [commitPlayerDelta, commitPlayerSteal, commitPlayerSwap])

  const [selectedChest, setSelectedChest] = useState<number | null>(null)
  const [boxEvent, setBoxEvent] = useState<BoxEvent | null>(null)
  const [isProcessingReward, setIsProcessingReward] = useState(false)
  const [hasShield, setHasShield] = useState(false) // 방어권 보유 여부
  const [shieldNotice, setShieldNotice] = useState<string | null>(null)
  const [pendingEvent, setPendingEvent] = useState<BoxEvent | null>(null) // 플레이어 선택 대기 중인 이벤트
  const [playerSelectTimeLeft, setPlayerSelectTimeLeft] = useState<number>(0)
  // 상대가 방어권을 쓸지 정하는 동안 공격자 화면에 보여줄 안내 (null이면 일반 '처리 중')
  const [awaitingShieldText, setAwaitingShieldText] = useState<string | null>(null)
  // 방어권 사용 여부를 묻는 모달 (네이티브 confirm 대체 — 게임 루프를 막지 않는다)
  const [shieldAsk, setShieldAsk] = useState<{ message: string; expiresAt: number } | null>(null)
  const shieldResolverRef = useRef<((useShield: boolean) => void) | null>(null)
  const hasShieldRef = useRef(false)
  const attackResolversRef = useRef(new Map<string, (result: AttackResult) => void>())
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

  // 방어권은 players.has_umbrella에 같이 저장한다(다른 모드는 이 컬럼을 쓰지 않는다).
  // 공격자가 "상대에게 방어권이 있는지"를 DB에서 확인해야 하고, 새로고침해도 방어권이
  // 사라지지 않아야 하기 때문이다.
  const hasRestoredShieldRef = useRef(false)
  const persistedShield = (currentPlayer as { has_umbrella?: boolean | null } | null)?.has_umbrella
  useEffect(() => {
    if (!currentPlayer || hasRestoredShieldRef.current) return
    hasRestoredShieldRef.current = true
    if (persistedShield) setHasShield(true)
  }, [currentPlayer, persistedShield])

  const setShieldPersisted = useCallback((value: boolean) => {
    setHasShield(value)
    hasShieldRef.current = value
    if (!playerId) return
    commitPlayerPatch(playerId, { has_umbrella: value }, value ? 'gold_quest_shield_gain' : 'gold_quest_shield_use')
      .catch((error) => console.error('방어권 저장 실패:', error))
  }, [commitPlayerPatch, playerId])

  useEffect(() => {
    if (!shieldNotice) return
    const timer = window.setTimeout(() => setShieldNotice(null), 2200)
    return () => window.clearTimeout(timer)
  }, [shieldNotice])

  // 골드 이동은 공격자가 서버 원자 연산으로 확정한다. 피해자 화면은
  // (1) 방어권이 있을 때 사용 여부를 답하고, (2) 확정 결과를 알림으로 받는 역할만 한다.
  // 예전에는 피해자가 골드 이동까지 확정했는데, 피해자 화면이 없거나(이탈·백그라운드)
  // 이벤트가 유실되면 '골드 가져오기'가 조용히 실패했다.
  useEffect(() => {
    if (!playerId) return

    return subscribeRoomRuntimeEvent((event) => {
      if (event.type === 'gold_quest:attack_response') {
        const payload = event.payload as AttackResponsePayload | undefined
        if (!payload || payload.attackerPlayerId !== playerId) return
        const resolve = attackResolversRef.current.get(payload.requestId)
        if (!resolve) return
        attackResolversRef.current.delete(payload.requestId)
        resolve({ blocked: payload.blocked })
        return
      }

      if (event.type === 'gold_quest:attack_notice') {
        const payload = event.payload as AttackNoticePayload | undefined
        if (!payload || payload.targetPlayerId !== playerId) return
        toast.info(payload.message)
        playSFX('incorrect')
        return
      }

      if (event.type !== 'gold_quest:attack_request') return
      const payload = event.payload as AttackRequestPayload | undefined
      if (!payload || payload.targetPlayerId !== playerId || payload.attackerPlayerId === playerId) return

      const attackName = payload.event.itemName || '공격'

      // 공격자는 DB에서 내 방어권을 확인한 뒤에만 물어온다. 그래도 로컬 상태가 다르면 '안 씀'으로 답한다.
      void (async () => {
        let blocked = false

        if (hasShieldRef.current) {
          const useShield = await askShield(
            `${payload.attackerNickname}님이 ${attackName} 효과를 사용했습니다.`,
            SHIELD_DECISION_MS,
          )
          if (useShield) {
            blocked = true
            setShieldPersisted(false)
            setShieldNotice(`${payload.attackerNickname}님의 공격을 방어권으로 막았습니다!`)
            playSFX('item')
          }
        }

        void sendRoomEvent('gold_quest:attack_response', {
          requestId: payload.requestId,
          attackerPlayerId: payload.attackerPlayerId,
          targetPlayerId: playerId,
          blocked,
        } satisfies AttackResponsePayload)
      })()
    })
  }, [askShield, playerId, playSFX, sendRoomEvent, setShieldPersisted])

  const waitForShieldResponse = async (event: BoxEvent, targetPlayer: GoldQuestPlayer): Promise<AttackResult> => {
    if (!playerId || !currentPlayer) return { blocked: false }
    const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    return new Promise<AttackResult>((resolve) => {
      // 피해자가 제한 시간 안에 방어권을 쓰지 않으면(응답 없음 포함) 공격이 그대로 들어간다.
      // 피해자 모달(5초)이 이 대기(8초)보다 짧아 정상적인 방어는 늦게 도착하지 않는다.
      const timer = window.setTimeout(() => {
        attackResolversRef.current.delete(requestId)
        resolve({ blocked: false })
      }, SHIELD_DECISION_MS + SHIELD_NETWORK_BUFFER_MS)

      attackResolversRef.current.set(requestId, (result) => {
        window.clearTimeout(timer)
        resolve(result)
      })

      void sendRoomEvent('gold_quest:attack_request', {
        requestId,
        attackerPlayerId: playerId,
        attackerNickname: currentPlayer.nickname,
        targetPlayerId: targetPlayer.id,
        event,
      } satisfies AttackRequestPayload)
    })
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

  // 카운트다운 완료는 훅(useGameBase)의 handleCountdownComplete가 처리한다. 완료를 훅에 알려야
  // 시작 전 퀴즈 게이트(shouldShowPreStartQuiz)가 열리고, 게이트가 끝나면 훅이 'quiz'로 넘긴다.
  // 예전에는 페이지 자체 핸들러가 바로 'quiz'로 들어가며 훅에는 알리지 않아 훅의
  // isCountdownComplete가 영원히 false였고, 시작 전 퀴즈 3문제가 조용히 건너뛰어졌다.

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
      // 연속 정답 시 방어권 획득 (Gold Quest 전용, 적립 없음)
      if (consecutiveCorrect + 1 >= SHIELD_STREAK && !hasShield) {
        setShieldPersisted(true)
        setShieldNotice(`${SHIELD_STREAK}연속 정답 - 방어권 획득!`)
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
          setShieldPersisted(false)
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
      const targetPlayer = players.find((player) => player.id === targetPlayerId) as GoldQuestPlayer | null
      if (!targetPlayer) {
        setIsProcessingReward(false)
        return
      }

      // 이벤트에 선택한 플레이어 ID와 값 설정
      const event: BoxEvent = {
        ...pendingEvent,
        targetPlayerId,
      }

      // 상대의 최신 골드·방어권은 DB에서 다시 읽는다(화면의 players는 몇 초 늦을 수 있다).
      const freshTarget = await getPlayerById(targetPlayerId).catch(() => null)
      const targetGold = freshTarget?.gold ?? targetPlayer.gold ?? 0
      const targetHasShield = Boolean((freshTarget as { has_umbrella?: boolean | null } | null)?.has_umbrella)

      // Elf와 Wizard의 경우 훔칠 골드 양 계산
      if (pendingEvent.type === 'ELF' && targetGold > 0) {
        event.value = Math.floor(targetGold * GOLD_STEAL_RATE.ELF)
        event.message = `${targetPlayer.nickname}님의 골드 ${toPercent(GOLD_STEAL_RATE.ELF)}%를 가져왔다. +${event.value} 골드`
      } else if (pendingEvent.type === 'WIZARD' && targetGold > 0) {
        event.value = Math.floor(targetGold * GOLD_STEAL_RATE.WIZARD)
        event.message = `${targetPlayer.nickname}님의 골드 ${toPercent(GOLD_STEAL_RATE.WIZARD)}%를 가져왔다. +${event.value} 골드`
      } else if (pendingEvent.type === 'KING') {
        event.message = `${targetPlayer.nickname}님과 골드를 교환했다.`
      }

      // 상대에게 방어권이 있을 때만 사용 여부를 묻고 기다린다. 없으면 바로 확정한다.
      let result: AttackResult = { blocked: false }
      if (targetHasShield) {
        setAwaitingShieldText(`${targetPlayer.nickname}님이 방어권을 쓸지 정하는 중이에요.`)
        try {
          result = await waitForShieldResponse(event, targetPlayer)
        } finally {
          setAwaitingShieldText(null)
        }
      }

      let outcomeEvent: BoxEvent
      if (result.blocked) {
        // targetPlayerId가 있어야 playerSelect 화면의 결과 패널에 표시된다.
        outcomeEvent = {
          type: 'FAIRY',
          targetPlayerId,
          message: `${targetPlayer.nickname}님이 방어권으로 공격을 막았다.`,
          itemName: '방어권',
          icon: '🛡️',
        }
      } else {
        // 골드 이동은 공격자가 서버 원자 연산으로 확정한다(피해자 화면이 없어도 동작).
        try {
          await applyBoxEvent(event, playerId, currentPlayer, targetPlayer, goldMutator)
          outcomeEvent = event
          const noticeMessage = event.type === 'KING'
            ? `${currentPlayer.nickname}님이 왕의 명령서로 나와 골드를 교환했어요.`
            : `${currentPlayer.nickname}님이 ${event.itemName}로 내 골드 ${event.value ?? 0}을 가져갔어요.`
          void sendRoomEvent('gold_quest:attack_notice', {
            attackerPlayerId: playerId,
            targetPlayerId,
            message: noticeMessage,
          } satisfies AttackNoticePayload)
        } catch (error) {
          console.error('Error applying attack:', error)
          outcomeEvent = {
            type: 'FAIRY',
            targetPlayerId,
            message: `${targetPlayer.nickname}님에게 효과가 닿지 않았다.`,
            itemName: '실패',
            icon: '💨',
          }
        }
      }

      setBoxEvent(outcomeEvent)

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

  return {
    ...base,
    // 파생 값
    isPaused,
    rankedPlayers,
    leaderGold,
    quizUnavailableMessage,
    // 골드퀘스트 상태
    selectedChest,
    boxEvent,
    isProcessingReward,
    hasShield,
    shieldNotice,
    pendingEvent,
    playerSelectTimeLeft,
    awaitingShieldText,
    shieldAsk,
    // 핸들러
    answerShield,
    goToChestView,
    handleAnswerSubmit,
    handleChestSelect,
    handlePlayerSelect,
  }
}
