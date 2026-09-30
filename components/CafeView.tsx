'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CafeShop from '@/components/cafe/CafeShop'
import ItemChoiceModal from '@/components/cafe/ItemChoiceModal'
import CafeImage from '@/components/cafe/CafeImage'
import { useCafeStore } from '@/store/cafeStore'
import {
  MENU_ITEMS,
  CUSTOMER_FALLBACK_EMOJI,
  Customer,
  formatCafeMoney,
  formatCafeMoneyDelta,
  formatTime,
  pickCopyCatMenu,
} from '@/lib/game/cafe'
import { MAX_CUSTOMERS_IN_LINE } from '@/lib/game/cafeConfig'
import { CAFE_ITEMS, GOLDEN_SPATULA_MULTIPLIER, getRandomItemChoices, type CafeItem, type ItemId } from '@/lib/game/cafeItems'
import { X, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import QuizView from '@/components/QuizView'
import AnswerReveal from '@/components/AnswerReveal'
import { useRevealedAnswer } from '@/hooks/useRevealedAnswer'
import { useAudioContext } from '@/components/AudioProvider'
import type { Database } from '@/types/database.types'
import PixelIcon from '@/components/ui/PixelIcon'
import QuizSetName from '@/components/game/QuizSetName'

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
  questionSetTitle?: string | null
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
  paused = false,
  questionSetTitle,
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

  return (
    <div className="cafe-ambient relative w-full h-dvh overflow-hidden">
      {/* 상단 정보 */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        {/* 폰: 칩 4개 + 상점 버튼이 360px를 넘어 상점 버튼이 화면 밖으로 밀리던 문제 → 칩 축소, 손님 수 칩은 sm부터 */}
        <div className="max-w-7xl mx-auto px-2 py-2 sm:px-4 sm:py-4 flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-1.5 sm:gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-2 py-1 sm:px-4 sm:py-2 border-2 border-white/30">
              <PixelIcon name="time" size={24} alt="" className="sm:hidden" />
              <PixelIcon name="time" size={36} alt="" className="hidden sm:inline-block" />
              <span
                className={`text-lg sm:text-3xl font-bold font-mono whitespace-nowrap ${isUrgent ? 'text-red-600 animate-pulse' : 'text-slate-700'
                  }`}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-2 py-1 sm:px-4 sm:py-2 border-2 border-white/30">
              <PixelIcon name="gold" size={22} alt="" className="sm:hidden" />
              <PixelIcon name="gold" size={32} alt="" className="hidden sm:inline-block" />
              <span className="text-lg sm:text-3xl font-bold text-slate-700 whitespace-nowrap">{formatCafeMoney(cash)}</span>
            </div>
            <QuizSetName title={questionSetTitle} className="hidden lg:flex" />
            <div className="hidden sm:flex items-center gap-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border-2 border-white/30">
              <PixelIcon name="people" size={28} alt="" />
              <span className="text-xl font-bold text-slate-700 whitespace-nowrap">{customersServed}명</span>
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
                      <CafeImage
                        src={item.image}
                        alt={item.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 object-contain"
                        fallbackEmoji={item.emoji}
                        fallbackClassName="h-5 w-5 text-sm"
                      />
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
                    <CafeImage
                      src={CAFE_ITEMS.GOLDEN_SPATULA.image}
                      alt={CAFE_ITEMS.GOLDEN_SPATULA.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain"
                      fallbackEmoji={CAFE_ITEMS.GOLDEN_SPATULA.emoji}
                      fallbackClassName="h-5 w-5 text-sm"
                    />
                    {GOLDEN_SPATULA_MULTIPLIER}배
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <Button
            onClick={() => setShowShop(true)}
            className="shrink-0 bg-white text-amber-700 hover:bg-amber-50 font-bold text-sm sm:text-lg px-3 py-2 sm:px-6 sm:py-3 shadow-xl border-4 border-amber-800"
          >
            <ShoppingCart className="mr-1.5 sm:mr-2 h-5 w-5" />
            상점
          </Button>
        </div>
      </div>

      {/* 아이템 결과 안내 — 가운데 정렬은 바깥 div (motion의 y 애니메이션이 -translate-x-1/2를 덮어써서 오른쪽으로 밀렸다) */}
      <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4">
        <AnimatePresence>
          {notice && (
            <motion.div
              key={notice.id}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <div className={`rounded-xl border-4 px-5 py-2 text-center text-base font-black shadow-xl sm:text-lg ${
                notice.tone === 'good' ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700'
              }`}>
                {notice.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 오답 화면 */}
      {showWrong && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-24 left-0 right-0 bottom-0 z-30 flex items-center justify-center p-4"
        >
          <div className="bg-red-100 border-4 border-red-500 rounded-xl p-8 shadow-lg text-center max-w-md">
            <div className="mb-4 flex justify-center">
              <PixelIcon name="wrong" size={96} />
            </div>
            <h2 className="text-4xl font-bold text-red-600 mb-2">틀렸습니다.</h2>
            <AnswerReveal answer={revealedAnswer} />
            <p className="text-gray-700">다른 문제로 넘어갑니다.</p>
          </div>
        </motion.div>
      )}

      {/* 카페 화면 */}
      <>
          {/* 손님 영역 - 카운터 위쪽에 줄지어 배치 */}
          {/* 폰: 손님 5명 말풍선이 화면보다 넓어 잘리던 것 → 가로 스크롤. 가로 폰(높이≤500)은 줄 높이를 줄여 HUD·매대와 겹치지 않게 */}
          <div className="absolute bottom-56 [@media(max-height:500px)]:bottom-32 left-0 right-0 z-10">
            <div className="max-w-5xl mx-auto px-2 sm:px-4 overflow-x-auto overscroll-x-contain">
              <div className="relative flex items-end justify-center gap-2 sm:gap-3 h-56 [@media(max-height:500px)]:h-32 w-max min-w-full mx-auto">
                {badReviewActive && customersInLine.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 flex flex-col items-center gap-1 rounded-2xl border-4 border-rose-400 bg-white/95 px-5 py-3 text-center shadow-xl"
                  >
                    <span className="text-lg font-black text-rose-600">악성 리뷰 때문에 손님이 안 와요</span>
                    <span className="text-sm font-bold text-slate-600">{badReviewSeconds}초 뒤 다시 손님이 와요</span>
                  </motion.div>
                )}
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
                          <div className="relative w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] [@media(max-height:500px)]:w-10 [@media(max-height:500px)]:h-10">
                            <CafeImage
                              src={customer.characterImage}
                              alt="손님"
                              width={72}
                              height={72}
                              className="w-full h-full object-contain"
                              fallbackEmoji={CUSTOMER_FALLBACK_EMOJI}
                              fallbackClassName="w-full h-full text-5xl"
                            />
                          </div>
                        </motion.div>

                        {/* 주문 말풍선 */}
                        <motion.div
                          whileHover={{ scale: 1.04 }}
                          className={`bg-white rounded-2xl px-2 py-2 sm:px-4 sm:py-3 shadow-xl border-4 min-w-[92px] sm:min-w-[120px] [@media(max-height:500px)]:py-1 transition-all ${isUrgentCustomer
                              ? 'border-red-500 bg-red-50 animate-pulse'
                              : 'border-amber-400 group-hover:border-amber-500'
                            }`}
                        >
                          <div className="text-center">
                            <div className="mb-1.5 flex items-center justify-center">
                              <CafeImage
                                src={menu.image}
                                alt={menu.name}
                                width={56}
                                height={56}
                                className="w-10 h-10 sm:w-14 sm:h-14 [@media(max-height:500px)]:w-7 [@media(max-height:500px)]:h-7 object-contain"
                                fallbackEmoji={menu.emoji}
                                fallbackClassName="text-3xl"
                              />
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-gray-800 mb-0.5 sm:mb-1 whitespace-nowrap">{menu.name}</div>
                            <div className={`text-xs font-semibold ${priceCrashed ? 'text-rose-600' : 'text-green-600'}`}>
                              {formatCafeMoneyDelta(getDisplayPrice(menu.sellPrice))}
                            </div>
                          </div>
                        </motion.div>

                        {/* 인내심 게이지 */}
                        <div className="mt-1.5 sm:mt-2 w-20 sm:w-28 h-2 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-400">
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
          <div className="absolute bottom-24 [@media(max-height:500px)]:bottom-10 left-0 right-0 z-15">
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
                            <CafeImage
                              src={menu.image}
                              alt={menu.name}
                              width={40}
                              height={40}
                              className="w-full h-full object-contain"
                              fallbackEmoji={menu.emoji}
                              fallbackClassName="text-2xl"
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
          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 [@media(max-height:500px)]:pb-1">
            <div className="max-w-7xl mx-auto flex flex-col items-center gap-3 [@media(max-height:500px)]:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowQuiz(true)}
                className="h-auto min-h-0 min-w-[300px] items-center justify-between gap-3 border-2 border-[#3A9BDC] bg-[#88D1E7] px-10 py-1.5 text-sm font-bold text-[#1a5f8f] shadow-[0_3px_0_#3A9BDC] hover:border-[#3A9BDC] hover:bg-[#7ec8e0] hover:text-[#1a5f8f] hover:shadow-[0_2px_0_#3A9BDC] active:translate-y-0.5 active:shadow-none"
                style={{
                  backgroundImage: 'linear-gradient(180deg, #D9F2F9 0%, #88D1E7 52%, #7ec5e8 100%)',
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <PixelIcon name="dish" size={22} alt="" />
                  음식 채우기
                </span>
                <span className="mr-3 text-xs font-semibold text-[#1a5f8f]/85">스페이스바</span>
              </Button>
              <div className="mt-3 text-center text-xs sm:text-sm font-bold text-slate-700 drop-shadow-sm [@media(max-height:500px)]:hidden">
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
            className="absolute inset-0 z-40 flex items-center justify-center p-4 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            {consecutiveCorrect >= 2 && (
              <motion.div
                key={consecutiveCorrect}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg"
              >
                <PixelIcon name="streak" size={18} alt="" />
                {consecutiveCorrect}연속 정답! 희귀 아이템이 더 잘 나와요
              </motion.div>
            )}

            <div className="w-full max-w-3xl my-auto">
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
                  variant="glass"
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
              <span className="inline-flex items-center gap-2">
                <CafeImage
                  src={CAFE_ITEMS.GOLDEN_SPATULA.image}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  fallbackEmoji={CAFE_ITEMS.GOLDEN_SPATULA.emoji}
                  fallbackClassName="h-10 w-10 text-3xl"
                />
                {CAFE_ITEMS.GOLDEN_SPATULA.name} {GOLDEN_SPATULA_MULTIPLIER}배 수익!
              </span>
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
