'use client'

import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CafeShop from '@/components/cafe/CafeShop'
import ItemChoiceModal from '@/components/cafe/ItemChoiceModal'
import { useCafeStore } from '@/store/cafeStore'
import {
  MENU_ITEMS,
  Customer,
  formatCafeMoney,
  formatCafeMoneyDelta,
  formatTime,
} from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import { CAFE_ITEMS, getRandomItemChoices, type CafeItem, type ItemId } from '@/lib/game/cafeItems'
import { X, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import QuizView from '@/components/QuizView'
import { useAudioContext } from '@/components/AudioProvider'
import type { Database } from '@/types/database.types'

type Player = Database['public']['Tables']['players']['Row']

type Question = {
  id: string
  type?: 'CHOICE' | 'SHORT' | 'OX' | 'BLANK'
  question_text: string
  options: string[]
  answer?: string
}

interface CafeViewProps {
  onGameEnd?: () => void
  roomCode?: string
  currentQuestion: Question | null
  onAnswer: (answer: string) => Promise<boolean>
  onNextQuestion: () => void
  players: Player[]
  currentPlayerId: string | null
  consecutiveCorrect: number
  onSendEvent: (type: 'cafe:item_attack', payload: unknown) => Promise<unknown> | void
  onScoreChange?: (totalCash: number) => void
  paused?: boolean
}

export default function CafeView({
  onGameEnd,
  currentQuestion,
  onAnswer,
  onNextQuestion,
  players,
  currentPlayerId,
  consecutiveCorrect,
  onSendEvent,
  onScoreChange,
  paused = false,
}: CafeViewProps) {
  const {
    status,
    timeRemaining,
    cash,
    totalCashEarned,
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
    applyBuff,
    activateGoldenSpatula,
    consumeGoldenSpatula,
    purchaseMenuFree,
  } = useCafeStore()

  const [showQuiz, setShowQuiz] = useState(false)
  const [showWrong, setShowWrong] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [servingAnimations, setServingAnimations] = useState<
    Array<{ id: string; x: number; y: number; amount: number; isGolden?: boolean }>
  >([])
  const [itemChoices, setItemChoices] = useState<CafeItem[]>([])
  const [showItemModal, setShowItemModal] = useState(false)
  const [restockedMenuName, setRestockedMenuName] = useState('')
  const [showGoldenEffect, setShowGoldenEffect] = useState(false)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const customerUpdateInterval = useRef<NodeJS.Timeout | null>(null)
  const timerInterval = useRef<NodeJS.Timeout | null>(null)
  const patienceUpdateInterval = useRef<NodeJS.Timeout | null>(null)

  const { playSFX } = useAudioContext()
  const effectiveStatus = paused ? 'paused' : status

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
          const topPlayer = players
            .filter(player => player.id !== currentPlayerId)
            .sort((a, b) => (b.score || 0) - (a.score || 0))[0]
          if (topPlayer) {
            const newMenu = MENU_ITEMS.find(menu => !unlockedMenus.includes(menu.id))
            if (newMenu) purchaseMenuFree(newMenu.id)
          }
          break
        }
      }
    }

    if (item.type === 'debuff' && targetPlayerId) {
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
    unlockedMenus,
  ])

  // 퀴즈 정답 제출
  const handleAnswerSubmit = async (answer: string) => {
    if (!answer) {
      // 시간 초과
      playSFX('incorrect')
      setShowWrong(true)
      setShowQuiz(false)
      setTimeout(() => {
        setShowWrong(false)
        onNextQuestion()
      }, 2000)
      return false
    }

    const correct = await onAnswer(answer)

    if (correct) {
      playSFX('correct')

      // 정답 시 랜덤 메뉴 재고충전
      const availableMenus = unlockedMenus
      if (availableMenus.length > 0) {
        const randomMenu = availableMenus[Math.floor(Math.random() * availableMenus.length)]
        restockMenu(randomMenu)
        setRestockedMenuName(MENU_ITEMS.find(menu => menu.id === randomMenu)?.name || randomMenu)
      }

      setItemChoices(getRandomItemChoices(consecutiveCorrect + 1))
      setShowItemModal(true)
    } else {
      playSFX('incorrect')
      setShowWrong(true)
      setShowQuiz(false)
      setTimeout(() => {
        setShowWrong(false)
        onNextQuestion()
      }, 2000)
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

      onScoreChange?.(totalCashEarned + finalEarned)

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

  // 카운터 앞 손님들 (최대 5명)
  const customersInLine = customers.slice(0, MAX_CUSTOMERS_IN_LINE)

  return (
    <div className="cafe-ambient relative w-full h-screen overflow-hidden">
      {/* 상단 정보 */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
              <span className="text-3xl">⏰</span>
              <span
                className={`text-3xl font-bold font-mono ${isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'
                  }`}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
              <span className="text-3xl">💰</span>
              <span className="text-3xl font-bold text-slate-700">{formatCafeMoney(cash)}</span>
            </div>
            <div className="flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
              <span className="text-2xl">👥</span>
              <span className="text-xl font-bold text-slate-700">{customersServed}명</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {activeBuffs.map(buff => {
                  const item = CAFE_ITEMS[buff.itemId]
                  const remaining = Math.max(0, Math.ceil((buff.expiresAt - currentTime) / 1000))
                  return (
                    <motion.div
                      key={buff.itemId}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-black ${
                        item.type === 'buff' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}
                    >
                      <span>{item.emoji}</span>
                      <span>{remaining}초</span>
                    </motion.div>
                  )
                })}
                {goldenSpatulaActive && (
                  <motion.div
                    key="golden-spatula"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-1 text-sm font-black text-amber-950"
                  >
                    🥄 3배
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <Button
            onClick={() => setShowShop(true)}
            className="bg-white text-amber-700 hover:bg-amber-50 font-bold text-lg px-6 py-3 shadow-xl border-4 border-amber-800"
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            상점
          </Button>
        </div>
      </div>

      {/* 오답 화면 */}
      {showWrong && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-24 left-0 right-0 bottom-0 z-30 flex items-center justify-center p-4"
        >
          <div className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center max-w-md">
            <div className="text-6xl mb-4">❌</div>
            <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다.</h2>
            <p className="text-gray-700">다른 문제로 넘어갑니다.</p>
          </div>
        </motion.div>
      )}

      {/* 카페 화면 */}
      <>
          {/* 손님 영역 - 카운터 위쪽에 줄지어 배치 */}
          <div className="absolute bottom-56 left-0 right-0 z-10">
            <div className="max-w-5xl mx-auto px-4">
              <div className="flex items-end justify-center gap-3 h-56">
                <AnimatePresence>
                  {customersInLine.map((customer, index) => {
                    const menu = MENU_ITEMS.find((m) => m.id === customer.order)
                    if (!menu) return null

                    const patience = getCustomerPatience(customer)
                    const isUrgentCustomer = patience < 0.3

                    return (
                      <motion.div
                        key={customer.id}
                        initial={{ opacity: 0, y: 100, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.5, x: 200 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        className="relative flex flex-col items-center cursor-pointer group"
                        onClick={(e) => handleCustomerClick(customer, e)}
                        style={{ order: index }}
                      >
                        {/* 손님 */}
                        <motion.div
                          animate={{
                            y: [0, -5, 0],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                          className={`mb-1.5 transition-all flex items-center justify-center ${isUrgentCustomer
                              ? 'animate-pulse scale-110'
                              : 'group-hover:scale-110'
                            }`}
                        >
                          <div className="relative w-[4.5rem] h-[4.5rem]">
                            <Image
                              src={customer.characterImage}
                              alt="손님"
                              width={72}
                              height={72}
                              unoptimized
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                // SVG 로드 실패 시 이모지로 대체
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = `<div class="text-5xl">${customer.emoji}</div>`
                                }
                              }}
                            />
                          </div>
                        </motion.div>

                        {/* 주문 말풍선 */}
                        <motion.div
                          whileHover={{ scale: 1.04 }}
                          className={`bg-white rounded-2xl px-4 py-3 shadow-xl border-4 min-w-[120px] transition-all ${isUrgentCustomer
                              ? 'border-red-500 bg-red-50 animate-pulse'
                              : 'border-amber-400 group-hover:border-amber-500'
                            }`}
                        >
                          <div className="text-center">
                            <div className="mb-1.5 flex items-center justify-center">
                              <Image
                                src={menu.image}
                                alt={menu.name}
                                width={56}
                                height={56}
                                unoptimized
                                className="w-14 h-14 object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  if (target.parentElement) {
                                    target.parentElement.innerHTML = `<div class="text-3xl">${menu.emoji}</div>`
                                  }
                                }}
                              />
                            </div>
                            <div className="text-sm font-bold text-gray-800 mb-1">{menu.name}</div>
                            <div className="text-xs font-semibold text-green-600">
                              {formatCafeMoneyDelta(Math.floor(menu.sellPrice * upgrades.sellPriceMultiplier))}
                            </div>
                          </div>
                        </motion.div>

                        {/* 인내심 게이지 */}
                        <div className="mt-2 w-28 h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-400">
                          <motion.div
                            initial={{ width: '100%' }}
                            animate={{
                              width: `${patience * 100}%`,
                              backgroundColor: patience > 0.5 ? '#10b981' : patience > 0.3 ? '#f59e0b' : '#ef4444',
                            }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full"
                          />
                        </div>
                        <div className="text-xs text-gray-600 mt-1 font-semibold">
                          {Math.ceil(patience * customer.patience)}초
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* 접시 영역 - 카운터 아래에 모든 메뉴 슬롯 표시 (그리드 형태) */}
          <div className="absolute bottom-24 left-0 right-0 z-15">
            <div className="max-w-5xl mx-auto px-4 pt-1">
              <div className="grid grid-cols-4 gap-x-2 gap-y-1.5 justify-items-center">
                {MENU_ITEMS.map((menu, index) => {
                  const isUnlocked = unlockedMenus.includes(menu.id)
                  const stock = menuStock[menu.id] || 0
                  const hasOrder = customers.some((c) => c.order === menu.id)

                  return (
                    <motion.div
                      key={menu.id}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative flex flex-col items-center"
                    >
                      {/* 접시 */}
                      <div
                        className={`relative w-14 h-14 rounded-full border-2 shadow-md transition-all ${isUnlocked
                            ? stock > 0
                              ? hasOrder
                                ? 'bg-green-100 border-green-400 scale-105'
                                : 'bg-white border-amber-300'
                              : 'bg-white border-amber-300 opacity-60'
                            : 'bg-gray-300 border-gray-500 opacity-40'
                          }`}
                      >
                        {/* 메뉴 이미지 (해금되고 재고가 있을 때만) */}
                        {isUnlocked && stock > 0 && (
                          <div className="absolute inset-0 flex items-center justify-center p-1.5">
                            <Image
                              src={menu.image}
                              alt={menu.name}
                              width={40}
                              height={40}
                              unoptimized
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = `<span class="text-2xl">${menu.emoji}</span>`
                                }
                              }}
                            />
                          </div>
                        )}

                        {/* 재고 수 (해금된 경우만) */}
                        {isUnlocked && (
                          <div
                            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${stock > 0
                                ? 'bg-blue-500 text-white border-blue-600'
                                : 'bg-gray-500 text-white border-gray-600'
                              }`}
                          >
                            {stock}
                          </div>
                        )}

                        {/* 주문 요청 표시 */}
                        {hasOrder && isUnlocked && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border border-yellow-600"
                          >
                            <span className="text-[10px]">⚡</span>
                          </motion.div>
                        )}
                      </div>

                      {/* 메뉴 이름 (해금된 경우만) */}
                      {isUnlocked && (
                        <div className="mt-1 text-[10px] font-bold text-gray-700 text-center max-w-[56px] truncate">
                          {menu.name}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 음식 채우기 버튼 및 안내 */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
            <div className="max-w-7xl mx-auto flex flex-col items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowQuiz(true)}
                className="h-auto min-h-0 min-w-[300px] items-center justify-between gap-3 border-2 border-[#3A9BDC] bg-[#88D1E7] px-10 py-1.5 text-sm font-bold text-[#1a5f8f] shadow-[0_3px_0_#3A9BDC] hover:border-[#3A9BDC] hover:bg-[#7ec8e0] hover:text-[#1a5f8f] hover:shadow-[0_2px_0_#3A9BDC] active:translate-y-0.5 active:shadow-none"
                style={{
                  backgroundImage: 'linear-gradient(180deg, #D9F2F9 0%, #88D1E7 52%, #7ec5e8 100%)',
                }}
              >
                <span>🍽️ 음식 채우기</span>
                <span className="mr-3 text-xs font-semibold text-[#1a5f8f]/85">스페이스바</span>
              </Button>
              <div className="mt-3 text-center text-sm font-bold text-slate-700 drop-shadow-sm">
                손님을 클릭하여 주문한 메뉴를 서빙하세요! 재고가 없으면 음식 채우기 버튼을 눌러주세요.
              </div>
            </div>
          </div>
        </>

      <AnimatePresence>
        {showQuiz && currentQuestion && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            {consecutiveCorrect >= 2 && (
              <motion.div
                key={consecutiveCorrect}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg"
              >
                🔥 {consecutiveCorrect}연속 정답! 희귀 아이템이 더 잘 나와요
              </motion.div>
            )}

            <div className="w-full max-w-3xl">
              {showItemModal ? (
                <ItemChoiceModal
                  items={itemChoices}
                  restockedMenuName={restockedMenuName}
                  consecutiveCorrect={consecutiveCorrect + 1}
                  players={players}
                  currentPlayerId={currentPlayerId}
                  onSelect={handleItemSelect}
                  onSkip={closeQuizAndAdvance}
                />
              ) : (
                <QuizView
                  question={currentQuestion}
                  onAnswer={handleAnswerSubmit}
                  onCorrectClick={() => undefined}
                  timeLimit={30}
                  paused={paused}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 돈 획득 애니메이션 */}
      <AnimatePresence>
        {servingAnimations.map((anim) => (
          <motion.div
            key={anim.id}
            initial={{ opacity: 1, x: anim.x, y: anim.y, scale: 1 }}
            animate={{ opacity: 0, y: anim.y - 100, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="fixed pointer-events-none z-50"
            style={{ left: anim.x, top: anim.y }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`text-4xl font-bold drop-shadow-2xl ${anim.isGolden ? 'text-amber-300' : 'text-green-400'}`}
              style={{ textShadow: anim.isGolden ? '0 0 14px rgba(251, 191, 36, 0.9)' : '0 0 10px rgba(34, 197, 94, 0.8)' }}
            >
              {formatCafeMoneyDelta(anim.amount)}
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {showGoldenEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-amber-300/15"
          >
            <div className="rounded-lg bg-amber-400 px-8 py-5 text-3xl font-black text-amber-950 shadow-2xl">
              🥄 황금 주걱 3배 수익!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 상점 모달 */}
      <AnimatePresence>
        {showShop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowShop(false)}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[80vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border-4 border-amber-300 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingCart className="h-8 w-8 text-amber-600" />
                  상점
                </h2>
                <button
                  onClick={() => setShowShop(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <CafeShop />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
