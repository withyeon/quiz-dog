'use client'

import CafeHud from '@/components/cafe/CafeHud'
import CafeNotice from '@/components/cafe/CafeNotice'
import CafeWrongPanel from '@/components/cafe/CafeWrongPanel'
import CustomerLine from '@/components/cafe/CustomerLine'
import MenuShelf from '@/components/cafe/MenuShelf'
import FillFoodBar from '@/components/cafe/FillFoodBar'
import CafeQuizOverlay from '@/components/cafe/CafeQuizOverlay'
import ServingMoneyFloats from '@/components/cafe/ServingMoneyFloats'
import GoldenSpatulaFlash from '@/components/cafe/GoldenSpatulaFlash'
import CafeShopModal from '@/components/cafe/CafeShopModal'
import { useCafeView, type CafeViewProps } from '@/hooks/useCafeView'

/**
 * 달콤 바삭 카페 플레이 화면. 규칙·상태는 useCafeView 훅이 맡고,
 * 여기서는 상단 정보 줄·손님 줄·메뉴 접시·퀴즈·상점을 겹겹이 배치만 한다.
 */
export default function CafeView(props: CafeViewProps) {
  const { currentQuestion, players, currentPlayerId, consecutiveCorrect, paused = false, questionSetTitle } = props
  const {
    timeRemaining,
    cash,
    customersServed,
    unlockedMenus,
    menuStock,
    customers,
    customersInLine,
    activeBuffs,
    goldenSpatulaActive,
    currentTime,
    isUrgent,
    priceCrashed,
    badReviewActive,
    badReviewSeconds,
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
    getCustomerPatience,
    getDisplayPrice,
    handleCustomerClick,
    handleAnswerSubmit,
    handleItemSelect,
    closeQuizAndAdvance,
  } = useCafeView(props)

  return (
    <div className="cafe-ambient relative w-full h-dvh overflow-hidden">
      <CafeHud
        timeRemaining={timeRemaining}
        isUrgent={isUrgent}
        cash={cash}
        customersServed={customersServed}
        questionSetTitle={questionSetTitle}
        activeBuffs={activeBuffs}
        goldenSpatulaActive={goldenSpatulaActive}
        currentTime={currentTime}
        onOpenShop={() => setShowShop(true)}
      />

      <CafeNotice notice={notice} />

      {showWrong && <CafeWrongPanel revealedAnswer={revealedAnswer} />}

      {/* 카페 화면 */}
      <CustomerLine
        customersInLine={customersInLine}
        badReviewActive={badReviewActive}
        badReviewSeconds={badReviewSeconds}
        priceCrashed={priceCrashed}
        getCustomerPatience={getCustomerPatience}
        getDisplayPrice={getDisplayPrice}
        onCustomerClick={handleCustomerClick}
      />
      <MenuShelf unlockedMenus={unlockedMenus} menuStock={menuStock} customers={customers} />
      <FillFoodBar onFill={() => setShowQuiz(true)} />

      <CafeQuizOverlay
        open={showQuiz}
        question={currentQuestion}
        consecutiveCorrect={consecutiveCorrect}
        showItemModal={showItemModal}
        itemChoices={itemChoices}
        restockedMenuName={restockedMenuName}
        players={players}
        currentPlayerId={currentPlayerId}
        paused={paused}
        onAnswer={handleAnswerSubmit}
        onItemSelect={handleItemSelect}
        onSkip={closeQuizAndAdvance}
      />

      <ServingMoneyFloats animations={servingAnimations} />
      <GoldenSpatulaFlash show={showGoldenEffect} />
      <CafeShopModal open={showShop} onClose={() => setShowShop(false)} />
    </div>
  )
}
