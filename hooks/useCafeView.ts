'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCafeStore } from '@/store/cafeStore'
import { MENU_ITEMS, Customer, pickCopyCatMenu } from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import { CAFE_ITEMS, getRandomItemChoices, type CafeItem, type ItemId } from '@/lib/game/cafeItems'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import { useAudioContext } from '@/components/AudioProvider'
import type { Database } from '@/types/database.types'

export type CafePlayer = Database['public']['Tables']['players']['Row']

export type CafeQuestion = {
  id: string
  type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer?: string
}

export interface CafeViewProps {
  onGameEnd?: () => void
  roomCode?: string
  currentQuestion: CafeQuestion | null
  onAnswer: (answer: string) => Promise<boolean>
  onNextQuestion: () => void
  players: CafePlayer[]
  currentPlayerId: string | null
  consecutiveCorrect: number
  onSendEvent: (type: 'cafe:item_attack', payload: unknown) => Promise<unknown> | void
  questionSetTitle?: string | null
  paused?: boolean
}

/**
 * 달콤 바삭 카페 한 판의 화면 상태와 규칙.
 * 타이머·손님 줄·인내심, 손님 서빙(가격 폭락·황금 뒤집개·슈퍼 광고 보정), 정답 재고 충전,
 * 아이템 선택과 공격 전송을 모두 여기서 처리하고 CafeView 는 돌려준 값으로 화면만 그린다.
 */
