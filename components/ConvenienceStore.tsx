'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, Zap, Store, Sparkles, PackagePlus, Replace, TrendingUp } from 'lucide-react'
import type { Product, Customer, StoreEvent, ProductCategory } from '@/lib/game/convenienceStore'
import {
  generateProductOptions,
  calculateTotalCPS,
  sellProduct,
  generateCustomer,
  checkEvent,
  getTierColor,
  getUpgradeCost,
  upgradeProduct,
  calculateProductIncome,
  getCategorySynergy,
  getCategoryEmoji,
  formatMoney,
  roundMoney,
  GRID_SIZE,
} from '@/lib/game/convenienceStore'

interface ConvenienceStoreProps {
  money: number
  onMoneyChange: (newMoney: number) => void
  products: Product[]
  onProductsChange: (newProducts: Product[]) => void
  onQuizStart: () => void
  canInteract: boolean
  quizCorrect?: boolean // 퀴즈 정답 여부
  onProductSelected?: () => void // 상품 선택 완료 콜백
  showOrderModal?: boolean // 정답 3개마다 부모에서 열어주는 발주 모달
  answerSpeed?: 'fast' | 'normal' | 'slow' // 정답 속도 (가챠 등급 보정용)
}

export default function ConvenienceStore({
  money,
  onMoneyChange,
  products,
  onProductsChange,
  onQuizStart,
  canInteract,
  quizCorrect = false,
  onProductSelected,
  showOrderModal = false,
  answerSpeed = 'normal',
}: ConvenienceStoreProps) {
  const [cps, setCps] = useState(0)
  const [gameState, setGameState] = useState<'idle' | 'quiz' | 'selection'>('idle')
  const [selectionOptions, setSelectionOptions] = useState<Product[]>([])
  const [lastTick, setLastTick] = useState(Date.now())
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [currentEvent, setCurrentEvent] = useState<StoreEvent | null>(null)
  const [eventTimeLeft, setEventTimeLeft] = useState(0)
  const [selectedProductToSell, setSelectedProductToSell] = useState<Product | null>(null)
  const [pendingProductToPlace, setPendingProductToPlace] = useState<Product | null>(null)

  // CPS 계산
  useEffect(() => {
    const totalCPS = calculateTotalCPS(products)
    let multiplier = 1.0

    // 이벤트 배율 적용
    if (currentEvent) {
      multiplier *= currentEvent.multiplier
    }

    // 고객 보너스 적용 (일시적)
    if (currentCustomer) {
      multiplier *= currentCustomer.bonusMultiplier
    }

    setCps(roundMoney(totalCPS * multiplier))
  }, [products, currentEvent, currentCustomer])

  // 자동 수익 루프
  useEffect(() => {
    if (cps === 0) return
    const interval = setInterval(() => {
      onMoneyChange(roundMoney(money + cps))
      setLastTick(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [cps, money, onMoneyChange])

  // 고객 방문 시스템 (30초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const customer = generateCustomer()
      if (customer) {
        setCurrentCustomer(customer)
        setTimeout(() => setCurrentCustomer(null), 5000) // 5초간 보너스
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // 이벤트 시스템 (60초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      const event = checkEvent()
      if (event) {
        setCurrentEvent(event)
        setEventTimeLeft(event.duration)

        const countdown = setInterval(() => {
          setEventTimeLeft((prev) => {
            if (prev <= 1) {
              setCurrentEvent(null)
              clearInterval(countdown)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // 퀴즈 시작
  const handleQuizStart = () => {
    if (!canInteract || gameState !== 'idle') return
    setGameState('quiz')
    onQuizStart()
  }

  // 퀴즈 정답 시 상품 선택 모달 표시 (기존: 발주 버튼 → 퀴즈 → 정답 시)
  useEffect(() => {
    if (quizCorrect && gameState === 'quiz') {
      const options = generateProductOptions(answerSpeed, products.length >= GRID_SIZE)
      setSelectionOptions(options)
      setGameState('selection')
    }
  }, [quizCorrect, gameState, answerSpeed, products.length])

  // 부모에서 정답 3개마다 열어주는 발주 모달
  useEffect(() => {
    if (showOrderModal) {
      setSelectionOptions(generateProductOptions(answerSpeed, products.length >= GRID_SIZE))
      setGameState('selection')
    }
  }, [showOrderModal, answerSpeed, products.length])

  useEffect(() => {
    if (!showOrderModal && gameState === 'selection') {
      setGameState('idle')
    }
  }, [showOrderModal, gameState])

  // 상품 배치
  const handlePlaceProduct = (product: Product) => {
    if (products.length >= GRID_SIZE) {
      setPendingProductToPlace(product)
      setGameState('idle')
      return
    }

    const newProducts = [...products, product]
    onProductsChange(newProducts)
    setGameState('idle')
    if (onProductSelected) onProductSelected()
  }

  const handleReplaceProduct = (slotIndex: number) => {
    if (!pendingProductToPlace) return

    const newProducts = [...products]
    newProducts[slotIndex] = pendingProductToPlace
    onProductsChange(newProducts)
    setPendingProductToPlace(null)
    if (onProductSelected) onProductSelected()
  }

  const handleSkipPendingProduct = () => {
    setPendingProductToPlace(null)
    if (onProductSelected) onProductSelected()
  }

  // 상품 판매
  const handleSellProduct = (product: Product) => {
    const result = sellProduct(product, products)
    if (result.success) {
      onMoneyChange(roundMoney(money + result.money))
      onProductsChange(result.newProducts)
      setSelectedProductToSell(null)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 rounded-[28px] bg-gradient-to-br from-emerald-50 via-white to-amber-50 font-sans text-slate-800 border border-white/80 shadow-2xl" style={{ fontFamily: 'BMJUA, sans-serif' }}>
      {/* HUD (정보창) */}
      <header className="flex flex-wrap justify-between items-center gap-3 bg-white/90 p-4 rounded-2xl shadow-md border-b-4 border-emerald-200 mb-4 sticky top-4 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-100 p-2 rounded-full">
            <Coins className="text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">총 매출</p>
            <motion.p
              key={money}
              initial={{ scale: 1.2, color: '#16a34a' }}
              animate={{ scale: 1, color: '#1e293b' }}
              className="text-2xl font-black"
            >
              {formatMoney(money)}
            </motion.p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-green-100 p-2 rounded-full">
            <Zap className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">초당 수익 (CPS)</p>
            <p className="text-xl font-bold text-slate-800">
              +{formatMoney(cps)} /초
            </p>
          </div>
        </div>

        {/* 고객 보너스 표시 */}
        {currentCustomer && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-purple-100 p-2 rounded-full flex items-center gap-2"
          >
            <span className="text-2xl">{currentCustomer.emoji}</span>
            <div>
              <p className="text-xs text-purple-600 font-bold">{currentCustomer.name}</p>
              <p className="text-sm font-bold text-purple-800">
                {currentCustomer.bonusMultiplier}x 보너스!
              </p>
            </div>
          </motion.div>
        )}

        {/* 이벤트 표시 */}
        {currentEvent && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-yellow-100 p-2 rounded-full flex items-center gap-2 border-2 border-yellow-400"
          >
            <span className="text-2xl">{currentEvent.emoji}</span>
            <div>
              <p className="text-xs text-yellow-600 font-bold">{currentEvent.name}</p>
              <p className="text-sm font-bold text-yellow-800">
                {eventTimeLeft}초 남음
              </p>
            </div>
          </motion.div>
        )}
      </header>

      {pendingProductToPlace && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 shadow-md"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Replace className="text-amber-600" />
              <div>
                <p className="font-black text-amber-900">
                  매대가 꽉 찼습니다. 교체할 상품을 고르세요.
                </p>
                <p className="text-xs text-amber-700">
                  새 상품: {pendingProductToPlace.name} · +{formatMoney(pendingProductToPlace.income)}/초
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSkipPendingProduct}
              className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-amber-700 shadow-sm hover:bg-amber-100"
            >
              건너뛰기
            </button>
          </div>
        </motion.div>
      )}

      {/* 메인 게임 영역 */}
      <div className="flex flex-col md:flex-row gap-5 min-h-[600px]">
        {/* 왼쪽: 컨트롤 패널 */}
        <div className="md:w-1/3 flex flex-col gap-4">
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleQuizStart}
            disabled={!canInteract || gameState !== 'idle'}
            className={`flex-1 min-h-36 rounded-3xl shadow-lg border-b-8 flex flex-col items-center justify-center gap-3 transition-colors text-white font-black text-2xl
              ${canInteract && gameState === 'idle'
                ? 'bg-emerald-500 border-emerald-700 hover:bg-emerald-400'
                : 'bg-slate-400 border-slate-500 cursor-not-allowed'
              }
            `}
          >
            <PackagePlus size={48} className="mb-2" />
            <span>발주 넣기</span>
            <span className="text-sm font-normal opacity-80">(퀴즈 풀고 상품 받기)</span>
          </motion.button>

          <div className="bg-white/95 p-4 rounded-2xl border-2 border-emerald-100 flex-1 shadow-sm">
            <h3 className="font-bold text-slate-500 mb-2 flex items-center gap-2">
              <Store size={18} /> 편의점 현황
            </h3>
            <ul className="text-sm space-y-2">
              <li className="flex justify-between">
                <span>진열 상품 수</span>
                <span className="font-bold">
                  {products.length} / {GRID_SIZE}
                </span>
              </li>
              <li className="flex justify-between text-amber-600">
                <span>전설 아이템</span>
                <span className="font-bold">
                  {products.filter((i) => i?.tier === '전설').length}개
                </span>
              </li>
              <li className="flex justify-between text-purple-600">
                <span>영웅 아이템</span>
                <span className="font-bold">
                  {products.filter((i) => i?.tier === '영웅').length}개
                </span>
              </li>
            </ul>

            <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                <TrendingUp size={14} /> 운영 팁
              </div>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                먼저 10칸을 채운 뒤, 낮은 수익 상품을 높은 등급 상품으로 교체하면 매출이 크게 뜁니다.
              </p>
            </div>

            {/* 시너지 표시 */}
            <div className="mt-3 pt-3 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 mb-2">📊 카테고리 시너지</h4>
              <div className="space-y-1">
                {(['음료', '식품', '간식', '프리미엄'] as ProductCategory[]).map(category => {
                  const count = products.filter(p => p.category === category).length
                  if (count === 0) return null
                  const synergy = getCategorySynergy(category, products)
                  return (
                    <div key={category} className="flex justify-between text-xs">
                      <span>{getCategoryEmoji(category)} {category}</span>
                      <span className="font-bold text-blue-600">
                        {count}개 × {synergy.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 진열대 (Grid) */}
        <div className="md:w-2/3 bg-gradient-to-b from-white to-slate-50 rounded-3xl border-4 border-emerald-200 p-5 shadow-inner relative">
          <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2">
            🏪 나의 편의점 생산 라인
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array(GRID_SIZE)
              .fill(null)
              .map((_, idx) => {
                const slot = products[idx] || null
                return (
                  <div
                    key={idx}
                    onClick={() => handleReplaceProduct(idx)}
                    className={`relative aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition
                      ${pendingProductToPlace
                        ? 'cursor-pointer border-amber-400 bg-amber-50 ring-2 ring-amber-200 hover:scale-[1.02]'
                        : 'border-slate-300 bg-slate-100'
                      }`}
                  >
                    {slot ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`w-full h-full p-2 flex flex-col items-center justify-between rounded-lg border-2 ${slot.color} ${slot.borderColor} relative group`}
                      >
                        {/* 등급 뱃지 */}
                        <span
                          className={`absolute top-1 left-1 text-[10px] px-1.5 rounded-full text-white font-bold shadow-sm ${getTierColor(
                            slot.tier
                          )}`}
                        >
                          {slot.tier}
                        </span>

                        {/* 레벨 표시 */}
                        {(slot.level || 1) > 1 && (
                          <span className="absolute top-1 right-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-white font-bold shadow-sm">
                            Lv.{slot.level}
                          </span>
                        )}

                        <div className="flex-1 flex items-center justify-center text-4xl filter drop-shadow-md">
                          {slot.image ? (
                            <Image
                              src={slot.image}
                              alt={slot.name}
                              width={64}
                              height={64}
                              unoptimized
                              className="pixelated w-16 h-16 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = `<span class="text-4xl">${slot.emoji}</span>`
                                }
                              }}
                            />
                          ) : (
                            slot.emoji
                          )}
                        </div>

                        <div className="w-full bg-white/60 backdrop-blur-sm rounded-md py-1 text-center">
                          <p className="text-[10px] text-slate-500 line-clamp-1">
                            {slot.name}
                          </p>
                          <p className="text-xs font-bold">
                            +{formatMoney(calculateProductIncome(slot, products))}/s
                          </p>
                        </div>

                        {/* 수익 발생 이펙트 */}
                        <motion.div
                          key={lastTick}
                          initial={{ opacity: 0, y: 0 }}
                          animate={{ opacity: [0, 1, 0], y: -20 }}
                          transition={{ duration: 0.8 }}
                          className="absolute top-0 right-0 text-green-600 font-bold text-xs pointer-events-none"
                        >
                          +{formatMoney(calculateProductIncome(slot, products))}
                        </motion.div>

                        {/* 업그레이드/판매 버튼 (호버 시) */}
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          {(slot.level || 1) < 5 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const cost = getUpgradeCost(slot)
                                if (money >= cost) {
                                  const result = upgradeProduct(slot, products)
                                  if (result.success) {
                                    onProductsChange(result.newProducts)
                                    onMoneyChange(roundMoney(money - result.cost))
                                  }
                                }
                              }}
                              className={`text-white text-[10px] font-bold px-2 py-1 rounded w-full ${money >= getUpgradeCost(slot)
                                ? 'bg-blue-500 hover:bg-blue-600'
                                : 'bg-gray-500 cursor-not-allowed'
                                }`}
                            >
                              ⬆ {formatMoney(getUpgradeCost(slot))}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedProductToSell(slot)
                            }}
                            className="text-white text-[10px] font-bold bg-red-500 hover:bg-red-600 px-2 py-1 rounded w-full"
                          >
                            판매: {formatMoney(slot.sellPrice || slot.income * 10)}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <span className="text-slate-300 text-xs">
                        {pendingProductToPlace ? '여기로 교체' : '빈 매대'}
                      </span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {/* 모달 시스템 */}
      <AnimatePresence>
        {/* 상품 선택 모달 */}
        {gameState === 'selection' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 max-w-4xl w-full text-center shadow-2xl border-4 border-purple-500"
            >
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-800 flex items-center justify-center gap-2">
                  <Sparkles className="text-yellow-500" /> 상품 도착! 하나를 고르세요
                </h2>
                <p className="text-slate-500">
                  {products.length >= GRID_SIZE
                    ? '10칸이 꽉 찼습니다. 좋은 상품을 고른 뒤 교체할 매대를 선택하세요.'
                    : '높은 등급일수록 더 많은 돈을 법니다. 같은 카테고리끼리 시너지 효과!'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {selectionOptions.map((item, idx) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -10 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePlaceProduct(item)}
                    className={`relative p-6 rounded-2xl border-4 ${item.color} ${item.borderColor} flex flex-col items-center gap-3 shadow-lg group overflow-hidden`}
                  >
                    {/* 전설/영웅 후광 효과 */}
                    {(item.tier === '전설' || item.tier === '영웅') && (
                      <div className="absolute inset-0 bg-white/30 animate-pulse pointer-events-none"></div>
                    )}

                    <div
                      className={`text-sm font-bold px-3 py-1 bg-white/50 rounded-full mb-2 ${getTierColor(
                        item.tier
                      )} text-white`}
                    >
                      {item.tier}
                    </div>

                    {/* 카테고리 표시 */}
                    <div className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">
                      {getCategoryEmoji(item.category)} {item.category}
                    </div>

                    <div className="text-7xl drop-shadow-md group-hover:scale-110 transition-transform duration-300">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          width={96}
                          height={96}
                          unoptimized
                          className="pixelated w-24 h-24 object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            if (target.parentElement) {
                              target.parentElement.innerHTML = `<span class="text-7xl">${item.emoji}</span>`
                            }
                          }}
                        />
                      ) : (
                        item.emoji
                      )}
                    </div>
                    <div className="text-xl font-bold text-slate-800">{item.name}</div>
                    <div className="font-mono text-lg font-bold text-slate-600 bg-white/60 px-4 py-1 rounded-lg">
                      +{formatMoney(item.income)}/초
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 판매 확인 모달 */}
        {selectedProductToSell && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedProductToSell(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-md w-full"
            >
              <div className="text-center mb-4">
                <div className="text-6xl mb-2 flex justify-center">
                  {selectedProductToSell.image ? (
                    <Image
                      src={selectedProductToSell.image}
                      alt={selectedProductToSell.name}
                      width={96}
                      height={96}
                      unoptimized
                      className="pixelated w-24 h-24 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        if (target.parentElement) {
                          target.parentElement.innerHTML = `<span class="text-6xl">${selectedProductToSell.emoji}</span>`
                        }
                      }}
                    />
                  ) : (
                    selectedProductToSell.emoji
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-2">{selectedProductToSell.name}</h3>
                <p className="text-gray-600">
                  판매 가격: {formatMoney(selectedProductToSell.sellPrice || selectedProductToSell.income * 10)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedProductToSell(null)}
                  className="flex-1 py-3 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSellProduct(selectedProductToSell)}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600"
                >
                  판매하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