export function useCafeView({
  onGameEnd,
  currentQuestion,
  onAnswer,
  onNextQuestion,
  players,
  currentPlayerId,
  consecutiveCorrect,
  onSendEvent,
  paused = false,
}: CafeViewProps) {
  const {
    status,
    timeRemaining,
    cash,
    customersServed,
    unlockedMenus,
    menuStock,
    upgrades,
    customers,
    activeBuffs,
    goldenSpatulaActive,
    tickTimer,
    serveMenu,
    earnCash,
    addCustomer,
    updateCustomers,
    restockMenu,
    restockForCorrectAnswer,
    applyBuff,
    activateGoldenSpatula,
    consumeGoldenSpatula,
    purchaseMenuFree,
  } = useCafeStore()

  const [showQuiz, setShowQuiz] = useState(false)
  const [showWrong, setShowWrong] = useState(false)
  const { revealedAnswer, reveal: revealAnswer, clearRevealedAnswer } = useRevealedAnswer()
  const [showShop, setShowShop] = useState(false)
  const [servingAnimations, setServingAnimations] = useState<
    Array<{ id: string; x: number; y: number; amount: number; isGolden?: boolean }>
  >([])
  const [itemChoices, setItemChoices] = useState<CafeItem[]>([])
  const [showItemModal, setShowItemModal] = useState(false)
  const [restockedMenuName, setRestockedMenuName] = useState('')
  const [showGoldenEffect, setShowGoldenEffect] = useState(false)
  // 아이템 결과 안내 (카피캣으로 무엇을 가져왔는지 등). 2.5초 뒤 사라진다.
  const [notice, setNotice] = useState<{ id: number; text: string; tone: 'good' | 'bad' } | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const customerUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const patienceUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  const { playSFX } = useAudioContext()
  const effectiveStatus = paused ? 'paused' : status

  const showNotice = useCallback((text: string, tone: 'good' | 'bad' = 'good') => {
    setNotice({ id: Date.now(), text, tone })
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  // 타이머
  useEffect(() => {
    if (effectiveStatus === 'playing') {
      timerInterval.current = setInterval(() => {
        tickTimer()
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
  }, [effectiveStatus, tickTimer])

  const hasActiveBuff = useCallback((itemId: ItemId) => (
    activeBuffs.some(buff => buff.itemId === itemId && buff.expiresAt > Date.now())
  ), [activeBuffs])

  // 손님 업데이트 (인내심 체크)
  useEffect(() => {
    if (effectiveStatus === 'playing') {
      customerUpdateInterval.current = setInterval(() => {
        updateCustomers(Date.now())
      }, 1000)

      return () => {
        if (customerUpdateInterval.current) {
          clearInterval(customerUpdateInterval.current)
        }
      }
    }
  }, [effectiveStatus, updateCustomers])

  // 인내심 게이지 실시간 업데이트
  useEffect(() => {
    if (effectiveStatus === 'playing') {
      patienceUpdateInterval.current = setInterval(() => {
        setCurrentTime(Date.now())
      }, 100) // 0.1초마다 업데이트

      return () => {
        if (patienceUpdateInterval.current) {
          clearInterval(patienceUpdateInterval.current)
        }
      }
    }
  }, [effectiveStatus])

  // 게임 종료 처리
  useEffect(() => {
    if (status === 'ended' && onGameEnd) {
      onGameEnd()
    }
  }, [status, onGameEnd])

  // 손님을 항상 3명 유지
  useEffect(() => {
    if (effectiveStatus === 'playing') {
      const interval = setInterval(() => {
        if (hasActiveBuff('BAD_REVIEW')) return
        // 손님이 3명 미만이면 계속 추가
        if (customers.length < MAX_CUSTOMERS_IN_LINE) {
          addCustomer()
        }
      }, hasActiveBuff('RUSH_HOUR') ? 800 : 2000)

      return () => clearInterval(interval)
    }
  }, [effectiveStatus, customers.length, addCustomer, hasActiveBuff])

  const closeQuizAndAdvance = useCallback(() => {
    setShowQuiz(false)
    setShowItemModal(false)
    setItemChoices([])
    onNextQuestion()
  }, [onNextQuestion])

  const handleItemSelect = useCallback(async (itemId: ItemId, targetPlayerId?: string) => {
    setShowItemModal(false)
    setShowQuiz(false)
    setItemChoices([])

    const item = CAFE_ITEMS[itemId]

    if (item.type === 'buff') {
      switch (itemId) {
        case 'GOLDEN_SPATULA':
          activateGoldenSpatula()
          break
        case 'EXPRESS_LANE':
        case 'RUSH_HOUR':
        case 'SUPER_AD':
          applyBuff(itemId, item.duration)
          break
        case 'SECRET_RECIPE':
          unlockedMenus.forEach(menuId => {
            restockMenu(menuId)
            restockMenu(menuId)
          })
          break
        case 'COPY_CAT': {
          // 1등(나 제외)이 연 메뉴 중 내가 없는 가장 비싼 것 하나만 가져온다.
          const { topPlayer, menuId } = pickCopyCatMenu(players, currentPlayerId, unlockedMenus)
          if (menuId) {
            purchaseMenuFree(menuId)
            const menuName = MENU_ITEMS.find(menu => menu.id === menuId)?.name ?? menuId
            const topName = players.find(player => player.id === topPlayer?.id)?.nickname ?? '1등'
            showNotice(`카피캣! ${topName}의 ${menuName} 메뉴를 가져왔어요`)
          } else {
            showNotice(topPlayer ? '1등도 내가 없는 메뉴가 없어요' : '따라 할 상대가 없어요', 'bad')
          }
          break
        }
      }
    }

    if (item.type === 'debuff' && targetPlayerId) {
      // 보낸 쪽에도 확인이 뜬다 (예전엔 모달만 닫혀서 눌렀는지 알 수 없었다)
      const targetName = players.find(player => player.id === targetPlayerId)?.nickname ?? '친구'
      showNotice(itemId === 'TAX'
        ? `${targetName}에게 세금을 걷었어요!`
        : `${targetName}의 카페에 ${item.name}!`)
      await onSendEvent('cafe:item_attack', {
        attackerId: currentPlayerId,
        targetId: targetPlayerId,
        itemId,
        duration: item.duration,
      })
    }

    onNextQuestion()
  }, [
    activateGoldenSpatula,
    applyBuff,
    currentPlayerId,
    onNextQuestion,
    onSendEvent,
    players,
    purchaseMenuFree,
    restockMenu,
    showNotice,
    unlockedMenus,
  ])

  // 퀴즈 정답 제출
  const handleAnswerSubmit = async (answer: string) => {
    if (!answer) {
      // 시간 초과 — 오답으로 기록해야 리포트 분모에 잡힌다.
      // 예전에는 여기서 바로 리턴해서 시간 초과가 한 건도 기록되지 않았고,
      // 그 결과 정답률이 늘 100%로 나왔다.
      await onAnswer('')
      playSFX('incorrect')
      setShowWrong(true)
      setShowQuiz(false)
      revealAnswer(currentQuestion?.id)
      setTimeout(() => {
        setShowWrong(false)
        clearRevealedAnswer()
        onNextQuestion()
      }, 3000)
      return false
    }

    const correct = await onAnswer(answer)

    if (correct) {
      playSFX('correct')

      // 정답 시 재고충전: 줄 선 손님이 기다리는(재고 0) 메뉴부터, 없으면 재고가 가장 적은 메뉴
      const restocked = restockForCorrectAnswer()
      if (restocked) {
        setRestockedMenuName(MENU_ITEMS.find(menu => menu.id === restocked)?.name || restocked)
      }

      setItemChoices(getRandomItemChoices(consecutiveCorrect + 1))
      setShowItemModal(true)
    } else {
      playSFX('incorrect')
      setShowWrong(true)
      setShowQuiz(false)
      revealAnswer(currentQuestion?.id)
      setTimeout(() => {
        setShowWrong(false)
        clearRevealedAnswer()
        onNextQuestion()
      }, 3000)
    }
    return correct
  }

  // 스페이스 키로 음식 채우기 버튼 클릭
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space' && effectiveStatus === 'playing' && !showQuiz && !showItemModal) {
        e.preventDefault()
        setShowQuiz(true)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [effectiveStatus, showQuiz, showItemModal])

  // 손님 클릭으로 서빙 (Blooket 스타일)
  const handleCustomerClick = (customer: Customer, event: React.MouseEvent) => {
    if (effectiveStatus !== 'playing') return
    const result = serveMenu(customer.id, customer.order)
    if (result.success) {
      let finalEarned = result.earned
      let adjustment = 0
      const wasGolden = goldenSpatulaActive

      if (hasActiveBuff('PRICE_CRASH')) {
        const crashed = Math.floor(finalEarned * 0.5)
        adjustment += crashed - finalEarned
        finalEarned = crashed
      }

      if (wasGolden) {
        const bonus = result.earned * 2
        adjustment += bonus
        finalEarned += bonus
        consumeGoldenSpatula()
        setShowGoldenEffect(true)
        setTimeout(() => setShowGoldenEffect(false), 1000)
      }

      if (hasActiveBuff('SUPER_AD')) {
        const bonus = Math.floor(finalEarned * 0.5)
        adjustment += bonus
        finalEarned += bonus
      }

      if (adjustment !== 0) {
        earnCash(adjustment)
      }

      // 돈 애니메이션 추가
      const rect = event.currentTarget.getBoundingClientRect()
      setServingAnimations((prev) => [
        ...prev,
        {
          id: `anim-${Date.now()}`,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          amount: finalEarned,
          isGolden: wasGolden,
        },
      ])

      // 애니메이션 제거
      setTimeout(() => {
        setServingAnimations((prev) => prev.slice(1))
      }, 2000)
    }
  }

  // 손님의 인내심 계산
  const getCustomerPatience = (customer: Customer) => {
    const elapsed = (currentTime - customer.spawnTime) / 1000
    const effectivePatience = hasActiveBuff('EXPRESS_LANE') ? customer.patience * 2 : customer.patience
    const remaining = Math.max(0, effectivePatience - elapsed)
    return Math.min(1, remaining / effectivePatience)
  }

  const isUrgent = timeRemaining <= 10 && effectiveStatus === 'playing'
  const priceCrashed = hasActiveBuff('PRICE_CRASH')
  const badReviewActive = hasActiveBuff('BAD_REVIEW')
  const badReviewSeconds = badReviewActive
    ? Math.max(0, Math.ceil(((activeBuffs.find(buff => buff.itemId === 'BAD_REVIEW')?.expiresAt ?? 0) - currentTime) / 1000))
    : 0
  // 말풍선에 보여 줄 판매가: 업그레이드 배율 + 가격 폭락(반토막)까지 반영
  const getDisplayPrice = (sellPrice: number) => {
    const base = Math.floor(sellPrice * upgrades.sellPriceMultiplier)
    return priceCrashed ? Math.floor(base * 0.5) : base
  }

  // 카운터 앞 손님들 (최대 5명)
  const customersInLine = customers.slice(0, MAX_CUSTOMERS_IN_LINE)

  return {
    // 카페 상태
    timeRemaining,
    cash,
    customersServed,
    unlockedMenus,
    menuStock,
    customers,
    customersInLine,
    activeBuffs,
    goldenSpatulaActive,
    effectiveStatus,
    currentTime,
    isUrgent,
    priceCrashed,
    badReviewActive,
    badReviewSeconds,
    // 화면 상태
    showQuiz,
    setShowQuiz,
    showWrong,
    revealedAnswer,
    showShop,
    setShowShop,
    servingAnimations,
    itemChoices,
    showItemModal,
    restockedMenuName,
    showGoldenEffect,
    notice,
    // 계산·핸들러
    getCustomerPatience,
    getDisplayPrice,
    handleCustomerClick,
    handleAnswerSubmit,
    handleItemSelect,
    closeQuizAndAdvance,
  }
}
